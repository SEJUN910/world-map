-- Supabase default privileges explicitly grant functions to API roles as well
-- as PUBLIC. Trigger functions must not be callable through PostgREST RPC.
revoke all on function public.create_profile() from anon, authenticated;
revoke all on function public.guard_event() from anon, authenticated;
revoke all on function public.guard_event_image() from anon, authenticated;
drop policy profiles_update_own on public.visitors;
