-- Replace the removed administrator dashboard with three public counters.
-- Raw records and browser/session hashes remain inaccessible to clients.
drop function public.analytics_summary(text,integer);
create function public.traffic_totals(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare today_start timestamptz;
begin
  if p_key is null or not exists(select 1 from public.analytics_settings where write_key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex')) then
    raise insufficient_privilege using message='Analytics key required';
  end if;
  today_start := ((now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul');
  return jsonb_build_object(
    'todayVisitors',(select count(distinct visitor_hash) from public.analytics_hits where occurred_at>=today_start and occurred_at<today_start+interval '1 day'),
    'pageViews',(select count(*) from public.analytics_hits where kind='page_view'),
    'eventViews',(select count(*) from public.analytics_hits where kind='event_view')
  );
end;
$$;
revoke all on function public.traffic_totals(text) from public;
grant execute on function public.traffic_totals(text) to anon, authenticated;
