import { Loader2 } from 'lucide-react';

// Man hinh cho khoi dong: chi hien trong luc phien dang nhap + cau hinh
// goc (bao tri, khoa tinh nang, role) dang duoc xac minh, va bien mat ngay
// khi app san sang ve (hoac hien man hinh dang nhap khi chua dang nhap).
// Khong co delay gia tao. Kieu theo fallback Suspense o App.jsx
// ("Đang tải trang...") va spinner "Đang tải phân quyền..." cu cua Layout.
export default function BootSplash() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 font-sans text-slate-500 font-semibold animate-pulse">
      <Loader2 size={32} className="animate-spin text-blue-600" />
      <span>Đang kiểm tra đăng nhập</span>
    </div>
  );
}
