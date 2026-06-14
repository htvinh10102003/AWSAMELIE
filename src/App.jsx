import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import OrderReport from './pages/OrderReport';
import PackingSpeed from './pages/PackingSpeed';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="bao-cao-don" element={<OrderReport />} />
          {/* Sửa lại dòng này cho chuẩn cú pháp React Router */}
          <Route path="toc-do-dong-goi" element={<PackingSpeed />} /> 
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}