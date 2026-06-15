import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import OrderReport from './pages/OrderReport';
import PackingSpeed from './pages/PackingSpeed';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import UnderDevelopment from './pages/UnderDevelopment'; 
import DeclaredFeeReport from './pages/DeclaredFeeReport';
import InventoryReport from './pages/InventoryReport';
import OrderReconciliation from './pages/OrderReconciliation';
import UpdateSchedule from './pages/UpdateSchedule';

// ⚡️ IMPORT TRANG HIỆU CHỈNH NGƯỜI ĐÓNG GÓI MỚI
import UpdatePacker from './pages/UpdatePacker';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang Login độc lập hoàn toàn, không nằm trong bộ khung Layout hệ thống */}
        <Route path="/login" element={<Login />} />

        {/* ⚡️ BỘ ĐỊNH TUYẾN CHÍNH: Phải giữ nguyên Layout để hiển thị thanh Sidebar */}
        <Route path="/" element={<Layout />}>
          
          {/* 🎯 TRANG CHỦ INDEX: Trỏ về Dashboard xịn để vào phát xem biểu đồ ngay */}
          <Route index element={<Dashboard />} />
          
          <Route path="bao-cao-don" element={<OrderReport />} />
         <Route path="toc-do-dong-goi-chung" element={<PackingSpeed mode="general" />} />
<Route path="toc-do-dong-goi-nhan-su" element={<PackingSpeed mode="employee" />} />
          
          {/* 🛠 ĐƯỜNG DẪN CHO CÁC TAB BÁO CÁO VÀ VẬN HÀNH */}
          <Route path="bao-cao-hoan" element={<UnderDevelopment />} />
          <Route path="bao-cao-kiem-ke" element={<UnderDevelopment />} />
          <Route path="bao-cao-ton-kho" element={<InventoryReport />} />
          <Route path="don-khong-khai-gia" element={<DeclaredFeeReport />} />
          <Route path="doi-soat-kho" element={<OrderReconciliation />} />
          
          {/* 🔒 KHÓA CỔNG CÀI ĐẶT ADMIN: Bọc ProtectedRoute bảo vệ nghiêm ngặt */}
          <Route path="admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

          {/* 🔒 KHÓA CỔNG HIỆU CHỈNH: Xếp đồng cấp và được bảo vệ nghiêm ngặt */}
          <Route path="cap-nhat-nguoi-dong-goi" element={<ProtectedRoute><UpdatePacker /></ProtectedRoute>} />
          <Route path="cap-nhat-lich-lam-viec" element={<ProtectedRoute><UpdateSchedule /></ProtectedRoute>} /> 
        </Route>
      </Routes>
    </BrowserRouter>
  );
}