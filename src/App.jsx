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
import ReturnProcessing from './pages/ReturnProcessing';
import PrintedOrdersToday from './pages/PrintedOrdersToday';
import UpdateWarehouseMap from './pages/UpdateWarehouseMap';
import ProductLocation from './pages/ProductLocation';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<Layout />}>

          {/* 📊 TAB DASHBOARD (TỔNG QUAN) */}
          <Route index element={<Dashboard />} /> {/* Đơn đi hàng ngày */}
          <Route path="dashboard-don-hoan" element={<UnderDevelopment />} />
          <Route path="dashboard-kpi" element={<UnderDevelopment />} />
          
          {/* 🖨️ TAB ĐƠN IN */}
          <Route path="bao-cao-don" element={<OrderReport />} />
          <Route path="don-da-in-hom-nay" element={<PrintedOrdersToday />} />

          {/* 📦 TAB ĐÓNG GÓI */}
          <Route path="dong-goi-don-hang" element={<UnderDevelopment />} />
          <Route path="toc-do-dong-goi-chung" element={<PackingSpeed mode="general" />} />
          <Route path="toc-do-dong-goi-nhan-su" element={<UnderDevelopment />} />
          
          {/* 🔄 TAB ĐƠN HOÀN */}
          {/* Bẻ lái link cũ sang tính năng kiểm tra đơn hoàn mới */}
          <Route path="bao-cao-hoan" element={<Navigate to="/kiem-tra-don-hoan" replace />} />
          <Route path="bao-cao-hoan-tong-hop" element={<UnderDevelopment />} />
          <Route path="kiem-tra-don-hoan" element={<KiemTraDonHoan />} />
          <Route path="xu-ly-don-hoan" element={<ReturnProcessing />} />

          {/* 📋 TAB BÁO CÁO KIỂM KÊ */}
          {/* Bẻ lái link gốc sang thống kê */}
          <Route path="bao-cao-kiem-ke" element={<Navigate to="/thong-ke-kiem-ke" replace />} />
          <Route path="thong-ke-kiem-ke" element={<UnderDevelopment />} />
          <Route path="danh-sach-kiem-ke" element={<UnderDevelopment />} />

          {/* 🏢 TAB TỒN KHO */}
          <Route path="bao-cao-ton-kho" element={<InventoryReport />} />
          <Route path="vi-tri-san-pham" element={<ProductLocation />} />
          <Route path="chi-dan-nhat-hang" element={<UnderDevelopment />} />

          {/* ⚠️ CÁC BÁO CÁO ĐƠN LẺ */}
          <Route path="don-khong-khai-gia" element={<DeclaredFeeReport />} />
          <Route path="doi-soat-kho" element={<OrderReconciliation />} />
          
          {/* 🔒 KHÓA CỔNG CÀI ĐẶT ADMIN: Bọc ProtectedRoute bảo vệ nghiêm ngặt */}
          <Route path="admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

          {/* 🔒 KHÓA CỔNG HIỆU CHỈNH: Được bảo vệ nghiêm ngặt bằng ProtectedRoute */}
          <Route path="cap-nhat-nguoi-dong-goi" element={<ProtectedRoute><UpdatePacker /></ProtectedRoute>} />
          <Route path="cap-nhat-lich-lam-viec" element={<ProtectedRoute><UpdateSchedule /></ProtectedRoute>} /> 
          <Route path="cap-nhat-san-pham" element={<ProtectedRoute><UpdateProduct /></ProtectedRoute>} />
          <Route path="cap-nhat-so-do-kho" element={<ProtectedRoute><UpdateWarehouseMap /></ProtectedRoute>} />
          
        </Route>
      </Routes>
    </BrowserRouter>
  );
}