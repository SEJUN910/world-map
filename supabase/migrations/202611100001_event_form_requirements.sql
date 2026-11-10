-- Location coordinates remain required; region/venue labels are optional.
alter table public.events
  drop constraint events_region_check,
  drop constraint events_venue_check,
  alter column region set default '',
  alter column venue set default '',
  add constraint events_region_check check (char_length(btrim(region)) <= 60),
  add constraint events_venue_check check (char_length(btrim(venue)) <= 120);

-- Enforce introductions on new/updated user publications without rewriting
-- existing posts or imposing requirements on imported public-source records.
alter table public.events add constraint events_user_description_required
  check (author_id is null or publication_status <> 'published' or char_length(btrim(description)) > 0)
  not valid;

create or replace view public.event_regions with (security_invoker = true) as
select region_code as code, min(region) as name
from public.events
where publication_status = 'published'
  and btrim(region) <> ''
  and (source_name is null or end_date >= (now() at time zone 'Asia/Seoul')::date)
group by region_code;
