import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import FeatureGuard from './components/FeatureGuard';
import MaintenanceGate from './components/MaintenanceGate';
import DevtoolGuard from './components/DevtoolGuard';

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
const TraHangHoanTien = lazy(() => import('./pages/TraHangHoanTien'));
const BaoCaoHoanChuaNhan = lazy(() => import('./pages/BaoCaoHoanChuaNhan'));
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
const BillPrint = lazy(() => import('./pages/BillPrint'));
const StatusTransitionTracker = lazy(() => import('./pages/StatusTransitionTracker'));
const FeatureLockManager = lazy(() => import('./pages/FeatureLockManager'));
const NotFound = lazy(() => import('./pages/NotFound'));
const UploadVideoHoan = lazy(() => import('./pages/UploadVideoHoan'));
const VideoKhieuNai = lazy(() => import('./pages/VideoKhieuNai'));
const TongHopKhieuNai = lazy(() => import('./pages/TongHopKhieuNai'));
const Mobile = lazy(() => import('./pages/Mobile'));

export default function App() {
  return (
    <BrowserRouter>
      <DevtoolGuard />
      <Suspense fallback={<div className="h-screen flex items-center justify-center font-sans text-slate-500 font-semibold animate-pulse">Đang tải trang...</div>}>
      <MaintenanceGate>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Giao diện điện thoại riêng, ngoài Layout desktop, tự kiểm tra đăng nhập trong trang */}
        <Route path="/mobile" element={<Mobile />} />

        <Route path="/" element={<Layout />}>

          {/* 📊 TAB DASHBOARD (TỔNG QUAN) - Cụm featureId="dashboard" */}
          <Route index element={
            <FeatureGuard featureId="dashboard" subFeatureId="don_di_hang_ngay">
              <Dashboard />
            </FeatureGuard>
          } />
          <Route path="dashboard-returns" element={
            <FeatureGuard featureId="dashboard" subFeatureId="dashboard_don_hoan">
              <DashboardDonHoan />
            </FeatureGuard>
          } />
          <Route path="dashboard-kpi" element={
            <FeatureGuard featureId="dashboard" subFeatureId="dashboard_kpi">
              <KPI_Report />
            </FeatureGuard>
          } />
          <Route path="status-transitions" element={
            <FeatureGuard featureId="dashboard" subFeatureId="tra_cuu_luan_chuyen">
              <StatusTransitionTracker />
            </FeatureGuard>
          } />
          
          {/* 🖨️ TAB ĐƠN IN - Cụm featureId="print_orders" */}
          <Route path="order-report" element={
            <FeatureGuard featureId="print_orders" subFeatureId="bao_cao_don">
              <OrderReport />
            </FeatureGuard>
          } />
          <Route path="printed-today" element={
            <FeatureGuard featureId="print_orders" subFeatureId="don_da_in">
              <PrintedOrdersToday />
            </FeatureGuard>
          } />
          <Route path="filter-by-zone" element={
            <FeatureGuard featureId="print_orders" subFeatureId="loc_don_day_ke">
              <FilterByZone />
            </FeatureGuard>
          } />
          <Route path="awb-locations" element={
            <FeatureGuard featureId="print_orders" subFeatureId="chen_vi_tri_awb">
              <AWBProcessor />
            </FeatureGuard>
          } />
          <Route path="print-spx-orders" element={
            <FeatureGuard featureId="print_orders" subFeatureId="in_don_spx">
              <SpxPrinter />
            </FeatureGuard>
          } />
          <Route path="in-bill" element={
            <FeatureGuard featureId="print_orders" subFeatureId="in_bill">
              <BillPrint />
            </FeatureGuard>
          } />

          {/* 📦 TAB ĐÓNG GÓI - Cụm featureId="packing" */}
          <Route path="packing-orders" element={
            <FeatureGuard featureId="packing" subFeatureId="dong_goi_don_hang">
              <UnderDevelopment />
            </FeatureGuard>
          } />
          <Route path="packing-speed" element={
            <FeatureGuard featureId="packing" subFeatureId="toc_do_dong_goi_chung">
              <PackingSpeed mode="general" />
            </FeatureGuard>
          } />
          <Route path="packing-speed-by-staff" element={
            <FeatureGuard featureId="packing" subFeatureId="toc_do_dong_goi_nhan_su">
              <UnderDevelopment />
            </FeatureGuard>
          } />
          
          {/* 🔄 TAB ĐƠN HOÀN - Cụm featureId="return_orders" */}
          <Route path="bao-cao-hoan" element={<Navigate to="/check-returns" replace />} />
          <Route path="returns-summary" element={
            <FeatureGuard featureId="return_orders" subFeatureId="bao_cao_hoan_tong_hop">
              <UnderDevelopment />
            </FeatureGuard>
          } />
          <Route path="check-returns" element={
            <FeatureGuard featureId="return_orders" subFeatureId="kiem_tra_don_hoan">
              <KiemTraDonHoan />
            </FeatureGuard>
          } />
          <Route path="process-returns" element={
            <FeatureGuard featureId="return_orders" subFeatureId="xu_ly_don_hoan">
              <ReturnProcessing />
            </FeatureGuard>
          } />
          <Route path="returns-refunds" element={
            <FeatureGuard featureId="return_orders" subFeatureId="tra_hang_hoan_tien">
              <TraHangHoanTien />
            </FeatureGuard>
          } />
          <Route path="unreceived-returns" element={
            <FeatureGuard featureId="return_orders" subFeatureId="bao_cao_hoan_chua_nhan">
              <BaoCaoHoanChuaNhan />
            </FeatureGuard>
          } />

          {/* 📋 TAB BÁO CÁO KIỂM KÊ - Cụm featureId="inventory_check" */}
          <Route path="bao-cao-kiem-ke" element={<Navigate to="/inventory-count-stats" replace />} />
          <Route path="inventory-count-stats" element={
            <FeatureGuard featureId="inventory_check" subFeatureId="thong_ke_kiem_ke">
              <UnderDevelopment />
            </FeatureGuard>
          } />
          <Route path="inventory-count-list" element={
            <FeatureGuard featureId="inventory_check" subFeatureId="danh_sach_kiem_ke">
              <UnderDevelopment />
            </FeatureGuard>
          } />

          {/* 🏢 TAB TỒN KHO - Cụm featureId="inventory_report" */}
          <Route path="inventory-report" element={
            <FeatureGuard featureId="inventory_report" subFeatureId="bao_cao_ton_kho">
              <InventoryReport />
            </FeatureGuard>
          } />
          <Route path="product-locations" element={
            <FeatureGuard featureId="inventory_report" subFeatureId="vi_tri_san_pham">
              <ProductLocation />
            </FeatureGuard>
          } />

          {/* ⚠️ TAB KHIẾU NẠI - Cụm featureId="complaints" (MỚI) */}
          <Route path="complaints" element={
            <FeatureGuard featureId="complaints" subFeatureId="tong_hop_khieu_nai">
              <TongHopKhieuNai />
            </FeatureGuard>
          } />
          <Route path="complaint-videos" element={
            <FeatureGuard featureId="complaints" subFeatureId="video_khieu_nai">
              <VideoKhieuNai />
            </FeatureGuard>
          } />

          {/* ⚠️ CÁC BÁO CÁO ĐƠN LẺ */}
          <Route path="undeclared-fee-orders" element={
            <FeatureGuard featureId="standalone_khai_gia">
              <DeclaredFeeReport />
            </FeatureGuard>
          } />
          <Route path="stock-reconciliation" element={
            <FeatureGuard featureId="standalone_doi_soat">
              <OrderReconciliation />
            </FeatureGuard>
          } />
          
          {/* 🔒 KHÓA CỔNG CÀI ĐẶT ADMIN: Bọc ProtectedRoute bảo vệ nghiêm ngặt */}
          <Route path="admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

          {/* 🔒 KHÓA CỔNG HIỆU CHỈNH: Được bảo vệ nghiêm ngặt bằng ProtectedRoute */}
          <Route path="update-packers" element={<ProtectedRoute><UpdatePacker /></ProtectedRoute>} />
          <Route path="update-work-schedule" element={<ProtectedRoute><UpdateSchedule /></ProtectedRoute>} /> 
          <Route path="update-products" element={<ProtectedRoute><UpdateProduct /></ProtectedRoute>} />
          <Route path="update-warehouse-map" element={<ProtectedRoute><UpdateWarehouseMap /></ProtectedRoute>} />
          
          <Route path="kpi-management" element={<ProtectedRoute><KPI_Management /></ProtectedRoute>} />
          <Route path="kpi-data-entry" element={<ProtectedRoute><KPI_DataEntry /></ProtectedRoute>} />
          
          <Route path="update-shelf-zones" element={<ProtectedRoute><SetupZone /></ProtectedRoute>} />
          <Route path="webhook-retry" element={<ProtectedRoute><WebhookRetrier /></ProtectedRoute>} />

          {/* === TRANG UPLOAD VIDEO CHO ADMIN === */}
          <Route path="upload-return-videos" element={<ProtectedRoute><UploadVideoHoan /></ProtectedRoute>} />

          {/* 🛡️ TRANG QUẢN LÝ KHÓA TÍNH NĂNG (DÀNH RIÊNG CHO OWNER) */}
          <Route path="feature-locks" element={<ProtectedRoute><FeatureLockManager /></ProtectedRoute>} />


          {/* === LEGACY REDIRECTS: old Vietnamese slugs -> new English slugs (bookmarks/shared links keep working) === */}
          <Route path="bao-cao-don" element={<Navigate to="/order-report" replace />} />
          <Route path="bao-cao-hoan-chua-nhan" element={<Navigate to="/unreceived-returns" replace />} />
          <Route path="bao-cao-hoan-tong-hop" element={<Navigate to="/returns-summary" replace />} />
          <Route path="bao-cao-ton-kho" element={<Navigate to="/inventory-report" replace />} />
          <Route path="cap-nhat-day-ke" element={<Navigate to="/update-shelf-zones" replace />} />
          <Route path="cap-nhat-lich-lam-viec" element={<Navigate to="/update-work-schedule" replace />} />
          <Route path="cap-nhat-nguoi-dong-goi" element={<Navigate to="/update-packers" replace />} />
          <Route path="cap-nhat-san-pham" element={<Navigate to="/update-products" replace />} />
          <Route path="cap-nhat-so-do-kho" element={<Navigate to="/update-warehouse-map" replace />} />
          <Route path="cap-nhat-tinh-nang" element={<Navigate to="/feature-locks" replace />} />
          <Route path="cap-nhat-webhook" element={<Navigate to="/webhook-retry" replace />} />
          <Route path="chen-vi-tri-awb" element={<Navigate to="/awb-locations" replace />} />
          <Route path="danh-sach-kiem-ke" element={<Navigate to="/inventory-count-list" replace />} />
          <Route path="dashboard-don-hoan" element={<Navigate to="/dashboard-returns" replace />} />
          <Route path="doi-soat-kho" element={<Navigate to="/stock-reconciliation" replace />} />
          <Route path="don-da-in-hom-nay" element={<Navigate to="/printed-today" replace />} />
          <Route path="don-khong-khai-gia" element={<Navigate to="/undeclared-fee-orders" replace />} />
          <Route path="dong-goi-don-hang" element={<Navigate to="/packing-orders" replace />} />
          <Route path="in-don-spx" element={<Navigate to="/print-spx-orders" replace />} />
          <Route path="kiem-tra-don-hoan" element={<Navigate to="/check-returns" replace />} />
          <Route path="loc-don-theo-day-ke" element={<Navigate to="/filter-by-zone" replace />} />
          <Route path="nhap-lieu-kpi" element={<Navigate to="/kpi-data-entry" replace />} />
          <Route path="quan-ly-kpi" element={<Navigate to="/kpi-management" replace />} />
          <Route path="thong-ke-kiem-ke" element={<Navigate to="/inventory-count-stats" replace />} />
          <Route path="toc-do-dong-goi-chung" element={<Navigate to="/packing-speed" replace />} />
          <Route path="toc-do-dong-goi-nhan-su" element={<Navigate to="/packing-speed-by-staff" replace />} />
          <Route path="tong-hop-khieu-nai" element={<Navigate to="/complaints" replace />} />
          <Route path="tra-cuu-luan-chuyen" element={<Navigate to="/status-transitions" replace />} />
          <Route path="tra-hang-hoan-tien" element={<Navigate to="/returns-refunds" replace />} />
          <Route path="upload-video-hoan" element={<Navigate to="/upload-return-videos" replace />} />
          <Route path="vi-tri-san-pham" element={<Navigate to="/product-locations" replace />} />
          <Route path="video-khieu-nai" element={<Navigate to="/complaint-videos" replace />} />
          <Route path="xu-ly-don-hoan" element={<Navigate to="/process-returns" replace />} />
          {/* 🚀 BẮT MỌI LINK SAI Ở ĐÂY - PHẢI ĐẶT Ở DƯỚI CÙNG TRONG THẺ BỌC LAYOUT */}
          <Route path="*" element={<NotFound />} />

        </Route>
      </Routes>
      </MaintenanceGate>
      </Suspense>
    </BrowserRouter>
  );
}