-- Run after 202611230001_saved_events.sql with a SQL runner. All fixtures roll back.
-- Covers: own-row RLS, published-only inserts, duplicate no-op, the 200 limit
-- (including re-saving at the limit), and the guest -> Google account merge.
begin;
do $$
declare author uuid:=gen_random_uuid(); guest uuid:=gen_random_uuid(); member uuid:=gen_random_uuid();
  pub uuid[]:='{}'; e uuid; draft uuid;
begin
  insert into auth.users(id,is_anonymous,raw_app_meta_data) values
    (author,true,'{}'),(guest,true,'{}'),(member,false,'{"provider":"google","providers":["google"]}');
  insert into auth.identities(provider_id,user_id,identity_data,provider) values
    (member::text,member,jsonb_build_object('sub',member::text),'google');
  for n in 1..203 loop
    e:=gen_random_uuid();
    insert into public.events(id,author_id,slug,title,description,region,region_code,venue,address,latitude,longitude)
      values(e,author,'saved-test','Saved test','Synthetic test introduction','Seoul','seoul','Test venue','Test address',37.5,127);
    insert into storage.objects(bucket_id,name,owner_id) values('event-posters',author::text||'/'||e::text||'/test.jpg',author::text);
    insert into public.event_images(event_id,storage_path) values(e,author::text||'/'||e::text||'/test.jpg');
    if n<=202 then
      update public.events set publication_status='published' where id=e;
      pub:=pub||e;
    else
      draft:=e;
    end if;
  end loop;
  perform set_config('test.guest',guest::text,true);
  perform set_config('test.member',member::text,true);
  perform set_config('test.pub',array_to_string(pub,','),true);
  perform set_config('test.draft',draft::text,true);
end $$;
set local role authenticated;
do $$
declare pub uuid[]:=string_to_array(current_setting('test.pub'),',')::uuid[];
  guest uuid:=current_setting('test.guest')::uuid; member uuid:=current_setting('test.member')::uuid;
  token text; moved integer;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',guest,'role','authenticated')::text,true);
  begin insert into public.saved_events(visitor_id,event_id) values(guest,current_setting('test.draft')::uuid); raise exception 'Unpublished event saved';
  exception when insufficient_privilege then null; end;
  begin insert into public.saved_events(visitor_id,event_id) values(member,pub[1]); raise exception 'Saved for another visitor';
  exception when insufficient_privilege then null; end;
  insert into public.saved_events(visitor_id,event_id) select guest, unnest(pub[1:3]);
  insert into public.saved_events(visitor_id,event_id) values(guest,pub[1]) on conflict do nothing;
  if (select count(*) from public.saved_events)<>3 then raise exception 'Guest save count wrong'; end if;
  token:=public.begin_event_account_handoff();

  perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
  if exists(select 1 from public.saved_events where visitor_id=guest) then raise exception 'Member can read guest rows'; end if;
  insert into public.saved_events(visitor_id,event_id) select member, unnest(pub[3:201]);
  if (select count(*) from public.saved_events)<>199 then raise exception 'Member save count wrong'; end if;
  moved:=public.complete_event_account_handoff(token);
  if moved<>0 then raise exception 'Handoff return value changed: %', moved; end if;
  -- Room for exactly one: pub[3] is deduplicated, one of pub[1]/pub[2] fits.
  if (select count(*) from public.saved_events)<>200 then raise exception 'Merge not capped at 200'; end if;
  if (select count(*) from public.saved_events where event_id = any(pub[1:2]))<>1 then raise exception 'Merge did not add exactly one new event'; end if;
  begin insert into public.saved_events(visitor_id,event_id) values(member,pub[202]); raise exception 'Limit not enforced';
  exception when others then if sqlerrm<>'saved_events_limit' then raise; end if; end;
  insert into public.saved_events(visitor_id,event_id) values(member,pub[5]) on conflict do nothing;
  delete from public.saved_events where event_id=pub[5];
  if (select count(*) from public.saved_events)<>199 then raise exception 'Own delete failed'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.saved_events where visitor_id=current_setting('test.guest')::uuid) then raise exception 'Guest rows not removed after merge'; end if;
  if has_table_privilege('anon','public.saved_events','SELECT') or has_table_privilege('authenticated','public.saved_events','UPDATE')
    or has_function_privilege('authenticated','public.guard_saved_event()','EXECUTE') then raise exception 'Unexpected privileges'; end if;
end $$;
rollback;
select 'PASS: saved_events RLS, published-only, duplicate no-op, 200 limit, guest merge and privileges; fixtures rolled back' as result;
