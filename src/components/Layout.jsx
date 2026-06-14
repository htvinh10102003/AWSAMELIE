import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase'; // Nhớ check đúng đường dẫn file supabase của ông nhé
import { 
  TrendingUp, 
  Printer, 
  Timer, 
  Settings, 
  PackageSearch,
  LogOut
} from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // === STATE LƯU THÔNG TIN USER ===
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 1. Lấy thông tin user realtime ngay khi vừa vào trang
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();

    // 2. Lắng nghe nếu có biến động trạng thái (Đăng xuất/Hết hạn session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login'); // Nếu mất session thì đá văng về trang đăng nhập
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // === HÀM XỬ LÝ ĐĂNG XUẤT ===
  const handleLogout = async () => {
    if (confirm("Ông có chắc chắn muốn đăng xuất không?")) {
      await supabase.auth.signOut();
      navigate('/login');
    }
  };

  // Thuật toán bóc tách tên hiển thị: Ưu tiên full_name ở metadata -> Nếu không có thì cắt lấy chữ trước @ của Email
  const userEmail = user?.email || '';
  const displayName = user?.user_metadata?.full_name || userEmail.split('@')[0] || 'Đang tải...';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const reportMenus = [
    { path: '/', icon: TrendingUp, label: 'Đơn đi hàng ngày' },
    { path: '/bao-cao-don', icon: Printer, label: 'Đơn có thể in' },
    { path: '/toc-do-dong-goi', icon: Timer, label: 'Tốc độ đóng gói' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans antialiased text-slate-800 tracking-normal selection:bg-blue-500 selection:text-white">
      
      {/* SIDEBAR - TONE DARK PRO */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-10">
        
        {/* Logo AMELIE */}
        <div className="h-16 flex items-center px-6 bg-slate-950/50 border-b border-slate-800/80">
          <div className="bg-blue-600 p-1.5 rounded-lg mr-3 shadow-lg shadow-blue-900/50">
            <PackageSearch className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-black text-white tracking-wider">AMELIE<span className="text-blue-500 font-normal">WMS</span></h1>
        </div>

        {/* Menu Navigation */}
        <div className="flex-1 overflow-y-auto py-6">
          <div className="px-5 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Báo cáo & Vận hành
          </div>
          <nav className="space-y-1.5 px-3 mb-8">
            {reportMenus.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 group ${
                    isActive 
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-900/40' 
                      : 'hover:bg-slate-800 hover:text-white font-medium'
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="px-5 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Hệ thống
          </div>
          <nav className="space-y-1.5 px-3">
            <Link 
              to="/admin" 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 group ${
                location.pathname === '/admin' 
                  ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-900/40' 
                  : 'hover:bg-slate-800 hover:text-white font-medium'
              }`}
            >
              <Settings size={18} strokeWidth={location.pathname === '/admin' ? 2.5 : 2} className={location.pathname === '/admin' ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'} />
              <span className="text-sm">Cài đặt Liên kết</span>
            </Link>
          </nav>
        </div>
        
        {/* ⚡️ USER PROFILE BLOCK - ĐÃ ĐỔI SANG REALTIME DATA TỪ SUPABASE */}
        <div className="p-4 bg-slate-950/40 border-t border-slate-800/60 flex justify-between items-center">
          <div className="flex items-center gap-3 max-w-[80%]">
            <div className="w-9 h-9 min-w-[36px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-md ring-2 ring-slate-800 uppercase">
              {avatarLetter}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold text-white leading-tight truncate capitalize">{displayName}</span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate" title={userEmail}>
                {userEmail || 'Admin hệ thống'}
              </span>
            </div>
          </div>
          {/* NÚT ĐĂNG XUẤT HOẠT ĐỘNG THỰC TẾ */}
          <button 
            onClick={handleLogout}
            title="Đăng xuất"
            className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>

      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto bg-slate-50 relative">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-50/30 to-transparent pointer-events-none" />
        <div className="relative z-10 p-8 h-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}