-- Tách trạng thái hãng ("Đã hoàn") khỏi trạng thái nhận ("Đã nhận")
-- cho bảng return_receipt_checks (báo cáo "Đơn hoàn chưa nhận").
--
-- Ngữ nghĩa mới (chốt 2026-11-10):
-- - carrier_status "Đã hoàn" = HÃNG đã giao hàng trả về (shipper tick
--   trả hàng; dữ liệu từ dán kết quả AfterShip / 17Track / Excel).
--   Hãng báo đã giao CHƯA chắc chủ shop đã cầm hàng.
-- - received_status "Đã nhận" = CHỦ SHOP đã quét mã / tick tay xác nhận
--   cầm hàng thật. Chỉ quét (source 'quet') và sửa tay (source
--   'thu_cong') mới được ghi 'Đã nhận'.
-- - carrier_status NULL = chưa dán kết quả lần nào (chưa rõ hãng đã giao
--   hay chưa) — hiển thị trống, KHÔNG được hiểu là "Chưa hoàn".
--
-- Trước đây luồng dán kết quả ghi nhầm received_status='Đã nhận' cho đơn
-- hãng báo Delivered, nên migration này sửa lại dữ liệu cũ:
-- 1) thêm cột carrier_status;
-- 2) đơn từng được dán Delivered -> carrier_status='Đã hoàn';
-- 3) đơn từng được dán mà không Delivered -> carrier_status='Chưa hoàn'
--    (chỉ khi bước 2 chưa set — guard IS NULL);
-- 4) đơn đang 'Đã nhận' nhưng KHÔNG có lịch sử quét/tick 'Đã nhận' nào
--    -> trả về 'Chưa nhận', ngày về NULL (đó là dấu hãng báo, không phải
--    dấu đã cầm hàng). Đơn 'Đã khiếu nại' không bị chạm tới (WHERE chỉ
--    khớp 'Đã nhận').
--
-- KHÔNG đổi CHECK constraint của received_status (đã mở rộng 'Đã khiếu
-- nại' ở migration 20261109_return_receipt_checks_khieu_nai.sql).
-- Chỉ tạo file này, KHÔNG chạy — Vinh chạy trong Supabase SQL Editor.
alter table public.return_receipt_checks
  add column if not exists carrier_status text;

-- 2) Hãng đã hoàn: từng có lần dán (aftership/17track/excel/generic)
--    ghi nhận Đã nhận (nghĩa cũ = hãng báo Delivered).
update public.return_receipt_checks c
  set carrier_status = 'Đã hoàn'
  where exists (
    select 1 from public.return_receipt_check_history h
    where h.return_id = c.return_id
      and h.source in ('aftership', '17track', 'excel', 'generic')
      and h.received_status = 'Đã nhận'
  );

-- 3) Hãng chưa hoàn: từng được dán mà không Delivered (ghi 'Chưa nhận'
--    theo nghĩa cũ), và bước 2 chưa set carrier_status.
update public.return_receipt_checks c
  set carrier_status = 'Chưa hoàn'
  where c.carrier_status is null
    and exists (
      select 1 from public.return_receipt_check_history h
      where h.return_id = c.return_id
        and h.source in ('aftership', '17track', 'excel', 'generic')
        and h.received_status = 'Chưa nhận'
    );

-- 4) Sửa dấu nhận cũ: 'Đã nhận' mà không có lịch sử quét/tick 'Đã nhận'
--    thì chỉ là hãng báo giao — trả về 'Chưa nhận', ngày về NULL.
update public.return_receipt_checks c
  set received_status = 'Chưa nhận',
      received_date = null
  where c.received_status = 'Đã nhận'
    and not exists (
      select 1 from public.return_receipt_check_history h
      where h.return_id = c.return_id
        and h.source in ('quet', 'thu_cong')
        and h.received_status = 'Đã nhận'
    );
