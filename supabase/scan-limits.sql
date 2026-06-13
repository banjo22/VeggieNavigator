create table if not exists public.daily_scan_usage (
  usage_date date not null,
  subject_type text not null check (subject_type in ('guest', 'user')),
  subject_id text not null,
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, subject_type, subject_id)
);

alter table public.daily_scan_usage enable row level security;

drop policy if exists "Service role manages scan usage" on public.daily_scan_usage;
create policy "Service role manages scan usage"
  on public.daily_scan_usage
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
