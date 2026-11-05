import { useEffect, useState, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isAdminRole, isSuperAdminRole } from '../lib/roles';
import { getXmasEnabled } from '../lib/xmas';
import { sessionRevokedKey, isRevokedAfterLogin } from '../lib/session';
import { reportPresence, recordLoginHistory } from '../lib/presence';
import { 
  TrendingUp, Printer, Timer, Settings, PackageSearch, LogOut, Undo2, ScanLine, 
  Boxes, AlertTriangle, X, Wrench, ChevronDown, ChevronRight, UserCog, CalendarDays, 
  BarChart3, User, Pin, PinOff, ClipboardCheck, PackageMinus, CheckCircle2, 
  LayoutDashboard, Target, Box, ListChecks, MapPin, BarChart2,
  Filter, FileEdit, LayoutGrid, Webhook, History, ShieldAlert, Settings2, Loader2, Info,
  AlignLeft, AlignRight, AlignVerticalSpaceAround, Settings as SettingsIcon,
  Megaphone, Bell, Sparkles, Gift, Rocket, Flame, Star, Zap, Lock,
  MessageSquareWarning, Video, UploadCloud
} from 'lucide-react';

// === MAP URL VỚI TÍNH NĂNG ===
const ROUTE_TO_FEATURE_MAP = {
  '/': { parent: 'dashboard', sub: 'don_di_hang_ngay' },
  '/dashboard-don-hoan': { parent: 'dashboard', sub: 'dashboard_don_hoan' },
  '/dashboard-kpi': { parent: 'dashboard', sub: 'dashboard_kpi' },
  '/tra-cuu-luan-chuyen': { parent: 'dashboard', sub: 'tra_cuu_luan_chuyen' },
  
  '/bao-cao-don': { parent: 'print_orders', sub: 'bao_cao_don' },
  '/don-da-in-hom-nay': { parent: 'print_orders', sub: 'don_da_in' },
  '/loc-don-theo-day-ke': { parent: 'print_orders', sub: 'loc_don_day_ke' },
  '/chen-vi-tri-awb': { parent: 'print_orders', sub: 'chen_vi_tri_awb' },
  '/in-don-spx': { parent: 'print_orders', sub: 'in_don_spx' },

  '/dong-goi-don-hang': { parent: 'packing', sub: 'dong_goi_don_hang' },
  '/toc-do-dong-goi-chung': { parent: 'packing', sub: 'toc_do_dong_goi_chung' },
  '/toc-do-dong-goi-nhan-su': { parent: 'packing', sub: 'toc_do_dong_goi_nhan_su' },

  '/bao-cao-hoan-tong-hop': { parent: 'return_orders', sub: 'bao_cao_hoan_tong_hop' },
  '/xu-ly-don-hoan': { parent: 'return_orders', sub: 'xu_ly_don_hoan' },
  '/kiem-tra-don-hoan': { parent: 'return_orders', sub: 'kiem_tra_don_hoan' },
  '/tra-hang-hoan-tien': { parent: 'return_orders', sub: 'tra_hang_hoan_tien' },

  '/thong-ke-kiem-ke': { parent: 'inventory_check', sub: 'thong_ke_kiem_ke' },
  '/danh-sach-kiem-ke': { parent: 'inventory_check', sub: 'danh_sach_kiem_ke' },

  '/doi-soat-kho': { parent: 'standalone_doi_soat', sub: null },

  '/bao-cao-ton-kho': { parent: 'inventory_report', sub: 'bao_cao_ton_kho' },
  '/vi-tri-san-pham': { parent: 'inventory_report', sub: 'vi_tri_san_pham' },

  '/tong-hop-khieu-nai': { parent: 'complaints', sub: 'tong_hop_khieu_nai' },
  '/video-khieu-nai': { parent: 'complaints', sub: 'video_khieu_nai' },

  '/don-khong-khai-gia': { parent: 'standalone_khai_gia', sub: null },
  '/admin': { parent: 'admin_sys', sub: null },

  '/quan-ly-kpi': { parent: 'kpi', sub: 'quan_ly_kpi' },
  '/nhap-lieu-kpi': { parent: 'kpi', sub: 'nhap_lieu_kpi' },

  '/cap-nhat-nguoi-dong-goi': { parent: 'system_adjust', sub: 'cap_nhat_nguoi_dong_goi' },
  '/cap-nhat-lich-lam-viec': { parent: 'system_adjust', sub: 'cap_nhat_lich_lam_viec' },
  '/cap-nhat-san-pham': { parent: 'system_adjust', sub: 'cap_nhat_san_pham' },
  '/cap-nhat-so-do-kho': { parent: 'system_adjust', sub: 'cap_nhat_so_do_kho' },
  '/cap-nhat-day-ke': { parent: 'system_adjust', sub: 'cap_nhat_day_ke' },
  '/cap-nhat-webhook': { parent: 'system_adjust', sub: 'cap_nhat_webhook' },
  '/upload-video-hoan': { parent: 'system_adjust', sub: 'upload_video_hoan' }
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const userRef = useRef(null);
  const sessionSnapshotRef = useRef(null);
  const kickingRef = useRef(false);

  // Da nguoi dung ra man hinh dang nhap voi thong bao het phien (chi goi 1 lan).
  const kickSession = async () => {
    if (kickingRef.current) return;
    kickingRef.current = true;
    try { await supabase.auth.signOut(); } catch (e) {}
    navigate('/login?session_expired=1', { replace: true });
  };

  // Kiem tra phien con hop le khong: tai khoan bi xoa, hoac role/is_owner bi doi, hoac co dong thu hoi moi hon lan dang nhap.
  const checkSessionValid = async (currentUser) => {
    const me = currentUser || userRef.current;
    if (!me) return;
    const { data: { user: fresh }, error } = await supabase.auth.getUser();
    if (error || !fresh) { await kickSession(); return; }
    const snap = sessionSnapshotRef.current;
    if (snap && (fresh.user_metadata?.role !== snap.role || (fresh.user_metadata?.is_owner === true) !== snap.isOwner)) {
      await kickSession(); return;
    }
    const { data: revoked } = await supabase.from('system_configs').select('value').eq('key', sessionRevokedKey(fresh.id)).maybeSingle();
    if (revoked && isRevokedAfterLogin(revoked.value, fresh)) { await kickSession(); }
  };
  const [isInitializing, setIsInitializing] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Thông báo Global System
  const [globalNotif, setGlobalNotif] = useState(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isNotifClosing, setIsNotifClosing] = useState(false);
  const [bannerNotif, setBannerNotif] = useState(null);

  // === STATE CẤU HÌNH KHÓA TÍNH NĂNG ===
  const [featureLocks, setFeatureLocks] = useState({});

  const [layoutPrefs, setLayoutPrefs] = useState(() => {
    try {
      const cached = localStorage.getItem('amelie_layout_prefs');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return { pinned: true, position: 'left' }; 
  });
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const layoutSettingsRef = useRef(null);

  const [menuStates, setMenuStates] = useState({
    dashboard: false, print_orders: false, packing: false, 
    return_orders: false, inventory_check: false, inventory_report: false, 
    complaints: false, kpi: false, system_adjust: false
  });

  const [activeTooltip, setActiveTooltip] = useState(null);
  const [xmasOn, setXmasOn] = useState(true);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (layoutSettingsRef.current && !layoutSettingsRef.current.contains(event.target)) {
        setShowLayoutSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let alive = true;
    getXmasEnabled().then(v => { if (alive) setXmasOn(v); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const p = location.pathname;
    setMenuStates(prev => ({
      ...prev,
      dashboard: prev.dashboard || ['/', '/dashboard-', '/tra-cuu-luan-chuyen'].some(m => p.includes(m)),
      print_orders: prev.print_orders || ['/bao-cao-don', '/don-da-in-hom-nay', '/loc-don-theo-day-ke', '/chen-vi-tri-awb', '/in-don-spx'].some(m => p.includes(m)),
      packing: prev.packing || ['/dong-goi-', '/toc-do-dong-goi-'].some(m => p.includes(m)),
      return_orders: prev.return_orders || ['/bao-cao-hoan-', '/kiem-tra-don-hoan', '/xu-ly-don-hoan', '/tra-hang-hoan-tien'].some(m => p.includes(m)),
      inventory_check: prev.inventory_check || ['/thong-ke-kiem-ke', '/danh-sach-kiem-ke'].some(m => p.includes(m)),
      inventory_report: prev.inventory_report || ['/bao-cao-ton-kho', '/vi-tri-san-pham'].some(m => p.includes(m)),
      complaints: prev.complaints || ['/tong-hop-khieu-nai', '/video-khieu-nai'].some(m => p.includes(m)),
      kpi: prev.kpi || ['/quan-ly-kpi', '/nhap-lieu-kpi'].some(m => p.includes(m)),
      system_adjust: prev.system_adjust || ['/cap-nhat-', '/upload-video-hoan'].some(m => p.includes(m))
    }));
  }, [location.pathname]);

  useEffect(() => {
    const fetchUserAndConfigs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      userRef.current = user;
      if (user) {
        sessionSnapshotRef.current = { role: user.user_metadata?.role, isOwner: user.user_metadata?.is_owner === true };
        // Neu tai khoan da bi thu hoi truoc khi vao trang (va chua dang nhap lai sau do) thi da ra ngay.
        const { data: revoked } = await supabase.from('system_configs').select('value').eq('key', sessionRevokedKey(user.id)).maybeSingle();
        if (revoked && isRevokedAfterLogin(revoked.value, user)) { await kickSession(); return; }
      }
      
      if (user) {
        const userConfigKey = `layout_pref_${user.id}`;
        const keys = ['global_notification', 'global_banner', userConfigKey];
        
        // CÁCH FETCH AN TOÀN ĐỂ KHÔNG BAO GIỜ BỊ CRASH GIAO DIỆN
        const [normalConfigs, lockConfigs] = await Promise.all([
          supabase.from('system_configs').select('key, value').in('key', keys),
          supabase.from('system_configs').select('key, value').ilike('key', 'feature_lock_%')
        ]);
        
        const data = [...(normalConfigs.data || []), ...(lockConfigs.data || [])];
        
        if (data.length > 0) {
          const loadedLocks = {};
          data.forEach(item => {
            try {
              if (item.key === userConfigKey) {
                const parsedPrefs = JSON.parse(item.value);
                setLayoutPrefs(parsedPrefs);
                localStorage.setItem('amelie_layout_prefs', JSON.stringify(parsedPrefs)); 
              }
              else if (item.key === 'global_notification') {
                const notifData = JSON.parse(item.value);
                const dismissedId = localStorage.getItem('dismissed_notif_id');
                if (notifData && notifData.enabled && String(notifData.id) !== dismissedId) {
                  setGlobalNotif(notifData);
                }
              }
              else if (item.key === 'global_banner') {
                setBannerNotif(JSON.parse(item.value));
              }
              else if (item.key.startsWith('feature_lock_')) {
                const parentId = item.key.replace('feature_lock_', '');
                loadedLocks[parentId] = JSON.parse(item.value);
              }
            } catch(e) {
              console.error("Lỗi parse config:", item.key, e);
            }
          });
          setFeatureLocks(loadedLocks);
        }
      }
      setIsInitializing(false);
    };

    fetchUserAndConfigs();

    // Hien dien: ghi nhan dang mo app ngay khi vao + moi 5 phut, de
    // Owner xem duoc ai dang online o tab Quan ly Users.
    reportPresence();
    const presenceIntervalId = setInterval(() => { reportPresence(); }, 5 * 60 * 1000);

    // Kiem tra dinh ky + khi quay lai tab, de tai khoan bi xoa/doi quyen bi da ra trong vong ~1 phut
    // ngay ca khi realtime khong toi (vi du dang o tab khac).
    const intervalId = setInterval(() => { checkSessionValid(); }, 60000);
    const onFocus = () => { checkSessionValid(); };
    window.addEventListener('focus', onFocus);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate('/login');
      else {
        setUser(session.user); userRef.current = session.user;
        if (!sessionSnapshotRef.current) sessionSnapshotRef.current = { role: session.user.user_metadata?.role, isOwner: session.user.user_metadata?.is_owner === true };
        // Chi ghi khi dang nhap that (SIGNED_IN), khong ghi khi load lai
        // trang (INITIAL_SESSION) hay refresh token (TOKEN_REFRESHED).
        if (event === 'SIGNED_IN') { recordLoginHistory(); reportPresence(); }
      }
    });

    const channel = supabase.channel('system_configs_listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_configs' }, 
        (payload) => {
          try {
            if (payload.new.key && payload.new.key.startsWith('session_revoked_')) {
              const me = userRef.current;
              if (me && payload.new.key === sessionRevokedKey(me.id) && isRevokedAfterLogin(payload.new.value, me)) {
                kickSession();
              }
              return;
            }
            if (payload.new.key === 'global_banner') {
              setBannerNotif(JSON.parse(payload.new.value));
            }
            else if (payload.new.key === 'global_notification') {
              const notifData = JSON.parse(payload.new.value);
              const dismissedId = localStorage.getItem('dismissed_notif_id');
              if (notifData && notifData.enabled && String(notifData.id) !== dismissedId) {
                setGlobalNotif(notifData);
                setIsNotifClosing(false);
              } else {
                setGlobalNotif(null);
              }
            }
            // REALTIME KHÓA TÍNH NĂNG
            else if (payload.new.key.startsWith('feature_lock_')) {
              const parentId = payload.new.key.replace('feature_lock_', '');
              setFeatureLocks(prev => ({
                ...prev,
                [parentId]: JSON.parse(payload.new.value)
              }));
            }
          } catch (e) { }
        }
      ).subscribe();

    return () => {
      clearInterval(intervalId);
      clearInterval(presenceIntervalId);
      window.removeEventListener('focus', onFocus);
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
  const isAdmin = isAdminRole(user?.user_metadata?.role);
  const isSuperAdmin = isSuperAdminRole(user?.user_metadata?.role);
  const isOwner = user?.user_metadata?.is_owner === true;
  
  const adminRoutes = ['/admin', '/quan-ly-kpi', '/nhap-lieu-kpi', '/cap-nhat-nguoi-dong-goi', '/cap-nhat-lich-lam-viec', '/cap-nhat-san-pham', '/cap-nhat-so-do-kho', '/cap-nhat-day-ke', '/cap-nhat-webhook', '/upload-video-hoan'];
  const ownerRoutes = ['/cap-nhat-tinh-nang'];

  let hasAccess = true;
  if (ownerRoutes.some(route => location.pathname.startsWith(route))) hasAccess = isOwner;
  else if (adminRoutes.some(route => location.pathname.startsWith(route))) hasAccess = isAdmin || isOwner;

  // === KIỂM TRA TRẠNG THÁI KHÓA ===
  let isFeatureLocked = false;
  let lockMessage = '';
  
  const currentRouteMapping = ROUTE_TO_FEATURE_MAP[location.pathname];
  if (currentRouteMapping) {
    const parentLockConfig = featureLocks[currentRouteMapping.parent];
    if (parentLockConfig) {
      if (parentLockConfig.isLocked) {
        isFeatureLocked = true;
        lockMessage = parentLockConfig.message;
      } else if (currentRouteMapping.sub && parentLockConfig.subs?.[currentRouteMapping.sub]?.isLocked) {
        isFeatureLocked = true;
        lockMessage = parentLockConfig.subs[currentRouteMapping.sub].message;
      }
    }
  }

  const getThemeVars = () => {
    return {
      sidebar: 'bg-white border-slate-200 shadow-sm',
      textPrimary: 'text-slate-700', textMuted: 'text-slate-400',
      activeBg: 'bg-slate-900', activeText: 'text-white font-bold', activeBorder: 'shadow-[inset_4px_0_0_0_#059669]',
      hoverBg: 'hover:bg-slate-100', iconColor: 'text-slate-400 group-hover:text-blue-600', iconActive: 'text-white',
      activeBar: 'shadow-[inset_4px_0_0_0_#059669]', sectionLabel: 'text-slate-500',
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
          matchRoutes: ['/bao-cao-hoan-', '/kiem-tra-don-hoan', '/xu-ly-don-hoan', '/tra-hang-hoan-tien'],
          subItems: [
            { path: '/bao-cao-hoan-tong-hop', label: 'Tổng hợp đơn hoàn', icon: BarChart3 },
            { path: '/xu-ly-don-hoan', label: 'Xử lý Đơn hoàn', icon: PackageMinus },
            { path: '/kiem-tra-don-hoan', label: 'Kiểm tra & Chốt SL', icon: ScanLine },
            { path: '/tra-hang-hoan-tien', label: 'Trả hàng hoàn tiền', icon: Undo2 }
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
        {
          id: 'complaints', label: 'Khiếu nại', icon: MessageSquareWarning,
          matchRoutes: ['/tong-hop-khieu-nai', '/video-khieu-nai'],
          subItems: [
            { path: '/tong-hop-khieu-nai', label: 'Tổng hợp đơn khiếu nại', icon: BarChart3 },
            { path: '/video-khieu-nai', label: 'Video khiếu nại', icon: Video }
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
          matchRoutes: ['/cap-nhat-', '/upload-video-hoan'],
          subItems: [
            ...(isOwner ? [{ path: '/cap-nhat-tinh-nang', label: 'Khóa tính năng', icon: ShieldAlert }] : []),
            { path: '/cap-nhat-nguoi-dong-goi', label: 'Người đóng gói', icon: UserCog },
            { path: '/cap-nhat-lich-lam-viec', label: 'Lịch làm việc', icon: CalendarDays },
            { path: '/cap-nhat-san-pham', label: 'Hiệu chỉnh sản phẩm', icon: PackageSearch },
            { path: '/cap-nhat-so-do-kho', label: 'Sơ đồ Kho hàng', icon: MapPin },
            { path: '/cap-nhat-day-ke', label: 'Quy ước dãy kệ', icon: LayoutGrid },
            { path: '/cap-nhat-webhook', label: 'Chạy lại Webhook', icon: Webhook },
            { path: '/upload-video-hoan', label: 'Upload video hàng hoàn', icon: UploadCloud }
          ]
        }
      ]
    }] : [])
  ];

  // Ẩn khỏi menu với người không phải Owner khi tính năng bị khóa: khóa cấp
  // cha thì ẩn cả mục cha, khóa cấp con thì chỉ ẩn mục con đó; mục cha nào
  // không còn mục con nào thì ẩn luôn. Dùng đúng bảng ROUTE_TO_FEATURE_MAP
  // như màn hình khóa bên dưới, nên nút bị ẩn đúng với những trang mà mở
  // trực tiếp sẽ hiện bảo trì. Owner vẫn thấy đủ để kiểm tra.
  const isLockedConfig = (cfg) => cfg?.isLocked === true || cfg?.isLocked === 'true';
  const isMenuPathLocked = (path) => {
    const mapping = ROUTE_TO_FEATURE_MAP[path];
    if (!mapping) return false;
    const lock = featureLocks[mapping.parent];
    if (!lock) return false;
    if (isLockedConfig(lock)) return true;
    if (mapping.sub && isLockedConfig(lock.subs?.[mapping.sub])) return true;
    return false;
  };
  const visibleMenuConfig = isOwner ? MENU_CONFIG : MENU_CONFIG.map(group => ({
    ...group,
    items: group.items.map(item => {
      if (item.subItems) {
        if (isLockedConfig(featureLocks[item.id])) return null;
        const visibleSubs = item.subItems.filter(sub => !isMenuPathLocked(sub.path));
        return visibleSubs.length ? { ...item, subItems: visibleSubs } : null;
      }
      return isMenuPathLocked(item.path) ? null : item;
    }).filter(Boolean)
  })).filter(group => group.items.length > 0);

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

  const getBannerStyle = (type) => {
    switch (type) {
      case 'alert':
        return {
          gradient: 'bg-gradient-to-r from-rose-600 via-red-600 to-red-500',
          icon: Flame,
          badgeText: ' CẢNH BÁO',
          shadow: 'shadow-[0_4px_20px_rgba(225,29,72,0.45)]'
        };
      case 'warning':
        return {
          gradient: 'bg-gradient-to-r from-amber-500 via-orange-500 to-orange-400',
          icon: Zap,
          badgeText: ' LƯU Ý',
          shadow: 'shadow-[0_4px_20px_rgba(245,158,11,0.4)]'
        };
      default:
        return {
          gradient: 'bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-500',
          icon: Megaphone,
          badgeText: ' THÔNG BÁO',
          shadow: 'shadow-[0_4px_20px_rgba(59,130,246,0.4)]'
        };
    }
  };

  const bannerStyle = bannerNotif ? getBannerStyle(bannerNotif.type) : null;

  return (
    <>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee ${bannerNotif?.speed || 18}s linear infinite;
        }
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
      `}</style>

      {bannerNotif?.enabled && bannerStyle && (
        <div className={`no-print absolute top-0 left-0 w-full h-10 z-[500] overflow-hidden ${bannerStyle.gradient} ${bannerStyle.shadow}`}>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 shadow-inner pointer-events-none">
            <span className="text-xs font-bold tracking-wider text-white drop-shadow-sm">
              {bannerStyle.badgeText}
            </span>
            <bannerStyle.icon size={14} className="text-white animate-icon-bounce" strokeWidth={2.5} />
          </div>

          <div className="flex-1 h-full flex items-center pl-24 pr-8 min-w-0">
            <span className="text-sm font-bold text-white tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] truncate">
              {bannerNotif.content || bannerNotif.text}
            </span>
          </div>

          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
        </div>
      )}

      <div className={`layout-root flex h-screen font-sans antialiased overflow-hidden relative ${xmasOn ? 'bg-gradient-to-b from-[#DFF4FF] via-[#F0F9FF] to-[#F8FAFC]' : 'bg-slate-50'} 
        ${isTopLayout ? 'flex-col' : layoutPrefs.position === 'right' ? 'flex-row-reverse' : 'flex-row'}
        ${bannerNotif?.enabled ? 'pt-10' : ''}`}
      >
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

        <div
          className={`no-print flex-shrink-0 z-40 flex transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] relative ${themeVars.sidebar}
            ${isTopLayout
              ? `w-full h-16 flex-row items-center px-4 border-b ${themeVars.headerBorder}`
              : `flex-col h-full ${layoutPrefs.position === 'left' ? 'border-r' : 'border-l'} ${sidebarExpanded ? 'w-[300px]' : 'w-[72px]'}`}
        `}>
          <div className={`${isTopLayout ? 'w-auto pr-8' : `h-[68px] flex items-center justify-between px-4 sticky top-0 z-20 border-b ${themeVars.headerBorder}`}`}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-md ${themeVars.logoBg}`}>
                <PackageSearch className={themeVars.logoIcon} size={24} strokeWidth={2.5}/>
              </div>
              <div className={`transition-opacity duration-300 ${sidebarExpanded || isTopLayout ? 'opacity-100' : 'opacity-0 hidden'}`}>
                <h1 className={`text-lg font-bold tracking-tight flex items-center gap-1.5 leading-none whitespace-nowrap ${themeVars.textPrimary}`}>
                  WMS
                </h1>
              </div>
            </div>
            
            {!isTopLayout && (
              <button onClick={togglePin} className={`p-1.5 rounded-lg hover:bg-slate-100/20 transition-colors shrink-0 ${themeVars.textMuted} hover:${themeVars.textPrimary} ${!sidebarExpanded ? 'absolute right-[16px]' : ''}`}>
                {sidebarExpanded ? <PinOff size={18} /> : <Pin size={18} />}
              </button>
            )}
          </div>

          <div className={`${isTopLayout ? 'flex-1 flex items-center h-full px-2' : 'flex-1 overflow-y-auto overflow-x-hidden py-5 scrollbar-thin'}`}>
            
            {isTopLayout && (
              <div className="flex h-full items-center gap-2 relative">
                {visibleMenuConfig.map((group, gIdx) => {
                  const isAdminGroup = group.groupLabel === 'Hệ thống Quản trị';
                  const groupIsActive = group.items.some((it) => it.subItems
                    ? (it.matchRoutes?.some((route) => location.pathname.includes(route)) || (location.pathname === '/' && it.id === 'dashboard'))
                    : location.pathname === it.path);
                  return (
                    <div key={gIdx} className="h-full flex items-center group/mainnav">
                      <button className={`h-10 px-4 flex items-center gap-2 rounded-xl text-sm font-bold transition-all
                        ${isAdminGroup
                          ? (groupIsActive ? 'text-white bg-red-700 hover:bg-red-800' : 'text-red-700 bg-red-50 hover:bg-red-100')
                          : (groupIsActive ? 'text-white bg-slate-900 shadow-[inset_4px_0_0_0_#059669]' : `${themeVars.textPrimary} hover:bg-slate-100`)}
                      `}>
                        {group.groupLabel}
                        <ChevronDown size={16} className={groupIsActive ? (isAdminGroup ? 'text-red-200' : 'text-white') : (isAdminGroup ? 'text-red-500' : themeVars.textMuted)} />
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
                                <button className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isActive ? 'bg-slate-900 text-white shadow-[inset_4px_0_0_0_#059669]' : 'text-slate-700 hover:bg-slate-100'}`}>
                                  <div className="flex items-center gap-3">
                                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-slate-400'} />
                                    <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                                  </div>
                                  <ChevronRight size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                                </button>
                              ) : (
                                <Link to={item.path} className={`w-full flex items-center px-4 py-3 transition-colors ${isActive ? 'bg-slate-900 text-white shadow-[inset_4px_0_0_0_#059669]' : 'text-slate-700 hover:bg-slate-100'}`}>
                                  <div className="flex items-center gap-3">
                                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-slate-400'} />
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
                                        <Link key={sIdx} to={sub.path} className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${isSubActive ? 'bg-slate-900 text-white shadow-[inset_4px_0_0_0_#059669]' : 'text-slate-700 hover:bg-slate-100'}`}>
                                          <sub.icon size={18} strokeWidth={isSubActive ? 2.5 : 2} className={`mt-0.5 shrink-0 ${isSubActive ? 'text-white' : (sub.highlight ? 'text-rose-500' : 'text-slate-400')}`} />
                                          <div className="flex flex-col flex-1">
                                            <span className={`text-sm leading-tight ${isSubActive ? 'font-bold text-white' : `font-medium ${sub.highlight ? 'text-rose-600 font-bold' : ''}`}`}>{sub.label}</span>
                                            {sub.subtitle && <span className={`text-xs mt-1 ${isSubActive ? 'text-slate-300' : 'text-slate-500'}`}>{sub.subtitle}</span>}
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

            {!isTopLayout && visibleMenuConfig.map((group, gIdx) => {
              const isAdminGroup = group.groupLabel === 'Hệ thống Quản trị';
              
              return (
                <div key={gIdx} className="mb-8">
                  {gIdx > 0 && (sidebarExpanded || !isAdminGroup) && (
                    <div aria-hidden="true" className="mx-5 mb-6 border-t border-slate-200" />
                  )}
                  {!sidebarExpanded && isAdminGroup && (
                    <hr className="border-t-2 border-dashed border-slate-200 mx-4 my-4" />
                  )}
                  
                  <div className={`
                    ${!sidebarExpanded && isAdminGroup ? 'border-[1.5px] border-red-400 rounded-2xl mx-1.5 py-1.5 bg-red-50/20 shadow-inner' : ''}
                  `}>
                    <div className={`px-5 mb-3 flex items-center gap-3 transition-opacity duration-300 whitespace-nowrap ${sidebarExpanded ? 'opacity-100' : 'hidden'}`}>
                      <span className={`ui-section-title ${themeVars.sectionLabel}`}>{group.groupLabel}</span>
                      <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
                    </div>
                    
                    <nav className={`${sidebarExpanded ? 'space-y-1.5 px-3' : 'space-y-1.5'}`}>
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
                                className={`w-full flex items-center rounded-xl cursor-pointer transition-all ${sidebarExpanded ? 'px-3 py-3' : 'p-3 justify-center'} ${isActive ? `${themeVars.activeBg} ${themeVars.activeBar}` : themeVars.hoverBg}`}
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
                                          className={`relative group flex items-start rounded-xl transition-all ${sidebarExpanded ? 'px-3 py-2.5 gap-3 w-full' : 'p-2 justify-center w-10 h-10'} ${isSubActive ? themeVars.activeBg + ' ' + (sidebarExpanded ? themeVars.activeBorder : 'shadow-sm') : themeVars.hoverBg}`}
                                        >
                                          <sub.icon size={sidebarExpanded ? 16 : 18} strokeWidth={isSubActive ? 2.5 : 2} className={`${sidebarExpanded ? 'mt-0.5' : ''} shrink-0 ${isSubActive ? themeVars.iconActive : (sub.highlight ? 'text-rose-500' : themeVars.textMuted)}`} />
                                          
                                          {sidebarExpanded && (
                                            <div className="flex flex-col flex-1">
                                              <span className={`text-sm whitespace-normal leading-snug break-words ${isSubActive ? themeVars.activeText : `font-medium ${themeVars.textPrimary} ${sub.highlight ? 'text-rose-600 font-bold' : ''}`}`}>{sub.label}</span>
                                              {sub.subtitle && <span className={`text-xs mt-0.5 whitespace-normal leading-tight ${themeVars.textMuted}`}>{sub.subtitle}</span>}
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
                              className={`flex items-center rounded-xl transition-all ${sidebarExpanded ? 'px-3 py-3 w-full' : 'p-3 justify-center'} ${isActive ? `${themeVars.activeBg} ${themeVars.activeBar}` : themeVars.hoverBg}`}
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

          <div className={`relative ${isTopLayout ? 'flex items-center pl-4 border-l' : 'p-5 border-t'} ${themeVars.headerBorder} flex items-center justify-between transition-all duration-300 ${!sidebarExpanded && !isTopLayout ? 'flex-col gap-3 py-4' : ''}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${!sidebarExpanded && !isTopLayout ? 'justify-center' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0 relative ${themeVars.logoBg} ${themeVars.logoIcon}`}>
                {avatarLetter}
              </div>
              <div className={`flex flex-col transition-all duration-300 overflow-hidden ${sidebarExpanded || isTopLayout ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
                <span className={`text-sm font-bold truncate leading-tight whitespace-nowrap max-w-[120px] ${themeVars.textPrimary}`}>{displayName}</span>
                <span className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${themeVars.textMuted}`}>
  {isOwner ? 'Owner' : isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'User'}
</span>
              </div>
            </div>
            
            <div className={`flex items-center gap-1 ${!sidebarExpanded && !isTopLayout ? 'flex-col' : ''}`}>
              <div className="relative" ref={layoutSettingsRef}>
                <button onClick={() => setShowLayoutSettings(!showLayoutSettings)} title="Cài đặt giao diện" className={`p-2 rounded-lg transition-colors ${themeVars.textMuted} hover:${themeVars.textPrimary} hover:bg-slate-100/50`}>
                  <SettingsIcon size={18} />
                </button>
                
                {showLayoutSettings && (
                  <div className={`absolute z-50 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl w-40 p-1 
                    ${isTopLayout ? 'right-0 top-full' : layoutPrefs.position === 'left' ? 'left-full ml-2 bottom-0' : 'right-full mr-2 bottom-0'}`}>
                    <div className="px-3 py-2 ui-section-title text-slate-500 border-b border-slate-200 mb-1">Vị trí Menu</div>
                    <button onClick={() => changePosition('left')} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${layoutPrefs.position === 'left' ? 'text-white font-bold bg-slate-900 shadow-[inset_4px_0_0_0_#059669]' : 'text-slate-600 hover:bg-slate-100'}`}>
                      <AlignLeft size={16} /> Lề trái
                    </button>
                    <button onClick={() => changePosition('right')} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${layoutPrefs.position === 'right' ? 'text-white font-bold bg-slate-900 shadow-[inset_4px_0_0_0_#059669]' : 'text-slate-600 hover:bg-slate-100'}`}>
                      <AlignRight size={16} /> Lề phải
                    </button>
                    <button onClick={() => changePosition('top')} className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${layoutPrefs.position === 'top' ? 'text-white font-bold bg-slate-900 shadow-[inset_4px_0_0_0_#059669]' : 'text-slate-600 hover:bg-slate-100'}`}>
                      <AlignVerticalSpaceAround size={16} /> Bên trên
                    </button>
                  </div>
                )}
              </div>
              
              <button onClick={() => setShowLogoutModal(true)} title="Đăng xuất" className={`p-2 rounded-lg transition-colors shrink-0 ${themeVars.textMuted} hover:text-red-500 hover:bg-red-50/20`}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="layout-main-col flex-1 overflow-y-auto overflow-x-hidden relative h-full z-10 flex flex-col">
          <div className="layout-page-wrap relative p-6 sm:p-8 flex-1 flex flex-col">
            {isInitializing ? (
              <div className="flex flex-col items-center justify-center m-auto gap-4">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Đang tải phân quyền...</span>
              </div>
            ) : !hasAccess ? (
               <div className="flex flex-col items-center justify-center m-auto text-center animate-in fade-in zoom-in-95 duration-500 max-w-md w-full">
                 <div className="w-24 h-24 bg-white/80 rounded-full flex items-center justify-center mb-6 border-[8px] border-white/40 shadow-inner">
                   <ShieldAlert size={40} className="text-red-600" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2 uppercase tracking-tight bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-xl shadow-sm">Truy cập bị từ chối</h2>
                 <p className="text-slate-800 mb-8 text-sm leading-relaxed font-bold bg-white/90 backdrop-blur-md px-5 py-3 rounded-xl shadow-sm">Bạn không có quyền truy cập trang này. Vui lòng liên hệ Quản trị viên để được cấp quyền.</p>
                 <button onClick={() => navigate('/')} className="px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 shadow-md transition-all flex items-center gap-2">
                   <Undo2 size={18} /> Quay lại trang chủ
                 </button>
               </div>
            ) : !isOwner && isFeatureLocked ? (
               <div className="flex flex-col items-center justify-center m-auto text-center animate-in fade-in zoom-in-95 duration-500 max-w-md w-full">
                 <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 border-[8px] border-white/40 shadow-inner">
                   <Lock size={40} className="text-red-600" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2 uppercase tracking-tight bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-xl shadow-sm">Bảo trì hệ thống</h2>
                 <p className="text-slate-800 mb-8 text-sm leading-relaxed font-bold bg-white/90 backdrop-blur-md px-5 py-3 rounded-xl shadow-sm">{lockMessage || 'Tính năng này hiện đang được khóa để bảo trì.'}</p>
                 <button onClick={() => navigate('/')} className="px-6 py-3 bg-slate-700 text-white text-sm font-bold rounded-xl hover:bg-slate-800 shadow-md transition-all flex items-center gap-2">
                   <Undo2 size={18} /> Quay về Trang chủ
                 </button>
               </div>
            ) : (
              <>
                {isOwner && isFeatureLocked && (
                  <div className="mb-4 p-3 bg-amber-100 border border-amber-300 text-amber-800 rounded-xl flex items-start gap-3 text-sm font-bold shadow-sm animate-in fade-in slide-in-from-top-4">
                    <Lock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p>Tính năng này đang bị KHÓA đối với Admin và Nhân viên.</p>
                      <p className="text-xs font-medium text-amber-700 mt-0.5 whitespace-pre-wrap">Lời nhắn: "{lockMessage}"</p>
                    </div>
                  </div>
                )}
                <Outlet />
              </>
            )}
          </div>
        </div>
        
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 sm:p-8 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-red-50 rounded-2xl">
                  <LogOut size={24} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight">Đăng xuất</h3>
                  <p className="text-sm text-slate-500 font-medium">Kết thúc phiên làm việc</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-8 font-medium">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowLogoutModal(false)} className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors">
                  Hủy
                </button>
                <button onClick={handleLogout} className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md transition-colors">
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}

        {globalNotif && (
          <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300 ${isNotifClosing ? 'pointer-events-none' : ''}`}>
            <div className={`bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden ${isNotifClosing ? 'animate-notif-out' : 'animate-notif-in'}`}>
              <div className={`px-8 py-6 flex items-start justify-between border-b relative overflow-hidden
                ${globalNotif.type === 'update' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100' :
                  'bg-gradient-to-r from-slate-50 to-slate-50 border-slate-200'}`}>

                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 blur-xl
                  ${globalNotif.type === 'update' ? 'bg-blue-400' : 'bg-slate-400'}`} />

                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0
                    ${globalNotif.type === 'update' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                      'bg-gradient-to-br from-slate-600 to-slate-700 text-white'}`}>
                    {globalNotif.type === 'update' ? (
                      <Settings size={26} className="animate-icon-bounce" strokeWidth={2} />
                    ) : (
                      <Info size={26} strokeWidth={2} />
                    )}
                  </div>
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-[0.2em] block mb-1
                      ${globalNotif.type === 'update' ? 'text-blue-500' : 'text-slate-400'}`}>
                      {globalNotif.type === 'update' ? 'Cập nhật hệ thống' : 'Thông báo'}
                    </span>
                    <h3 className="text-2xl font-bold text-slate-800 leading-tight">
                      {globalNotif.title || 'Thông báo mới'}
                    </h3>
                  </div>
                </div>
                
                <button 
                  onClick={() => setGlobalNotif(null)} 
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-lg transition-colors shrink-0 relative z-10 active:scale-90 duration-150"
                >
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>

              <div className="p-8">
                <div className="text-slate-600 text-[15px] font-medium leading-relaxed whitespace-pre-wrap mb-8">
                  {globalNotif.content}
                </div>
                
                <div className="border-t border-slate-100 pt-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                    <label className="flex items-center gap-3 text-sm text-slate-500 font-medium cursor-pointer group select-none hover:text-slate-700 transition">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={dontShowAgain} 
                          onChange={(e) => setDontShowAgain(e.target.checked)} 
                        />
                        <div className={`w-11 h-6 rounded-full transition-colors duration-300 
                          ${dontShowAgain ? 'bg-slate-700' : 'bg-slate-200'} 
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
                      className="w-full sm:w-auto px-8 py-3.5 text-white font-bold rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl active:scale-95 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900"
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