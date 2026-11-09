-- Mở rộng trạng thái kiểm nhận tay: thêm 'Đã khiếu nại'.
-- Trang "Đơn hoàn chưa nhận" cho tick tay 3 trạng thái (Chưa nhận /
-- Đã nhận / Đã khiếu nại) ở từng dòng và tick hàng loạt; trạng thái mới
-- chỉ lưu được sau khi chạy migration này (trước đó DB sẽ chặn ở CHECK).
-- Bảng lịch sử return_receipt_check_history KHÔNG cần đổi: cột
-- received_status của nó là text thường, không có CHECK constraint.
alter table public.return_receipt_checks
  drop constraint if exists return_receipt_checks_received_status_check;
alter table public.return_receipt_checks
  add constraint return_receipt_checks_received_status_check
  check (received_status in ('Đã nhận', 'Chưa nhận', 'Đã khiếu nại'));
