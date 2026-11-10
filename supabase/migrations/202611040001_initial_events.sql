-- FESTIVA initial schema. No service-role credentials are needed by the app.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60));
  return new;
end;
$$;
revoke all on function public.create_profile() from public;
create trigger create_user_profile after insert on auth.users
  for each row execute function public.create_profile();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  slug text not null check (char_length(slug) between 1 and 100),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 3000),
  region text not null check (char_length(btrim(region)) between 1 and 60),
  region_code text not null check (char_length(region_code) between 1 and 100),
  venue text not null check (char_length(btrim(venue)) between 1 and 120),
  address text not null default '' check (char_length(address) <= 200),
  latitude double precision not null check (latitude between 33 and 39),
  longitude double precision not null check (longitude between 124 and 132),
  start_date date,
  end_date date,
  timezone text not null default 'Asia/Seoul' check (timezone = 'Asia/Seoul'),
  official_url text not null default '' check (char_length(official_url) <= 1000 and (official_url = '' or official_url ~ '^https?://')),
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published', 'hidden', 'deleted')),
  event_status text not null default 'scheduled' check (event_status in ('scheduled', 'postponed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or (start_date is not null and end_date >= start_date))
);
create index events_author_idx on public.events(author_id, created_at desc);
create index events_public_region_idx on public.events(region_code, created_at desc) where publication_status = 'published';
create index events_public_created_idx on public.events(created_at desc) where publication_status = 'published';

create table public.event_images (
  event_id uuid primary key references public.events(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  reason text not null check (char_length(btrim(reason)) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique(event_id, reporter_id)
);
create index reports_open_idx on public.reports(created_at desc) where status = 'open';
create table public.extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_images enable row level security;
alter table public.reports enable row level security;
alter table public.extraction_jobs enable row level security;

-- Reset default grants; policies alone do not grant table access.
revoke all on public.profiles, public.events, public.event_images, public.reports, public.extraction_jobs from anon, authenticated;
grant select on public.events, public.event_images to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant insert, update on public.events to authenticated;
grant insert, update, delete on public.event_images to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select on public.extraction_jobs to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy events_read on public.events for select to anon, authenticated using (
  publication_status = 'published' or author_id = (select auth.uid()) or (select public.is_admin())
);
create policy events_create on public.events for insert to authenticated with check (
  author_id = (select auth.uid()) and publication_status = 'draft'
);
create policy events_update_own on public.events for update to authenticated using (
  author_id = (select auth.uid()) and publication_status in ('draft', 'published')
) with check (author_id = (select auth.uid()) and publication_status in ('draft', 'published', 'deleted'));
create policy events_admin_update on public.events for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy images_read on public.event_images for select to anon, authenticated using (
  exists (select 1 from public.events e where e.id = event_id)
);
create policy images_create on public.event_images for insert to authenticated with check (
  exists (select 1 from public.events e where e.id = event_id and e.author_id = (select auth.uid()) and e.publication_status in ('draft','published'))
  and storage_path like (select auth.uid())::text || '/' || event_id::text || '/%'
);
create policy images_update on public.event_images for update to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and e.author_id = (select auth.uid()) and e.publication_status in ('draft','published'))
) with check (
  exists (select 1 from public.events e where e.id = event_id and e.author_id = (select auth.uid()) and e.publication_status in ('draft','published'))
  and storage_path like (select auth.uid())::text || '/' || event_id::text || '/%'
);
create policy images_remove on public.event_images for delete to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and e.author_id = (select auth.uid()) and e.publication_status in ('draft','deleted'))
);
create policy reports_read on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy reports_create on public.reports for insert to authenticated with check (
  reporter_id = (select auth.uid()) and status = 'open'
  and exists (select 1 from public.events e where e.id = event_id and e.publication_status = 'published')
);
create policy reports_admin_update on public.reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy extraction_read_own on public.extraction_jobs for select to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and e.author_id = (select auth.uid()))
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('event-posters', 'event-posters', false, 10485760, array['image/jpeg']);
create policy poster_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'event-posters'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.events e where e.id::text = (storage.foldername(name))[2] and e.author_id = (select auth.uid()) and e.publication_status in ('draft','published'))
);
create policy poster_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'event-posters' and (
    owner_id = (select auth.uid())::text
    or exists (select 1 from public.event_images i join public.events e on e.id = i.event_id where i.storage_path = name and e.publication_status = 'published')
    or (select public.is_admin())
  )
);
-- Unique immutable file paths; no UPDATE permission is granted for overwrites.
create policy poster_remove on storage.objects for delete to authenticated using (
  bucket_id = 'event-posters' and owner_id = (select auth.uid())::text
  and not exists (select 1 from public.event_images i join public.events e on e.id = i.event_id where i.storage_path = name and e.publication_status <> 'deleted')
);

create function public.guard_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.author_id <> old.author_id or new.id <> old.id or new.created_at <> old.created_at) then
    raise exception 'Event identity cannot be changed';
  end if;
  if new.publication_status = 'published' and not exists (
    select 1 from public.event_images i join storage.objects o on o.bucket_id = 'event-posters' and o.name = i.storage_path
    where i.event_id = new.id and o.owner_id = new.author_id::text
  ) then raise exception 'A poster is required before publication'; end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.guard_event() from public;
create trigger guard_event before insert or update on public.events for each row execute function public.guard_event();
