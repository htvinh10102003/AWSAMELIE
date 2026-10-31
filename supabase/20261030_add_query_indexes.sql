-- AWSAMELIE - Them index cho cac query nang nhat (an toan, chay lai duoc)
-- Chay trong Supabase Dashboard > SQL Editor, sau khi da push code muc 3.
-- CREATE INDEX IF NOT EXISTS: index nao co roi se tu bo qua, khong bao loi, khong xoa du lieu.
-- Luu y: chay luc it nguoi dung nhat neu co the, vi tao index se khoa bang trong thoi gian ngan.

-- Dashboard: loc theo printed_at / carrier_date / created_at
create index if not exists idx_orders_printed_at on public.orders (printed_at);
create index if not exists idx_orders_carrier_date on public.orders (carrier_date);
create index if not exists idx_orders_created_at on public.orders (created_at);

-- PackingSpeed: loc theo packed_at + status
create index if not exists idx_orders_packed_at on public.orders (packed_at);
create index if not exists idx_orders_status on public.orders (status);

-- Join orders -> order_products (Dashboard, StatusTransitionTracker)
create index if not exists idx_order_products_order_id on public.order_products (order_id);

-- StatusTransitionTracker: order_histories loc theo created_at, order_id, trang thai
create index if not exists idx_order_histories_created_at on public.order_histories (created_at desc);
create index if not exists idx_order_histories_order_id on public.order_histories (order_id);
create index if not exists idx_order_histories_status_old_new on public.order_histories (status_old, status_new);

-- Ton kho: tim theo product_code
create index if not exists idx_product_inventories_product_code on public.product_inventories (product_code);

-- Lich su don hoan + lich lam viec
create index if not exists idx_return_audit_logs_created_at on public.return_audit_logs (created_at desc);
create index if not exists idx_working_schedules_work_date on public.working_schedules (work_date);

-- Kiem tra lai sau khi chay:
-- select tablename, indexname from pg_indexes where schemaname='public' and indexname like 'idx_%' order by tablename;
