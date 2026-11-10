-- A short-lived, one-use ownership proof lets a verified Google account keep
-- events authored in the same browser before signup. The token is held only in
-- an HttpOnly auth-flow cookie; the database stores its hash.
create table public.event_account_handoffs (
  token_hash text primary key,
  source_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 minutes',
  state text not null default 'pending' check (state in ('pending','redeeming','used'))
);
alter table public.event_account_handoffs enable row level security;
revoke all on public.event_account_handoffs from public, anon, authenticated;
create function public.begin_event_account_handoff() returns text
language plpgsql security definer set search_path = '' as $$
declare token text;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id = auth.uid() and is_anonymous) then
    raise insufficient_privilege using message = 'Anonymous owner required';
  end if;
  delete from public.event_account_handoffs where expires_at < now() - interval '1 day';
  token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into public.event_account_handoffs(token_hash,source_id) values(encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid());
  return token;
end;
$$;
create function public.complete_event_account_handoff(p_token text) returns integer
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
revoke all on function public.begin_event_account_handoff() from public,anon;
revoke all on function public.complete_event_account_handoff(text) from public,anon;
grant execute on function public.begin_event_account_handoff(), public.complete_event_account_handoff(text) to authenticated;

create or replace function public.guard_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.created_at<>old.created_at or new.source_name is distinct from old.source_name or new.source_id is distinct from old.source_id then
      raise exception 'Event identity cannot be changed';
    end if;
    if new.author_id is distinct from old.author_id and not exists(
      select 1 from public.event_account_handoffs where source_id=old.author_id and target_id=new.author_id
      and target_id=auth.uid() and state='redeeming' and expires_at>now()
    ) then raise exception 'Event owner cannot be changed'; end if;
  end if;
  if new.publication_status='published' and new.author_id is not null and not exists(
    select 1 from public.event_images i join storage.objects o on o.bucket_id='event-posters' and o.name=i.storage_path
    where i.event_id=new.id and o.owner_id=new.author_id::text
  ) then raise exception 'A poster is required before publication'; end if;
  new.updated_at=now();
  return new;
end;
$$;
revoke all on function public.guard_event() from public,anon,authenticated;
