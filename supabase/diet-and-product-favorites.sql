alter table public.profiles
add column if not exists diet_mode text not null default 'vegan',
add column if not exists warning_ingredients text[] not null default array['milch', 'ei', 'gelatine', 'honig'];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_diet_mode_check'
  ) then
    alter table public.profiles
    add constraint profiles_diet_mode_check
    check (diet_mode in ('vegan', 'vegetarisch', 'flexitarisch'));
  end if;
end $$;

create table if not exists public.product_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  barcode text not null,
  name text not null,
  status text not null,
  image_url text,
  reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, barcode)
);

alter table public.product_favorites enable row level security;

drop policy if exists "Service role manages product favorites" on public.product_favorites;
create policy "Service role manages product favorites"
  on public.product_favorites
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Users read own product favorites" on public.product_favorites;
create policy "Users read own product favorites"
  on public.product_favorites
  for select
  using (auth.uid() = user_id);
