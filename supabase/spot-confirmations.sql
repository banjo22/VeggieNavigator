create table if not exists public.spot_confirmations (
  spot_id bigint not null references public.community_spots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spot_id, user_id)
);

alter table public.spot_confirmations enable row level security;

drop policy if exists "Users read own spot confirmations" on public.spot_confirmations;
create policy "Users read own spot confirmations"
  on public.spot_confirmations
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own spot confirmations" on public.spot_confirmations;
create policy "Users insert own spot confirmations"
  on public.spot_confirmations
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Service role manages spot confirmations" on public.spot_confirmations;
create policy "Service role manages spot confirmations"
  on public.spot_confirmations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
