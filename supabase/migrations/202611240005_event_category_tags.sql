-- One category per event for the list/map filter, plus finer tags kept for
-- later filters and labels. Tags are lowercase keys (e.g. concert, kids, photo);
-- display names live in the app.
alter table public.events
  add column category text not null default 'other'
    check (category in ('festival', 'exhibition', 'performance', 'other')),
  add column tags text[] not null default '{}'
    check (cardinality(tags) <= 12 and array_to_string(tags, ',') ~ '^([a-z][a-z-]{1,29}(,[a-z][a-z-]{1,29})*)?$');

create index events_public_country_category_idx on public.events (country_code, category, created_at desc)
  where publication_status = 'published';

-- Sources that only ever list festivals. Culture info and Paris rows are filled
-- by re-running their import scripts, which now write category and tags.
update public.events set category = 'festival', tags = array['festival']
where source_name in ('tourapi', 'taiwan_tourism', 'national_cultural_festivals');
