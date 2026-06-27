import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, Printer, Timer, Settings, PackageSearch, LogOut, Undo2, ScanLine, 
  Boxes, AlertTriangle, X, Wrench, ChevronDown, ChevronRight, UserCog, CalendarDays, 
  BarChart3, User, Pin, PinOff, ClipboardCheck, PackageMinus, CheckCircle2, 
  LayoutDashboard, Target, Box, ListChecks, MapPin, BarChart2, Menu
} from 'lucide-react';
import TestingNoticeBanner from './TestingNoticeBanner';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // States quản lý sidebar thu gọn / ghim
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const sidebarExpanded = isSidebarPinned || isSidebarHovered;

  // STATE MOBILE MENU
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // STATES QUẢN LÝ ĐÓNG/MỞ CÁC MENU DROPDOWN
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isPrintOrdersOpen, setIsPrintOrdersOpen] = useState(false);
  const [isPackingOpen, setIsPackingOpen] = useState(false);
  const [isReturnOrdersOpen, setIsReturnOrdersOpen] = useState(false);
  const [isInventoryCheckOpen, setIsInventoryCheckOpen] = useState(false);
  const [isInventoryReportOpen, setIsInventoryReportOpen] = useState(false);
  const [isAdjustMenuOpen, setIsAdjustMenuOpen] = useState(false);

  // Tự động mở dropdown nếu đang ở trang con
  useEffect(() => {
    if (location.pathname === '/' || location.pathname.includes('/dashboard-')) setIsDashboardOpen(true);
    if (location.pathname.includes('/bao-cao-don') || location.pathname.includes('/don-da-in-hom-nay')) setIsPrintOrdersOpen(true);
    if (location.pathname.includes('/dong-goi-') || location.pathname.includes('/toc-do-dong-goi-')) setIsPackingOpen(true);
    if (location.pathname.includes('/bao-cao-hoan-') || location.pathname.includes('/kiem-tra-don-hoan') || location.pathname.includes('/xu-ly-don-hoan')) setIsReturnOrdersOpen(true);
    if (location.pathname.includes('/thong-ke-kiem-ke') || location.pathname.includes('/danh-sach-kiem-ke')) setIsInventoryCheckOpen(true);
    if (location.pathname.includes('/bao-cao-ton-kho') || location.pathname.includes('/vi-tri-san-pham')) setIsInventoryReportOpen(true);
    if (location.pathname.includes('/cap-nhat-')) setIsAdjustMenuOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login');
      else setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const userEmail = user?.email || '';
  const displayName = user?.user_metadata?.full_name || userEmail.split('@')[0] || 'Đang tải...';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const isAdmin = user?.user_metadata?.role === 'admin';

  // ⚡️ KHAI BÁO CẤU TRÚC MENU MỚI
  const reportMenus = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'print_orders', icon: Printer, label: 'Đơn in' },
    { id: 'packing', icon: Timer, label: 'Đóng gói' },
    { id: 'return_orders', icon: Undo2, label: 'Báo cáo đơn hoàn' },
    { id: 'inventory_check', icon: ClipboardCheck, label: 'Báo cáo kiểm kê' },
    { path: '/doi-soat-kho', icon: ScanLine, label: 'Đối soát đơn cuối ngày' },
    { id: 'inventory_report', icon: Boxes, label: 'Báo cáo tồn kho' },
    { path: '/don-khong-khai-gia', icon: AlertTriangle, label: 'Đơn không khai giá' },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 font-sans antialiased text-gray-800 tracking-normal selection:bg-blue-500/20 selection:text-blue-700">
      
      {/* SIDEBAR */}
      <div
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        onClick={(e) => {
          // Đóng mobile menu khi click vào Link (thẻ a)
          if (e.target.closest('a')) {
            setMobileMenuOpen(false);
          }
        }}
        className={`flex-shrink-0 bg-white/70 backdrop-blur-2xl border-r border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col z-10 transition-all duration-300 ease-in-out relative ${
          sidebarExpanded ? 'w-64' : 'w-16'
        } max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transform max-md:transition-all max-md:duration-300 max-md:ease-in-out max-md:w-64 max-md:shadow-2xl ${
          mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        }`}
      >
        
        {/* Logo + Pin button */}
        <div className="h-16 flex items-center justify-center relative bg-white/50 backdrop-blur-md border-b border-white/20 rounded-br-2xl">
          {sidebarExpanded ? (
            <div className="flex items-center w-full px-4">
              <div className="bg-blue-600 p-1.5 rounded-xl mr-3 shadow-lg shadow-blue-500/20">
                <PackageSearch className="text-white" size={22} />
              </div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Amelie<span className="text-blue-600 font-semibold">WMS</span></h1>
            </div>
          ) : (
            <div className="p-1.5 rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20">
              <PackageSearch className="text-white" size={20} />
            </div>
          )}
          <button
            onClick={() => setIsSidebarPinned(!isSidebarPinned)}
            className={`absolute p-1 rounded-lg hover:bg-white/60 transition-colors ${sidebarExpanded ? 'right-2 top-4' : 'right-1 top-1'}`}
            title={isSidebarPinned ? 'Bỏ ghim sidebar' : 'Ghim sidebar'}
          >
            {isSidebarPinned ? <PinOff size={14} className="text-gray-500" /> : <Pin size={14} className="text-gray-500" />}
          </button>
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto py-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          {sidebarExpanded && (
            <div className="px-5 mb-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Báo cáo & Vận hành</div>
          )}
          <nav className="space-y-1.5 px-3 mb-8">
            
            {reportMenus.map((item) => {
              const Icon = item.icon;

              // 1. DROPDOWN DASHBOARD
              if (item.id === 'dashboard') {
                const isChildActive = location.pathname === '/' || location.pathname === '/dashboard-don-hoan' || location.pathname === '/dashboard-kpi';
                return (
                  <div key={item.id} className="space-y-1.5">
                    <button onClick={() => setIsDashboardOpen(!isDashboardOpen)} className={`w-full flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group cursor-pointer ${!sidebarExpanded ? 'justify-center px-0' : 'px-4 justify-between'} ${isChildActive && !isDashboardOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} strokeWidth={2} className={`transition-colors ${isChildActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
                        {sidebarExpanded && <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>}
                      </div>
                      {sidebarExpanded && (isDashboardOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>)}
                    </button>
                    {sidebarExpanded && isDashboardOpen && (
                      <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-200/60 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <Link to="/" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <TrendingUp size={16} className={location.pathname === '/' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Đơn đi hàng ngày</span>
                        </Link>
                        <Link to="/dashboard-don-hoan" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/dashboard-don-hoan' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <BarChart2 size={16} className={location.pathname === '/dashboard-don-hoan' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">SL Đơn hoàn theo ngày</span>
                        </Link>
                        <Link to="/dashboard-kpi" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/dashboard-kpi' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <Target size={16} className={location.pathname === '/dashboard-kpi' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Tổng quan KPI tháng</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }

              // 2. DROPDOWN ĐƠN IN
              if (item.id === 'print_orders') {
                const isChildActive = location.pathname === '/bao-cao-don' || location.pathname === '/don-da-in-hom-nay';
                return (
                  <div key={item.id} className="space-y-1.5">
                    <button onClick={() => setIsPrintOrdersOpen(!isPrintOrdersOpen)} className={`w-full flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group cursor-pointer ${!sidebarExpanded ? 'justify-center px-0' : 'px-4 justify-between'} ${isChildActive && !isPrintOrdersOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} strokeWidth={2} className={`transition-colors ${isChildActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
                        {sidebarExpanded && <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>}
                      </div>
                      {sidebarExpanded && (isPrintOrdersOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>)}
                    </button>
                    {sidebarExpanded && isPrintOrdersOpen && (
                      <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-200/60 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <Link to="/bao-cao-don" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/bao-cao-don' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <Printer size={16} className={location.pathname === '/bao-cao-don' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Đơn có thể in</span>
                        </Link>
                        <Link to="/don-da-in-hom-nay" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/don-da-in-hom-nay' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <CheckCircle2 size={16} className={location.pathname === '/don-da-in-hom-nay' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Đơn đã in hôm nay</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }
              
              // 3. DROPDOWN ĐÓNG GÓI
              if (item.id === 'packing') {
                const isChildActive = location.pathname.includes('/dong-goi-') || location.pathname.includes('/toc-do-dong-goi-');
                return (
                  <div key={item.id} className="space-y-1.5">
                    <button onClick={() => setIsPackingOpen(!isPackingOpen)} className={`w-full flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group cursor-pointer ${!sidebarExpanded ? 'justify-center px-0' : 'px-4 justify-between'} ${isChildActive && !isPackingOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} strokeWidth={2} className={`transition-colors ${isChildActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
                        {sidebarExpanded && <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>}
                      </div>
                      {sidebarExpanded && (isPackingOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>)}
                    </button>
                    {sidebarExpanded && isPackingOpen && (
                      <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-200/60 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <Link to="/dong-goi-don-hang" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/dong-goi-don-hang' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                            <Box size={16} className={location.pathname === '/dong-goi-don-hang' ? 'text-blue-600' : 'text-gray-400'} />
                            <div className="flex flex-col">
                              <span className="text-sm">Đóng gói đơn hàng</span>
                              <span className="text-[10px] text-red-500 font-normal leading-tight mt-0.5">Tab đóng gói dành cho NVĐG</span>
                            </div>
                        </Link>
                        <Link to="/toc-do-dong-goi-chung" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/toc-do-dong-goi-chung' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <BarChart3 size={16} className={location.pathname === '/toc-do-dong-goi-chung' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Đóng gói chung</span>
                        </Link>
                        <Link to="/toc-do-dong-goi-nhan-su" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/toc-do-dong-goi-nhan-su' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <User size={16} className={location.pathname === '/toc-do-dong-goi-nhan-su' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Theo nhân sự</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }

              // 4. DROPDOWN BÁO CÁO ĐƠN HOÀN 
              if (item.id === 'return_orders') {
                const isChildActive = location.pathname === '/bao-cao-hoan-tong-hop' || location.pathname === '/kiem-tra-don-hoan' || location.pathname === '/xu-ly-don-hoan';
                return (
                  <div key={item.id} className="space-y-1.5">
                    <button onClick={() => setIsReturnOrdersOpen(!isReturnOrdersOpen)} className={`w-full flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group cursor-pointer ${!sidebarExpanded ? 'justify-center px-0' : 'px-4 justify-between'} ${isChildActive && !isReturnOrdersOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} strokeWidth={2} className={`transition-colors ${isChildActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
                        {sidebarExpanded && <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>}
                      </div>
                      {sidebarExpanded && (isReturnOrdersOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>)}
                    </button>
                    {sidebarExpanded && isReturnOrdersOpen && (
                      <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-200/60 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <Link to="/bao-cao-hoan-tong-hop" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/bao-cao-hoan-tong-hop' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <BarChart3 size={16} className={location.pathname === '/bao-cao-hoan-tong-hop' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Tổng hợp đơn hoàn</span>
                        </Link>
                        <Link to="/xu-ly-don-hoan" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/xu-ly-don-hoan' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                        <PackageMinus size={16} className={location.pathname === '/xu-ly-don-hoan' ? 'text-blue-600' : 'text-gray-400'} />
                        <span className="text-sm">Xử lý Đơn hoàn</span>
                        </Link>
                        <Link to="/kiem-tra-don-hoan" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/kiem-tra-don-hoan' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <ScanLine size={16} className={location.pathname === '/kiem-tra-don-hoan' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Kiểm tra & Chốt SL</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }

              // 5. DROPDOWN BÁO CÁO KIỂM KÊ
              if (item.id === 'inventory_check') {
                const isChildActive = location.pathname === '/thong-ke-kiem-ke' || location.pathname === '/danh-sach-kiem-ke';
                return (
                  <div key={item.id} className="space-y-1.5">
                    <button onClick={() => setIsInventoryCheckOpen(!isInventoryCheckOpen)} className={`w-full flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group cursor-pointer ${!sidebarExpanded ? 'justify-center px-0' : 'px-4 justify-between'} ${isChildActive && !isInventoryCheckOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} strokeWidth={2} className={`transition-colors ${isChildActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
                        {sidebarExpanded && <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>}
                      </div>
                      {sidebarExpanded && (isInventoryCheckOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>)}
                    </button>
                    {sidebarExpanded && isInventoryCheckOpen && (
                      <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-200/60 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <Link to="/thong-ke-kiem-ke" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/thong-ke-kiem-ke' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <BarChart3 size={16} className={location.pathname === '/thong-ke-kiem-ke' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Báo cáo chung</span>
                        </Link>
                        <Link to="/danh-sach-kiem-ke" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/danh-sach-kiem-ke' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <ListChecks size={16} className={location.pathname === '/danh-sach-kiem-ke' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Danh sách cần kiểm kê</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }

              // 6. DROPDOWN BÁO CÁO TỒN KHO
              if (item.id === 'inventory_report') {
                const isChildActive = location.pathname === '/bao-cao-ton-kho' || location.pathname === '/vi-tri-san-pham';
                return (
                  <div key={item.id} className="space-y-1.5">
                    <button onClick={() => setIsInventoryReportOpen(!isInventoryReportOpen)} className={`w-full flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group cursor-pointer ${!sidebarExpanded ? 'justify-center px-0' : 'px-4 justify-between'} ${isChildActive && !isInventoryReportOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} strokeWidth={2} className={`transition-colors ${isChildActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} />
                        {sidebarExpanded && <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>}
                      </div>
                      {sidebarExpanded && (isInventoryReportOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>)}
                    </button>
                    {sidebarExpanded && isInventoryReportOpen && (
                      <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-200/60 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <Link to="/bao-cao-ton-kho" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/bao-cao-ton-kho' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <Boxes size={16} className={location.pathname === '/bao-cao-ton-kho' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Tồn kho thực tế</span>
                        </Link>
                        <Link to="/vi-tri-san-pham" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/vi-tri-san-pham' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                          <MapPin size={16} className={location.pathname === '/vi-tri-san-pham' ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="text-sm">Vị trí sản phẩm</span>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }

              // 7. RENDER CÁC MỤC ĐƠN LẺ BÌNH THƯỜNG (Ví dụ: Đối soát kho, Đơn không khai giá)
              const isActive = location.pathname === item.path;
              return (
                <div key={item.path} className="space-y-1.5">
                  <Link to={item.path} className={`flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group ${!sidebarExpanded ? 'justify-center px-0' : 'px-4'} ${isActive ? 'bg-blue-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-blue-500/20' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`} />
                    {sidebarExpanded && <span className="text-sm">{item.label}</span>}
                    {isActive && sidebarExpanded && <span className="ml-auto w-1.5 h-5 bg-white/40 rounded-full" />}
                  </Link>
                </div>
              )
            })}
          </nav>

          {isAdmin && sidebarExpanded && (
            <>
              <div className="px-5 mb-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Hệ thống</div>
              <nav className="space-y-1.5 px-3">
                <Link to="/admin" className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${location.pathname === '/admin' ? 'bg-blue-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-blue-500/20' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
                  <Settings size={18} strokeWidth={location.pathname === '/admin' ? 2.5 : 2} className={`transition-colors duration-200 ${location.pathname === '/admin' ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`} />
                  <span className="text-sm">Quản trị Hệ thống</span>
                </Link>
                  <Link to="/quan-ly-kpi" className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${location.pathname === '/quan-ly-kpi' ? 'bg-blue-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-blue-500/20' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'}`}>
  <Target size={18} strokeWidth={location.pathname === '/quan-ly-kpi' ? 2.5 : 2} className={`transition-colors duration-200 ${location.pathname === '/quan-ly-kpi' ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`} />
  <span className="text-sm">Quản lý KPI & Lỗi</span>
</Link>
                <div className="pt-1">
                  <button onClick={() => setIsAdjustMenuOpen(!isAdjustMenuOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 group hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Wrench size={18} strokeWidth={2} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-sm">Cập nhật & Hiệu chỉnh</span>
                    </div>
                    {isAdjustMenuOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>}
                  </button>
                  {isAdjustMenuOpen && (
                    <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-200/60 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                      <Link to="/cap-nhat-nguoi-dong-goi" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/cap-nhat-nguoi-dong-goi' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                        <UserCog size={16} className={location.pathname === '/cap-nhat-nguoi-dong-goi' ? 'text-blue-600' : 'text-gray-400'} />
                        <span className="text-sm">Người đóng gói</span>
                      </Link>
                      <Link to="/cap-nhat-lich-lam-viec" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/cap-nhat-lich-lam-viec' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                        <CalendarDays size={16} className={location.pathname === '/cap-nhat-lich-lam-viec' ? 'text-blue-600' : 'text-gray-400'} />
                        <span className="text-sm">Lịch làm việc</span>
                      </Link>
                      <Link to="/cap-nhat-san-pham" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/cap-nhat-san-pham' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                        <PackageSearch size={16} className={location.pathname === '/cap-nhat-san-pham' ? 'text-blue-600' : 'text-gray-400'} />
                        <span className="text-sm">Hiệu chỉnh sản phẩm</span>
                      </Link>
                      <Link to="/cap-nhat-so-do-kho" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${location.pathname === '/cap-nhat-so-do-kho' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-white/60 hover:text-gray-900 text-gray-500 font-medium text-sm'}`}>
                        <MapPin size={16} className={location.pathname === '/cap-nhat-so-do-kho' ? 'text-blue-600' : 'text-gray-400'} />
                        <span className="text-sm">Sơ đồ Kho hàng</span>
                      </Link>
                    </div>
                  )}
                </div>
              </nav>
            </>
          )}

          {isAdmin && !sidebarExpanded && (
            <nav className="space-y-2 px-3 mt-2">
              <Link to="/admin" className="flex justify-center py-3 rounded-2xl hover:bg-white/60 group transition-colors">
                <Settings size={18} strokeWidth={2} className="text-gray-400 group-hover:text-blue-500" />
              </Link>
              <button onClick={() => setIsAdjustMenuOpen(!isAdjustMenuOpen)} className="flex justify-center py-3 rounded-2xl w-full hover:bg-white/60 group transition-colors">
                <Wrench size={18} strokeWidth={2} className="text-gray-400 group-hover:text-blue-500" />
              </button>
            </nav>
          )}
        </div>
        
        {/* User Profile */}
        <div className="p-4 bg-white/40 backdrop-blur-lg border-t border-white/20 rounded-tr-2xl">
          {sidebarExpanded ? (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 max-w-[75%]">
                <div className="w-9 h-9 min-w-[36px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-md ring-2 ring-white/50 uppercase">{avatarLetter}</div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-gray-900 leading-tight truncate capitalize">{displayName}</span>
                  <span className="text-[10px] text-gray-500 font-medium mt-0.5 truncate">{isAdmin ? '🛡️ Admin' : '📦 Nhân viên'}</span>
                </div>
              </div>
              <button onClick={() => setShowLogoutModal(true)} title="Đăng xuất" className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-xl hover:bg-white/60 cursor-pointer"><LogOut size={16} /></button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-md ring-2 ring-white/50 uppercase">{avatarLetter}</div>
              <button onClick={() => setShowLogoutModal(true)} title="Đăng xuất" className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-xl hover:bg-white/60 cursor-pointer"><LogOut size={14} /></button>
            </div>
          )}
        </div>

      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto relative bg-transparent">
        {/* Hamburger menu mobile */}
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden absolute top-4 left-4 z-30 p-2 bg-white/80 backdrop-blur-md rounded-xl shadow-lg hover:bg-white/90 transition-colors"
        >
          <Menu size={20} className="text-gray-700" />
        </button>

        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/20 via-white to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-blue-50/40 to-transparent pointer-events-none" />
        {/* <div className="relative z-10 p-8 h-full">
          <TestingNoticeBanner />
          <Outlet />
        </div> */}
      </div>

      {/* OVERLAY MOBILE */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/80 backdrop-blur-2xl border border-white/40 rounded-3xl shadow-2xl w-full max-w-md p-6 transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100/80 backdrop-blur-md rounded-full"><LogOut size={20} className="text-red-500" /></div>
                <h3 className="text-lg font-bold text-gray-900">Xác nhận đăng xuất</h3>
              </div>
              <button onClick={() => setShowLogoutModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/60 rounded-full transition-colors"><X size={18} /></button>
            </div>
            <p className="text-gray-600 text-sm mb-6">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không? Phiên làm việc sẽ kết thúc.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowLogoutModal(false)} className="px-5 py-2.5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/30 text-gray-700 font-medium hover:bg-white/80 transition-all shadow-sm">Hủy</button>
              <button onClick={handleLogout} className="px-5 py-2.5 rounded-2xl bg-red-500/90 backdrop-blur-md text-white font-medium hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}