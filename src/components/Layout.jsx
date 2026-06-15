import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, 
  Printer, 
  Timer, 
  Settings, 
  PackageSearch,
  LogOut,
  Undo2,
  ScanLine,
  Boxes,
  AlertTriangle,
  X,
  Wrench,
  ChevronDown,
  ChevronRight,
  UserCog,
  CalendarDays,
  BarChart3,
  User,
  Pin,
  PinOff,
  ClipboardCheck
} from 'lucide-react';
import TestingNoticeBanner from './TestingNoticeBanner';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // ⚡️ States quản lý sidebar thu gọn / ghim
  const [isSidebarPinned, setIsSidebarPinned] = useState(true); // mặc định ghim
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const sidebarExpanded = isSidebarPinned || isSidebarHovered;

  // ⚡️ STATES QUẢN LÝ ĐÓNG/MỞ CÁC MENU DROPDOWN TRÊN SIDEBAR
  const [isPackingSpeedOpen, setIsPackingSpeedOpen] = useState(false);
  const [isAdjustMenuOpen, setIsAdjustMenuOpen] = useState(false);

  // Tự động giữ trạng thái mở cho dropdown nếu người dùng đang đứng ở trang con của nó
  useEffect(() => {
    if (location.pathname.includes('/toc-do-dong-goi-')) {
      setIsPackingSpeedOpen(true);
    }
    if (location.pathname.includes('/cap-nhat-')) {
      setIsAdjustMenuOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
      }
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

  // Mảng menu dạng phẳng (Bỏ mục Tốc độ đóng gói ra làm dropdown riêng bên dưới)
  const reportMenus = [
    { path: '/', icon: TrendingUp, label: 'Đơn đi hàng ngày' },
    { path: '/bao-cao-don', icon: Printer, label: 'Đơn có thể in' },
    { path: '/bao-cao-hoan', icon: Undo2, label: 'Báo cáo đơn hoàn' },
    { path: '/bao-cao-kiem-ke', icon: ClipboardCheck, label: 'Báo cáo kiểm kê' },
    { path: '/doi-soat-kho', icon: ScanLine, label: 'Đối soát đơn cuối ngày' },
    { path: '/bao-cao-ton-kho', icon: Boxes, label: 'Báo cáo tồn kho' },
    { path: '/don-khong-khai-gia', icon: AlertTriangle, label: 'Đơn không khai giá' },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 font-sans antialiased text-gray-800 tracking-normal selection:bg-blue-500/20 selection:text-blue-700">
      
      {/* SIDEBAR */}
      <div
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`flex-shrink-0 bg-white/70 backdrop-blur-2xl border-r border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col z-10 transition-all duration-300 ease-in-out relative ${
          sidebarExpanded ? 'w-64' : 'w-16'
        }`}
      >
        
        {/* Logo + Pin button */}
        <div className="h-16 flex items-center justify-center relative bg-white/50 backdrop-blur-md border-b border-white/20 rounded-br-2xl">
          {sidebarExpanded ? (
            <div className="flex items-center w-full px-4">
              <div className="bg-blue-600 p-1.5 rounded-xl mr-3 shadow-lg shadow-blue-500/20">
                <PackageSearch className="text-white" size={22} />
              </div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">AMELIE<span className="text-blue-600 font-semibold">WMS</span></h1>
            </div>
          ) : (
            <div className="p-1.5 rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20">
              <PackageSearch className="text-white" size={20} />
            </div>
          )}
          {/* Nút ghim / bỏ ghim */}
          <button
            onClick={() => setIsSidebarPinned(!isSidebarPinned)}
            className={`absolute p-1 rounded-lg hover:bg-white/60 transition-colors ${
              sidebarExpanded ? 'right-2 top-4' : 'right-1 top-1'
            }`}
            title={isSidebarPinned ? 'Bỏ ghim sidebar' : 'Ghim sidebar'}
          >
            {isSidebarPinned ? (
              <PinOff size={14} className="text-gray-500" />
            ) : (
              <Pin size={14} className="text-gray-500" />
            )}
          </button>
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto py-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          {sidebarExpanded && (
            <div className="px-5 mb-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Báo cáo & Vận hành</div>
          )}
          <nav className="space-y-1.5 px-3 mb-8">
            
            {/* Render các menu đơn lẻ */}
            {reportMenus.map((item, idx) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <div key={item.path} className="space-y-1.5">
                  <Link 
                    to={item.path} 
                    className={`flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group ${
                      !sidebarExpanded ? 'justify-center px-0' : 'px-4'
                    } ${
                      isActive ? 'bg-blue-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-blue-500/20' : 'hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600'
                    }`}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`} />
                    {sidebarExpanded && <span className="text-sm">{item.label}</span>}
                    {isActive && sidebarExpanded && <span className="ml-auto w-1.5 h-5 bg-white/40 rounded-full" />}
                  </Link>

                  {/* VỊ TRÍ CHÈN DROPDOWN TỐC ĐỘ ĐÓNG GÓI (sau mục "Đơn có thể in" - idx=1) */}
                  {idx === 1 && (
                    <div className="pt-0.5">
                      <button 
                        onClick={() => setIsPackingSpeedOpen(!isPackingSpeedOpen)}
                        className={`w-full flex items-center gap-3 py-3 rounded-2xl transition-all duration-200 group hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600 cursor-pointer ${
                          !sidebarExpanded ? 'justify-center px-0' : 'px-4 justify-between'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Timer size={18} strokeWidth={2} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                          {sidebarExpanded && <span className="text-sm">Tốc độ đóng gói</span>}
                        </div>
                        {sidebarExpanded && (isPackingSpeedOpen ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>)}
                      </button>

                      {/* Menu con của Tốc độ đóng gói */}
                      {sidebarExpanded && isPackingSpeedOpen && (
                        <div className="mt-1 mb-2 ml-4 pl-3 border-l-2 border-slate-200/60 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
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
                  )}
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
                  <span className="text-sm">Cài đặt Liên kết</span>
                </Link>

                {/* Dropdown Cập nhật & Hiệu chỉnh */}
                <div className="pt-1">
                  <button 
                    onClick={() => setIsAdjustMenuOpen(!isAdjustMenuOpen)} 
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 group hover:bg-white/60 hover:text-gray-900 font-medium text-gray-600 cursor-pointer"
                  >
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
                    </div>
                  )}
                </div>
              </nav>
            </>
          )}

          {/* Khi sidebar thu gọn, vẫn hiển thị Admin menu icon (không text) */}
          {isAdmin && !sidebarExpanded && (
            <nav className="space-y-2 px-3 mt-2">
              <Link to="/admin" className="flex justify-center py-3 rounded-2xl hover:bg-white/60 group transition-colors">
                <Settings size={18} strokeWidth={2} className="text-gray-400 group-hover:text-blue-500" />
              </Link>
              {/* Wrench icon */}
              <button
                onClick={() => setIsAdjustMenuOpen(!isAdjustMenuOpen)} // vẫn cho phép mở submenu khi expand hover
                className="flex justify-center py-3 rounded-2xl w-full hover:bg-white/60 group transition-colors"
              >
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
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/20 via-white to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-blue-50/40 to-transparent pointer-events-none" />
        <div className="relative z-10 p-8 h-full">
          <TestingNoticeBanner />
          <Outlet />
        </div>
      </div>

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