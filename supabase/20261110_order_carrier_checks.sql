-- ============================================================
-- Bảng order_carrier_checks — trạng thái check hãng + nhận hàng
-- cho đơn gốc đang hoàn (status 71 'Đang chuyển hoàn' / 74 'Xác nhận
-- hoàn'). Tạo ngày 2026-11-10 theo yêu cầu của Vinh (bỏ phương án
-- "chỉ xem trong phiên" cho mục check 71/74 — mục này BẮT BUỘC lưu lại).
--
-- Đúng 3 cột, KHÔNG có cột ngày tháng (Vinh: "không cần lưu ngày tháng
-- hay gì hết", "chỉ cần lưu trạng thái là trả hay chưa thôi").
--   order_id       text PRIMARY KEY — mã đơn Nhanh (orders.id)
--   carrier_status text — 'Đã hoàn' (hãng đã giao/trả hàng về) /
--                         'Chưa hoàn' (hãng chưa giao) /
--                         NULL (chưa check hãng lần nào)
--   received_status text — 'Đã nhận' (shop đã quét nhận hàng hoàn) /
--                          'Chưa nhận' / NULL (chưa có trạng thái)
-- KHÔNG bật RLS (giống return_receipt_checks).
--
-- Ghi (upsert theo order_id, onConflict 'order_id'):
--   * carrier_status: mục check 71/74 trong tab Đối chiếu (dán kết quả
--     AfterShip/17Track / upload file SPX) — 'Đã hoàn' nếu hãng báo đã
--     trả/delivered/returned-to-sender, 'Chưa hoàn' nếu chưa.
--   * received_status: tab Quét — quét trúng mã của đơn 71/74 thì ghi
--     'Đã nhận'; tick tay trong báo cáo cũng ghi vào đây.
--   * Hai trường ghi ĐỘC LẬP: upsert chỉ ghi cột cần đổi, không ghi đè
--     cột còn lại (VD dán kết quả chỉ đổi carrier_status, giữ nguyên
--     received_status; quét chỉ đổi received_status, giữ carrier_status).
--   * received_status là text thường (không có CHECK constraint) nên
--     'Đã khiếu nại' từ nút tick 3 trạng thái vẫn ghi được nếu cần.
--
-- Lưu ý: order_id là PRIMARY KEY nên Postgres đã tự tạo sẵn index duy
-- nhất (btree) trên cột này — không cần tạo thêm index riêng.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_carrier_checks (
  order_id text PRIMARY KEY,
  carrier_status text,
  received_status text
);
