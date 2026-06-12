alter table public.community_spots
add column if not exists created_by text,
add column if not exists created_by_name text;

