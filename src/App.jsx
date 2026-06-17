// ⚡️ ĐÃ SỬA: Import thêm thuộc tính Navigate từ thư viện react-router-dom
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import KiemTraDonHoan from './pages/KiemTraDonHoan';
import UpdatePacker from './pages/UpdatePacker';
import UpdateProduct from './pages/UpdateProduct';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<Layout />}>

          <Route index element={<Dashboard />} />
          
          <Route path="bao-cao-don" element={<OrderReport />} />
          <Route path="toc-do-dong-goi-chung" element={<PackingSpeed mode="general" />} />
          <Route path="toc-do-dong-goi-nhan-su" element={<PackingSpeed mode="employee" />} />
          
          {/* ⚡️ FIX LỖI: Tự động bẻ lái link cũ sang tính năng kiểm tra đơn hoàn mới */}
          <Route path="bao-cao-hoan" element={<Navigate to="/kiem-tra-don-hoan" replace />} />
          
          {/* 🛠 ĐƯỜNG DẪN CHO CÁC TAB BÁO CÁO VÀ VẬN HÀNH */}
          <Route path="bao-cao-hoan-tong-hop" element={<UnderDevelopment />} />
          <Route path="kiem-tra-don-hoan" element={<KiemTraDonHoan />} />
          <Route path="bao-cao-kiem-ke" element={<UnderDevelopment />} />
          <Route path="bao-cao-ton-kho" element={<InventoryReport />} />
          <Route path="don-khong-khai-gia" element={<DeclaredFeeReport />} />
          <Route path="doi-soat-kho" element={<OrderReconciliation />} />
          
          {/* 🔒 KHÓA CỔNG CÀI ĐẶT ADMIN: Bọc ProtectedRoute bảo vệ nghiêm ngặt */}
          <Route path="admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

          {/* 🔒 KHÓA CỔNG HIỆU CHỈNH: Xếp đồng cấp và được bảo vệ nghiêm ngặt */}
          <Route path="cap-nhat-nguoi-dong-goi" element={<ProtectedRoute><UpdatePacker /></ProtectedRoute>} />
          <Route path="cap-nhat-lich-lam-viec" element={<ProtectedRoute><UpdateSchedule /></ProtectedRoute>} /> 
          <Route path="cap-nhat-san-pham" element={<ProtectedRoute><UpdateProduct /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}