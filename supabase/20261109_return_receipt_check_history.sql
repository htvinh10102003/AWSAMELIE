-- Lịch sử kiểm nhận hàng hoàn (báo cáo đơn hoàn chưa nhận).
-- 1 dòng / 1 lần kiểm 1 đơn: mỗi lần dán AfterShip xác nhận là 1 lô
-- (batch_id chung cho cả lô), sửa tay từng đơn ghi riêng 1 dòng
-- (batch_id null, source 'thu_cong'). Không bật RLS (theo tiền lệ
-- return_receipt_checks / deleted_orders): đọc/ghi qua client với
-- session đã đăng nhập; ghi lịch sử chỉ là best-effort (lỗi thì bỏ
-- qua, không làm hỏng cập nhật trạng thái chính).
create table if not exists public.return_receipt_check_history (
  id uuid primary key default gen_random_uuid(),
  return_id text not null,
  tracking_number text,
  shipment_status text,
  received_status text,
  received_date date,
  source text,
  checked_by text,
  checked_at timestamptz not null default now(),
  batch_id uuid
);
create index if not exists idx_rrch_return_id_time on public.return_receipt_check_history (return_id, checked_at desc);
create index if not exists idx_rrch_batch on public.return_receipt_check_history (batch_id);
create index if not exists idx_rrch_time on public.return_receipt_check_history (checked_at desc);
