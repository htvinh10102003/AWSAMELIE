-- AWSAMELIE - VACUUM sau khi don dep (chay RIENG trong SQL Editor, sau khi nut Don dep bao "Da xong")
-- Ly do tach rieng: VACUUM khong chay duoc trong function / transaction cua RPC, nen khong the goi tu frontend.
-- VACUUM (khong FULL) chi danh dau khong gian chet de tai su dung, khong khoa bang lau, an toan chay ban ngay.
-- VACUUM FULL moi thu hep file that su, nhung KHOA BANG trong luc chay - chi chay luc it nguoi dung nhat, neu that su can.
vacuum analyze public.orders;
vacuum analyze public.order_products;
vacuum analyze public.order_histories;
vacuum analyze public.return_audit_logs;

-- Kiem tra dung luong sau vacuum:
-- select pg_size_pretty(pg_total_relation_size('public.orders')) as orders_size,
--        pg_size_pretty(pg_total_relation_size('public.order_histories')) as histories_size,
--        pg_size_pretty(pg_database_size(current_database())) as db_size;

-- CHI chay cac dong duoi neu dung luong van khong giam va dang luc it nguoi dung:
-- vacuum full public.orders;
-- vacuum full public.order_products;
-- vacuum full public.order_histories;
-- vacuum full public.return_audit_logs;
