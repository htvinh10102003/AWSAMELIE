-- Đơn đã xóa trên Nhanh.vn (2026-11-09).
-- Chạy trong Supabase SQL Editor.
--
-- Edge function nhanh-order-actions (action syncDeleted) kéo danh sách
-- đơn đã xóa từ API Nhanh order/deleted (từ 2025-01-01 tới hiện tại)
-- rồi upsert vào đây, 1 dòng cho 1 đơn (order_id là khóa chính, đồng
-- bộ lại không tạo trùng). wms-allocation đọc bảng này để loại các đơn
-- đã xóa khỏi phân bổ tồn kho, tránh đơn đã xóa chiếm hàng của đơn khác
-- và tránh ghi nhầm ngày đủ hàng (orders_printabledate) cho đơn đã xóa.
--
-- Không bật RLS (giống bảng orders sau đợt revert RLS ngày 2026-11-04):
-- edge ghi bằng service role, frontend đọc bằng anon key.

create table if not exists public.deleted_orders (
  order_id text primary key,
  deleted_at timestamptz,
  deleted_by int,
  synced_at timestamptz not null default now()
);

create index if not exists idx_deleted_orders_deleted_at on public.deleted_orders (deleted_at desc);
