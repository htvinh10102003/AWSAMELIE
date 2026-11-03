-- Bảng đơn trả hàng / hoàn tiền trên sàn, đồng bộ từ API Nhanh ecom/return.
-- Viết dạng idempotent: chạy lại nhiều lần vẫn an toàn, và nếu bảng đã tồn tại
-- từ bản đồng bộ cũ (chỉ có return_id) thì chỉ thêm các cột còn thiếu.
-- Mỗi bản ghi Nhanh trả về là đầy đủ nên edge upsert nguyên hàng theo return_id.

create table if not exists public.ecom_return_orders (
  return_id text primary key
);

alter table public.ecom_return_orders add column if not exists platform_id int;
alter table public.ecom_return_orders add column if not exists platform_name text;
alter table public.ecom_return_orders add column if not exists shop_id text;
alter table public.ecom_return_orders add column if not exists business_id int;
alter table public.ecom_return_orders add column if not exists return_type int;
alter table public.ecom_return_orders add column if not exists original_ecom_order_id text;
alter table public.ecom_return_orders add column if not exists reason_id text;
alter table public.ecom_return_orders add column if not exists reason_name text;
alter table public.ecom_return_orders add column if not exists amount double precision;
alter table public.ecom_return_orders add column if not exists ecom_status_id text;
alter table public.ecom_return_orders add column if not exists ecom_status_name text;
alter table public.ecom_return_orders add column if not exists nhanh_status_id int;
alter table public.ecom_return_orders add column if not exists nhanh_status_name text;
alter table public.ecom_return_orders add column if not exists return_created_at timestamptz;
alter table public.ecom_return_orders add column if not exists return_updated_at timestamptz;
alter table public.ecom_return_orders add column if not exists products jsonb;
alter table public.ecom_return_orders add column if not exists raw_data jsonb;
alter table public.ecom_return_orders add column if not exists synced_at timestamptz default now();

-- Nếu bảng cũ lưu return_id dạng số thì chuyển sang text cho khớp docs
-- (docs ghi returnId là string; chuyển số -> text không mất dữ liệu).
alter table public.ecom_return_orders
  alter column return_id type text using return_id::text;

create index if not exists idx_ecom_returns_platform_updated
  on public.ecom_return_orders (platform_id, return_updated_at desc);
create index if not exists idx_ecom_returns_original_order
  on public.ecom_return_orders (original_ecom_order_id);
create index if not exists idx_ecom_returns_nhanh_status
  on public.ecom_return_orders (nhanh_status_id);

-- Đọc: user đã đăng nhập trong app được xem (ghi chỉ qua edge dùng service role).
alter table public.ecom_return_orders enable row level security;
drop policy if exists "ecom_returns_select_authenticated" on public.ecom_return_orders;
create policy "ecom_returns_select_authenticated" on public.ecom_return_orders
  for select to authenticated using (true);
