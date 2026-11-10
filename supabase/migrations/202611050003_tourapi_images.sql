-- TourAPI images remain at the original official URL, without alteration.
alter table public.events add column source_image_url text;
alter table public.events add column source_image_license text;
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
);
