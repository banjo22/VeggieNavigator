create table if not exists public.spot_guest_confirmations (
  spot_id bigint not null references public.community_spots(id) on delete cascade,
  guest_id text not null,
  created_at timestamptz not null default now(),
  primary key (spot_id, guest_id)
);

alter table public.spot_guest_confirmations enable row level security;

drop policy if exists "Service role manages guest spot confirmations" on public.spot_guest_confirmations;
create policy "Service role manages guest spot confirmations"
  on public.spot_guest_confirmations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
