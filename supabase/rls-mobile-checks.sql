-- Run once as user A, user B, and anonymous. Every query must return zero rows.
select id,user_id from public.scan_history where user_id<>(select auth.uid());
select user_id from public.user_preferences where user_id<>(select auth.uid());
select user_id,barcode from public.product_favorites where user_id<>(select auth.uid());
