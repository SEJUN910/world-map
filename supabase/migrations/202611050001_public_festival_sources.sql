-- Imported public data has no visitor owner and may not include a poster.
-- Ordinary visitor submissions still require their own verified poster.
alter table public.events alter column author_id drop not null;
alter table public.events
  add column source_name text,
  add column source_id text,
  add column source_url text,
  add column source_provider text,
  add column source_reference_date date,
  add column source_synced_at timestamptz;

alter table public.events add constraint events_source_owner_check check (
  (author_id is not null and source_name is null and source_id is null
    and source_url is null and source_provider is null
    and source_reference_date is null and source_synced_at is null)
  or
  (author_id is null and source_name is not null and source_name = 'national_cultural_festivals'
    and source_id is not null and source_id ~ '^[a-f0-9]{64}$'
    and source_url is not null and source_url = 'https://www.data.go.kr/data/15013104/standard.do'
    and source_provider is not null and char_length(source_provider) between 1 and 100
    and source_synced_at is not null)
);
create unique index events_source_identity_idx on public.events (source_name, source_id)
  where source_name is not null;

create or replace function public.guard_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.author_id is distinct from old.author_id or new.id <> old.id
    or new.created_at <> old.created_at
    or new.source_name is distinct from old.source_name
    or new.source_id is distinct from old.source_id
  ) then
    raise exception 'Event identity cannot be changed';
  end if;
  if new.publication_status = 'published' and new.author_id is not null and not exists (
    select 1 from public.event_images i join storage.objects o
      on o.bucket_id = 'event-posters' and o.name = i.storage_path
    where i.event_id = new.id and o.owner_id = new.author_id::text
  ) then raise exception 'A poster is required before publication'; end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.guard_event() from public, anon, authenticated;
