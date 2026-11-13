-- AWSAMELIE - Luu lich su don qua han o bao cao doi soat cuoi ngay (2026-11-13)
-- Chay 1 lan trong Supabase Dashboard > SQL Editor (CREATE TABLE IF NOT EXISTS
-- + CREATE OR REPLACE FUNCTION + cron.schedule, an toan, chay lai duoc).
--
-- 12h trua (05:00 UTC): chup don do buoi sang — Shopee/TikTok, tao hom qua,
--   in trong ngay, chua ban giao (chua quet).
-- 12h dem (17:00 UTC): chup don do buoi chieu — Shopee/TikTok, tao hom nay
--   truoc 14h + don nhay do (tao hom qua con chua ban giao).
-- Don da quet ban giao (scanned_codes trong bien ban doi soat cua ngay do)
--   thi khong luu. Mot don trong cung 1 ngay + 1 buoi chi luu 1 lan.
-- Bang khong co RLS (giong order_carrier_checks); muc lich su tren app chi
--   hien voi owner.
--
-- LUU Y:
-- - o.status / o.sale_channel so sanh bang ::text de chay duoc du cot la
--   int hay text.
-- - Ham la SECURITY DEFINER de pg_cron doc duoc orders + sessions bat chap RLS.
-- - cron.schedule upsert theo ten job nen chay lai file nay van an toan.

create table if not exists public.overdue_order_snapshots (
  id bigint generated always as identity primary key,
  order_id text not null,
  snapshot_date date not null,
  session text not null check (session in ('morning', 'afternoon')),
  sale_channel text,
  carrier_code text,
  status integer,
  created_at timestamptz not null default now(),
  unique (order_id, snapshot_date, session)
);
create index if not exists overdue_order_snapshots_date_idx
  on public.overdue_order_snapshots (snapshot_date, session);

create or replace function public.snapshot_overdue_orders(p_session text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  vn_now timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  ref_date date;
  scanned text[];
  inserted_count integer := 0;
begin
  if p_session not in ('morning', 'afternoon') then
    raise exception 'session phai la morning hoac afternoon';
  end if;
  -- Ngay tham chieu: buoi sang (chay luc 12:00) = hom nay;
  -- buoi chieu (chay luc 00:00, da sang ngay moi) = hom qua.
  if p_session = 'morning' then
    ref_date := vn_now::date;
  else
    ref_date := vn_now::date - 1;
  end if;

  -- Ma da quet ban giao trong cac bien ban doi soat cua ngay tham chieu
  -- (id don hoac ma van don). Bien ban co the chua co -> mang rong.
  select coalesce(array_agg(distinct code), '{}')
    into scanned
    from public.reconciliation_sessions s,
         jsonb_array_elements_text(coalesce(s.scanned_codes, '[]'::jsonb)) as code
    where s.audit_date = ref_date;

  -- Don do: in trong ngay tham chieu (gio VN), chua ban giao/xong (loai
  -- EXCLUDED [40,43,59,60,61,71,72,74] + CANCELED [58,63,64] giong trang
  -- doi soat), kenh Shopee (42)/TikTok (48), chua quet ban giao;
  -- buoi sang: tao hom qua; buoi chieu: tao hom nay truoc 14h HOAC tao
  -- hom qua (don nhay do).
  insert into public.overdue_order_snapshots
    (order_id, snapshot_date, session, sale_channel, carrier_code, status)
  select o.id, ref_date, p_session, o.sale_channel::text, o.carrier_code, o.status::integer
  from public.orders o
  where (o.printed_at at time zone 'Asia/Ho_Chi_Minh')::date = ref_date
    and o.status::text not in ('40', '43', '59', '60', '61', '71', '72', '74')
    and o.status::text not in ('58', '63', '64')
    and o.sale_channel::text in ('42', '48')
    and not (o.id = any (scanned)
      or (o.carrier_code is not null and o.carrier_code <> '' and o.carrier_code = any (scanned)))
    and (
      (p_session = 'morning'
        and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date = ref_date - 1)
      or (p_session = 'afternoon'
        and (
          ((o.created_at at time zone 'Asia/Ho_Chi_Minh')::date = ref_date
            and extract(hour from o.created_at at time zone 'Asia/Ho_Chi_Minh') < 14)
          or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date = ref_date - 1
        ))
    )
  on conflict (order_id, snapshot_date, session) do nothing;
  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'session', p_session,
    'snapshot_date', ref_date,
    'inserted', inserted_count
  );
end;
$$;

-- Lich tu dong (pg_cron): 12:00 VN = 05:00 UTC; 00:00 VN = 17:00 UTC.
select cron.schedule('snapshot-overdue-morning', '0 5 * * *', $$select public.snapshot_overdue_orders('morning')$$);
select cron.schedule('snapshot-overdue-afternoon', '0 17 * * *', $$select public.snapshot_overdue_orders('afternoon')$$);
