alter table public.spot_comments
add column if not exists parent_comment_id bigint references public.spot_comments(id) on delete cascade;
