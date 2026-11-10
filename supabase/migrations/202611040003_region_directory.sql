create view public.event_regions with (security_invoker = true) as
select region_code as code, min(region) as name
from public.events where publication_status = 'published'
group by region_code;
grant select on public.event_regions to anon, authenticated;
