-- Removes only legacy web data structures. Mobile accounts and data stay intact.
begin;

drop table if exists public.spot_comments cascade;
drop table if exists public.spot_guest_confirmations cascade;

delete from public.spot_reactions where user_id is null;
drop index if exists public.spot_reactions_one_per_guest;
alter table public.spot_reactions
  drop constraint if exists spot_reactions_subject_check,
  drop column if exists guest_id;
alter table public.spot_reactions alter column user_id set not null;

delete from public.daily_scan_usage where subject_type <> 'user';
alter table public.daily_scan_usage
  drop constraint if exists daily_scan_usage_subject_type_check;
alter table public.daily_scan_usage
  add constraint daily_scan_usage_subject_type_check check (subject_type='user');

alter table public.profiles
  drop column if exists public_spots,
  drop column if exists public_scans,
  drop column if exists public_comments,
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id;

alter table public.community_spots
  drop column if exists image_data_url;

commit;
