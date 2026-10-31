-- AWSAMELIE - RPC xoa database theo lo (thay cho request_cleanup 1 lan duy nhat)
-- Chay 1 lan trong Supabase Dashboard > SQL Editor, sau do nut Don dep DB trong Admin se goi RPC nay lap lai.
-- Nguyen tac:
--  * Moi lan goi chi xoa toi da batch_size dong/bang (mac dinh 1000). Moi lan goi la 1 transaction rieng,
--    nen neu 1 lan bi timeout thi cac lo truoc van giu nguyen, frontend goi tiep ma khong mat tien trinh.
--  * Xoa con truoc, cha sau: order_products -> order_histories -> return_audit_logs -> orders.
--    Don hang chi bi xoa khi khong con san pham / lich su nao tham chieu toi no (NOT EXISTS), tranh loi khoa ngoai.
--  * Chi xoa du lieu giao dich cu hon days_old ngay, theo created_at. Master Data (san pham, nhan su, cau hinh) khong bi dong vao.
--  * ANALYZE o cuoi de thong ke moi. VACUUM KHONG chay duoc trong function (Postgres cam VACUUM trong transaction),
--    nen sau khi xoa xong hay chay file 20261030_vacuum_after_cleanup.sql rieng trong SQL Editor.

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
  rem_products integer := 0;
  rem_hist integer := 0;
  rem_returns integer := 0;
  rem_orders integer := 0;
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

  -- So con lai (de frontend biet khi nao xong)
  select count(*) into rem_products from public.order_products op
    join public.orders o on o.id = op.order_id where o.created_at < cutoff;
  select count(*) into rem_hist from public.order_histories
    where created_at < cutoff or order_id in (select id from public.orders where created_at < cutoff);
  select count(*) into rem_returns from public.return_audit_logs where created_at < cutoff;
  select count(*) into rem_orders from public.orders where created_at < cutoff
    and not exists (select 1 from public.order_products p where p.order_id = orders.id)
    and not exists (select 1 from public.order_histories h where h.order_id = orders.id);

  analyze public.orders;
  analyze public.order_products;
  analyze public.order_histories;
  analyze public.return_audit_logs;

  return jsonb_build_object(
    'cutoff', cutoff,
    'deleted', jsonb_build_object(
      'order_products', del_products,
      'order_histories', del_hist,
      'return_audit_logs', del_returns,
      'orders', del_orders
    ),
    'remaining', jsonb_build_object(
      'order_products', rem_products,
      'order_histories', rem_hist,
      'return_audit_logs', rem_returns,
      'orders', rem_orders
    ),
    'done', (rem_products = 0 and rem_hist = 0 and rem_returns = 0 and rem_orders = 0)
  );
end;
$$;

-- Cho phep role authenticated goi (kiem tra owner ben trong ham). Anon khong duoc goi truc tiep.
revoke execute on function public.request_cleanup_batched(integer, integer) from public;
grant execute on function public.request_cleanup_batched(integer, integer) to authenticated;
