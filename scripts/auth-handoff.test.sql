-- Run with a development database's SQL runner. All fixtures roll back.
begin;
do $$
declare guest uuid:=gen_random_uuid(); member uuid:=gen_random_uuid(); other_member uuid:=gen_random_uuid();
  linked uuid:=gen_random_uuid(); event uuid; token text; expired text; moved integer;
begin
  insert into auth.users(id,is_anonymous,raw_app_meta_data) values
    (guest,true,'{}'),(member,false,'{"provider":"google","providers":["google"]}'),
    (other_member,false,'{"provider":"google","providers":["google"]}'),(linked,true,'{}');
  insert into auth.identities(provider_id,user_id,identity_data,provider) values
    (member::text,member,jsonb_build_object('sub',member::text),'google'),
    (other_member::text,other_member,jsonb_build_object('sub',other_member::text),'google');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',guest,'role','authenticated')::text,true);
  token:=public.begin_event_account_handoff(); expired:=public.begin_event_account_handoff();
  update public.event_account_handoffs set expires_at=now()-interval '1 second' where token_hash=encode(sha256(convert_to(expired,'UTF8')),'hex');
  for n in 1..2 loop
    event:=gen_random_uuid();
    insert into public.events(id,author_id,slug,title,description,region,region_code,venue,address,latitude,longitude)
      values(event,guest,'oauth-test','OAuth test','Synthetic test introduction','Seoul','seoul','Test venue','Test address',37.5,127);
    insert into storage.objects(bucket_id,name,owner_id) values('event-posters',guest::text||'/'||event::text||'/test.jpg',guest::text);
    insert into public.event_images(event_id,storage_path) values(event,guest::text||'/'||event::text||'/test.jpg');
    if n=2 then update public.events set publication_status='published' where id=event; end if;
  end loop;
  begin perform public.complete_event_account_handoff(token); raise exception 'Anonymous redemption accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member,'role','authenticated')::text,true);
  begin update public.events set author_id=member where author_id=guest; raise exception 'Direct ownership update accepted';
  exception when others then if sqlerrm<>'Event owner cannot be changed' then raise; end if; end;
  begin perform public.complete_event_account_handoff(expired); raise exception 'Expired proof accepted';
  exception when others then if sqlerrm<>'Expired ownership proof' then raise; end if; end;
  moved:=public.complete_event_account_handoff(token);
  if moved<>2 then raise exception 'Wrong transfer count'; end if;
  if public.complete_event_account_handoff(token)<>0 then raise exception 'Retry not idempotent'; end if;
  if (select count(*) from storage.objects where owner_id=member::text and name like guest::text||'/%')<>2 then raise exception 'Poster ownership lost'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_member,'role','authenticated')::text,true);
  begin perform public.complete_event_account_handoff(token); raise exception 'Replayed proof accepted by another account';
  exception when others then if sqlerrm<>'Expired ownership proof' then raise; end if; end;
  -- First-time link keeps the same identity and needs no event-owner changes.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',linked,'role','authenticated')::text,true);
  token:=public.begin_event_account_handoff();
  update auth.users set is_anonymous=false where id=linked;
  insert into auth.identities(provider_id,user_id,identity_data,provider) values(linked::text,linked,jsonb_build_object('sub',linked::text),'google');
  if public.complete_event_account_handoff(token)<>0 then raise exception 'Same-ID linking failed'; end if;
  if has_table_privilege('authenticated','public.event_account_handoffs','SELECT') or has_table_privilege('anon','public.event_account_handoffs','SELECT') then raise exception 'Proofs exposed'; end if;
  if has_function_privilege('anon','public.begin_event_account_handoff()','EXECUTE') then raise exception 'Unauthenticated claim creation exposed'; end if;
  perform set_config('test.member',member::text,true); perform set_config('test.guest',guest::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.guest'),'role','authenticated')::text,true) is not null as guest_claim_set;
do $$ begin
  if exists(select 1 from public.events where author_id=current_setting('test.member')::uuid and publication_status='draft') then raise exception 'Old guest can read private transferred events'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.member'),'role','authenticated')::text,true) is not null as member_claim_set;
do $$ begin
  if (select count(*) from public.events where author_id=auth.uid())<>2 then raise exception 'New member cannot see transferred events'; end if;
  update public.events set title='Edited after account transfer' where author_id=auth.uid();
  if (select count(*) from storage.objects where owner_id=auth.uid()::text)<>2 then raise exception 'New member cannot read private poster metadata'; end if;
end $$;
reset role;
rollback;
select 'PASS: Google ownership handoff, expiry, replay, linking, RLS, poster ownership and member editing; fixtures rolled back' as result;
