alter table public.events
  add column description_content jsonb,
  drop constraint events_description_check,
  add constraint events_description_check check (char_length(description) <= 20000),
  add constraint events_description_content_check check (
    description_content is null or (
      jsonb_typeof(description_content) = 'object'
      and description_content->>'type' = 'doc'
      and jsonb_typeof(description_content->'content') = 'array'
      and octet_length(description_content::text) <= 262144
    )
  );
comment on column public.events.description_content is
  'Validated Tiptap JSON for authored descriptions; description remains plain text for search and legacy sources.';
