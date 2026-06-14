import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import OrderReport from './pages/OrderReport';
import PackingSpeed from './pages/PackingSpeed';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import UnderDevelopment from './pages/UnderDevelopment'; // ⚡️ IMPORT TRANG ĐANG PHÁT TRIỂN MỚI

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang Login độc lập hoàn toàn, không nằm trong bộ khung Layout hệ thống */}
        <Route path="/login" element={<Login />} />

        {/* Bộ định tuyến chính của hệ thống */}
        <Route path="/" element={<Layout />}>
          <Route index element={<UnderDevelopment />} />
          <Route path="bao-cao-don" element={<OrderReport />} />
          <Route path="toc-do-dong-goi" element={<PackingSpeed />} /> 
          
          {/* ⚡️ ĐƯỜNG DẪN CHO 3 TAB MỚI ĐỒNG BỘ THEO LAYOUT SIDEBAR */}
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