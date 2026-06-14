import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import OrderReport from './pages/OrderReport';
import PackingSpeed from './pages/PackingSpeed';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import UnderDevelopment from './pages/UnderDevelopment'; 

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
          <Route path="toc-do-dong-goi" element={<PackingSpeed />} /> 
          
          {/* 🛠 ĐƯỜNG DẪN CHO 3 TAB MỚI: Hiện giao diện Đang phát triển */}
          <Route path="bao-cao-hoan" element={<UnderDevelopment />} />
          <Route path="bao-cao-kiem-ke" element={<UnderDevelopment />} />
          <Route path="bao-cao-ton-kho" element={<UnderDevelopment />} />
          
          {/* 🔒 KHÓA CỔNG ADMIN: Bọc ProtectedRoute bảo vệ nghiêm ngặt */}
          <Route 
            path="admin" 
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } 
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}