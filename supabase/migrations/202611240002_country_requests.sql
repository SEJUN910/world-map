-- Visitors ask for countries the site does not cover yet. Only a keyed hash of
-- the anonymous visitor cookie and the ISO country code are stored; one vote per
-- visitor and country. Writes go through the API with the analytics write key,
-- reads only through the admin summary.
create table public.country_requests (
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  primary key (visitor_hash, country_code)
);
create index country_requests_country_idx on public.country_requests (country_code, created_at desc);
alter table public.country_requests enable row level security;
revoke all on public.country_requests from anon, authenticated;

-- Returns true for a new request, false when this visitor already asked for it.
create function public.record_country_request(p_key text, p_visitor text, p_country text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if p_key is null or not exists (select 1 from public.analytics_settings where write_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')) then
    raise exception 'invalid key' using errcode = 'insufficient_privilege';
  end if;
  insert into public.country_requests (visitor_hash, country_code) values (p_visitor, p_country)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;
revoke all on function public.record_country_request(text, text, text) from public;
grant execute on function public.record_country_request(text, text, text) to anon, authenticated;

create function public.country_request_summary()
returns table (country_code text, total_count bigint, recent_count bigint, last_requested_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = 'insufficient_privilege';
  end if;
  return query
    select r.country_code, count(*), count(*) filter (where r.created_at >= now() - interval '30 days'), max(r.created_at)
    from public.country_requests r
    group by r.country_code;
end;
$$;
revoke all on function public.country_request_summary() from public;
grant execute on function public.country_request_summary() to authenticated;
