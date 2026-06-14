import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import OrderReport from './pages/OrderReport';
import PackingSpeed from './pages/PackingSpeed';
import Login from './pages/Login'; // Import trang Login mới
import ProtectedRoute from './components/ProtectedRoute'; // Import bộ hộ vệ chặn cửa

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang Login độc lập hoàn toàn, không nằm trong bộ khung Layout hệ thống */}
        <Route path="/login" element={<Login />} />

        {/* Bộ định tuyến chính của hệ thống */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="bao-cao-don" element={<OrderReport />} />
          <Route path="toc-do-dong-goi" element={<PackingSpeed />} /> 
          
          {/* ⚡️ KHÓA CỔNG ADMIN: Bọc ProtectedRoute bảo vệ nghiêm ngặt */}
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