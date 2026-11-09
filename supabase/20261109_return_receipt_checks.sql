-- Bảng cập nhật tay trạng thái nhận hàng hoàn (báo cáo đơn hoàn chưa nhận).
-- 1 dòng / 1 yêu cầu trả (return_id). Không bật RLS (theo tiền lệ
-- deleted_orders): đọc/ghi qua client với session đã đăng nhập;
-- quyền sửa chỉ owner, check ở UI (user_metadata.is_owner / email owner).
create table if not exists public.return_receipt_checks (
  return_id text primary key,
  received_date date,
  received_status text check (received_status in ('Đã nhận', 'Chưa nhận')),
  updated_by text,
  updated_at timestamptz not null default now()
);
create index if not exists idx_return_receipt_checks_received_status
  on public.return_receipt_checks (received_status);
