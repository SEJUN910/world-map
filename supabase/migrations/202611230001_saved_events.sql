-- Saved ("관심") events: one row per visitor and public event.
-- Rows belong to the Supabase auth user (anonymous or Google). A guest's rows
-- move to an existing Google account through the same one-use handoff proof
-- that already transfers authored events.
create table public.saved_events (
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (visitor_id, event_id)
);
create index saved_events_visitor_created_idx on public.saved_events (visitor_id, created_at desc);
alter table public.saved_events enable row level security;
revoke all on public.saved_events from public, anon, authenticated;
grant select, insert, delete on public.saved_events to authenticated;

create policy saved_events_select_own on public.saved_events
  for select to authenticated using (visitor_id = (select auth.uid()));
-- Only currently published events can be saved; later unpublishing keeps the
-- row so the owner can see and clear it, but RLS hides the event itself.
create policy saved_events_insert_own on public.saved_events
  for insert to authenticated with check (
    visitor_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.publication_status = 'published')
  );
create policy saved_events_delete_own on public.saved_events
  for delete to authenticated using (visitor_id = (select auth.uid()));

-- At most 200 saved events per visitor. The advisory lock serialises
-- concurrent inserts from several tabs so the count cannot be raced past.
create function public.guard_saved_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('saved_events:' || new.visitor_id::text, 0));
  -- An already-saved event is a no-op for ON CONFLICT DO NOTHING; let it
  -- through instead of reporting the limit.
  if exists(select 1 from public.saved_events where visitor_id = new.visitor_id and event_id = new.event_id) then
    return new;
  end if;
  if (select count(*) from public.saved_events where visitor_id = new.visitor_id) >= 200 then
    raise exception 'saved_events_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_saved_event() from public, anon, authenticated;
create trigger saved_events_limit before insert on public.saved_events
  for each row execute function public.guard_saved_event();

-- Same handoff as 202611100005, plus merging the guest's saved events into the
-- Google account (newest first, never past the 200 limit) in one transaction.
create or replace function public.complete_event_account_handoff(p_token text) returns integer
language plpgsql security definer set search_path = '' as $$
declare claim public.event_account_handoffs; moved integer; room integer;
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
  -- Saved events are a convenience: a problem here must never block moving
  -- the authored events above, so it runs in its own sub-block. Take the same
  -- lock as guard_saved_event() before counting so another tab cannot push
  -- the account past 200 between the count and the insert.
  begin
    perform pg_advisory_xact_lock(hashtextextended('saved_events:' || auth.uid()::text, 0));
    room := greatest(0, 200 - (select count(*) from public.saved_events where visitor_id = auth.uid()))::integer;
    insert into public.saved_events(visitor_id, event_id, created_at)
      select auth.uid(), s.event_id, s.created_at from public.saved_events s
      where s.visitor_id = claim.source_id
        and not exists(select 1 from public.saved_events t where t.visitor_id = auth.uid() and t.event_id = s.event_id)
      order by s.created_at desc limit room
      on conflict do nothing;
    delete from public.saved_events where visitor_id = claim.source_id;
  exception when others then
    null;
  end;
  update public.event_account_handoffs set state='used' where token_hash=claim.token_hash;
  return moved;
end;
$$;
