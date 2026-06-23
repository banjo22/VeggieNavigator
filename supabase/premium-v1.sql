alter table public.profiles
add column if not exists premium_status text not null default 'free',
add column if not exists premium_plan text not null default 'free',
add column if not exists premium_until timestamptz,
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_premium_status_check'
  ) then
    alter table public.profiles
    add constraint profiles_premium_status_check
    check (premium_status in ('free', 'trialing', 'active', 'past_due', 'canceled'));
  end if;
end $$;

-- Premium manuell aktivieren, zum Testen:
-- update public.profiles
-- set premium_status = 'active',
--     premium_plan = 'premium_monthly',
--     premium_until = null,
--     updated_at = now()
-- where id = 'DEINE-USER-ID';

-- Premium wieder deaktivieren:
-- update public.profiles
-- set premium_status = 'free',
--     premium_plan = 'free',
--     premium_until = null,
--     updated_at = now()
-- where id = 'DEINE-USER-ID';
