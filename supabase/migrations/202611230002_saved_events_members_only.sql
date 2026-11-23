-- Saved events are a Google-member feature: anonymous visitors cannot save.
-- That makes the guest -> account merge added in 202611230001 unnecessary, so
-- the handoff function goes back to its 202611100005 definition.

drop policy saved_events_insert_own on public.saved_events;
create policy saved_events_insert_own on public.saved_events
  for insert to authenticated with check (
    visitor_id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (select 1 from public.events e where e.id = event_id and e.publication_status = 'published')
  );

-- No anonymous rows can be created from now on; drop any made before.
delete from public.saved_events s using auth.users u where u.id = s.visitor_id and u.is_anonymous;

create or replace function public.complete_event_account_handoff(p_token text) returns integer
language plpgsql security definer set search_path = '' as $$
declare claim public.event_account_handoffs; moved integer;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and not is_anonymous)
    or not exists(select 1 from auth.identities where user_id=auth.uid() and provider='google') then
    raise insufficient_privilege using message = 'Google account required';
  end if;
  select * into claim from public.event_account_handoffs
    where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if not found then raise exception 'Invalid ownership proof'; end if;
  if claim.state='used' and claim.target_id=auth.uid() then return 0; end if;
  if claim.state<>'pending' or claim.expires_at<=now() then raise exception 'Expired ownership proof'; end if;
  if claim.source_id=auth.uid() then
    update public.event_account_handoffs set state='used',target_id=auth.uid() where token_hash=claim.token_hash;
    return 0;
  end if;
  if not exists(select 1 from auth.users where id=claim.source_id and is_anonymous) then
    raise insufficient_privilege using message = 'Only anonymous data can be transferred';
  end if;
  update public.event_account_handoffs set state='redeeming',target_id=auth.uid() where token_hash=claim.token_hash;
  -- Keep object keys unchanged. Metadata ownership and event ownership move in
  -- one transaction; all future uploads use the member's own folder.
  update storage.objects o set owner_id=auth.uid()::text
    where bucket_id='event-posters' and owner_id=claim.source_id::text
    and exists(select 1 from public.event_images i join public.events e on e.id=i.event_id where i.storage_path=o.name and e.author_id=claim.source_id);
  update public.events set author_id=auth.uid() where author_id=claim.source_id;
  get diagnostics moved = row_count;
  update public.event_account_handoffs set state='used' where token_hash=claim.token_hash;
  return moved;
end;
$$;
