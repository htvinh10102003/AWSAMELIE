# Chuẩn giao diện AWSAMELIE (áp từ đợt 2026-10-30)
- Nền chung: slate-50, card trắng viền slate-200 bo 16px, bóng nhẹ (ui-card trong src/components/ui.jsx).
- Chữ: font-bold (không dùng font-black), tiêu đề tracking-tight, label uppercase text-xs.
- Chữ nhỏ nhất: text-xs (12px), không dùng 9-10px cho nội dung đọc được.
- Card kính (bg-white/70 + backdrop-blur) đã bỏ, chuyển sang card đặc để đọc được trên nền lễ.
- Không dùng emoji trong giao diện, dùng icon Lucide + chữ trạng thái.
- Banner thông báo: dòng tĩnh, không chạy marquee. Ảnh nền lễ: cover, không kéo giãn 100% x 100%.
- Logic, dữ liệu, route, quyền: không đổi. Chỉ đổi class hiển thị và text hiển thị.

## Phan quyen (them 2026-10-30)
- File chuan: src/lib/roles.js - user / admin / super_admin, owner la co rieng.
- Super admin = admin + thay doi Nhanh.vn, Google Sheet don in/don di, nen giao dien.
- Super admin KHONG co: don dep DB, cap/xoa tai khoan, thong bao global, dong bo hoan (van owner).
- Owner moi duoc cap super_admin (form tao/sua user trong Admin, edge manage-users giu doi role chi owner).
