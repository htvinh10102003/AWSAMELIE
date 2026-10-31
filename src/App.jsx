import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import FeatureGuard from './components/FeatureGuard';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Admin = lazy(() => import('./pages/Admin'));
const OrderReport = lazy(() => import('./pages/OrderReport'));
const PackingSpeed = lazy(() => import('./pages/PackingSpeed'));
const Login = lazy(() => import('./pages/Login'));
const UnderDevelopment = lazy(() => import('./pages/UnderDevelopment'));
const DeclaredFeeReport = lazy(() => import('./pages/DeclaredFeeReport'));
const InventoryReport = lazy(() => import('./pages/InventoryReport'));
const OrderReconciliation = lazy(() => import('./pages/OrderReconciliation'));
const UpdateSchedule = lazy(() => import('./pages/UpdateSchedule'));
const KiemTraDonHoan = lazy(() => import('./pages/KiemTraDonHoan'));
const UpdatePacker = lazy(() => import('./pages/UpdatePacker'));
const UpdateProduct = lazy(() => import('./pages/UpdateProduct'));
const ReturnProcessing = lazy(() => import('./pages/ReturnProcessing'));
const PrintedOrdersToday = lazy(() => import('./pages/PrintedOrdersToday'));
const UpdateWarehouseMap = lazy(() => import('./pages/UpdateWarehouseMap'));
const ProductLocation = lazy(() => import('./pages/ProductLocation'));
const KPI_Management = lazy(() => import('./pages/KPI_Management'));
const KPI_DataEntry = lazy(() => import('./pages/KPI_DataEntry'));
const KPI_Report = lazy(() => import('./pages/KPI_Report'));
const SetupZone = lazy(() => import('./pages/SetupZone'));
const FilterByZone = lazy(() => import('./pages/FilterByZone'));
const WebhookRetrier = lazy(() => import('./pages/WebhookRetrier'));
const DashboardDonHoan = lazy(() => import('./pages/DashboardDonHoan'));
const AWBProcessor = lazy(() => import('./pages/AWBProcessor'));
const SpxPrinter = lazy(() => import('./pages/SpxPrinter'));
const StatusTransitionTracker = lazy(() => import('./pages/StatusTransitionTracker'));
const FeatureLockManager = lazy(() => import('./pages/FeatureLockManager'));
const NotFound = lazy(() => import('./pages/NotFound'));
const UploadVideoHoan = lazy(() => import('./pages/UploadVideoHoan'));
const VideoKhieuNai = lazy(() => import('./pages/VideoKhieuNai'));
const TongHopKhieuNai = lazy(() => import('./pages/TongHopKhieuNai'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="h-screen flex items-center justify-center font-sans text-slate-500 font-semibold animate-pulse">Đang tải trang...</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<Layout />}>

          {/* 📊 TAB DASHBOARD (TỔNG QUAN) - Cụm featureId="dashboard" */}
          <Route index element={
            <FeatureGuard featureId="dashboard" subFeatureId="tong_quan">
              <Dashboard />
            </FeatureGuard>
          } />
          <Route path="dashboard-don-hoan" element={
            <FeatureGuard featureId="dashboard" subFeatureId="don_hoan">
              <DashboardDonHoan />
            </FeatureGuard>
          } />
          <Route path="dashboard-kpi" element={
            <FeatureGuard featureId="dashboard" subFeatureId="kpi">
              <KPI_Report />
            </FeatureGuard>
          } />
          <Route path="tra-cuu-luan-chuyen" element={
            <FeatureGuard featureId="dashboard" subFeatureId="tra_cuu">
              <StatusTransitionTracker />
            </FeatureGuard>
          } />
          
          {/* 🖨️ TAB ĐƠN IN - Cụm featureId="print_orders" */}
          <Route path="bao-cao-don" element={
            <FeatureGuard featureId="print_orders" subFeatureId="bao_cao">
              <OrderReport />
            </FeatureGuard>
          } />
          <Route path="don-da-in-hom-nay" element={
            <FeatureGuard featureId="print_orders" subFeatureId="da_in">
              <PrintedOrdersToday />
            </FeatureGuard>
          } />
          <Route path="loc-don-theo-day-ke" element={
            <FeatureGuard featureId="print_orders" subFeatureId="loc_day_ke">
              <FilterByZone />
            </FeatureGuard>
          } />
          <Route path="chen-vi-tri-awb" element={
            <FeatureGuard featureId="print_orders" subFeatureId="chen_awb">
              <AWBProcessor />
            </FeatureGuard>
          } />
          <Route path="in-don-spx" element={
            <FeatureGuard featureId="print_orders" subFeatureId="in_spx">
              <SpxPrinter />
            </FeatureGuard>
          } />

          {/* 📦 TAB ĐÓNG GÓI - Cụm featureId="packing" */}
          <Route path="dong-goi-don-hang" element={
            <FeatureGuard featureId="packing" subFeatureId="dong_goi">
              <UnderDevelopment />
            </FeatureGuard>
          } />
          <Route path="toc-do-dong-goi-chung" element={
            <FeatureGuard featureId="packing" subFeatureId="toc_do_chung">
              <PackingSpeed mode="general" />
            </FeatureGuard>
          } />
          <Route path="toc-do-dong-goi-nhan-su" element={
            <FeatureGuard featureId="packing" subFeatureId="toc_do_ns">
              <UnderDevelopment />
            </FeatureGuard>
          } />
          
          {/* 🔄 TAB ĐƠN HOÀN - Cụm featureId="returns" */}
          <Route path="bao-cao-hoan" element={<Navigate to="/kiem-tra-don-hoan" replace />} />
          <Route path="bao-cao-hoan-tong-hop" element={
            <FeatureGuard featureId="returns" subFeatureId="tong_hop">
              <UnderDevelopment />
            </FeatureGuard>
          } />
          <Route path="kiem-tra-don-hoan" element={
            <FeatureGuard featureId="returns" subFeatureId="kiem_tra">
              <KiemTraDonHoan />
            </FeatureGuard>
          } />
          <Route path="xu-ly-don-hoan" element={
            <FeatureGuard featureId="returns" subFeatureId="xu_ly">
              <ReturnProcessing />
            </FeatureGuard>
          } />

          {/* 📋 TAB BÁO CÁO KIỂM KÊ - Cụm featureId="inventory" */}
          <Route path="bao-cao-kiem-ke" element={<Navigate to="/thong-ke-kiem-ke" replace />} />
          <Route path="thong-ke-kiem-ke" element={
            <FeatureGuard featureId="inventory" subFeatureId="thong_ke_kiem_ke">
              <UnderDevelopment />
            </FeatureGuard>
          } />
          <Route path="danh-sach-kiem-ke" element={
            <FeatureGuard featureId="inventory" subFeatureId="ds_kiem_ke">
              <UnderDevelopment />
            </FeatureGuard>
          } />

          {/* 🏢 TAB TỒN KHO - Cụm featureId="inventory" */}
          <Route path="bao-cao-ton-kho" element={
            <FeatureGuard featureId="inventory" subFeatureId="ton_kho">
              <InventoryReport />
            </FeatureGuard>
          } />
          <Route path="vi-tri-san-pham" element={
            <FeatureGuard featureId="inventory" subFeatureId="vi_tri">
              <ProductLocation />
            </FeatureGuard>
          } />

          {/* ⚠️ TAB KHIẾU NẠI - Cụm featureId="complaints" (MỚI) */}
          <Route path="tong-hop-khieu-nai" element={
            <FeatureGuard featureId="complaints" subFeatureId="tong_hop_khieu_nai">
              <TongHopKhieuNai />
            </FeatureGuard>
          } />
          <Route path="video-khieu-nai" element={
            <FeatureGuard featureId="complaints" subFeatureId="video_khieu_nai">
              <VideoKhieuNai />
            </FeatureGuard>
          } />

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
          
          <Route path="quan-ly-kpi" element={<ProtectedRoute><KPI_Management /></ProtectedRoute>} />
          <Route path="nhap-lieu-kpi" element={<ProtectedRoute><KPI_DataEntry /></ProtectedRoute>} />
          
          <Route path="cap-nhat-day-ke" element={<ProtectedRoute><SetupZone /></ProtectedRoute>} />
          <Route path="cap-nhat-webhook" element={<ProtectedRoute><WebhookRetrier /></ProtectedRoute>} />

          {/* === TRANG UPLOAD VIDEO CHO ADMIN === */}
          <Route path="upload-video-hoan" element={<ProtectedRoute><UploadVideoHoan /></ProtectedRoute>} />

          {/* 🛡️ TRANG QUẢN LÝ KHÓA TÍNH NĂNG (DÀNH RIÊNG CHO OWNER) */}
          <Route path="cap-nhat-tinh-nang" element={<ProtectedRoute><FeatureLockManager /></ProtectedRoute>} />

          {/* 🚀 BẮT MỌI LINK SAI Ở ĐÂY - PHẢI ĐẶT Ở DƯỚI CÙNG TRONG THẺ BỌC LAYOUT */}
          <Route path="*" element={<NotFound />} />

        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}