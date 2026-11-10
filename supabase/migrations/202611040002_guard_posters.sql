-- Direct Data API requests must preserve the same image invariants as the app.
create function public.guard_event_image() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.event_id <> old.event_id then
    raise exception 'Poster event cannot be changed';
  end if;
  if not exists (
    select 1 from public.events e join storage.objects o
      on o.bucket_id = 'event-posters' and o.name = new.storage_path and o.owner_id = e.author_id::text
    where e.id = new.event_id and new.storage_path like e.author_id::text || '/' || e.id::text || '/%'
  ) then raise exception 'An uploaded poster owned by the author is required'; end if;
  return new;
end;
$$;
revoke all on function public.guard_event_image() from public;
create trigger guard_event_image before insert or update on public.event_images
  for each row execute function public.guard_event_image();
