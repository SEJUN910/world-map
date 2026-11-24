-- Country requests: cap votes per network per day and close the summary to anon.
-- ip_day_hash is a keyed hash of the IP and the UTC day, so it rotates daily and
-- cannot be linked across days or to analytics; the IP itself is never stored.
alter table public.country_requests
  add column ip_day_hash text check (ip_day_hash is null or ip_day_hash ~ '^[a-f0-9]{64}$');
create index country_requests_ip_day_idx on public.country_requests (ip_day_hash) where ip_day_hash is not null;

drop function public.record_country_request(text, text, text);
-- 'created', 'duplicate' (this visitor already asked for it) or 'limited' (the
-- network already sent the daily maximum of new requests).
create function public.record_country_request(p_key text, p_visitor text, p_country text, p_ip_day text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if p_key is null or not exists (select 1 from public.analytics_settings where write_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')) then
    raise exception 'invalid key' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.country_requests where visitor_hash = p_visitor and country_code = p_country) then
    return 'duplicate';
  end if;
  if (select count(*) from public.country_requests where ip_day_hash = p_ip_day) >= 20 then
    return 'limited';
  end if;
  insert into public.country_requests (visitor_hash, country_code, ip_day_hash) values (p_visitor, p_country, p_ip_day)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return case when inserted > 0 then 'created' else 'duplicate' end;
end;
$$;
revoke all on function public.record_country_request(text, text, text, text) from public;
grant execute on function public.record_country_request(text, text, text, text) to anon, authenticated;

-- Supabase grants EXECUTE to anon by default; the summary is for admins only.
revoke all on function public.country_request_summary() from anon;
