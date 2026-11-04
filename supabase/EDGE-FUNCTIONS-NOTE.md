# Edge Functions: da deploy nhung khong co source trong repo

Kiem tra ngay 2026-10-30 bang anon key (chi goi thu, khong thay doi du lieu):
- `wms-allocation`: dang chay (tra ve printable/holding/outOfStock) - duoc OrderReport goi, khong co body.
- `smart-service`: dang chay (tra loi validation khi body rong) - duoc WebhookRetrier goi voi { ids: [...] }, tra ve { filteredIds }.
- `spx-printer`: dang chay (tra loi validation khi body rong) - duoc SpxPrinter goi voi { trackingNumbers: [...] }, tra ve { code: 0, ... } khi thanh cong.
- `nhanh-auth`, `get-upload-url`, `sync-nhanh`: co trong repo va dang chay.

Ket luan: 3 function dau KHONG MAT, chi la source khong nam trong repo nay (co the deploy tu repo khac hoac tu Supabase Dashboard).
Khong nen viet lai logic `wms-allocation` tu dau vi no anh huong truc tiep den viec chia don in / giu / het hang.
De lam: neu Vinh tim duoc source goc thi copy vao `supabase/functions/wms-allocation`, `smart-service`, `spx-printer` roi moi sua tiep. Neu khong tim duoc thi cu de nguyen ban deploy hien tai, dung dong vao.

CAP NHAT 2026-11-04 (chi doc tu Dashboard, khong sua/deploy): source `wms-allocation` DA DUOC KHOI PHUC vao `supabase/functions/wms-allocation/index.ts` (182 dong, ban sao tu tab Code tren Dashboard; co the lech dong trang so voi ban goc). XAC NHAN: ham chi tao 1 client bang SUPABASE_ANON_KEY, khong dung service role key, khong chuyen tiep Authorization header — nen tu khi bat RLS sang 2026-11-04 no chi thay bang trong va tra ve rong. Ham doc system_configs (lay print_allowed_statuses, mac dinh '54,55,56,42,40', va print_priority_mode), product_inventories, orders kem order_products!order_id(*). Don khong co order_products thi invalidCount++ va vao outOfStock; don status 40 (code ghi ['40'], du comment ghi 42) hoac du hang thi vao printable; du 1 phan thi holding; khong du thi outOfStock. FIX DUNG (Vinh chot 2026-11-04, da deploy 10:57): doi SUPABASE_ANON_KEY -> SUPABASE_SERVICE_ROLE_KEY, giu nguyen moi logic, Verify JWT OFF giu nguyen, RLS giu nguyen; Vinh xac nhan phan bo hien lai 10:58. File index.ts trong repo hien la BAN SERVICE KEY, khop ban dang chay tren Dashboard (da push len repo ngay 2026-11-04).

RPC (cung kiem tra ngay 2026-10-30):
- `get_db_size`: CO, tra ve 139291795 bytes (~133 MB) luc kiem tra.
- `request_cleanup(days_old)`: CO, Admin goi khi bam don dep. Chi chay khi Vinh bam nut va xac nhan trong Admin, khong tu dong chay.
- `get_orders_by_zone(awb_list)`: CO, FilterByZone goi.
