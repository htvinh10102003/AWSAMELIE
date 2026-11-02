-- Lịch sử gửi sang hãng vận chuyển (2026-11-02).
-- Chạy trong Supabase SQL Editor.
--
-- Mỗi lần bấm gửi (toolbar nhiều đơn hoặc popup 1 đơn), edge function
-- nhanh-order-actions tự ghi 1 dòng vào đây, để gửi xong lỡ load lại
-- trang vẫn mở ra check lại được. Giao diện chỉ hiển thị 5 dòng gần
-- nhất (bảng không tự xóa dòng cũ).
--
-- Chỉ service role (edge function) đọc/ghi: bật RLS và không tạo policy
-- cho anon/authenticated; frontend chỉ gọi qua edge function (đã kiểm
-- tra owner), nên không mở thêm quyền ghi cho anon key.

create table if not exists public.send_history (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  created_by text,
  source text,
  total_count int not null default 0,
  ok_count int not null default 0,
  fail_count int not null default 0,
  skipped_count int not null default 0,
  items jsonb not null default '[]'::jsonb,
  skipped_ids jsonb not null default '[]'::jsonb
);

create index if not exists idx_send_history_created_at on public.send_history (created_at desc);

alter table public.send_history enable row level security;
