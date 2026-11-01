-- Nhãn đơn hàng Nhanh.vn cho báo cáo đặc biệt (2026-11-01).
-- Chạy trong Supabase SQL Editor. Chỉ làm cho đơn mới đồng bộ sau này:
-- đơn cũ không có nhãn, sẽ cào lại sau theo kế hoạch riêng.
--
-- nhanh_tags: danh sách nhãn, cache 24h (tài liệu Nhanh khuyên cache vì
-- nhãn rất ít thay đổi). Edge function nhanh-order-actions đọc bảng này
-- trước, cũ hơn 24h mới gọi API order/tags rồi ghi đè.
-- order_tags: đơn nào gắn nhãn nào, lấy từ info.tags của API order/list
-- trong lúc sync-nhanh chạy (đơn mới đồng bộ mới có dòng ở đây).

create table if not exists public.nhanh_tags (
  tag_id text primary key,
  name text not null,
  bg_color text,
  text_color text,
  status int,
  updated_at timestamptz not null default now()
);

create table if not exists public.order_tags (
  order_id text not null,
  tag_id text not null,
  tag_name text,
  bg_color text,
  text_color text,
  primary key (order_id, tag_id)
);

create index if not exists idx_order_tags_tag_id on public.order_tags (tag_id);
create index if not exists idx_order_tags_order_id on public.order_tags (order_id);

-- Frontend đọc bằng anon key nên mở SELECT cho mọi người (dữ liệu nhãn
-- của shop, cùng mức với bảng orders vốn đã đọc được bằng anon key).
-- Ghi chỉ qua service role (edge function), anon không ghi được.
alter table public.nhanh_tags enable row level security;
alter table public.order_tags enable row level security;

drop policy if exists "nhanh_tags_read" on public.nhanh_tags;
create policy "nhanh_tags_read" on public.nhanh_tags
  for select using (true);

drop policy if exists "order_tags_read" on public.order_tags;
create policy "order_tags_read" on public.order_tags
  for select using (true);
