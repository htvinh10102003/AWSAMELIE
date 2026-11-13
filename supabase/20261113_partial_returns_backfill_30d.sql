-- Kéo bù đơn hoàn 1 phần (type 16) từ bảng orders + job kéo định kỳ.
-- Bối cảnh (2026-11-13): đơn hoàn 1 phần chỉ về qua webhook orderPartialReturn.
-- Event ngày 11-09 10:30 (đơn 880851783) webhook trả 200 success nhưng dòng
-- không vào partial_return_orders (code lúc đó insert thường, lỗi ghi chỉ
-- console.error rồi vẫn trả success). Không có job nào kéo bù nên đơn hụt
-- mất luôn. File này: (1) kéo bù 1 lần trong 30 ngày gần đây, (2) tạo hàm
-- backfill_partial_returns(p_days) để job định kỳ gọi, (3) tạo job pg_cron
-- chạy 07:00 VN mỗi ngày, kéo 2 ngày gần đây.
-- Nguồn: bảng orders (đơn type 16 đã về đó qua sync order/list).
-- LƯU Ý CHẠY FILE: SQL Editor chạy cả file như 1 giao dịch — nếu 1 câu
-- lỗi thì các câu trước đó cũng bị lùi lại (đã xảy ra 2 lần 2026-11-13:
-- lỗi ở bước tạo job làm mất luôn phần kéo bù + tạo hàm chạy trước đó).
-- Vì vậy chạy file này theo TỪNG PHẦN RIÊNG BIỆT (mỗi phần 1 lần Run):
-- phần 1 (kéo bù), phần 2 (tạo hàm), phần 3 (tạo job), phần 4 (kiểm tra).
-- Ngoài ra SQL Editor chỉ hiển thị kết quả cuối cùng nên câu kiểm tra
-- ở phần 4 cũng chạy RIÊNG từng câu.

-- ============================================================
-- 1. KÉO BÙ 1 LẦN: đơn type 16 trong 30 ngày gần đây (theo ngày VN)
-- ============================================================
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
    and o.created_at >= (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 30) at time zone 'Asia/Ho_Chi_Minh')
),
inserted as (
  insert into public.partial_return_orders
    (id, original_order_id, original_ecom_order_id, ecom_order_id, shop_id,
     sale_channel, status, created_by_name, products, raw_data, created_at, updated_at)
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
  on conflict (id) do nothing
  returning id
)
select count(*) as backfilled_30d from inserted;

-- ============================================================
-- 2. HÀM KÉO BÙ ĐỊNH KỲ: backfill_partial_returns(p_days)
--    Kéo đơn type 16 trong p_days gần đây (theo ngày VN) từ orders
--    vào partial_return_orders. Trả về số dòng mới chèn.
-- ============================================================
create or replace function public.backfill_partial_returns(p_days int default 2)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from timestamptz;
  v_inserted int;
begin
  v_from := (((now() at time zone 'Asia/Ho_Chi_Minh')::date - p_days) at time zone 'Asia/Ho_Chi_Minh');

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
        o.raw_data->'data'->'info'->'createdByName'
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
      and o.created_at >= v_from
  )
  insert into public.partial_return_orders
    (id, original_order_id, original_ecom_order_id, ecom_order_id, shop_id,
     sale_channel, status, created_by_name, products, raw_data, created_at, updated_at)
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

  get diagnostics v_inserted = row_count;
  return jsonb_build_object('days', p_days, 'window_from', v_from, 'inserted', v_inserted);
end;
$$;

-- ============================================================
-- 3. JOB ĐỊNH KỲ: 07:00 VN mỗi ngày, kéo 2 ngày gần đây
--    (DB múi giờ UTC nên 0 0 * * * = 07:00 VN)
-- ============================================================
-- Xóa job cũ (nếu có) bằng hàm unschedule. LƯU Ý 2 bài học ở lần chạy
-- 2026-11-13: (1) role của SQL Editor KHÔNG có quyền DELETE trực tiếp
-- trên bảng cron.job (lỗi 42501); (2) cron.unschedule BÁO LỖI XX000 khi
-- job chưa tồn tại (không trả false lặng lẽ như tưởng) nên phải kiểm
-- tra EXISTS trước trong DO block. Ngoài ra SQL Editor chỉ hiển thị kết
-- quả cuối cùng nên các câu kiểm tra ở phần 4 chạy RIÊNG từng câu.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-partial-returns-daily') then
    perform cron.unschedule('sync-partial-returns-daily');
  end if;
end $$;
select cron.schedule('sync-partial-returns-daily', '0 0 * * *', 'select public.backfill_partial_returns(2);');

-- ============================================================
-- 4. KIỂM TRA — chạy RIÊNG từng câu (SQL Editor chỉ hiện kết quả cuối)
-- ============================================================
-- 4a. Một câu duy nhất trả về đủ thông tin: tổng dòng, đơn mới nhất,
--     đơn 880851783 đã về chưa, gọi thử hàm, job đã có chưa.
select
  (select count(*) from public.partial_return_orders) as total_partial,
  (select max(created_at) from public.partial_return_orders) as newest,
  (select count(*) from public.partial_return_orders where id = '880851783') as has_880851783,
  (select public.backfill_partial_returns(2)) as func_test,
  (select count(*) from cron.job where jobname = 'sync-partial-returns-daily') as job_exists;
-- 4b. Chi tiết đơn 880851783 (vụ webhook 11-09 hụt) đã về chưa?
select id, original_order_id, original_ecom_order_id, status, created_at
from public.partial_return_orders where id = '880851783';
