-- France as a third country, with events from the City of Paris open data
-- "Que faire à Paris" (ODbL). Photo credits are kept per event.
alter table public.events
  drop constraint events_country_code_check,
  add constraint events_country_code_check check (country_code in ('kr', 'tw', 'fr')),
  drop constraint events_country_location_check,
  add constraint events_country_location_check check (
    (country_code = 'kr' and latitude between 33 and 39 and longitude between 124 and 132 and timezone = 'Asia/Seoul')
    or (country_code = 'tw' and latitude between 21.8 and 26.5 and longitude between 118 and 123 and timezone = 'Asia/Taipei')
    or (country_code = 'fr' and latitude between 41.3 and 51.2 and longitude between -5.5 and 9.8 and timezone = 'Europe/Paris')
  ),
  add column source_image_credit text,
  add constraint events_source_image_credit_check check (
    source_image_credit is null
    or (source_name = 'paris_qfap' and char_length(btrim(source_image_credit)) between 1 and 200)
  );

alter table public.events drop constraint events_source_owner_check;
alter table public.events add constraint events_source_owner_check check (
  (author_id is not null and source_name is null and source_id is null
    and source_url is null and source_provider is null
    and source_reference_date is null and source_synced_at is null
    and source_image_url is null and source_image_license is null)
  or
  (author_id is null and source_name is not null and source_name = 'national_cultural_festivals'
    and source_id is not null and source_id ~ '^[a-f0-9]{64}$'
    and source_url is not null and source_url = 'https://www.data.go.kr/data/15013104/standard.do'
    and source_provider is not null and char_length(source_provider) between 1 and 100
    and source_synced_at is not null and source_image_url is null and source_image_license is null)
  or
  (author_id is null and source_name is not null and source_name = 'tourapi'
    and source_id is not null and source_id ~ '^[0-9]{1,20}$'
    and source_url is not null and source_url = 'https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578'
    and source_provider is not null and source_provider = '한국관광공사' and source_synced_at is not null
    and source_image_url is not null and source_image_url ~ '^https://tong[.]visitkorea[.]or[.]kr/[^[:space:]]+$'
    and char_length(source_image_url) <= 2000
    and source_image_license is not null and source_image_license in ('Type1', 'Type3'))
  or
  (author_id is null and source_name = 'taiwan_tourism' and country_code = 'tw'
    and source_id is not null and source_id ~ '^Event_[A-Za-z0-9_]{1,80}$'
    and source_url = 'https://data.gov.tw/en/datasets/7778'
    and source_provider = 'Taiwan Tourism Administration'
    and source_synced_at is not null
    and source_image_url is not null
    and source_image_url ~ '^https://([a-z0-9-]+[.])*(gov[.]tw|taiwan[.]net[.]tw)/[^[:space:]]+$'
    and char_length(source_image_url) <= 2000
    and source_image_license = 'OGDL-1.0')
  or
  (author_id is null and source_name = 'paris_qfap' and country_code = 'fr'
    and source_id is not null and source_id ~ '^[0-9]{1,20}$'
    and source_url = 'https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/'
    and source_provider = 'Ville de Paris'
    and source_synced_at is not null
    and source_image_url is not null
    and source_image_url ~ '^https://cdn[.]paris[.]fr/[^[:space:]]+$'
    and char_length(source_image_url) <= 2000
    and source_image_license = 'ODbL')
);

alter table public.analytics_hits
  drop constraint analytics_hits_path_check,
  add constraint analytics_hits_path_check check (path in ('/', '/korea', '/taiwan', '/france', '/regions')),
  drop constraint analytics_hits_country_code_check,
  add constraint analytics_hits_country_code_check check (country_code in ('kr', 'tw', 'fr'));
