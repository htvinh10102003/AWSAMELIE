import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, Printer, Timer, Settings, PackageSearch, LogOut, Undo2, ScanLine, 
  Boxes, AlertTriangle, X, Wrench, ChevronDown, ChevronRight, UserCog, CalendarDays, 
  BarChart3, User, Pin, PinOff, ClipboardCheck, PackageMinus, CheckCircle2, 
  LayoutDashboard, Target, Box, ListChecks, MapPin, BarChart2, Menu,
  Filter, FileEdit, LayoutGrid, Webhook, History, ShieldAlert, Settings2, Loader2, Info, PartyPopper
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Thông báo Global System
  const [globalNotif, setGlobalNotif] = useState(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // States UI điều khiển
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const sidebarExpanded = isSidebarPinned || isSidebarHovered;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // States Submenu Open
  const [menuStates, setMenuStates] = useState({
    dashboard: false, print_orders: false, packing: false, 
    return_orders: false, inventory_check: false, inventory_report: false, 
    kpi: false, system_adjust: false
  });

  // Themes States
  const [xmasTheme, setXmasTheme] = useState({ isXmasEnabled: false });
  const [tetTheme, setTetTheme] = useState({ isTetEnabled: false });
  const [midAutumnTheme, setMidAutumnTheme] = useState({ isMidAutumnEnabled: false });
  const [nationalDayTheme, setNationalDayTheme] = useState({ isNationalDayEnabled: false });

  // Tự động mở menu theo URL
  useEffect(() => {
    const p = location.pathname;
    setMenuStates(prev => ({
      ...prev,
      dashboard: prev.dashboard || ['/', '/dashboard-', '/tra-cuu-luan-chuyen'].some(m => p.includes(m)),
      print_orders: prev.print_orders || ['/bao-cao-don', '/don-da-in-hom-nay', '/loc-don-theo-day-ke', '/chen-vi-tri-awb', '/in-don-spx'].some(m => p.includes(m)),
      packing: prev.packing || ['/dong-goi-', '/toc-do-dong-goi-'].some(m => p.includes(m)),
      return_orders: prev.return_orders || ['/bao-cao-hoan-', '/kiem-tra-don-hoan', '/xu-ly-don-hoan'].some(m => p.includes(m)),
      inventory_check: prev.inventory_check || ['/thong-ke-kiem-ke', '/danh-sach-kiem-ke'].some(m => p.includes(m)),
      inventory_report: prev.inventory_report || ['/bao-cao-ton-kho', '/vi-tri-san-pham'].some(m => p.includes(m)),
      kpi: prev.kpi || ['/quan-ly-kpi', '/nhap-lieu-kpi'].some(m => p.includes(m)),
      system_adjust: prev.system_adjust || ['/cap-nhat-'].some(m => p.includes(m))
    }));
  }, [location.pathname]);

  // Khởi tạo và lắng nghe cấu hình
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsInitializing(false);
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login');
      else setUser(session.user);
      setIsInitializing(false);
    });

    const fetchConfigData = async () => {
      const keys = ['theme_christmas', 'theme_tet', 'theme_mid_autumn', 'theme_national_day', 'global_notification'];
      const { data } = await supabase.from('system_configs').select('key, value').in('key', keys);
      
      if (data) {
        data.forEach(item => {
          try {
            if (item.key === 'theme_christmas') setXmasTheme(JSON.parse(item.value));
            if (item.key === 'theme_tet') setTetTheme(JSON.parse(item.value));
            if (item.key === 'theme_mid_autumn') setMidAutumnTheme(JSON.parse(item.value));
            if (item.key === 'theme_national_day') setNationalDayTheme(JSON.parse(item.value));
            if (item.key === 'global_notification') {
              const notifData = JSON.parse(item.value);
              const dismissedId = localStorage.getItem('dismissed_notif_id');
              if (notifData && notifData.enabled && String(notifData.id) !== dismissedId) {
                setGlobalNotif(notifData);
              }
            }
          } catch(e) {}
        });
      }
    };
    fetchConfigData();

    const channel = supabase.channel('system_configs_listener')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_configs' }, 
        (payload) => {
          try {
            if (payload.new && payload.new.key === 'theme_christmas') setXmasTheme(JSON.parse(payload.new.value));
            if (payload.new && payload.new.key === 'theme_tet') setTetTheme(JSON.parse(payload.new.value));
            if (payload.new && payload.new.key === 'theme_mid_autumn') setMidAutumnTheme(JSON.parse(payload.new.value));
            if (payload.new && payload.new.key === 'theme_national_day') setNationalDayTheme(JSON.parse(payload.new.value));
            if (payload.new && payload.new.key === 'global_notification') {
              const notifData = JSON.parse(payload.new.value);
              const dismissedId = localStorage.getItem('dismissed_notif_id');
              if (notifData && notifData.enabled && String(notifData.id) !== dismissedId) {
                setGlobalNotif(notifData);
              } else {
                setGlobalNotif(null);
              }
            }
          } catch (e) { }
        }
      ).subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleCloseGlobalNotif = () => {
    if (dontShowAgain && globalNotif) {
      localStorage.setItem('dismissed_notif_id', String(globalNotif.id));
    }
    setGlobalNotif(null);
  };

  const userEmail = user?.email || '';
  const displayName = user?.user_metadata?.full_name || userEmail.split('@')[0] || '...';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const isAdmin = user?.user_metadata?.role === 'admin';
  const isOwner = user?.user_metadata?.is_owner === true;
  
  const adminRoutes = ['/admin', '/quan-ly-kpi', '/nhap-lieu-kpi', '/cap-nhat-nguoi-dong-goi', '/cap-nhat-lich-lam-viec', '/cap-nhat-san-pham', '/cap-nhat-so-do-kho', '/cap-nhat-day-ke', '/cap-nhat-webhook'];
  const ownerRoutes = ['/cap-nhat-tinh-nang'];

  const isRestrictedAdminRoute = adminRoutes.some(route => location.pathname.startsWith(route));
  const isRestrictedOwnerRoute = ownerRoutes.some(route => location.pathname.startsWith(route));

  let hasAccess = true;
  if (isRestrictedOwnerRoute) hasAccess = isOwner;
  else if (isRestrictedAdminRoute) hasAccess = isAdmin || isOwner;

  // Quyết định Theme hiển thị
  const isTet = tetTheme?.isTetEnabled || false;
  const isMidAutumn = (midAutumnTheme?.isMidAutumnEnabled || false) && !isTet;
  const isNationalDay = (nationalDayTheme?.isNationalDayEnabled || false) && !isTet && !isMidAutumn;
  const isXmas = (xmasTheme?.isXmasEnabled || false) && !isTet && !isMidAutumn && !isNationalDay;

  // Cấu trúc biến CSS theo từng Theme (Y hệt Mockup Thiết kế)
  const getThemeVars = () => {
    if (isTet) return {
      bgImage: "url('/assets/bg-tet.jpg')",
      sidebar: 'bg-[#fff8f0]/95 backdrop-blur-xl border-r border-red-100/50 shadow-[4px_0_24px_rgba(220,38,38,0.05)]',
      textPrimary: 'text-slate-800', textMuted: 'text-slate-500',
      activeBg: 'bg-red-50', activeText: 'text-red-700 font-bold', activeBorder: 'border-l-[3px] border-red-600',
      hoverBg: 'hover:bg-red-50/50', iconColor: 'text-slate-400 group-hover:text-red-500', iconActive: 'text-red-600',
      logoBg: 'bg-red-600', logoIcon: 'text-white', headerBorder: 'border-b border-red-100/50'
    };
    if (isMidAutumn) return {
      bgImage: "url('/assets/bg-mid-autumn.jpg')",
      sidebar: 'bg-[#fffaf0]/95 backdrop-blur-xl border-r border-orange-200/50 shadow-[4px_0_24px_rgba(234,88,12,0.05)]',
      textPrimary: 'text-slate-800', textMuted: 'text-slate-500',
      activeBg: 'bg-orange-50', activeText: 'text-orange-600 font-bold', activeBorder: 'border-l-[3px] border-orange-500',
      hoverBg: 'hover:bg-orange-50/50', iconColor: 'text-slate-400 group-hover:text-orange-500', iconActive: 'text-orange-600',
      logoBg: 'bg-orange-500', logoIcon: 'text-white', headerBorder: 'border-b border-orange-200/50'
    };
    if (isNationalDay) return {
      bgImage: "url('/assets/bg-national-day.jpg')",
      sidebar: 'bg-[#fffcfc]/95 backdrop-blur-xl border-r border-red-100/50 shadow-[4px_0_24px_rgba(220,38,38,0.05)]',
      textPrimary: 'text-slate-800', textMuted: 'text-slate-500',
      activeBg: 'bg-red-50', activeText: 'text-red-700 font-bold', activeBorder: 'border-l-[3px] border-red-600',
      hoverBg: 'hover:bg-red-50/50', iconColor: 'text-slate-400 group-hover:text-red-500', iconActive: 'text-red-600',
      logoBg: 'bg-red-600', logoIcon: 'text-white', headerBorder: 'border-b border-red-100/50'
    };
    if (isXmas) return {
      bgImage: "url('/assets/bg-christmas.jpg')",
      sidebar: 'bg-[#0a231c]/95 backdrop-blur-xl border-r border-[#1a4034] shadow-[4px_0_24px_rgba(0,0,0,0.2)]', // Sidebar Xanh Đen chuẩn thiết kế
      textPrimary: 'text-slate-100', textMuted: 'text-slate-400',
      activeBg: 'bg-[#133d30]', activeText: 'text-emerald-400 font-bold', activeBorder: 'border-l-[3px] border-emerald-500',
      hoverBg: 'hover:bg-[#133d30]/70', iconColor: 'text-slate-400 group-hover:text-emerald-400', iconActive: 'text-emerald-400',
      logoBg: 'bg-white', logoIcon: 'text-[#0a231c]', headerBorder: 'border-b border-[#1a4034]'
    };
    // Default Professional SaaS Theme
    return {
      bgImage: "none",
      sidebar: 'bg-white border-r border-slate-200 shadow-sm',
      textPrimary: 'text-slate-700', textMuted: 'text-slate-400',
      activeBg: 'bg-blue-50/80', activeText: 'text-blue-700 font-bold', activeBorder: 'border-l-[3px] border-blue-600',
      hoverBg: 'hover:bg-slate-50', iconColor: 'text-slate-400 group-hover:text-blue-600', iconActive: 'text-blue-600',
      logoBg: 'bg-blue-600', logoIcon: 'text-white', headerBorder: 'border-b border-slate-100'
    };
  };

  const themeVars = getThemeVars();

  const MENU_CONFIG = [
    {
      groupLabel: 'Báo cáo & Vận hành',
      items: [
        {
          id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard,
          matchRoutes: ['/', '/dashboard-', '/tra-cuu-luan-chuyen'],
          subItems: [
            { path: '/', label: 'Đơn đi hàng ngày', icon: TrendingUp },
            { path: '/dashboard-don-hoan', label: 'SL Đơn hoàn theo ngày', icon: BarChart2 },
            { path: '/dashboard-kpi', label: 'Tổng quan KPI tháng', icon: Target },
            { path: '/tra-cuu-luan-chuyen', label: 'Tra cứu luân chuyển', icon: History }
          ]
        },
        {
          id: 'print_orders', label: 'Đơn in', icon: Printer,
          matchRoutes: ['/bao-cao-don', '/don-da-in-hom-nay', '/loc-don-theo-day-ke', '/chen-vi-tri-awb', '/in-don-spx'],
          subItems: [
            { path: '/bao-cao-don', label: 'Đơn có thể in', icon: Printer },
            { path: '/don-da-in-hom-nay', label: 'Đơn đã in hôm nay', icon: CheckCircle2 },
            { path: '/loc-don-theo-day-ke', label: 'Lọc đơn chia theo dãy kệ', icon: Filter },
            { path: '/chen-vi-tri-awb', label: 'Chèn vị trí SP vào AWB', icon: FileEdit },
            { path: '/in-don-spx', label: 'In Đơn SPX Tự Động', icon: Printer, highlight: true }
          ]
        },
        {
          id: 'packing', label: 'Đóng gói', icon: Timer,
          matchRoutes: ['/dong-goi-', '/toc-do-dong-goi-'],
          subItems: [
            { path: '/dong-goi-don-hang', label: 'Đóng gói đơn hàng', subtitle: 'Tab dành cho NVĐG', icon: Box },
            { path: '/toc-do-dong-goi-chung', label: 'Đóng gói chung', icon: BarChart3 },
            { path: '/toc-do-dong-goi-nhan-su', label: 'Theo nhân sự', icon: User }
          ]
        },
        {
          id: 'return_orders', label: 'Báo cáo đơn hoàn', icon: Undo2,
          matchRoutes: ['/bao-cao-hoan-', '/kiem-tra-don-hoan', '/xu-ly-don-hoan'],
          subItems: [
            { path: '/bao-cao-hoan-tong-hop', label: 'Tổng hợp đơn hoàn', icon: BarChart3 },
            { path: '/xu-ly-don-hoan', label: 'Xử lý Đơn hoàn', icon: PackageMinus },
            { path: '/kiem-tra-don-hoan', label: 'Kiểm tra & Chốt SL', icon: ScanLine }
          ]
        },
        {
          id: 'inventory_check', label: 'Báo cáo kiểm kê', icon: ClipboardCheck,
          matchRoutes: ['/thong-ke-kiem-ke', '/danh-sach-kiem-ke'],
          subItems: [
            { path: '/thong-ke-kiem-ke', label: 'Báo cáo chung', icon: BarChart3 },
            { path: '/danh-sach-kiem-ke', label: 'Danh sách cần kiểm kê', icon: ListChecks }
          ]
        },
        { id: 'standalone_doi_soat', label: 'Đối soát đơn cuối ngày', path: '/doi-soat-kho', icon: ScanLine },
        {
          id: 'inventory_report', label: 'Báo cáo tồn kho', icon: Boxes,
          matchRoutes: ['/bao-cao-ton-kho', '/vi-tri-san-pham'],
          subItems: [
            { path: '/bao-cao-ton-kho', label: 'Tồn kho thực tế', icon: Boxes },
            { path: '/vi-tri-san-pham', label: 'Vị trí sản phẩm', icon: MapPin }
          ]
        },
        { id: 'standalone_khai_gia', label: 'Đơn không khai giá', path: '/don-khong-khai-gia', icon: AlertTriangle }
      ]
    },
    ...(isAdmin || isOwner ? [{
      groupLabel: 'Hệ thống Quản trị',
      items: [
        { id: 'admin_sys', label: 'Quản trị Hệ thống', path: '/admin', icon: Settings },
        {
          id: 'kpi', label: 'Quản lý KPI & Lỗi', icon: Target,
          matchRoutes: ['/quan-ly-kpi', '/nhap-lieu-kpi'],
          subItems: [
            { path: '/quan-ly-kpi', label: 'Cấu hình KPI', icon: Settings2 },
            { path: '/nhap-lieu-kpi', label: 'Nhập liệu hàng ngày', icon: FileEdit }
          ]
        },
        {
          id: 'system_adjust', label: 'Cập nhật & Hiệu chỉnh', icon: Wrench,
          matchRoutes: ['/cap-nhat-'],
          subItems: [
            ...(isOwner ? [{ path: '/cap-nhat-tinh-nang', label: 'Khóa tính năng', icon: ShieldAlert }] : []),
            { path: '/cap-nhat-nguoi-dong-goi', label: 'Người đóng gói', icon: UserCog },
            { path: '/cap-nhat-lich-lam-viec', label: 'Lịch làm việc', icon: CalendarDays },
            { path: '/cap-nhat-san-pham', label: 'Hiệu chỉnh sản phẩm', icon: PackageSearch },
            { path: '/cap-nhat-so-do-kho', label: 'Sơ đồ Kho hàng', icon: MapPin },
            { path: '/cap-nhat-day-ke', label: 'Quy ước dãy kệ', icon: LayoutGrid },
            { path: '/cap-nhat-webhook', label: 'Chạy lại Webhook', icon: Webhook }
          ]
        }
      ]
    }] : [])
  ];

  const toggleSubmenu = (id) => {
    setMenuStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={`flex h-screen font-sans antialiased overflow-hidden relative ${themeVars.bgImage === 'none' ? 'bg-slate-50' : 'bg-transparent'}`}>
      
      {/* BACKGROUND LAYER (100% 100% ĐỂ KHÔNG BỊ ZOOM CẮT MẤT VẬT THỂ 2 BÊN RÌA) */}
      {themeVars.bgImage !== 'none' && (
        <div 
          className="fixed inset-0 z-0 bg-no-repeat bg-center pointer-events-none transition-all duration-700"
          style={{ 
            backgroundImage: themeVars.bgImage,
            backgroundSize: '100% 100%' // Ép toàn bộ ảnh fit vừa khít màn hình
          }}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <div
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        onClick={(e) => { if (e.target.closest('a')) setMobileMenuOpen(false); }}
        className={`flex-shrink-0 z-40 flex flex-col transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] relative overflow-x-hidden ${themeVars.sidebar}
          ${sidebarExpanded ? 'w-[300px]' : 'w-[72px]'} 
          max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[300px] max-md:z-50 max-md:transition-transform
          ${mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}`}
      >
        {/* LOGO HEADER */}
        <div className={`h-[68px] flex items-center justify-between px-4 sticky top-0 z-10 transition-colors ${themeVars.headerBorder}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-md ${themeVars.logoBg}`}>
              <PackageSearch className={themeVars.logoIcon} size={20} strokeWidth={2.5}/>
            </div>
            <div className={`transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
              <h1 className={`text-lg font-black tracking-tight flex items-center gap-1.5 leading-none whitespace-nowrap ${themeVars.textPrimary}`}>
                Amelie WMS
              </h1>
            </div>
          </div>
          
          <button
            onClick={() => setIsSidebarPinned(!isSidebarPinned)}
            className={`p-1.5 rounded-lg hover:bg-slate-100/20 transition-colors shrink-0 max-md:hidden ${themeVars.textMuted} hover:${themeVars.textPrimary} ${!sidebarExpanded ? 'absolute right-[16px]' : ''}`}
          >
            {isSidebarPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
        </div>

        {/* MENU SCROLL AREA */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 scrollbar-thin scrollbar-thumb-slate-300/50 hover:scrollbar-thumb-slate-400/50 scrollbar-track-transparent">
          {MENU_CONFIG.map((group, gIdx) => (
            <div key={gIdx} className="mb-6">
              <div className={`px-5 mb-2 text-[11px] font-black uppercase tracking-widest transition-opacity duration-300 whitespace-nowrap ${themeVars.textMuted} ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                {group.groupLabel}
              </div>
              
              <nav className="space-y-1 px-3">
                {group.items.map(item => {
                  const hasSubItems = !!item.subItems;
                  const isActive = hasSubItems 
                    ? item.matchRoutes.some(route => location.pathname.includes(route)) || (location.pathname === '/' && item.id === 'dashboard')
                    : location.pathname === item.path;
                  const isOpen = menuStates[item.id];

                  if (hasSubItems) {
                    return (
                      <div key={item.id} className="relative">
                        <button 
                          onClick={() => toggleSubmenu(item.id)} 
                          className={`w-full flex items-center px-3 py-3 rounded-xl group cursor-pointer transition-all ${themeVars.hoverBg} ${isActive && !isOpen ? themeVars.activeBg : ''}`}
                        >
                          <div className="shrink-0 flex items-center justify-center w-8">
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? themeVars.iconActive : themeVars.iconColor}`} />
                          </div>
                          <div className={`flex items-center justify-between flex-1 transition-all duration-300 overflow-hidden ${sidebarExpanded ? 'opacity-100 ml-2 whitespace-normal text-left' : 'opacity-0 w-0 ml-0 whitespace-nowrap'}`}>
                            <span className={`text-sm tracking-wide leading-snug ${isActive ? themeVars.activeText : `font-medium ${themeVars.textPrimary}`}`}>{item.label}</span>
                            <div className="shrink-0 ml-2">
                              {isOpen ? <ChevronDown size={16} className={themeVars.textMuted}/> : <ChevronRight size={16} className={themeVars.textMuted}/>}
                            </div>
                          </div>
                        </button>
                        
                        <div className={`grid transition-all duration-300 ease-in-out ${sidebarExpanded && isOpen ? 'grid-rows-[1fr] opacity-100 mt-1 mb-2' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className={`ml-7 pl-3 border-l-2 ${themeVars.headerBorder} flex flex-col gap-1`}>
                              {item.subItems.map((sub, sIdx) => {
                                const isSubActive = location.pathname === sub.path;
                                return (
                                  <Link 
                                    key={sIdx} 
                                    to={sub.path} 
                                    className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all ${themeVars.hoverBg} ${isSubActive ? themeVars.activeBg + ' ' + themeVars.activeBorder : ''}`}
                                  >
                                    <sub.icon size={18} strokeWidth={isSubActive ? 2.5 : 2} className={`mt-0.5 shrink-0 ${isSubActive ? themeVars.iconActive : themeVars.textMuted}`} />
                                    <div className="flex flex-col flex-1">
                                      <span className={`text-sm whitespace-normal leading-snug break-words ${isSubActive ? themeVars.activeText : `font-medium ${themeVars.textPrimary}`}`}>{sub.label}</span>
                                      {sub.subtitle && <span className={`text-[11px] mt-0.5 whitespace-normal leading-tight ${themeVars.textMuted}`}>{sub.subtitle}</span>}
                                    </div>
                                  </Link>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <Link 
                      key={item.path} 
                      to={item.path} 
                      className={`w-full flex items-center px-3 py-3 rounded-xl group transition-all ${themeVars.hoverBg} ${isActive ? themeVars.activeBg : ''}`}
                    >
                      <div className="shrink-0 flex items-center justify-center w-8">
                        <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? themeVars.iconActive : themeVars.iconColor}`} />
                      </div>
                      <div className={`flex items-center flex-1 transition-all duration-300 overflow-hidden ${sidebarExpanded ? 'opacity-100 ml-2 whitespace-normal text-left' : 'opacity-0 w-0 ml-0 whitespace-nowrap'}`}>
                        <span className={`text-sm tracking-wide leading-snug ${isActive ? themeVars.activeText : `font-medium ${themeVars.textPrimary}`}`}>{item.label}</span>
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* USER PROFILE BOTTOM */}
        <div className={`p-4 border-t ${themeVars.headerBorder} transition-all duration-300 flex items-center justify-between ${sidebarExpanded ? 'flex-row' : 'flex-col gap-3 py-4'}`}>
          <div className={`flex items-center gap-3 overflow-hidden ${!sidebarExpanded ? 'justify-center' : ''}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shadow-sm shrink-0 relative ${themeVars.logoBg} ${themeVars.logoIcon}`}>
              {avatarLetter}
            </div>
            <div className={`flex flex-col transition-all duration-300 overflow-hidden ${sidebarExpanded ? 'opacity-100 w-auto whitespace-normal' : 'opacity-0 w-0 hidden whitespace-nowrap'}`}>
              <span className={`text-sm font-bold truncate leading-tight ${themeVars.textPrimary}`}>{displayName}</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${themeVars.textMuted}`}>{isAdmin ? 'Admin' : 'Nhân viên'}</span>
            </div>
          </div>
          <button onClick={() => setShowLogoutModal(true)} title="Đăng xuất" className={`p-2 rounded-xl transition-colors shrink-0 ${themeVars.textMuted} hover:text-red-500 hover:bg-red-50/20 ${!sidebarExpanded ? 'w-full flex justify-center' : ''}`}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative h-full z-10">
        
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden absolute top-4 left-4 z-30 p-2.5 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/60 hover:bg-white transition-colors"
        >
          <Menu size={20} className="text-slate-700" />
        </button>

        <div className="relative p-4 sm:p-8 min-h-full flex flex-col">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center m-auto gap-4">
              <Loader2 size={32} className={`animate-spin text-blue-600 ${isXmas ? 'text-white' : ''}`} />
              <span className={`text-sm font-bold uppercase tracking-widest ${isXmas ? 'text-white/80' : 'text-slate-500'}`}>Đang tải phân quyền...</span>
            </div>
          ) : hasAccess ? (
            <Outlet />
          ) : (
            <div className="flex flex-col items-center justify-center m-auto text-center animate-in fade-in zoom-in-95 duration-500 max-w-md w-full">
              <div className="w-24 h-24 bg-white/80 rounded-full flex items-center justify-center mb-6 border-[8px] border-white/40 shadow-inner">
                <ShieldAlert size={40} className="text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-xl shadow-sm">Truy cập bị từ chối</h2>
              <p className="text-slate-800 mb-8 text-sm leading-relaxed font-bold bg-white/90 backdrop-blur-md px-5 py-3 rounded-xl shadow-sm">Bạn không có quyền truy cập trang này. Vui lòng liên hệ Quản trị viên để được cấp quyền.</p>
              <button onClick={() => navigate('/')} className="px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 shadow-md transition-all flex items-center gap-2">
                <Undo2 size={18} /> Quay lại trang chủ
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* MOBILE MENU BACKDROP */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* MODAL ĐĂNG XUẤT */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-50 rounded-2xl"><LogOut size={24} className="text-red-600" /></div>
              <div>
                <h3 className="text-lg font-black text-slate-800 leading-tight">Đăng xuất</h3>
                <p className="text-sm text-slate-500 font-medium">Kết thúc phiên làm việc</p>
              </div>
            </div>
            <p className="text-slate-600 text-sm mb-8 font-medium">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowLogoutModal(false)} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors">Hủy</button>
              <button onClick={handleLogout} className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md transition-colors">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* CỬA SỔ THÔNG BÁO GLOBAL TỪ ADMIN */}
      {globalNotif && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`px-6 py-4 flex items-center justify-between border-b ${
              globalNotif.type === 'update' ? 'bg-blue-50 border-blue-100' :
              globalNotif.type === 'celebrate' ? 'bg-amber-50 border-amber-100' :
              'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-white shadow-sm ${
                  globalNotif.type === 'update' ? 'text-blue-600' :
                  globalNotif.type === 'celebrate' ? 'text-amber-500' :
                  'text-slate-600'
                }`}>
                  {globalNotif.type === 'update' ? <Settings size={20} /> :
                   globalNotif.type === 'celebrate' ? <PartyPopper size={20} /> : <Info size={20} />}
                </div>
                <h3 className="font-black text-slate-800 text-lg">{globalNotif.title || 'Thông báo mới'}</h3>
              </div>
              <button onClick={() => setGlobalNotif(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-slate-600 text-sm font-medium leading-relaxed whitespace-pre-wrap mb-8">
                {globalNotif.content}
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-500 font-medium cursor-pointer hover:text-slate-800 transition">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                  />
                  Tắt thông báo này
                </label>
                
                <button 
                  onClick={handleCloseGlobalNotif} 
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}