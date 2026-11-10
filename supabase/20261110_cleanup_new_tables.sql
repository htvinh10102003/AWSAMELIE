-- AWSAMELIE - Mo rong RPC xoa database theo lo them cac bang moi (2026-11-10)
-- Chay 1 lan trong Supabase Dashboard > SQL Editor (CREATE OR REPLACE, an toan, chay lai duoc).
-- File nay THAY THE supabase/20261102_cleanup_timeout_fix.sql: giu nguyen toan bo logic cu
-- (4 bang goc, owner check, timeout 120s, batch_size, JSON tra ve) va them 6 bang moi:
--   1. return_receipt_checks       - theo updated_at   (ngay sua cuoi cua ban ghi; received_date
--                                      la ngay nhan hang thuc te, co the cu hon ban ghi nen khong dung)
--   2. return_receipt_check_history - theo checked_at
--   3. partial_return_orders       - theo created_at
--   4. deleted_orders              - theo deleted_at
--   5. send_history                - theo created_at
--   6. orders_printabledate        - theo printable_date
-- Tat ca deu dung chung 1 moc cutoff = now() - days_old va cung mau xoa theo lo
-- (ctid + LIMIT batch_size) nhu cac bang cu, nen khong timeout.
--
-- LUU Y:
-- - partial_return_orders.created_at va deleted_orders.deleted_at cho phep NULL:
--   dong nao NULL se KHONG khop dieu kien "< cutoff" nen se o lai (an toan, khong xoa nham).
-- - orders_printabledate KHONG co file CREATE TABLE trong repo: su ton tai cua bang va
--   2 cot order_id / printable_date chi duoc chung minh boi edge function wms-allocation
--   (doc order_id, printable_date va insert { order_id, printable_date: ISO string }).
--   Neu khi chay file nay bao loi "relation orders_printabledate does not exist" hoac
--   loi kieu du lieu o cot printable_date, hay bo buoc 10 (xoa) cua bang nay roi chay lai,
--   hoac tao bang truoc theo dung cot ma wms-allocation dang dung.
-- - Cac bang moi khong co khoa ngoai (FK) toi orders, nen buoc xoa orders (buoc 4) giu
--   nguyen dieu kien cu (chi kiem order_products / order_histories).

create or replace function public.request_cleanup_batched(days_old integer, batch_size integer default 1000)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - (days_old || ' days')::interval;
  jwt jsonb := auth.jwt();
  meta jsonb;
  del_products integer := 0;
  del_hist integer := 0;
  del_returns integer := 0;
  del_orders integer := 0;
  del_receipt_checks integer := 0;
  del_receipt_hist integer := 0;
  del_partial integer := 0;
  del_deleted integer := 0;
  del_send_hist integer := 0;
  del_printable integer := 0;
  rem_products integer := 0;
  rem_hist integer := 0;
  rem_returns integer := 0;
  rem_orders integer := 0;
  rem_receipt_checks integer := 0;
  rem_receipt_hist integer := 0;
  rem_partial integer := 0;
  rem_deleted integer := 0;
  rem_send_hist integer := 0;
  rem_printable integer := 0;
begin
  -- Chi owner moi duoc goi. Owner duoc nhan dien bang user_metadata.is_owner = true,
  -- hoac tai khoan owner goc cua he thong (email nay cung dang dung trong Admin.jsx).
  -- Neu tai khoan owner cua Vinh khac email nay thi sua email o day truoc khi chay.
  meta := jwt -> 'user_metadata';
  if jwt is null or not (
    (meta ->> 'is_owner') = 'true'
    or (jwt ->> 'email') = 'contact.hotavinh@gmail.com'
  ) then
    raise exception 'Chi owner moi duoc don dep database';
  end if;

  -- FIX timeout: nang statement_timeout len 120 giay chi trong transaction nay.
  perform set_config('statement_timeout', '120s', true);

  if batch_size is null or batch_size < 1 then batch_size := 1000; end if;
  if batch_size > 5000 then batch_size := 5000; end if;

  -- 1. San pham cua don cu
  delete from public.order_products
  where ctid in (
    select op.ctid from public.order_products op
    join public.orders o on o.id = op.order_id
    where o.created_at < cutoff
    limit batch_size
  );
  get diagnostics del_products = row_count;

  -- 2. Lich su cua don cu, hoac lich su cu (ca 2 dieu kien, tranh sot)
  delete from public.order_histories
  where ctid in (
    select ctid from public.order_histories
    where created_at < cutoff
       or order_id in (select id from public.orders where created_at < cutoff)
    limit batch_size
  );
  get diagnostics del_hist = row_count;

  -- 3. Bien ban kiem hoan cu
  delete from public.return_audit_logs
  where ctid in (
    select ctid from public.return_audit_logs where created_at < cutoff limit batch_size
  );
  get diagnostics del_returns = row_count;

  -- 4. Don hang cu, chi khi khong con con tham chieu
  delete from public.orders o
  where o.ctid in (
    select o2.ctid from public.orders o2
    where o2.created_at < cutoff
      and not exists (select 1 from public.order_products p where p.order_id = o2.id)
      and not exists (select 1 from public.order_histories h where h.order_id = o2.id)
    limit batch_size
  );
  get diagnostics del_orders = row_count;

  -- 5. Danh dau nhan hang hoan cu (theo lan sua cuoi; xoa dong nay mat dau "da nhan")
  delete from public.return_receipt_checks
  where ctid in (
    select ctid from public.return_receipt_checks where updated_at < cutoff limit batch_size
  );
  get diagnostics del_receipt_checks = row_count;

  -- 6. Lich su kiem nhan hang hoan cu
  delete from public.return_receipt_check_history
  where ctid in (
    select ctid from public.return_receipt_check_history where checked_at < cutoff limit batch_size
  );
  get diagnostics del_receipt_hist = row_count;

  -- 7. Don hoan 1 phan cu
  delete from public.partial_return_orders
  where ctid in (
    select ctid from public.partial_return_orders where created_at < cutoff limit batch_size
  );
  get diagnostics del_partial = row_count;

  -- 8. Don da xoa cu (dong ghi dong bo tu Nhanh)
  delete from public.deleted_orders
  where ctid in (
    select ctid from public.deleted_orders where deleted_at < cutoff limit batch_size
  );
  get diagnostics del_deleted = row_count;

  -- 9. Lich su gui sang hang van chuyen cu
  delete from public.send_history
  where ctid in (
    select ctid from public.send_history where created_at < cutoff limit batch_size
  );
  get diagnostics del_send_hist = row_count;

  -- 10. Ngay du hang cu (bang phu cua wms-allocation)
  delete from public.orders_printabledate
  where ctid in (
    select ctid from public.orders_printabledate where printable_date < cutoff limit batch_size
  );
  get diagnostics del_printable = row_count;

  -- So con lai (de frontend biet khi nao xong)
  select count(*) into rem_products from public.order_products op
    join public.orders o on o.id = op.order_id where o.created_at < cutoff;
  select count(*) into rem_hist from public.order_histories
    where created_at < cutoff or order_id in (select id from public.orders where created_at < cutoff);
  select count(*) into rem_returns from public.return_audit_logs where created_at < cutoff;
  select count(*) into rem_orders from public.orders where created_at < cutoff
    and not exists (select 1 from public.order_products p where p.order_id = orders.id)
    and not exists (select 1 from public.order_histories h where h.order_id = orders.id);
  select count(*) into rem_receipt_checks from public.return_receipt_checks where updated_at < cutoff;
  select count(*) into rem_receipt_hist from public.return_receipt_check_history where checked_at < cutoff;
  select count(*) into rem_partial from public.partial_return_orders where created_at < cutoff;
  select count(*) into rem_deleted from public.deleted_orders where deleted_at < cutoff;
  select count(*) into rem_send_hist from public.send_history where created_at < cutoff;
  select count(*) into rem_printable from public.orders_printabledate where printable_date < cutoff;

  analyze public.orders;
  analyze public.order_products;
  analyze public.order_histories;
  analyze public.return_audit_logs;
  analyze public.return_receipt_checks;
  analyze public.return_receipt_check_history;
  analyze public.partial_return_orders;
  analyze public.deleted_orders;
  analyze public.send_history;
  analyze public.orders_printabledate;

  return jsonb_build_object(
    'cutoff', cutoff,
    'deleted', jsonb_build_object(
      'order_products', del_products,
      'order_histories', del_hist,
      'return_audit_logs', del_returns,
      'orders', del_orders,
      'return_receipt_checks', del_receipt_checks,
      'return_receipt_check_history', del_receipt_hist,
      'partial_return_orders', del_partial,
      'deleted_orders', del_deleted,
      'send_history', del_send_hist,
      'orders_printabledate', del_printable
    ),
    'remaining', jsonb_build_object(
      'order_products', rem_products,
      'order_histories', rem_hist,
      'return_audit_logs', rem_returns,
      'orders', rem_orders,
      'return_receipt_checks', rem_receipt_checks,
      'return_receipt_check_history', rem_receipt_hist,
      'partial_return_orders', rem_partial,
      'deleted_orders', rem_deleted,
      'send_history', rem_send_hist,
      'orders_printabledate', rem_printable
    ),
    'done', (rem_products = 0 and rem_hist = 0 and rem_returns = 0 and rem_orders = 0
      and rem_receipt_checks = 0 and rem_receipt_hist = 0 and rem_partial = 0
      and rem_deleted = 0 and rem_send_hist = 0 and rem_printable = 0)
  );
end;
$$;

-- Cho phep role authenticated goi (kiem tra owner ben trong ham). Anon khong duoc goi truc tiep.
revoke execute on function public.request_cleanup_batched(integer, integer) from public;
grant execute on function public.request_cleanup_batched(integer, integer) to authenticated;
