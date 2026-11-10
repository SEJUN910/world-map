-- Visitors post without signup. Internal anonymous auth IDs retain RLS ownership.
alter table public.profiles rename to visitors;
alter table public.visitors drop column display_name;
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.visitors(id) values (new.id);
  return new;
end;
$$;
-- Visitors do not edit a profile or any identity data.
revoke update on public.visitors from authenticated;
