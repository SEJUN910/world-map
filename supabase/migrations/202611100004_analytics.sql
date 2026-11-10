-- Anonymous, first-party usage counters. No raw IP, full URL, query, UA or
-- Supabase visitor/account identity is stored in analytics.
create table public.analytics_settings (
  id boolean primary key default true check (id),
  write_key_hash text not null check (write_key_hash ~ '^[a-f0-9]{64}$')
);
create table public.analytics_hits (
  id uuid primary key,
  occurred_at timestamptz not null default now(),
  kind text not null check (kind in ('page_view', 'event_view')),
  event_id uuid references public.events(id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  session_hash text not null check (session_hash ~ '^[a-f0-9]{64}$'),
  path text not null check (path in ('/', '/korea', '/taiwan', '/regions')),
  country_code text check (country_code in ('kr', 'tw')),
  locale text not null check (locale in ('ko', 'en', 'zh-TW')),
  referrer_host text not null default '' check (char_length(referrer_host) <= 253),
  check ((kind = 'event_view' and event_id is not null) or (kind = 'page_view' and event_id is null))
);
create index analytics_hits_time_idx on public.analytics_hits(occurred_at);
create index analytics_hits_event_idx on public.analytics_hits(event_id, occurred_at) where event_id is not null;
-- Reopening an event in the same 30-minute-inactivity session counts once.
create unique index analytics_event_session_idx on public.analytics_hits(session_hash, event_id) where kind = 'event_view';
alter table public.analytics_settings enable row level security;
alter table public.analytics_hits enable row level security;
revoke all on public.analytics_settings, public.analytics_hits from anon, authenticated;

create function public.record_analytics(p_key text, p_id uuid, p_kind text, p_event_id uuid, p_visitor text, p_session text, p_path text, p_country text, p_locale text, p_referrer text)
returns void language plpgsql security definer set search_path = '' as $$
declare event_country text;
begin
  if p_key is null or not exists (select 1 from public.analytics_settings where write_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')) then
    raise insufficient_privilege using message = 'Analytics key required';
  end if;
  if p_kind = 'event_view' then
    select country_code into event_country from public.events where id = p_event_id and publication_status = 'published';
    if not found then return; end if;
  else event_country := p_country;
  end if;
  insert into public.analytics_hits(id, kind, event_id, visitor_hash, session_hash, path, country_code, locale, referrer_host)
  values(p_id, p_kind, p_event_id, p_visitor, p_session, p_path, event_country, p_locale, p_referrer)
  on conflict do nothing;
end;
$$;

create function public.analytics_summary(p_key text, p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare since_at timestamptz; until_at timestamptz; result jsonb;
begin
  if p_key is null or not exists (select 1 from public.analytics_settings where write_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')) then
    raise insufficient_privilege using message = 'Analytics key required';
  end if;
  if p_days not in (7, 30, 90) then raise exception 'Invalid date range'; end if;
  since_at := (((now() at time zone 'Asia/Seoul')::date - (p_days - 1))::timestamp at time zone 'Asia/Seoul');
  until_at := ((((now() at time zone 'Asia/Seoul')::date + 1)::timestamp) at time zone 'Asia/Seoul');
  with hits as materialized (select * from public.analytics_hits where occurred_at >= since_at and occurred_at < until_at),
  daily as (
    select (occurred_at at time zone 'Asia/Seoul')::date as day,
      count(*) filter (where kind = 'page_view') as page_views,
      count(distinct visitor_hash) as visitors,
      count(*) filter (where kind = 'event_view') as event_views
    from hits group by 1
  ), top_events as (
    select e.id, e.title, e.country_code, count(*) as views, count(distinct h.visitor_hash) as visitors
    from hits h join public.events e on e.id = h.event_id where h.kind = 'event_view'
    group by e.id order by views desc, e.id limit 20
  ), countries as (
    select country_code, count(*) filter (where kind = 'page_view') as page_views,
      count(*) filter (where kind = 'event_view') as event_views
    from hits where country_code is not null group by country_code
  ), referrers as (
    select referrer_host, count(distinct session_hash) as visits from hits where kind = 'page_view'
    group by referrer_host order by visits desc, referrer_host limit 10
  )
  select jsonb_build_object(
    'pageViews', (select count(*) from hits where kind = 'page_view'),
    'visitors', (select count(distinct visitor_hash) from hits),
    'sessions', (select count(distinct session_hash) from hits),
    'eventViews', (select count(*) from hits where kind = 'event_view'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'pageViews', coalesce(v.page_views,0), 'visitors', coalesce(v.visitors,0), 'eventViews', coalesce(v.event_views,0)) order by d.day), '[]'::jsonb)
      from generate_series((since_at at time zone 'Asia/Seoul')::date, (until_at at time zone 'Asia/Seoul')::date - 1, interval '1 day') d(day) left join daily v on v.day = d.day::date),
    'topEvents', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'countryCode', country_code, 'views', views, 'visitors', visitors) order by views desc, id), '[]'::jsonb) from top_events),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('code', country_code, 'pageViews', page_views, 'eventViews', event_views) order by country_code), '[]'::jsonb) from countries),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('host', referrer_host, 'sessions', visits) order by visits desc, referrer_host), '[]'::jsonb) from referrers)
  ) into result;
  return result;
end;
$$;
revoke all on function public.record_analytics(text,uuid,text,uuid,text,text,text,text,text,text) from public;
revoke all on function public.analytics_summary(text,integer) from public;
grant execute on function public.record_analytics(text,uuid,text,uuid,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.analytics_summary(text,integer) to anon, authenticated;
