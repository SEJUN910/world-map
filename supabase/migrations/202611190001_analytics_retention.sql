-- Purge analytics hits older than a configurable number of days (default 90).
-- Called by the Vercel weekly cron; authenticated with the same ANALYTICS_WRITE_KEY
-- used by record_analytics so no extra secret is needed.
create function public.purge_analytics_hits(p_key text, p_days integer default 90)
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted integer;
begin
  if p_key is null or not exists (
    select 1 from public.analytics_settings
    where write_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
  ) then
    raise insufficient_privilege using message = 'Analytics key required';
  end if;
  if p_days < 30 or p_days > 365 then
    raise exception 'p_days must be between 30 and 365';
  end if;
  with removed as (
    delete from public.analytics_hits
    where occurred_at < now() - (p_days || ' days')::interval
    returning 1
  ) select count(*) into deleted from removed;
  return deleted;
end;
$$;
revoke all on function public.purge_analytics_hits(text,integer) from public;
grant execute on function public.purge_analytics_hits(text,integer) to anon, authenticated;
