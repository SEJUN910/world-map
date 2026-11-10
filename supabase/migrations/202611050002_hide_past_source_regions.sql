-- The explorer's region filter follows Korea local dates for imported data.
-- User-created listings retain their existing visibility rules.
create or replace view public.event_regions with (security_invoker = true) as
select region_code as code, min(region) as name
from public.events
where publication_status = 'published'
  and (source_name is null or end_date >= (now() at time zone 'Asia/Seoul')::date)
group by region_code;
