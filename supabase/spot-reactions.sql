create table if not exists public.spot_reactions (
  id bigserial primary key,
  spot_id bigint not null references public.community_spots(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spot_reactions_subject_check check (
    (user_id is not null and guest_id is null)
    or (user_id is null and guest_id is not null and length(trim(guest_id)) > 0)
  )
);

create unique index if not exists spot_reactions_one_per_user
  on public.spot_reactions(spot_id, user_id)
  where user_id is not null;

create unique index if not exists spot_reactions_one_per_guest
  on public.spot_reactions(spot_id, guest_id)
  where guest_id is not null;

alter table public.spot_reactions enable row level security;

drop policy if exists "spot reactions are readable" on public.spot_reactions;
create policy "spot reactions are readable"
  on public.spot_reactions
  for select
  using (true);

drop policy if exists "spot reactions are written by service role" on public.spot_reactions;
create policy "spot reactions are written by service role"
  on public.spot_reactions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
