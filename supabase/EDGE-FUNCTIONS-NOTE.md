# Edge Functions: da deploy nhung khong co source trong repo

Kiem tra ngay 2026-10-30 bang anon key (chi goi thu, khong thay doi du lieu):
- `wms-allocation`: dang chay (tra ve printable/holding/outOfStock) - duoc OrderReport goi, khong co body.
- `smart-service`: dang chay (tra loi validation khi body rong) - duoc WebhookRetrier goi voi { ids: [...] }, tra ve { filteredIds }.
- `spx-printer`: dang chay (tra loi validation khi body rong) - duoc SpxPrinter goi voi { trackingNumbers: [...] }, tra ve { code: 0, ... } khi thanh cong.
- `nhanh-auth`, `get-upload-url`, `sync-nhanh`: co trong repo va dang chay.

Ket luan: 3 function dau KHONG MAT, chi la source khong nam trong repo nay (co the deploy tu repo khac hoac tu Supabase Dashboard).
Khong nen viet lai logic `wms-allocation` tu dau vi no anh huong truc tiep den viec chia don in / giu / het hang.
De lam: neu Vinh tim duoc source goc thi copy vao `supabase/functions/wms-allocation`, `smart-service`, `spx-printer` roi moi sua tiep. Neu khong tim duoc thi cu de nguyen ban deploy hien tai, dung dong vao.

RPC (cung kiem tra ngay 2026-10-30):
- `get_db_size`: CO, tra ve 139291795 bytes (~133 MB) luc kiem tra.
- `request_cleanup(days_old)`: CO, Admin goi khi bam don dep. Chi chay khi Vinh bam nut va xac nhan trong Admin, khong tu dong chay.
- `get_orders_by_zone(awb_list)`: CO, FilterByZone goi.
