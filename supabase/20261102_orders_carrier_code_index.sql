-- AWSAMELIE - Index cho tim don theo ma van don tren mobile (tab Tim don).
-- Chay trong Supabase Dashboard > SQL Editor. An toan, chay lai duoc.
-- Code mobile tu 2026-11-02 thu khop chinh xac (.eq) truoc, nen co index
-- nay thi lan quet barcode/tim ma day du se dung index thay vi quet toan bang.
create index if not exists idx_orders_carrier_code on public.orders (carrier_code);

-- Kiem tra lai sau khi chay:
-- select indexname from pg_indexes where schemaname = 'public' and tablename = 'orders' and indexname = 'idx_orders_carrier_code';
