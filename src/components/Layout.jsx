import { useEffect, useState, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, Printer, Timer, Settings, PackageSearch, LogOut, Undo2, ScanLine, 
  Boxes, AlertTriangle, X, Wrench, ChevronDown, ChevronRight, UserCog, CalendarDays, 
  BarChart3, User, Pin, PinOff, ClipboardCheck, PackageMinus, CheckCircle2, 
  LayoutDashboard, Target, Box, ListChecks, MapPin, BarChart2, Menu,
  Filter, FileEdit, LayoutGrid, Webhook, History, ShieldAlert, Settings2, Loader2, Info, PartyPopper,
  AlignLeft, AlignRight, AlignVerticalSpaceAround, Settings as SettingsIcon,
  Megaphone, Bell, Sparkles, Gift, Rocket, Flame, Star, Zap
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Thông báo Global System (Modal bật lên)
  const [globalNotif, setGlobalNotif] = useState(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isNotifClosing, setIsNotifClosing] = useState(false);

  // ====== THÔNG BÁO BANNER CHẠY NGANG ======
  const [bannerNotif, setBannerNotif] = useState(null);

  // Lấy cấu hình từ LocalStorage để render tức thì, chống giật layout
  const [layoutPrefs, setLayoutPrefs] = useState(() => {
    try {
      const cached = localStorage.getItem('amelie_layout_prefs');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return { pinned: true, position: 'left' }; 
  });
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const layoutSettingsRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // States Submenu Open
  const [menuStates, setMenuStates] = useState({
    dashboard: false, print_orders: false, packing: false, 
    return_orders: false, inventory_check: false, inventory_report: false, 
    kpi: false, system_adjust: false
  });

  // ====== FIXED TOOLTIP STATE ======
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Themes States
  const [xmasTheme, setXmasTheme] = useState({ isXmasEnabled: false });
  const [tetTheme, setTetTheme] = useState({ isTetEnabled: false });
  const [midAutumnTheme, setMidAutumnTheme] = useState({ isMidAutumnEnabled: false });
  const [nationalDayTheme, setNationalDayTheme] = useState({ isNationalDayEnabled: false });

  // Đóng layout settings khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (layoutSettingsRef.current && !layoutSettingsRef.current.contains(event.target)) {
        setShowLayoutSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    const fetchUserAndConfigs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const userConfigKey = `layout_pref_${user.id}`;
        const keys = ['theme_christmas', 'theme_tet', 'theme_mid_autumn', 'theme_national_day', 'global_notification', 'global_banner', userConfigKey];
        const { data } = await supabase.from('system_configs').select('key, value').in('key', keys);
        
        if (data) {
          data.forEach(item => {
            try {
              if (item.key === 'theme_christmas') setXmasTheme(JSON.parse(item.value));
              if (item.key === 'theme_tet') setTetTheme(JSON.parse(item.value));
              if (item.key === 'theme_mid_autumn') setMidAutumnTheme(JSON.parse(item.value));
              if (item.key === 'theme_national_day') setNationalDayTheme(JSON.parse(item.value));
              
              if (item.key === userConfigKey) {
                const parsedPrefs = JSON.parse(item.value);
                setLayoutPrefs(parsedPrefs);
                localStorage.setItem('amelie_layout_prefs', JSON.stringify(parsedPrefs)); 
              }

              if (item.key === 'global_notification') {
                const notifData = JSON.parse(item.value);
                const dismissedId = localStorage.getItem('dismissed_notif_id');
                if (notifData && notifData.enabled && String(notifData.id) !== dismissedId) {
                  setGlobalNotif(notifData);
                }
              }

              // Load Banner
              if (item.key === 'global_banner') {
                setBannerNotif(JSON.parse(item.value));
              }

            } catch(e) {
              console.error("Lỗi parse config:", e);
            }
          });
        }
      }
      setIsInitializing(false);
    };

    fetchUserAndConfigs();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login');
      else setUser(session.user);
    });

    const channel = supabase.channel('system_configs_listener')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_configs' }, 
        (payload) => {
          try {
            if (payload.new.key === 'theme_christmas') setXmasTheme(JSON.parse(payload.new.value));
            if (payload.new.key === 'theme_tet') setTetTheme(JSON.parse(payload.new.value));
            if (payload.new.key === 'theme_mid_autumn') setMidAutumnTheme(JSON.parse(payload.new.value));
            if (payload.new.key === 'theme_national_day') setNationalDayTheme(JSON.parse(payload.new.value));
            
            if (payload.new.key === 'global_banner') {
              setBannerNotif(JSON.parse(payload.new.value));
            }
            
            if (payload.new.key === 'global_notification') {
              const notifData = JSON.parse(payload.new.value);
              const dismissedId = localStorage.getItem('dismissed_notif_id');
              if (notifData && notifData.enabled && String(notifData.id) !== dismissedId) {
                setGlobalNotif(notifData);
                setIsNotifClosing(false);
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

  const updateLayoutPrefs = async (newPrefs) => {
    setLayoutPrefs(newPrefs);
    localStorage.setItem('amelie_layout_prefs', JSON.stringify(newPrefs)); 
    
    if (user) {
      await supabase.from('system_configs').upsert({
        key: `layout_pref_${user.id}`,
        value: JSON.stringify(newPrefs),
        description: `User Layout Preferences - ${user.email}`
      }, { onConflict: 'key' });
    }
  };

  const togglePin = () => updateLayoutPrefs({ ...layoutPrefs, pinned: !layoutPrefs.pinned });
  const changePosition = (pos) => {
    updateLayoutPrefs({ ...layoutPrefs, position: pos });
    setShowLayoutSettings(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleCloseGlobalNotif = () => {
    setIsNotifClosing(true);
    setTimeout(() => {
      if (dontShowAgain && globalNotif) {
        localStorage.setItem('dismissed_notif_id', String(globalNotif.id));
      }
      setGlobalNotif(null);
      setIsNotifClosing(false);
    }, 300);
  };

  const userEmail = user?.email || '';
  const displayName = user?.user_metadata?.full_name || userEmail.split('@')[0] || '...';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const isAdmin = user?.user_metadata?.role === 'admin';
  const isOwner = user?.user_metadata?.is_owner === true;
  
  const adminRoutes = ['/admin', '/quan-ly-kpi', '/nhap-lieu-kpi', '/cap-nhat-nguoi-dong-goi', '/cap-nhat-lich-lam-viec', '/cap-nhat-san-pham', '/cap-nhat-so-do-kho', '/cap-nhat-day-ke', '/cap-nhat-webhook'];
  const ownerRoutes = ['/cap-nhat-tinh-nang'];

  let hasAccess = true;
  if (ownerRoutes.some(route => location.pathname.startsWith(route))) hasAccess = isOwner;
  else if (adminRoutes.some(route => location.pathname.startsWith(route))) hasAccess = isAdmin || isOwner;

  const isTet = tetTheme?.isTetEnabled || false;
  const isMidAutumn = (midAutumnTheme?.isMidAutumnEnabled || false) && !isTet;
  const isNationalDay = (nationalDayTheme?.isNationalDayEnabled || false) && !isTet && !isMidAutumn;
  const isXmas = (xmasTheme?.isXmasEnabled || false) && !isTet && !isMidAutumn && !isNationalDay;

  const getThemeVars = () => {
    if (isTet) return {
      bgImage: "url('/assets/bg-tet.jpg')",
      sidebar: 'bg-[#fff8f0]/95 backdrop-blur-xl border-red-100/50 shadow-[4px_0_24px_rgba(220,38,38,0.05)]',
      textPrimary: 'text-slate-800', textMuted: 'text-slate-500',
      activeBg: 'bg-red-50', activeText: 'text-red-700 font-bold', activeBorder: 'border-l-[3px] border-red-600',
      hoverBg: 'hover:bg-red-50/50', iconColor: 'text-slate-400 group-hover:text-red-500', iconActive: 'text-red-600',
      logoBg: 'bg-red-600', logoIcon: 'text-white', headerBorder: 'border-red-100/50'
    };
    if (isMidAutumn) return {
      bgImage: "url('/assets/bg-mid-autumn.jpg')",
      sidebar: 'bg-[#fffaf0]/95 backdrop-blur-xl border-orange-200/50 shadow-[4px_0_24px_rgba(234,88,12,0.05)]',
      textPrimary: 'text-slate-800', textMuted: 'text-slate-500',
      activeBg: 'bg-orange-50', activeText: 'text-orange-600 font-bold', activeBorder: 'border-l-[3px] border-orange-500',
      hoverBg: 'hover:bg-orange-50/50', iconColor: 'text-slate-400 group-hover:text-orange-500', iconActive: 'text-orange-600',
      logoBg: 'bg-orange-500', logoIcon: 'text-white', headerBorder: 'border-orange-200/50'
    };
    if (isNationalDay) return {
      bgImage: "url('/assets/bg-national-day.jpg')",
      sidebar: 'bg-[#fffcfc]/95 backdrop-blur-xl border-red-100/50 shadow-[4px_0_24px_rgba(220,38,38,0.05)]',
      textPrimary: 'text-slate-800', textMuted: 'text-slate-500',
      activeBg: 'bg-red-50', activeText: 'text-red-700 font-bold', activeBorder: 'border-l-[3px] border-red-600',
      hoverBg: 'hover:bg-red-50/50', iconColor: 'text-slate-400 group-hover:text-red-500', iconActive: 'text-red-600',
      logoBg: 'bg-red-600', logoIcon: 'text-white', headerBorder: 'border-red-100/50'
    };
    if (isXmas) return {
      bgImage: "url('/assets/bg-christmas.jpg')",
      sidebar: 'bg-[#0a231c]/95 backdrop-blur-xl border-[#1a4034] shadow-[4px_0_24px_rgba(0,0,0,0.2)]',
      textPrimary: 'text-slate-100', textMuted: 'text-slate-400',
      activeBg: 'bg-[#133d30]', activeText: 'text-emerald-400 font-bold', activeBorder: 'border-l-[3px] border-emerald-500',
      hoverBg: 'hover:bg-[#133d30]/70', iconColor: 'text-slate-400 group-hover:text-emerald-400', iconActive: 'text-emerald-400',
      logoBg: 'bg-white', logoIcon: 'text-[#0a231c]', headerBorder: 'border-[#1a4034]'
    };
    return {
      bgImage: "none",
      sidebar: 'bg-white border-slate-200 shadow-sm',
      textPrimary: 'text-slate-700', textMuted: 'text-slate-400',
      activeBg: 'bg-blue-50/80', activeText: 'text-blue-700 font-bold', activeBorder: 'border-l-[3px] border-blue-600',
      hoverBg: 'hover:bg-slate-50', iconColor: 'text-slate-400 group-hover:text-blue-600', iconActive: 'text-blue-600',
      logoBg: 'bg-blue-600', logoIcon: 'text-white', headerBorder: 'border-slate-100'
    };
  };

  const themeVars = getThemeVars();
  const isTopLayout = layoutPrefs.position === 'top';
  const sidebarExpanded = layoutPrefs.pinned;

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

  const toggleSubmenu = (id) => setMenuStates(prev => ({ ...prev, [id]: !prev[id] }));

  const handleMouseEnter = (e, label) => {
    if (sidebarExpanded || isTopLayout) return; 
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: layoutPrefs.position === 'left' ? rect.right + 12 : undefined,
      right: layoutPrefs.position === 'right' ? window.innerWidth - rect.left + 12 : undefined
    });
  };

  const handleMouseLeave = () => setActiveTooltip(null);

  // Helper lấy icon và màu cho banner
  const getBannerStyle = (type) => {
    switch (type) {
      case 'celebrate':
        return {
          gradient: 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500',
          icon: PartyPopper,
          badgeText: '🎉 SỰ KIỆN',
          shadow: 'shadow-[0_4px_20px_rgba(192,38,211,0.4)]'
        };
      case 'alert':
        return {
          gradient: 'bg-gradient-to-r from-rose-600 via-red-600 to-red-500',
          icon: Flame,
          badgeText: '🔥 CẢNH BÁO',
          shadow: 'shadow-[0_4px_20px_rgba(225,29,72,0.45)]'
        };
      case 'warning':
        return {
          gradient: 'bg-gradient-to-r from-amber-500 via-orange-500 to-orange-400',
          icon: Zap,
          badgeText: '⚡ LƯU Ý',
          shadow: 'shadow-[0_4px_20px_rgba(245,158,11,0.4)]'
        };
      default: // info
        return {
          gradient: 'bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500',
          icon: Megaphone,
          badgeText: '📢 THÔNG BÁO',
          shadow: 'shadow-[0_4px_20px_rgba(59,130,246,0.4)]'
        };
    }
  };

  const bannerStyle = bannerNotif ? getBannerStyle(bannerNotif.type) : null;

  return (
    <>
      {/* ====== CSS KEYFRAMES VÀ STYLES ====== */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee ${bannerNotif?.speed || 18}s linear infinite;
        }
        /* KHÔNG dừng khi hover - luôn chạy tiếp */
        /* .animate-marquee:hover { animation-play-state: paused; } */
        
        /* Ngăn chặn bôi đen text trong banner */
        .marquee-unselectable {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          pointer-events: none;
        }

        @keyframes notifIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-notif-in {
          animation: notifIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        @keyframes notifOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.9) translateY(20px); }
        }
        .animate-notif-out {
          animation: notifOut 0.3s ease-in forwards;
        }

        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-icon-bounce {
          animation: iconBounce 1.5s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
          background-size: 200% auto;
          animation: shimmer 2.5s linear infinite;
        }

        @keyframes confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100px) rotate(360deg); opacity: 0; }
        }
        .confetti-particle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 2px;
          animation: confettiFall 2s ease-in infinite;
        }
      `}</style>

      {/* ====== BANNER THÔNG BÁO CHẠY NGANG ====== */}
      {bannerNotif?.enabled && bannerStyle && (
        <div className={`absolute top-0 left-0 w-full h-10 z-[500] overflow-hidden ${bannerStyle.gradient} ${bannerStyle.shadow}`}>
          {/* Lớp phủ shimmer tạo hiệu ứng lấp lánh chuyển động */}
          <div className="absolute inset-0 animate-shimmer opacity-30 pointer-events-none" />

          {/* Hạt confetti trang trí (chỉ cho celebrate) */}
          {bannerNotif.type === 'celebrate' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="confetti-particle"
                  style={{
                    left: `${(i * 8.3) % 100}%`,
                    animationDelay: `${(i * 0.35) % 2}s`,
                    backgroundColor: ['#fff', '#fbbf24', '#f472b6', '#34d399', '#60a5fa'][i % 5],
                    top: '-5px'
                  }}
                />
              ))}
            </div>
          )}

          {/* Badge thông báo */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 shadow-inner pointer-events-none">
            <span className="text-[10px] font-black tracking-wider text-white drop-shadow-sm">
              {bannerStyle.badgeText}
            </span>
            <bannerStyle.icon size={14} className="text-white animate-icon-bounce" strokeWidth={2.5} />
          </div>

          {/* Nội dung chữ chạy - KHÔNG cho bôi đen, KHÔNG dừng khi hover */}
          <div className="whitespace-nowrap animate-marquee marquee-unselectable flex-1 h-full flex items-center pl-24 pr-8">
            <span className="text-sm font-bold text-white tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
              {bannerNotif.content || bannerNotif.text}
            </span>
          </div>

          {/* Đường viền phát sáng phía dưới */}
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
        </div>
      )}

      {/* ====== CONTAINER CHÍNH ====== */}
      <div className={`flex h-screen font-sans antialiased overflow-hidden relative ${themeVars.bgImage === 'none' ? 'bg-slate-50' : 'bg-transparent'} 
        ${isTopLayout ? 'flex-col' : layoutPrefs.position === 'right' ? 'flex-row-reverse' : 'flex-row'}
        ${bannerNotif?.enabled ? 'pt-10' : ''}`}
      >
        {/* TOOLTIP ĐỘC LẬP TẦNG TRÊN CÙNG (Cho Sidebar dọc thu gọn) */}
        {activeTooltip && (
          <div 
            className="fixed z-[99999] px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: activeTooltip.top,
              transform: 'translateY(-50%)',
              ...(activeTooltip.left ? { left: activeTooltip.left } : {}),
              ...(activeTooltip.right ? { right: activeTooltip.right } : {})
            }}
          >
            {activeTooltip.label}
            <div className={`absolute top-1/2 -translate-y-1/2 border-[5px] border-transparent 
              ${layoutPrefs.position === 'left' ? 'right-full border-r-slate-800' : 'left-full border-l-slate-800'}
            `} />
          </div>
        )}

        {themeVars.bgImage !== 'none' && (
          <div className="fixed inset-0 z-0 bg-no-repeat bg-center pointer-events-none transition-all duration-700"
               style={{ backgroundImage: themeVars.bgImage, backgroundSize: '100% 100%' }} />
        )}

        {/* NAVIGATION BAR CONTAINER */}
        <div
          onClick={(e) => { if (e.target.closest('a')) setMobileMenuOpen(false); }}
          className={`flex-shrink-0 z-40 flex transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] relative ${themeVars.sidebar}
            ${isTopLayout 
              ? `w-full h-16 flex-row items-center px-4 border-b ${themeVars.headerBorder}` 
              : `flex-col h-full ${layoutPrefs.position === 'left' ? 'border-r' : 'border-l'} ${sidebarExpanded ? 'w-[300px]' : 'w-[72px]'}`}
            max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[300px] max-md:flex-col max-md:h-full max-md:z-50 max-md:transition-transform max-md:border-r
            ${mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}`}
        >
          {/* LOGO HEADER */}
          <div className={`${isTopLayout ? 'w-auto pr-8' : `h-[68px] flex items-center justify-between px-4 sticky top-0 z-20 border-b ${themeVars.headerBorder}`}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-md ${themeVars.logoBg}`}>
                <PackageSearch className={themeVars.logoIcon} size={24} strokeWidth={2.5}/>
              </div>
              <div className={`transition-opacity duration-300 ${sidebarExpanded || isTopLayout ? 'opacity-100' : 'opacity-0 hidden max-md:block'}`}>
                <h1 className={`text-lg font-black tracking-tight flex items-center gap-1.5 leading-none whitespace-nowrap ${themeVars.textPrimary}`}>
                  Amelie WMS
                </h1>
              </div>
            </div>
            
            {!isTopLayout && (
              <button onClick={togglePin} className={`p-1.5 rounded-lg hover:bg-slate-100/20 transition-colors shrink-0 max-md:hidden ${themeVars.textMuted} hover:${themeVars.textPrimary} ${!sidebarExpanded ? 'absolute right-[16px]' : ''}`}>
                {sidebarExpanded ? <PinOff size={18} /> : <Pin size={18} />}
              </button>
            )}
          </div>

          {/* MENU AREA (Dynamic rendering Top vs Sidebar) */}
          <div className={`${isTopLayout ? 'flex-1 flex items-center h-full px-2' : 'flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin'}`}>
            
            {/* ======================= */}
            {/* RENDER DÀNH CHO LỀ TRÊN */}
            {/* ======================= */}
            {isTopLayout && (
              <div className="flex h-full items-center gap-2 relative">
                {MENU_CONFIG.map((group, gIdx) => {
                  const isAdminGroup = group.groupLabel === 'Hệ thống Quản trị';
                  return (
                    <div key={gIdx} className="h-full flex items-center group/mainnav">
                      <button className={`h-10 px-4 flex items-center gap-2 rounded-xl text-sm font-bold transition-all
                        ${isAdminGroup ? 'text-red-700 bg-red-50 hover:bg-red-100' : `${themeVars.textPrimary} hover:bg-slate-100/60`}
                      `}>
                        {group.groupLabel}
                        <ChevronDown size={16} className={isAdminGroup ? 'text-red-500' : themeVars.textMuted} />
                      </button>

                      <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-[100] py-2 opacity-0 invisible group-hover/mainnav:opacity-100 group-hover/mainnav:visible transition-all duration-200">
                        {group.items.map((item) => {
                          const hasSubItems = !!item.subItems;
                          const isActive = hasSubItems 
                            ? item.matchRoutes.some(route => location.pathname.includes(route)) || (location.pathname === '/' && item.id === 'dashboard')
                            : location.pathname === item.path;

                          return (
                            <div key={item.id} className="relative group/subnav">
                              {hasSubItems ? (
                                <button className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors ${isActive ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}>
                                  <div className="flex items-center gap-3">
                                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                                    <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                                  </div>
                                  <ChevronRight size={16} className={isActive ? 'text-blue-500' : 'text-slate-400'} />
                                </button>
                              ) : (
                                <Link to={item.path} className={`w-full flex items-center px-4 py-3 hover:bg-slate-50 transition-colors ${isActive ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}>
                                  <div className="flex items-center gap-3">
                                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                                    <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                                  </div>
                                </Link>
                              )}

                              {hasSubItems && (
                                <div className="absolute top-0 left-full -ml-1 pl-1">
                                  <div className="w-64 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-[101] py-2 opacity-0 invisible group-hover/subnav:opacity-100 group-hover/subnav:visible transition-all duration-200">
                                    {item.subItems.map((sub, sIdx) => {
                                      const isSubActive = location.pathname === sub.path;
                                      return (
                                        <Link key={sIdx} to={sub.path} className={`flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors ${isSubActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}`}>
                                          <sub.icon size={18} strokeWidth={isSubActive ? 2.5 : 2} className={`mt-0.5 shrink-0 ${isSubActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                          <div className="flex flex-col flex-1">
                                            <span className={`text-sm leading-tight ${isSubActive ? 'font-bold' : 'font-medium'}`}>{sub.label}</span>
                                            {sub.subtitle && <span className="text-[11px] mt-1 text-slate-500">{sub.subtitle}</span>}
                                          </div>
                                        </Link>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ============================= */}
            {/* RENDER DÀNH CHO LỀ TRÁI / PHẢI */}
            {/* ============================= */}
            {!isTopLayout && MENU_CONFIG.map((group, gIdx) => {
              const isAdminGroup = group.groupLabel === 'Hệ thống Quản trị';
              
              return (
                <div key={gIdx} className="mb-6">
                  {!sidebarExpanded && isAdminGroup && (
                    <hr className="border-t-2 border-dashed border-slate-200 mx-4 my-4" />
                  )}
                  
                  <div className={`
                    ${!sidebarExpanded && isAdminGroup ? 'border-[1.5px] border-red-400 rounded-2xl mx-1.5 py-1.5 bg-red-50/20 shadow-inner' : ''}
                  `}>
                    <div className={`px-5 mb-2 text-[11px] font-black uppercase tracking-widest transition-opacity duration-300 whitespace-nowrap ${themeVars.textMuted} ${sidebarExpanded ? 'opacity-100' : 'hidden'}`}>
                      {group.groupLabel}
                    </div>
                    
                    <nav className={`${sidebarExpanded ? 'space-y-1 px-3' : 'space-y-1'}`}>
                      {group.items.map(item => {
                        const hasSubItems = !!item.subItems;
                        const isActive = hasSubItems 
                          ? item.matchRoutes.some(route => location.pathname.includes(route)) || (location.pathname === '/' && item.id === 'dashboard')
                          : location.pathname === item.path;
                        const isOpen = menuStates[item.id];

                        if (hasSubItems) {
                          return (
                            <div key={item.id} className={`relative group ${sidebarExpanded ? '' : 'px-1'}`}>
                              <button 
                                onClick={() => toggleSubmenu(item.id)} 
                                onMouseEnter={(e) => handleMouseEnter(e, item.label)}
                                onMouseLeave={handleMouseLeave}
                                className={`w-full flex items-center rounded-xl cursor-pointer transition-all ${sidebarExpanded ? 'px-3 py-3' : 'p-3 justify-center'} ${themeVars.hoverBg} ${isActive && !isOpen ? themeVars.activeBg : ''}`}
                              >
                                <div className={`shrink-0 flex items-center justify-center w-8`}>
                                  <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? themeVars.iconActive : themeVars.iconColor}`} />
                                </div>
                                <div className={`flex items-center justify-between flex-1 transition-all duration-300 overflow-hidden ${sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                                  <span className={`text-sm tracking-wide leading-snug whitespace-nowrap ${isActive ? themeVars.activeText : `font-medium ${themeVars.textPrimary}`}`}>{item.label}</span>
                                  {sidebarExpanded && (
                                    <div className="shrink-0 ml-2">
                                      {isOpen ? <ChevronDown size={16} className={themeVars.textMuted}/> : <ChevronRight size={16} className={themeVars.textMuted}/>}
                                    </div>
                                  )}
                                </div>
                              </button>
                              
                              <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-1 mb-2' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                  <div className={`flex flex-col gap-1 ${sidebarExpanded ? 'ml-7 pl-3 border-l-2 border-slate-200/50' : 'items-center bg-slate-100/60 mx-1 py-1.5 rounded-xl shadow-inner'}`}>
                                    {item.subItems.map((sub, sIdx) => {
                                      const isSubActive = location.pathname === sub.path;
                                      return (
                                        <Link 
                                          key={sIdx} 
                                          to={sub.path} 
                                          onMouseEnter={(e) => handleMouseEnter(e, sub.label)}
                                          onMouseLeave={handleMouseLeave}
                                          className={`relative group flex items-start rounded-xl transition-all ${sidebarExpanded ? 'px-3 py-2.5 gap-3 w-full' : 'p-2 justify-center w-10 h-10'} ${themeVars.hoverBg} ${isSubActive ? themeVars.activeBg + ' ' + (sidebarExpanded ? themeVars.activeBorder : 'shadow-sm') : ''}`}
                                        >
                                          <sub.icon size={sidebarExpanded ? 16 : 18} strokeWidth={isSubActive ? 2.5 : 2} className={`${sidebarExpanded ? 'mt-0.5' : ''} shrink-0 ${isSubActive ? themeVars.iconActive : themeVars.textMuted}`} />
                                          
                                          {sidebarExpanded && (
                                            <div className="flex flex-col flex-1">
                                              <span className={`text-sm whitespace-normal leading-snug break-words ${isSubActive ? themeVars.activeText : `font-medium ${themeVars.textPrimary}`}`}>{sub.label}</span>
                                              {sub.subtitle && <span className={`text-[11px] mt-0.5 whitespace-normal leading-tight ${themeVars.textMuted}`}>{sub.subtitle}</span>}
                                            </div>
                                          )}
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
                          <div key={item.path} className={`relative group ${sidebarExpanded ? 'w-full' : 'px-1'}`}>
                            <Link 
                              to={item.path} 
                              onMouseEnter={(e) => handleMouseEnter(e, item.label)}
                              onMouseLeave={handleMouseLeave}
                              className={`flex items-center rounded-xl transition-all ${sidebarExpanded ? 'px-3 py-3 w-full' : 'p-3 justify-center'} ${themeVars.hoverBg} ${isActive ? themeVars.activeBg : ''}`}
                            >
                              <div className={`shrink-0 flex items-center justify-center w-8`}>
                                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors ${isActive ? themeVars.iconActive : themeVars.iconColor}`} />
                              </div>
                              <div className={`flex items-center flex-1 transition-all duration-300 overflow-hidden ${sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                                <span className={`text-sm tracking-wide leading-snug whitespace-nowrap ${isActive ? themeVars.activeText : `font-medium ${themeVars.textPrimary}`}`}>{item.label}</span>
                              </div>
                            </Link>
                          </div>
                        )
                      })}
                    </nav>
                  </div>
                </div>
              )
            })}
          </div>

          {/* USER PROFILE & SETTINGS */}
          <div className={`relative ${isTopLayout ? 'flex items-center pl-4 border-l' : 'p-4 border-t'} ${themeVars.headerBorder} flex items-center justify-between transition-all duration-300 ${!sidebarExpanded && !isTopLayout ? 'flex-col gap-3 py-4' : ''}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${!sidebarExpanded && !isTopLayout ? 'justify-center' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shadow-sm shrink-0 relative ${themeVars.logoBg} ${themeVars.logoIcon}`}>
                {avatarLetter}
              </div>
              <div className={`flex flex-col transition-all duration-300 overflow-hidden ${sidebarExpanded || isTopLayout ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
                <span className={`text-sm font-bold truncate leading-tight whitespace-nowrap max-w-[120px] ${themeVars.textPrimary}`}>{displayName}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${themeVars.textMuted}`}>{isAdmin ? 'Admin' : 'Nhân viên'}</span>
              </div>
            </div>
            
            <div className={`flex items-center gap-1 ${!sidebarExpanded && !isTopLayout ? 'flex-col' : ''}`}>
              <div className="relative" ref={layoutSettingsRef}>
                <button onClick={() => setShowLayoutSettings(!showLayoutSettings)} title="Cài đặt giao diện" className={`p-2 rounded-xl transition-colors ${themeVars.textMuted} hover:${themeVars.textPrimary} hover:bg-slate-100/50`}>
                  <SettingsIcon size={18} />
                </button>
                
                {/* Menu chọn Vị trí Layout */}
                {showLayoutSettings && (
                  <div className={`absolute z-50 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl w-40 p-1 
                    ${isTopLayout ? 'right-0 top-full' : layoutPrefs.position === 'left' ? 'left-full ml-2 bottom-0' : 'right-full mr-2 bottom-0'}`}>
                    <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">Vị trí Menu</div>
                    <button onClick={() => changePosition('left')} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors ${layoutPrefs.position === 'left' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-600'}`}>
                      <AlignLeft size={16} /> Lề trái
                    </button>
                    <button onClick={() => changePosition('right')} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors ${layoutPrefs.position === 'right' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-600'}`}>
                      <AlignRight size={16} /> Lề phải
                    </button>
                    <button onClick={() => changePosition('top')} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors ${layoutPrefs.position === 'top' ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-600'}`}>
                      <AlignVerticalSpaceAround size={16} /> Bên trên
                    </button>
                  </div>
                )}
              </div>
              
              <button onClick={() => setShowLogoutModal(true)} title="Đăng xuất" className={`p-2 rounded-xl transition-colors shrink-0 ${themeVars.textMuted} hover:text-red-500 hover:bg-red-50/20`}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative h-full z-10 flex flex-col">
          {!isTopLayout && (
            <button onClick={() => setMobileMenuOpen(true)} className={`md:hidden absolute top-4 ${layoutPrefs.position === 'right' ? 'right-4' : 'left-4'} z-30 p-2.5 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/60 hover:bg-white`}>
              <Menu size={20} className="text-slate-700" />
            </button>
          )}

          <div className="relative p-4 sm:p-8 flex-1 flex flex-col">
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
                <div className="p-3 bg-red-50 rounded-2xl">
                  <LogOut size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 leading-tight">Đăng xuất</h3>
                  <p className="text-sm text-slate-500 font-medium">Kết thúc phiên làm việc</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-8 font-medium">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowLogoutModal(false)} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors">
                  Hủy
                </button>
                <button onClick={handleLogout} className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md transition-colors">
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====== GLOBAL NOTIF MODAL ====== */}
        {globalNotif && (
          <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300 ${isNotifClosing ? 'pointer-events-none' : ''}`}>
            <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden ${isNotifClosing ? 'animate-notif-out' : 'animate-notif-in'}`}>
              {/* HEADER */}
              <div className={`px-8 py-6 flex items-start justify-between border-b relative overflow-hidden
                ${globalNotif.type === 'update' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100' : 
                  globalNotif.type === 'celebrate' ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border-amber-100' : 
                  'bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200'}`}>
                
                {/* Icon nền trang trí */}
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 blur-xl
                  ${globalNotif.type === 'update' ? 'bg-blue-400' : 
                    globalNotif.type === 'celebrate' ? 'bg-orange-400' : 'bg-slate-400'}`} />
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0
                    ${globalNotif.type === 'update' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 
                      globalNotif.type === 'celebrate' ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 
                      'bg-gradient-to-br from-slate-600 to-slate-700 text-white'}`}>
                    {globalNotif.type === 'update' ? (
                      <Settings size={26} className="animate-icon-bounce" strokeWidth={2} />
                    ) : globalNotif.type === 'celebrate' ? (
                      <PartyPopper size={26} className="animate-icon-bounce" strokeWidth={2} />
                    ) : (
                      <Info size={26} strokeWidth={2} />
                    )}
                  </div>
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-1
                      ${globalNotif.type === 'update' ? 'text-blue-500' : 
                        globalNotif.type === 'celebrate' ? 'text-orange-500' : 'text-slate-400'}`}>
                      {globalNotif.type === 'update' ? 'Cập nhật hệ thống' : 
                       globalNotif.type === 'celebrate' ? 'Tin vui' : 'Thông báo'}
                    </span>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight">
                      {globalNotif.title || 'Thông báo mới'}
                    </h3>
                  </div>
                </div>
                
                {/* Nút X đóng modal - VẪN GIỮ vì đây là popup, không phải banner */}
                <button 
                  onClick={() => setGlobalNotif(null)} 
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-xl transition-colors shrink-0 relative z-10 active:scale-90 duration-150"
                >
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>

              {/* BODY */}
              <div className="p-8">
                <div className={`text-slate-600 text-[15px] font-medium leading-relaxed whitespace-pre-wrap mb-8 
                  ${globalNotif.type === 'celebrate' ? 'text-slate-700' : ''}`}>
                  {globalNotif.content}
                </div>
                
                {/* Divider */}
                <div className="border-t border-slate-100 pt-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                    {/* Checkbox tùy chỉnh */}
                    <label className="flex items-center gap-3 text-sm text-slate-500 font-medium cursor-pointer group select-none hover:text-slate-700 transition">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={dontShowAgain} 
                          onChange={(e) => setDontShowAgain(e.target.checked)} 
                        />
                        <div className={`w-11 h-6 rounded-full transition-colors duration-300 
                          ${dontShowAgain ? 'bg-blue-500' : 'bg-slate-200'} 
                          after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                          after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow-md 
                          after:transition-transform after:duration-300 
                          ${dontShowAgain ? 'after:translate-x-5' : 'after:translate-x-0'}`} 
                        />
                      </div>
                      <span className="group-hover:text-slate-800 transition-colors">
                        Không hiển thị lại thông báo này
                      </span>
                    </label>
                    
                    <button 
                      onClick={handleCloseGlobalNotif} 
                      className={`w-full sm:w-auto px-8 py-3.5 text-white font-bold rounded-2xl shadow-lg 
                        transition-all duration-300 hover:shadow-xl active:scale-95
                        ${globalNotif.type === 'celebrate' 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' 
                          : globalNotif.type === 'update' 
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600' 
                            : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900'}`}
                    >
                      Đã hiểu
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}