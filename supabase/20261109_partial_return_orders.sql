-- Bảng riêng cho đơn hoàn 1 phần (type 16).
-- Trước đây đơn hoàn 1 phần nằm chung trong bảng orders, muốn lọc phải
-- quét JSON (raw_data->info->>type = '16') trên bảng đơn rất lớn — chậm.
-- Từ nay webhook orderPartialReturn ghi thẳng vào bảng này (có index theo
-- đơn gốc), báo cáo "đơn hoàn chưa nhận" đọc bảng này để đối chiếu.
-- KHÔNG bật RLS (theo tiền lệ return_receipt_checks / deleted_orders):
-- đọc/ghi qua client với session đã đăng nhập.
-- LƯU Ý: 49 dòng cũ vẫn nằm lại trong bảng orders (không xóa ở đây);
-- sync-nhanh / cron-sync (order/list) vẫn có thể đưa lại đơn type 16
-- vào orders khi chạy đồng bộ đầy đủ — chặn ở sync là việc riêng.
create table if not exists public.partial_return_orders (
  id text primary key,
  original_order_id text,
  original_ecom_order_id text,
  ecom_order_id text,
  shop_id text,
  sale_channel int,
  status int,
  created_by_name text,
  products jsonb,
  raw_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz not null default now()
);
create index if not exists idx_pro_original_order on public.partial_return_orders (original_order_id);
create index if not exists idx_pro_original_ecom on public.partial_return_orders (original_ecom_order_id);
create index if not exists idx_pro_created on public.partial_return_orders (created_at desc);

-- Backfill 49 đơn type 16 đã có trong orders (đếm ngày 2026-11-09, 14 đơn mới trong ngày).
-- original_order_id: info.originalOrderId thật trong payload đồng bộ
-- (không có object originalOrder lồng nhau); original_ecom_order_id =
-- channel.appOrderId bỏ hậu tố 'R' (VD '586714831070856213R' -> '...213').
insert into public.partial_return_orders
  (id, original_order_id, original_ecom_order_id, ecom_order_id, shop_id,
   sale_channel, status, created_by_name, products, raw_data, created_at, updated_at)
with src as (
  select
    o.id,
    coalesce(
      o.raw_data->'info'->>'originalOrderId',
      o.raw_data->'data'->'info'->>'originalOrderId',
      o.raw_data->'originalOrder'->>'id',
      o.raw_data->'data'->'originalOrder'->>'id'
    ) as original_order_id,
    coalesce(
      o.raw_data->'channel'->>'appOrderId',
      o.raw_data->'data'->'channel'->>'appOrderId'
    ) as ecom_order_id,
    coalesce(
      o.raw_data->'channel'->>'shopId',
      o.raw_data->'data'->'channel'->>'shopId',
      o.raw_data->'channel'->>'appShopId',
      o.raw_data->'data'->'channel'->>'appShopId',
      o.raw_data->'originalOrder'->'channel'->>'appShopId',
      o.raw_data->'data'->'originalOrder'->'channel'->>'appShopId'
    ) as shop_id,
    coalesce(
      o.raw_data->'channel'->>'saleChannel',
      o.raw_data->'data'->'channel'->>'saleChannel'
    ) as sale_channel_txt,
    coalesce(
      o.raw_data->'info'->>'statusId',
      o.raw_data->'data'->'info'->>'statusId',
      o.raw_data->'info'->>'status',
      o.raw_data->'data'->'info'->>'status'
    ) as status_txt,
    coalesce(
      o.raw_data->'info'->'createdBy'->>'name',
      o.raw_data->'data'->'info'->'createdBy'->>'name',
      o.raw_data->'info'->>'createdByName',
      o.raw_data->'data'->'info'->>'createdByName'
    ) as created_by_name,
    coalesce(
      o.raw_data->'products',
      o.raw_data->'data'->'products'
    ) as products,
    o.raw_data as raw_data,
    coalesce(
      nullif(o.raw_data->'info'->>'createdAt', ''),
      nullif(o.raw_data->'data'->'info'->>'createdAt', '')
    ) as created_at_txt,
    coalesce(
      nullif(o.raw_data->'info'->>'updatedAt', ''),
      nullif(o.raw_data->'data'->'info'->>'updatedAt', '')
    ) as updated_at_txt
  from public.orders o
  where coalesce(o.raw_data->'info'->>'type', o.raw_data->'data'->'info'->>'type') = '16'
)
select
  id,
  original_order_id,
  case when ecom_order_id is not null and right(ecom_order_id, 1) = 'R'
    then left(ecom_order_id, length(ecom_order_id) - 1)
    else ecom_order_id end,
  ecom_order_id,
  shop_id,
  case when sale_channel_txt ~ '^[0-9]+$' then sale_channel_txt::int end,
  case when status_txt ~ '^[0-9]+$' then status_txt::int end,
  created_by_name,
  products,
  raw_data,
  coalesce(case when created_at_txt ~ '^[0-9]+$' then to_timestamp(created_at_txt::bigint) end, now()),
  coalesce(case when updated_at_txt ~ '^[0-9]+$' then to_timestamp(updated_at_txt::bigint) end, now())
from src
on conflict (id) do nothing;
