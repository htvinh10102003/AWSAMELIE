# Design System AWSAMELIE (áp từ đợt restyle 2026-11-05, theo skill ui-ux-pro-max)

## Vòng 2 (2026-11-05, local, chưa push) — đổi cấu trúc hiển thị, không chỉ token

Vòng 1 chỉ đổi token + font nên nhìn không khác. Vòng 2 đổi hẳn cấu trúc:
- **Sidebar:** nhãn nhóm + divider, mục active nền slate-900 chữ trắng +
  vạch emerald 4px mép trái (inset shadow, không lệch layout); menu ngang
  cũng có active tương tự. Utility mới `.ui-section-title` (12px đậm in hoa,
  không fix màu).
- **Header trang thống nhất:** tiêu đề 24px đậm + dòng ngữ cảnh + hành động
  chính bên phải; OrderReport dùng dải slate-900 chữ trắng.
- **Card có hierarchy thật:** tiêu đề section + divider; card chính (hero)
  tint nền + viền accent + số lớn (Dashboard: Tổng đơn đã đi 32px nền
  emerald-50 viền emerald-300; OrderReport: Đủ hàng 30px nền emerald-50/60).
- **Bảng dễ quét:** cell padding lớn hơn, hover rõ, dòng đang tick nền
  emerald-50, ID mono đậm, pill trạng thái rounded-full (chỉ đổi hình,
  mapping màu Nhanh giữ nguyên).
- **Nút chính emerald-600 đặc** toàn app (nút phụ trắng viền); mobile nút
  chính py-3 (~44px vùng bấm), bottom nav active emerald.
- **Giữ nguyên:** mọi trường dữ liệu, logic, route, phân quyền, API, thứ tự
  dữ liệu, text tiếng Việt; hệ bill in; banner thường; viền đỏ bàn giao;
  mapping màu trạng thái Nhanh; kích thước in tem; logo sidebar blue-600
  (vẫn chờ quyết giữ làm điểm nhấn brand hay đổi sang slate).
- **Điểm cần quyết:** chữ trắng trên emerald-600 chỉ 3.77:1 (dưới chuẩn
  4.5:1 của vòng 1) — giữ emerald-600 hay chuyển emerald-700 (đổi 1 token).

Nguồn: repo `nextlevelbuilder/ui-ux-pro-max-skill`, đối chiếu đúng logic của nó:
row `ui-reasoning.csv` No.102 "Inventory & Stock Management"
(`Style_Priority: Flat Design + Minimalism & Swiss Style`, màu
`Functional neutral + status traffic-light + scanner accent`,
`Anti_Patterns: Excessive decoration + Complex shadows + 3D effects`),
row No.49 "Logistics/Delivery", và style `data-dense-dashboard`
(bảng dày, sticky header, row ~36px, KPI cards, filter, export).
Dial của skill cho app này: variance thấp (1–3), motion thấp (1–3),
density cao (8–10). Light-first, không dark mode.

## Token

| Vai trò | Giá trị | Ghi chú |
|---|---|---|
| Nền app | `#F8FAFC` (lớp `bg-slate-50` tương đương) | Sửa lệch slate-50/slate-100 trước đây |
| Card | `#FFFFFF`, viền `#E2E8F0` (slate-200) | |
| Chữ chính / chữ phụ | `#0F172A` / `#64748b` (slate-500, đạt 4.76:1 trên trắng) | |
| Nút chính (primary) | `#059669` (emerald-600), hover `#047857` (emerald-700) | Vòng 2: đổi từ slate-700 để hành động chính nổi bật ngay. LƯU Ý: chữ trắng trên emerald-600 chỉ 3.77:1, dưới chuẩn 4.5:1 — điểm cần quyết: giữ emerald-600 hay về emerald-700 |
| Nút đã chọn (tab/segmented) | `bg-slate-900` text trắng | |
| Accent quét/đủ hàng | `#059669` (emerald-600) | Chỉ nền nhạt + chữ đậm; KHÔNG chữ trắng trên nền emerald-600 (chỉ 3.77:1) |
| Info/link | `#2563EB` (blue-600) | Chỉ link/badge/info/trạng thái/biểu đồ, KHÔNG làm nút chính |
| Nguy hiểm | `#DC2626` (red-600) | |
| Focus ring | `#334155`, 2px, offset 2px (`:focus-visible` toàn cục) | |
| Trạng thái (traffic-light) | xanh lá / amber / đỏ + chữ đậm trên nền nhạt | Nghĩa không chỉ dựa vào màu — luôn kèm label chữ |

## Typography

- Giao diện: **Inter** (400/500/600/700, Google Fonts, fallback system stack).
  Inter có subset tiếng Việt; nếu load lỗi thì fallback, giao diện không vỡ.
- Mã/số (ID đơn, mã vận đơn, SKU, tiền): **JetBrains Mono** (`font-mono`).
- Thang chữ: 12 – 14 – 16 – 18 – 24 – 32. Nội dung chính 14px,
  label/badge/bảng 12px. **Tối thiểu 12px** — không dùng 10/11px.
- Heading `font-bold tracking-tight` (không `font-black`).
  Label form `text-xs font-bold uppercase tracking-wider`.

## Component

- **Card:** `bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6`.
  Bo 16px là lệch có chủ ý khỏi Flat 0–4px của skill, để giữ chuẩn
  đã duyệt 2026-10-30. Không shadow màu, không shadow nhiều lớp.
  Vòng 2: hierarchy thật — tiêu đề section đậm + divider; card chính
  (hero) dùng tint nền + viền accent + số lớn, card phụ giữ trắng phẳng.
- **Bảng:** wrapper `bg-white border-slate-200 rounded-2xl overflow-hidden`
  + `overflow-x-auto`; thead `bg-slate-50 text-xs font-bold text-slate-500`,
  **sticky top-0** khi bảng nằm trong vùng cuộn; tbody `divide-slate-100`;
  hàng `hover:bg-slate-50`; cell `px-4 py-3`.
  Vòng 2: cell padding lớn hơn, hover rõ, dòng đang tick nền emerald-50,
  ID mono đậm, pill trạng thái rounded-full; riêng OrderReport dùng thead
  slate-900 chữ trắng (các bảng khác giữ thead slate-50).
- **Nút:** chính `bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold
  rounded-xl px-4 py-2 shadow-sm` (vòng 2, trước đó slate-700); phụ `bg-white border-slate-300
  hover:bg-slate-50 text-slate-700 rounded-xl`; nguy hiểm
  `bg-red-600 hover:bg-red-700 rounded-xl`; icon-only `p-2 rounded-lg`.
  1 primary CTA mỗi màn hình; disabled kèm thuộc tính `disabled` thật.
- **Badge:** `rounded-full px-2 py-0.5 text-xs font-bold` + nền nhạt/chữ
  đậm/viền nhạt. Badge = trạng thái tĩnh; chip filter tương tác = nút.
- **Modal:** backdrop `bg-slate-900/50`; panel `bg-white rounded-2xl
  shadow-2xl p-6 sm:p-8`. Không dùng modal làm luồng điều hướng chính.
- **Tab:** segmented `bg-slate-100 p-1.5 rounded-2xl`, active nền trắng
  hoặc `bg-slate-900 text-white` (tab rời). Không trộn Tab + Sidebar +
  Bottom Nav cùng cấp.
- **Mobile:** bottom nav tối đa 5 item, luôn icon + label, tab active vòng 2:
  nền emerald-50, chữ + icon emerald-700 extrabold, vạch indicator 4px
  emerald-600 ở mép trên (vòng 1: indicator 3px slate-900); bottom-sheet thay modal giữa;
  input `py-3 text-base` (chống iOS zoom); header đen mobile GIỮ NGUYÊN
  (bản sắc mobile). Touch target đủ lớn, gap ≥ 8px.
- **Motion:** hover chỉ đổi màu/opacity, 150–250ms; không animation
  trang trí; tôn trọng `prefers-reduced-motion`.

## Cố tình KHÔNG đổi (restyle 2026-11-05)

- Hệ bill in tùy chỉnh: `src/lib/billTemplates.js`,
  `BillTemplateBuilder.jsx`, `BillPrint.jsx`, `PrintSettings.jsx`.
- 4 theme lễ trong `Layout.jsx` — ĐÃ XÓA 2026-11-05 theo yêu cầu user
  (không còn theme lễ, ảnh nền lễ, confetti/shimmer; banner thường,
  banner bảo trì và keyframes marquee/notif giữ nguyên).
- Màu badge trạng thái Nhanh, màu series biểu đồ, viền đỏ đơn cần bàn giao.
- Kích thước in tem vật lý trong `InventoryReport.jsx` (mm, font 4–8.5px).
- 3 mã hủy 58/63/64 cùng `bg-zinc-700` (cùng nhóm "hủy", có label chữ).
- Logic màu thông báo lỗi ở `Admin.jsx` (`includes('')` luôn đúng) — ĐÃ SỬA
  trong commit vòng 1 `5d93ea3d` (3 banner user/banner/notif: đỏ khi chứa
  'Lỗi'/'Không thể', icon AlertCircle cho lỗi).
- `src/components/ui.jsx` vẫn là code chết (không trang nào import) —
  đợt này chỉ bắt class chạy theo chuẩn, không tái cấu trúc JSX để dùng nó.
- Logo sidebar vẫn `bg-blue-600`, hover mục chưa chọn vẫn `text-blue-600` —
  chờ quyết có đổi nốt sang slate hay giữ làm điểm nhấn brand.
