-- Check every tag on its own: lowercase key, letters/digits with single hyphens,
-- at most 30 characters, no NULL elements (the joined-string check let those through).
create function public.valid_event_tags(tags text[]) returns boolean
language sql immutable
set search_path = ''
as $$
  select cardinality(tags) <= 12
    and array_position(tags, null) is null
    and not exists (select 1 from unnest(tags) as tag where tag !~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' or char_length(tag) > 30);
$$;

alter table public.events drop constraint events_tags_check;
alter table public.events add constraint events_tags_check check (public.valid_event_tags(tags));
