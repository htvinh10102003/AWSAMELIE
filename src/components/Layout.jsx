import { useEffect, useState, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, Printer, Timer, Settings, PackageSearch, LogOut, Undo2, ScanLine, 
  Boxes, AlertTriangle, X, Wrench, ChevronDown, ChevronRight, UserCog, CalendarDays, 
  BarChart3, User, Pin, PinOff, ClipboardCheck, PackageMinus, CheckCircle2, 
  LayoutDashboard, Target, Box, ListChecks, MapPin, BarChart2, Menu,
  Filter, FileEdit, LayoutGrid, Webhook, History, ShieldAlert, Settings2
} from 'lucide-react';

// ==========================================
// 🎄 COMPONENT: TUYẾT RƠI (Siêu nhẹ)
// ==========================================
const Snowfall = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(40)].map((_, i) => (
        <div 
          key={i} 
          className="absolute text-white/80 select-none animate-snowfall"
          style={{
            left: `${Math.random() * 100}vw`,
            top: `-20px`,
            animationDuration: `${Math.random() * 5 + 5}s`, 
            animationDelay: `${Math.random() * 5}s`,
            fontSize: `${Math.random() * 10 + 8}px`,
            opacity: Math.random() * 0.8 + 0.2
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
};

// ==========================================
// 🛷 COMPONENT: ÔNG GIÀ NOEL
// ==========================================
const FlyingSanta = ({ customText }) => {
  const [fly, setFly] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');
  
  const defaultMsgs = [
    "Ho Ho Ho! Chốt đơn mỏi tay nhé các sếp! 🎁", 
    "Giáng sinh an lành! Gói hàng cẩn thận nha! 🎄"
  ];

  useEffect(() => {
    const messages = customText ? customText.split('\n').filter(m => m.trim()) : defaultMsgs;
    const finalMsgs = messages.length > 0 ? messages : defaultMsgs;

    const interval = setInterval(() => {
      if(Math.random() > 0.4 && !fly) {
        setBannerMsg(finalMsgs[Math.floor(Math.random() * finalMsgs.length)]);
        setFly(true);
        setTimeout(() => setFly(false), 12000); 
      }
    }, 45000); 
    return () => clearInterval(interval);
  }, [fly, customText]);

  if(!fly) return null;

  return (
    <div className="fixed z-[100] pointer-events-none top-1/4 animate-fly-across">
      <div className="relative flex flex-col items-center">
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/3 whitespace-nowrap bg-red-600 text-white px-5 py-2 rounded-full font-black text-sm border-[3px] border-white shadow-xl animate-bounce z-10">
          {bannerMsg}
          <div className="absolute -bottom-2 left-8 w-4 h-4 bg-red-600 transform rotate-45 border-r-[3px] border-b-[3px] border-white"></div>
        </div>

        <svg viewBox="0 0 400 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[450px] h-auto drop-shadow-2xl">
          <path d="M 20 110 Q 70 120 120 110" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" className="animate-pulse" opacity="0.6"/>
          <path d="M 115 65 Q 180 90 260 40" stroke="#fbbf24" strokeWidth="2" fill="none" strokeDasharray="4 4" />
          
          <g transform="translate(230, 20)">
            <path d="M 65 5 L 60 -10 M 60 -5 L 50 -10 M 65 -5 L 75 -10" stroke="#78350f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="25" y="45" width="5" height="25" rx="2.5" fill="#78350f" className="animate-run-1" style={{ transformOrigin: '27.5px 45px' }} />
            <rect x="35" y="45" width="5" height="25" rx="2.5" fill="#92400e" className="animate-run-2" style={{ transformOrigin: '37.5px 45px' }} />
            <rect x="55" y="45" width="5" height="25" rx="2.5" fill="#78350f" className="animate-run-1" style={{ transformOrigin: '57.5px 45px' }} />
            <rect x="65" y="45" width="5" height="25" rx="2.5" fill="#92400e" className="animate-run-2" style={{ transformOrigin: '67.5px 45px' }} />
            
            <rect x="20" y="25" width="50" height="25" rx="12" fill="#92400e" />
            <path d="M 22 30 L 10 25" stroke="#92400e" strokeWidth="5" strokeLinecap="round" />
            
            <rect x="55" y="5" width="18" height="30" rx="8" fill="#92400e" />
            <rect x="65" y="0" width="22" height="14" rx="6" fill="#92400e" />
            <circle cx="75" cy="5" r="1.5" fill="#171717" />
            <circle cx="87" cy="7" r="4" fill="#ef4444" className="animate-pulse" /> 
          </g>

          <g transform="translate(10, 40)">
            <path d="M 5 70 L 100 70 Q 120 70 120 50" stroke="#fbbf24" strokeWidth="4" fill="none" strokeLinecap="round" />
            <line x1="25" y1="55" x2="25" y2="70" stroke="#fbbf24" strokeWidth="3" />
            <line x1="80" y1="55" x2="80" y2="70" stroke="#fbbf24" strokeWidth="3" />
            
            <rect x="15" y="10" width="25" height="25" fill="#3b82f6" rx="2" />
            <line x1="27.5" y1="10" x2="27.5" y2="35" stroke="#fbbf24" strokeWidth="2" />
            <line x1="15" y1="22.5" x2="40" y2="22.5" stroke="#fbbf24" strokeWidth="2" />
            
            <rect x="45" y="0" width="30" height="35" fill="#22c55e" rx="2" />
            <line x1="60" y1="0" x2="60" y2="35" stroke="#ef4444" strokeWidth="2" />
            <line x1="45" y1="17.5" x2="75" y2="17.5" stroke="#ef4444" strokeWidth="2" />

            <g transform="translate(75, -15)">
              <rect x="-10" y="20" width="35" height="35" rx="12" fill="#ef4444" /> 
              <path d="M 0 35 L -15 25 L -5 15" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" /> 
              <circle cx="-5" cy="15" r="4" fill="#171717" /> 
              
              <rect x="-10" y="38" width="35" height="6" fill="#171717" />
              <rect x="5" y="36" width="10" height="10" fill="none" stroke="#fbbf24" strokeWidth="2" rx="1" />
              
              <circle cx="15" cy="15" r="9" fill="#fca5a5" />
              <circle cx="20" cy="20" r="12" fill="#f3f4f6" />
              <circle cx="22" cy="12" r="2" fill="#171717" />
              
              <path d="M 5 12 L 15 -5 L 28 12 Z" fill="#ef4444" />
              <circle cx="15" cy="-5" r="5" fill="#f3f4f6" />
              <rect x="5" y="10" width="22" height="6" rx="3" fill="#f3f4f6" />
              
              <path d="M 10 35 L 25 30 L 40 40" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="40" cy="40" r="4" fill="#171717" />
            </g>

            <path d="M 0 55 L 115 55 L 105 30 L 15 30 Z" fill="#dc2626" />
            <path d="M 0 55 L 15 30 Q 10 20 0 20 L -5 55 Z" fill="#b91c1c" />
            <path d="M 115 55 L 105 30 Q 110 20 120 20 L 125 55 Z" fill="#b91c1c" />
            <path d="M 15 45 L 105 45" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" /> 
          </g>
        </svg>
      </div>
    </div>
  );
};

// ==========================================
// 🧧 COMPONENT: TẾT NGUYÊN ĐÁN
// ==========================================
const PetalFall = () => {
  const items = ['🌸', '🌼', '✨']; 
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(35)].map((_, i) => (
        <div 
          key={i} 
          className="absolute select-none animate-petal-fall"
          style={{
            left: `${Math.random() * 100}vw`,
            top: `-20px`,
            animationDuration: `${Math.random() * 6 + 6}s`, 
            animationDelay: `${Math.random() * 5}s`,
            fontSize: `${Math.random() * 12 + 10}px`,
            opacity: Math.random() * 0.7 + 0.3
          }}
        >
          {items[Math.floor(Math.random() * items.length)]}
        </div>
      ))}
    </div>
  );
};

const TetBanner = ({ customText }) => {
  const [show, setShow] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');
  
  const defaultMsgs = [
    "🧧 Chúc Mừng Năm Mới! Vạn sự hanh thông!",
    "🌸 Xuân sang – Đơn tới – Đóng hàng hết công suất!"
  ];

  useEffect(() => {
    const messages = customText ? customText.split('\n').filter(m => m.trim()) : defaultMsgs;
    const finalMsgs = messages.length > 0 ? messages : defaultMsgs;

    const interval = setInterval(() => {
      if(Math.random() > 0.4 && !show) {
        setBannerMsg(finalMsgs[Math.floor(Math.random() * finalMsgs.length)]);
        setShow(true);
        setTimeout(() => setShow(false), 10000); 
      }
    }, 50000); 
    return () => clearInterval(interval);
  }, [show, customText]);

  if(!show) return null;

  return (
    <div className="fixed z-[100] pointer-events-none top-0 left-1/2 transform -translate-x-1/2 animate-drop-down">
      <div className="flex flex-col items-center justify-center bg-gradient-to-b from-red-600 to-red-500 border-4 border-yellow-400 px-8 py-4 shadow-2xl rounded-b-3xl">
        <div className="text-4xl drop-shadow-md mb-2">🐉🧧🏮</div>
        <div className="text-yellow-300 font-black text-lg tracking-wide uppercase drop-shadow-md whitespace-nowrap">
          {bannerMsg}
        </div>
      </div>
      <div className="absolute -left-8 -top-2 text-3xl animate-sway">🏮</div>
      <div className="absolute -right-8 -top-2 text-3xl animate-sway" style={{animationDelay: '0.5s'}}>🏮</div>
    </div>
  );
};

// ==========================================
// 🎄 MŨ GIÁNG SINH DÙNG CHO AVATAR
// ==========================================
const SantaHatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Phần thân mũ */}
    <path d="M12 2C13.5 2 15 3.5 15 5L21 16H3L9 5C9 3.5 10.5 2 12 2Z" fill="#ef4444" />
    {/* Quả bông trắng */}
    <circle cx="12" cy="2" r="2.5" fill="white" />
    {/* Viền trắng dưới */}
    <path d="M3 16C6 12 9 11 12 11C15 11 18 12 21 16" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

// ==========================================
// 🌕 COMPONENT: TRUNG THU (Mid-Autumn)
// ==========================================
const MidAutumnOverlay = ({ theme }) => {
  const [lanterns] = useState([
    { id: 1, left: '4%', top: '12%', delay: '0s' },
    { id: 2, left: '8%', top: '35%', delay: '0.5s' },
    { id: 3, left: '90%', top: '15%', delay: '1s' },
    { id: 4, left: '84%', top: '40%', delay: '1.5s' },
  ]);
  const [rabbitJump, setRabbitJump] = useState(false);

  const handleRabbitClick = () => {
    setRabbitJump(true);
    setTimeout(() => setRabbitJump(false), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Trăng tròn */}
      <div className="absolute top-10 right-10 w-44 h-44 rounded-full bg-yellow-100 shadow-[0_0_120px_40px_rgba(255,255,200,0.7)]" />
      
      {/* Sao nhấp nháy */}
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-twinkle text-white"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            fontSize: `${Math.random() * 4 + 2}px`,
          }}
        >
          ✦
        </div>
      ))}

      {/* Mây trôi */}
      <div className="absolute top-1/4 left-0 w-64 h-20 bg-white/10 rounded-full blur-2xl animate-drift" style={{ animationDelay: '0s' }} />
      <div className="absolute top-1/3 left-1/3 w-80 h-24 bg-white/10 rounded-full blur-2xl animate-drift" style={{ animationDelay: '2s' }} />

      {/* Đèn lồng (nếu bật) */}
      {theme.isLanternEnabled && lanterns.map((l) => (
        <div
          key={l.id}
          className="absolute animate-sway-lantern pointer-events-auto cursor-pointer"
          style={{ left: l.left, top: l.top, animationDelay: l.delay }}
          onClick={(e) => {
            e.currentTarget.classList.add('animate-shake');
            setTimeout(() => e.currentTarget.classList.remove('animate-shake'), 500);
          }}
        >
          <div className="flex flex-col items-center group">
            <div className="w-2 h-4 bg-yellow-500 rounded-full mb-1" />
            <div className="w-8 h-12 bg-red-500 rounded-full border-2 border-yellow-300 shadow-lg shadow-yellow-500/50 transition-transform group-hover:scale-110 group-hover:shadow-yellow-400/80" />
            <div className="w-2 h-2 bg-yellow-300 rounded-full -mt-1" />
          </div>
        </div>
      ))}

      {/* Silhouette mái nhà / cây tre dưới cùng */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/50 to-transparent" />

      {/* Bánh trung thu, trà, mâm cỗ */}
      <div className="absolute bottom-10 left-10 text-4xl pointer-events-none">🥮</div>
      <div className="absolute bottom-20 right-20 text-4xl pointer-events-none">🍵</div>
      <div className="absolute bottom-5 left-1/3 text-4xl pointer-events-none">🏮</div>

      {/* Thỏ ngọc (nếu bật) */}
      {theme.isJadeRabbitEnabled && (
        <div
          className={`absolute bottom-10 left-1/2 transform -translate-x-1/2 cursor-pointer pointer-events-auto ${rabbitJump ? 'animate-rabbit-jump' : 'animate-rabbit-run'}`}
          onClick={handleRabbitClick}
        >
          <span className="text-4xl">🐇</span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 🇻🇳 COMPONENT: QUỐC KHÁNH 2/9
// ==========================================
const NationalDayOverlay = ({ theme }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!theme.isFireworksEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    const fireworks = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const createFirework = (x, y) => {
      for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        fireworks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: `hsl(${Math.random() * 360}, 100%, 60%)`
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fireworks.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.alpha -= 0.01;
        if (p.alpha <= 0) {
          fireworks.splice(index, 1);
          return;
        }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      animationId = requestAnimationFrame(animate);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.5) {
        createFirework(
          Math.random() * canvas.width,
          Math.random() * canvas.height * 0.5
        );
      }
    }, 1500);

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [theme.isFireworksEnabled]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Ngôi sao vàng lớn mờ */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-yellow-500 text-[250px] animate-star-pulse opacity-5">★</div>
      </div>

      {/* Pháo hoa canvas */}
      {theme.isFireworksEnabled && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      )}

      {/* Lá cờ bay nhẹ góc phải */}
      <div className="absolute top-24 right-4 pointer-events-auto animate-flag-wave">
        <span className="text-4xl">🇻🇳</span>
      </div>

      {/* Banner 2/9 */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-gradient-to-b from-red-600 to-red-500 border-4 border-yellow-400 px-8 py-3 shadow-2xl rounded-b-3xl animate-drop-down">
          <div className="text-yellow-300 font-black text-lg tracking-wide uppercase drop-shadow-md whitespace-nowrap">
            🇻🇳 Chào mừng Quốc khánh 2/9
          </div>
          <div className="text-white text-sm text-center">Tự hào Việt Nam • 1945 — 2026</div>
        </div>
      </div>

      {/* Silhouette thành phố dưới cùng */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
      <div className="absolute bottom-4 left-5 text-2xl opacity-40">🏢</div>
      <div className="absolute bottom-4 right-10 text-2xl opacity-40">🏠</div>
      <div className="absolute bottom-2 left-1/2 text-2xl opacity-40">🇻🇳</div>

      {/* Bản đồ Việt Nam outline (mờ) */}
      <svg className="absolute bottom-10 left-1/2 transform -translate-x-1/2 opacity-10 w-64 h-64" viewBox="0 0 100 100">
        <path d="M50 10 L70 20 L80 50 L70 80 L50 90 L30 80 L20 50 Z" fill="none" stroke="red" strokeWidth="2" />
      </svg>
    </div>
  );
};

// ==========================================
// 🏗️ LAYOUT CHÍNH
// ==========================================
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const sidebarExpanded = isSidebarPinned || isSidebarHovered;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isPrintOrdersOpen, setIsPrintOrdersOpen] = useState(false);
  const [isPackingOpen, setIsPackingOpen] = useState(false);
  const [isReturnOrdersOpen, setIsReturnOrdersOpen] = useState(false);
  const [isInventoryCheckOpen, setIsInventoryCheckOpen] = useState(false);
  const [isInventoryReportOpen, setIsInventoryReportOpen] = useState(false);
  const [isKpiMenuOpen, setIsKpiMenuOpen] = useState(false);
  const [isAdjustMenuOpen, setIsAdjustMenuOpen] = useState(false);

  // ==========================================
  // 🎄 & 🧧 & 🌕 & 🇻🇳 THEME STATES
  // ==========================================
  const [xmasTheme, setXmasTheme] = useState({ isXmasEnabled: false, isSantaFlying: false, customMessages: '' });
  const [tetTheme, setTetTheme] = useState({ isTetEnabled: false, isPetalFalling: false, customMessages: '' });
  const [midAutumnTheme, setMidAutumnTheme] = useState({ isMidAutumnEnabled: false, isJadeRabbitEnabled: true, isLanternEnabled: true, customMessages: '' });
  const [nationalDayTheme, setNationalDayTheme] = useState({ isNationalDayEnabled: false, isFireworksEnabled: true, customMessages: '' });

  useEffect(() => {
    if (location.pathname === '/' || location.pathname.includes('/dashboard-') || location.pathname.includes('/tra-cuu-luan-chuyen')) setIsDashboardOpen(true);
    if (location.pathname.includes('/bao-cao-don') || location.pathname.includes('/don-da-in-hom-nay') || location.pathname.includes('/loc-don-theo-day-ke') || location.pathname.includes('/chen-vi-tri-awb') || location.pathname.includes('/in-don-spx')) setIsPrintOrdersOpen(true);
    if (location.pathname.includes('/dong-goi-') || location.pathname.includes('/toc-do-dong-goi-')) setIsPackingOpen(true);
    if (location.pathname.includes('/bao-cao-hoan-') || location.pathname.includes('/kiem-tra-don-hoan') || location.pathname.includes('/xu-ly-don-hoan')) setIsReturnOrdersOpen(true);
    if (location.pathname.includes('/thong-ke-kiem-ke') || location.pathname.includes('/danh-sach-kiem-ke')) setIsInventoryCheckOpen(true);
    if (location.pathname.includes('/bao-cao-ton-kho') || location.pathname.includes('/vi-tri-san-pham')) setIsInventoryReportOpen(true);
    if (location.pathname.includes('/quan-ly-kpi') || location.pathname.includes('/nhap-lieu-kpi')) setIsKpiMenuOpen(true);
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

    const fetchThemeConfig = async () => {
      const { data } = await supabase.from('system_configs').select('key, value').in('key', ['theme_christmas', 'theme_tet', 'theme_mid_autumn', 'theme_national_day']);
      if (data) {
        data.forEach(item => {
          if (item.key === 'theme_christmas') {
            try { setXmasTheme(JSON.parse(item.value)); } catch(e) {}
          }
          if (item.key === 'theme_tet') {
            try { setTetTheme(JSON.parse(item.value)); } catch(e) {}
          }
          if (item.key === 'theme_mid_autumn') {
            try { setMidAutumnTheme(JSON.parse(item.value)); } catch(e) {}
          }
          if (item.key === 'theme_national_day') {
            try { setNationalDayTheme(JSON.parse(item.value)); } catch(e) {}
          }
        });
      }
    };
    fetchThemeConfig();

    const channel = supabase.channel('theme_listener')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_configs' }, 
        (payload) => {
          if (payload.new && payload.new.key === 'theme_christmas') {
            try { setXmasTheme(JSON.parse(payload.new.value)); } catch (e) { }
          }
          if (payload.new && payload.new.key === 'theme_tet') {
            try { setTetTheme(JSON.parse(payload.new.value)); } catch (e) { }
          }
          if (payload.new && payload.new.key === 'theme_mid_autumn') {
            try { setMidAutumnTheme(JSON.parse(payload.new.value)); } catch (e) { }
          }
          if (payload.new && payload.new.key === 'theme_national_day') {
            try { setNationalDayTheme(JSON.parse(payload.new.value)); } catch (e) { }
          }
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

  const userEmail = user?.email || '';
  const displayName = user?.user_metadata?.full_name || userEmail.split('@')[0] || 'Đang tải...';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const isAdmin = user?.user_metadata?.role === 'admin';
  
  // ⚡️ ĐÃ SỬA LỖI: THÊM LẠI KHAI BÁO isOwner ⚡️
  const isOwner = user?.user_metadata?.is_owner === true;
  
  const isTet = tetTheme?.isTetEnabled || false;
  const isMidAutumn = (midAutumnTheme?.isMidAutumnEnabled || false) && !isTet;
  const isNationalDay = (nationalDayTheme?.isNationalDayEnabled || false) && !isTet && !isMidAutumn;
  const isXmas = (xmasTheme?.isXmasEnabled || false) && !isTet && !isMidAutumn && !isNationalDay;

  const reportMenus = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'print_orders', icon: Printer, label: 'Đơn in' },
    { id: 'packing', icon: Timer, label: 'Đóng gói' },
    { id: 'return_orders', icon: Undo2, label: 'Báo cáo đơn hoàn' },
    { id: 'inventory_check', icon: ClipboardCheck, label: 'Báo cáo kiểm kê' },
    { path: '/doi-soat-kho', icon: ScanLine, label: 'Đối soát đơn cuối ngày' },
    { id: 'inventory_report', icon: Boxes, label: 'Báo cáo tồn kho' },
    { path: '/don-khong-khai-gia', icon: AlertTriangle, label: 'Đơn không khai giá' }
  ];

  return (
    <>
      <style>{`
        @keyframes snowfall {
          0% { transform: translateY(-10px) translateX(0) rotate(0deg); }
          50% { transform: translateY(50vh) translateX(20px) rotate(180deg); }
          100% { transform: translateY(100vh) translateX(-20px) rotate(360deg); }
        }
        .animate-snowfall { animation: snowfall linear infinite; }
        
        @keyframes petal-fall {
          0% { transform: translateY(-10px) translateX(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateY(50vh) translateX(30px) rotate(180deg); }
          100% { transform: translateY(100vh) translateX(-30px) rotate(360deg); opacity: 0.2; }
        }
        .animate-petal-fall { animation: petal-fall linear infinite; }

        @keyframes sway {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
        }
        .animate-sway { animation: sway 3s ease-in-out infinite; transform-origin: top center; }
        
        @keyframes drop-down-up {
          0% { transform: translateY(-100%) translateX(-50%); opacity: 0; }
          10% { transform: translateY(20px) translateX(-50%); opacity: 1; }
          15% { transform: translateY(0) translateX(-50%); opacity: 1; }
          85% { transform: translateY(0) translateX(-50%); opacity: 1; }
          90% { transform: translateY(20px) translateX(-50%); opacity: 1; }
          100% { transform: translateY(-100%) translateX(-50%); opacity: 0; }
        }
        .animate-drop-down { animation: drop-down-up 10s ease-in-out forwards; }

        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        .hover-xmas-wiggle:hover { animation: wiggle 0.3s ease-in-out infinite; }
        
        @keyframes run-1 {
          0%, 100% { transform: rotate(15deg); }
          50% { transform: rotate(-15deg); }
        }
        @keyframes run-2 {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
        }
        .animate-run-1 { animation: run-1 0.4s infinite ease-in-out; }
        .animate-run-2 { animation: run-2 0.4s infinite ease-in-out; }

        @keyframes fly-across {
          0% { transform: translateX(100vw) translateY(0) scale(1) rotate(-5deg); opacity: 0; }
          10% { opacity: 1; }
          30% { transform: translateX(60vw) translateY(-30px) scale(1.1) rotate(5deg); }
          70% { transform: translateX(-20vw) translateY(20px) scale(0.9) rotate(-5deg); }
          90% { opacity: 1; }
          100% { transform: translateX(-50vw) translateY(0) scale(1) rotate(0); opacity: 0; }
        }
        .animate-fly-across { animation: fly-across 12s linear forwards; }
        
        .xmas-neon-border {
          box-shadow: inset -3px 0px 15px rgba(220, 38, 38, 0.2), inset 0px 3px 15px rgba(22, 163, 74, 0.2);
          border-right: 1px solid rgba(220, 38, 38, 0.3);
        }
        
        .tet-neon-border {
          box-shadow: inset -3px 0px 15px rgba(220, 38, 38, 0.3), inset 0px 3px 15px rgba(234, 179, 8, 0.3);
          border-right: 1px solid rgba(234, 179, 8, 0.5);
        }
        
        .hover-tet-gold:hover {
          box-shadow: inset 0 0 15px rgba(234, 179, 8, 0.15);
          border-color: rgba(234, 179, 8, 0.4);
          background-color: rgba(254, 226, 226, 0.3);
        }

        /* Trung thu */
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .animate-twinkle { animation: twinkle 2s ease-in-out infinite; }

        @keyframes drift {
          0% { transform: translateX(0); }
          50% { transform: translateX(30px); }
          100% { transform: translateX(0); }
        }
        .animate-drift { animation: drift 10s ease-in-out infinite; }

        @keyframes sway-lantern {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        .animate-sway-lantern { animation: sway-lantern 3s ease-in-out infinite; transform-origin: top center; }

        @keyframes rabbit-jump {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-30px) scale(1.1); }
          50% { transform: translateY(0) scale(1); }
          70% { transform: translateY(-15px) scale(1.05); }
          100% { transform: translateY(0) scale(1); }
        }
        .animate-rabbit-jump { animation: rabbit-jump 1s ease-in-out; }

        @keyframes rabbit-run {
          0% { transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(120px) rotate(10deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        .animate-rabbit-run { animation: rabbit-run 6s ease-in-out infinite; }

        @keyframes shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          50% { transform: translateX(3px); }
          75% { transform: translateX(-2px); }
          100% { transform: translateX(0); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }

        /* Quốc khánh */
        @keyframes flag-wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(5deg); }
        }
        .animate-flag-wave { animation: flag-wave 2s ease-in-out infinite; }

        @keyframes star-pulse {
          0%, 100% { opacity: 0.05; transform: scale(1); }
          50% { opacity: 0.1; transform: scale(1.1); }
        }
        .animate-star-pulse { animation: star-pulse 4s ease-in-out infinite; }

        @keyframes glow-pulse {
          0%, 100% { text-shadow: 0 0 20px rgba(255,255,0,0.5); }
          50% { text-shadow: 0 0 40px rgba(255,255,0,0.9); }
        }
        .animate-glow-pulse { animation: glow-pulse 3s ease-in-out infinite; }

        .mid-autumn-neon-border {
          box-shadow: inset -3px 0px 15px rgba(255, 255, 255, 0.1), inset 0px 3px 15px rgba(255, 255, 255, 0.05);
          border-right: 1px solid rgba(255, 255, 255, 0.2);
        }
        .national-day-neon-border {
          box-shadow: inset -3px 0px 15px rgba(215, 25, 32, 0.3), inset 0px 3px 15px rgba(255, 215, 0, 0.3);
          border-right: 1px solid rgba(255, 215, 0, 0.5);
        }
      `}</style>

      {isXmas && <Snowfall />}
      {isXmas && xmasTheme.isSantaFlying && <FlyingSanta customText={xmasTheme.customMessages} />}
      
      {isTet && tetTheme.isPetalFalling && <PetalFall />}
      {isTet && <TetBanner customText={tetTheme.customMessages} />}

      {isMidAutumn && <MidAutumnOverlay theme={midAutumnTheme} />}
      {isNationalDay && <NationalDayOverlay theme={nationalDayTheme} />}

      <div className={`flex h-screen font-sans antialiased text-gray-800 tracking-normal selection:bg-blue-500/20 selection:text-blue-700 transition-colors duration-1000 ${
        isTet ? 'bg-gradient-to-br from-red-50 via-orange-50/40 to-yellow-50/40' : 
        isMidAutumn ? 'bg-gradient-to-br from-indigo-950 via-purple-900 to-blue-900' : 
        isNationalDay ? 'bg-gradient-to-br from-slate-100 via-white to-blue-50/30' : 
        isXmas ? 'bg-gradient-to-br from-red-50 via-white to-green-50/40' : 
        'bg-gradient-to-br from-slate-50 via-white to-blue-50/30'
      }`}>
        
        <div
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          onClick={(e) => { if (e.target.closest('a')) setMobileMenuOpen(false); }}
          className={`flex-shrink-0 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col z-10 transition-all duration-300 ease-in-out relative overflow-x-hidden ${
            sidebarExpanded ? 'w-64' : 'w-[72px]'
          } max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transform max-md:transition-all max-md:duration-300 max-md:ease-in-out max-md:w-64 max-md:shadow-2xl ${
            mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
          } ${
            isTet ? 'bg-white/90 tet-neon-border' : 
            isMidAutumn ? 'bg-indigo-950/60 mid-autumn-neon-border' : 
            isNationalDay ? 'bg-white/80 national-day-neon-border' : 
            isXmas ? 'bg-white/80 xmas-neon-border' : 
            'bg-white/70 border-r border-white/30'
          }`}
        >
          
          <div className={`h-16 flex items-center justify-between px-4 relative backdrop-blur-md rounded-br-2xl whitespace-nowrap transition-colors ${
            isTet ? 'bg-red-50/80 border-b border-yellow-300/50' : 
            isMidAutumn ? 'bg-indigo-900/80 border-b border-white/10' : 
            isNationalDay ? 'bg-white/50 border-b border-yellow-300/50' : 
            isXmas ? 'bg-red-50/50 border-b border-red-200/50' : 
            'bg-white/50 border-b border-white/20'
          }`}>
            <div className="flex items-center">
              <div className={`p-1.5 rounded-xl shrink-0 transition-colors ${
                isTet ? 'bg-red-600 shadow-yellow-500/40 shadow-lg' : 
                isMidAutumn ? 'bg-yellow-500 shadow-yellow-300/40 shadow-lg' : 
                isNationalDay ? 'bg-red-600 shadow-yellow-500/40 shadow-lg' : 
                isXmas ? 'bg-red-600 shadow-red-500/30 shadow-lg' : 
                'bg-blue-600 shadow-blue-500/20 shadow-lg'
              }`}>
                <PackageSearch className="text-white" size={22} />
              </div>
              <h1 className={`text-xl font-black tracking-tight ml-3 transition-all duration-300 flex items-center gap-1 ${
                isTet || isXmas || isNationalDay ? 'text-red-700' : 
                isMidAutumn ? 'text-yellow-300' : 
                'text-gray-900'
              } ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                Amelie<span className={`${
                  isTet ? 'text-yellow-600' : 
                  isMidAutumn ? 'text-orange-400' : 
                  isNationalDay ? 'text-yellow-600' : 
                  isXmas ? 'text-green-600' : 
                  'text-blue-600'
                } font-semibold`}>WMS</span> 
                {isTet ? <span className="animate-pulse drop-shadow-sm ml-1 text-sm">🧧</span> : 
                 isXmas ? <span className="animate-pulse ml-1 text-sm">🎄</span> : 
                 isMidAutumn ? <span className="animate-pulse ml-1 text-sm">🌕</span> : 
                 isNationalDay ? <span className="animate-pulse ml-1 text-sm">🇻🇳</span> : ''}
              </h1>
            </div>
            
            {isTet && sidebarExpanded && (
              <div className="absolute right-8 -bottom-4 text-2xl animate-sway pointer-events-none drop-shadow-md z-50">🏮</div>
            )}

            <button
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              className={`p-1 rounded-lg hover:bg-white/60 transition-colors shrink-0 z-10 ${!sidebarExpanded ? 'absolute right-[18px]' : ''}`}
              title={isSidebarPinned ? 'Bỏ ghim sidebar' : 'Ghim sidebar'}
            >
              {isSidebarPinned ? <PinOff size={14} className={isTet || isXmas || isNationalDay ? 'text-red-400' : isMidAutumn ? 'text-yellow-300' : 'text-gray-500'} /> : <Pin size={14} className={isTet || isXmas || isNationalDay ? 'text-red-400' : isMidAutumn ? 'text-yellow-300' : 'text-gray-500'} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            <div className={`px-5 mb-3 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
              isTet || isXmas || isNationalDay ? 'text-red-400/80' : 
              isMidAutumn ? 'text-yellow-200/80' : 
              'text-gray-400'
            } ${sidebarExpanded ? 'opacity-100 h-auto' : 'opacity-0 h-0 overflow-hidden'}`}>
              Báo cáo & Vận hành
            </div>
            
            <nav className="space-y-1.5 px-3 mb-8 relative">
              {reportMenus.map((item) => {
                const Icon = item.icon;

                const wiggleClass = isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : 
                  isXmas ? 'hover-xmas-wiggle hover:bg-red-50' : 
                  isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : 
                  isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : 
                  'hover:bg-white/60 hover:text-gray-900';
                const activeParentClass = isTet ? 'bg-red-50 text-red-600 border-red-200/50 shadow-sm' : 
                  isXmas ? 'bg-red-50 text-red-600' : 
                  isMidAutumn ? 'bg-indigo-900/60 text-yellow-300 border-white/10 shadow-sm' : 
                  isNationalDay ? 'bg-red-50 text-red-600 border-yellow-200/50 shadow-sm' : 
                  'bg-blue-50 text-blue-600';
                const activeChildClass = isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 
                  isXmas ? 'bg-red-50 text-red-700 font-bold' : 
                  isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : 
                  isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 
                  'bg-blue-50 text-blue-700 font-bold';
                const iconActiveColor = isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600';
                const iconHoverColor = isTet ? 'text-yellow-500' : 
                  isXmas ? 'text-green-500' : 
                  isMidAutumn ? 'text-yellow-300' : 
                  isNationalDay ? 'text-yellow-500' : 
                  'text-blue-500';

                if (item.id === 'dashboard') {
                  const isChildActive = location.pathname === '/' || location.pathname === '/dashboard-don-hoan' || location.pathname === '/dashboard-kpi' || location.pathname === '/tra-cuu-luan-chuyen';
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <button onClick={() => setIsDashboardOpen(!isDashboardOpen)} className={`w-full flex items-center px-4 py-3 rounded-2xl group cursor-pointer overflow-hidden whitespace-nowrap ${isChildActive && !isDashboardOpen ? activeParentClass : `${wiggleClass} font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                        <div className="flex items-center shrink-0">
                          <Icon size={20} strokeWidth={2} className={`transition-colors ${isChildActive ? iconActiveColor : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + iconHoverColor}`}`} />
                        </div>
                        <div className={`flex items-center justify-between w-full ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                          <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>
                          {isDashboardOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0"/> : <ChevronRight size={16} className="text-gray-400 shrink-0"/>}
                        </div>
                      </button>
                      {sidebarExpanded && isDashboardOpen && (
                        <div className={`mt-1 mb-2 ml-6 pl-3 border-l-2 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200 whitespace-nowrap ${isTet || isXmas || isNationalDay ? 'border-red-200/50' : isMidAutumn ? 'border-white/20' : 'border-slate-200/60'}`}>
                          <Link to="/" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <TrendingUp size={16} className={location.pathname === '/' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Đơn đi hàng ngày</span>
                          </Link>
                          <Link to="/dashboard-don-hoan" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/dashboard-don-hoan' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <BarChart2 size={16} className={location.pathname === '/dashboard-don-hoan' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">SL Đơn hoàn theo ngày</span>
                          </Link>
                          <Link to="/dashboard-kpi" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/dashboard-kpi' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <Target size={16} className={location.pathname === '/dashboard-kpi' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Tổng quan KPI tháng</span>
                          </Link>
                          <Link to="/tra-cuu-luan-chuyen" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/tra-cuu-luan-chuyen' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <History size={16} className={location.pathname === '/tra-cuu-luan-chuyen' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Tra cứu luân chuyển</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.id === 'print_orders') {
                  const isChildActive = location.pathname === '/bao-cao-don' || location.pathname === '/don-da-in-hom-nay' || location.pathname === '/loc-don-theo-day-ke' || location.pathname === '/chen-vi-tri-awb' || location.pathname === '/in-don-spx';
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <button onClick={() => setIsPrintOrdersOpen(!isPrintOrdersOpen)} className={`w-full flex items-center px-4 py-3 rounded-2xl group cursor-pointer overflow-hidden whitespace-nowrap ${isChildActive && !isPrintOrdersOpen ? activeParentClass : `${wiggleClass} font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                        <div className="flex items-center shrink-0">
                          <Icon size={20} strokeWidth={2} className={`transition-colors ${isChildActive ? iconActiveColor : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + iconHoverColor}`}`} />
                        </div>
                        <div className={`flex items-center justify-between w-full ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                          <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>
                          {isPrintOrdersOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0"/> : <ChevronRight size={16} className="text-gray-400 shrink-0"/>}
                        </div>
                      </button>
                      {sidebarExpanded && isPrintOrdersOpen && (
                        <div className={`mt-1 mb-2 ml-6 pl-3 border-l-2 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200 whitespace-nowrap ${isTet || isXmas || isNationalDay ? 'border-red-200/50' : isMidAutumn ? 'border-white/20' : 'border-slate-200/60'}`}>
                          <Link to="/bao-cao-don" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/bao-cao-don' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <Printer size={16} className={location.pathname === '/bao-cao-don' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Đơn có thể in</span>
                          </Link>
                          <Link to="/don-da-in-hom-nay" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/don-da-in-hom-nay' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <CheckCircle2 size={16} className={location.pathname === '/don-da-in-hom-nay' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Đơn đã in hôm nay</span>
                          </Link>
                          <Link to="/loc-don-theo-day-ke" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/loc-don-theo-day-ke' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <Filter size={16} className={location.pathname === '/loc-don-theo-day-ke' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Lọc đơn chia theo dãy kệ</span>
                          </Link>
                          <Link to="/chen-vi-tri-awb" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/chen-vi-tri-awb' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <FileEdit size={16} className={location.pathname === '/chen-vi-tri-awb' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Chèn vị trí SP vào AWB</span>
                          </Link>
                          <Link to="/in-don-spx" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/in-don-spx' ? (isTet || isNationalDay ? 'bg-orange-50 text-orange-600 font-bold border-yellow-200/50' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10' : 'bg-orange-50 text-orange-600 font-bold') : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <Printer size={16} className={location.pathname === '/in-don-spx' ? (isMidAutumn ? 'text-yellow-300' : 'text-orange-500') : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">In Đơn SPX Tự Động</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }
                
                if (item.id === 'packing') {
                  const isChildActive = location.pathname.includes('/dong-goi-') || location.pathname.includes('/toc-do-dong-goi-');
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <button onClick={() => setIsPackingOpen(!isPackingOpen)} className={`w-full flex items-center px-4 py-3 rounded-2xl group cursor-pointer overflow-hidden whitespace-nowrap ${isChildActive && !isPackingOpen ? activeParentClass : `${wiggleClass} font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                        <div className="flex items-center shrink-0">
                          <Icon size={20} strokeWidth={2} className={`transition-colors ${isChildActive ? iconActiveColor : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + iconHoverColor}`}`} />
                        </div>
                        <div className={`flex items-center justify-between w-full ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                          <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>
                          {isPackingOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0"/> : <ChevronRight size={16} className="text-gray-400 shrink-0"/>}
                        </div>
                      </button>
                      {sidebarExpanded && isPackingOpen && (
                        <div className={`mt-1 mb-2 ml-6 pl-3 border-l-2 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200 whitespace-nowrap ${isTet || isXmas || isNationalDay ? 'border-red-200/50' : isMidAutumn ? 'border-white/20' : 'border-slate-200/60'}`}>
                          <Link to="/dong-goi-don-hang" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/dong-goi-don-hang' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                              <Box size={16} className={location.pathname === '/dong-goi-don-hang' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                              <div className="flex flex-col">
                                <span className="text-sm">Đóng gói đơn hàng</span>
                                <span className="text-[10px] text-red-500 font-normal leading-tight mt-0.5">Tab dành cho NVĐG</span>
                              </div>
                          </Link>
                          <Link to="/toc-do-dong-goi-chung" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/toc-do-dong-goi-chung' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <BarChart3 size={16} className={location.pathname === '/toc-do-dong-goi-chung' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Đóng gói chung</span>
                          </Link>
                          <Link to="/toc-do-dong-goi-nhan-su" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/toc-do-dong-goi-nhan-su' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <User size={16} className={location.pathname === '/toc-do-dong-goi-nhan-su' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Theo nhân sự</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.id === 'return_orders') {
                  const isChildActive = location.pathname === '/bao-cao-hoan-tong-hop' || location.pathname === '/kiem-tra-don-hoan' || location.pathname === '/xu-ly-don-hoan';
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <button onClick={() => setIsReturnOrdersOpen(!isReturnOrdersOpen)} className={`w-full flex items-center px-4 py-3 rounded-2xl group cursor-pointer overflow-hidden whitespace-nowrap ${isChildActive && !isReturnOrdersOpen ? activeParentClass : `${wiggleClass} font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                        <div className="flex items-center shrink-0">
                          <Icon size={20} strokeWidth={2} className={`transition-colors ${isChildActive ? iconActiveColor : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + iconHoverColor}`}`} />
                        </div>
                        <div className={`flex items-center justify-between w-full ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                          <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>
                          {isReturnOrdersOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0"/> : <ChevronRight size={16} className="text-gray-400 shrink-0"/>}
                        </div>
                      </button>
                      {sidebarExpanded && isReturnOrdersOpen && (
                        <div className={`mt-1 mb-2 ml-6 pl-3 border-l-2 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200 whitespace-nowrap ${isTet || isXmas || isNationalDay ? 'border-red-200/50' : isMidAutumn ? 'border-white/20' : 'border-slate-200/60'}`}>
                          <Link to="/bao-cao-hoan-tong-hop" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/bao-cao-hoan-tong-hop' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <BarChart3 size={16} className={location.pathname === '/bao-cao-hoan-tong-hop' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Tổng hợp đơn hoàn</span>
                          </Link>
                          <Link to="/xu-ly-don-hoan" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/xu-ly-don-hoan' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <PackageMinus size={16} className={location.pathname === '/xu-ly-don-hoan' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Xử lý Đơn hoàn</span>
                          </Link>
                          <Link to="/kiem-tra-don-hoan" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/kiem-tra-don-hoan' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <ScanLine size={16} className={location.pathname === '/kiem-tra-don-hoan' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Kiểm tra & Chốt SL</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.id === 'inventory_check') {
                  const isChildActive = location.pathname === '/thong-ke-kiem-ke' || location.pathname === '/danh-sach-kiem-ke';
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <button onClick={() => setIsInventoryCheckOpen(!isInventoryCheckOpen)} className={`w-full flex items-center px-4 py-3 rounded-2xl group cursor-pointer overflow-hidden whitespace-nowrap ${isChildActive && !isInventoryCheckOpen ? activeParentClass : `${wiggleClass} font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                        <div className="flex items-center shrink-0">
                          <Icon size={20} strokeWidth={2} className={`transition-colors ${isChildActive ? iconActiveColor : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + iconHoverColor}`}`} />
                        </div>
                        <div className={`flex items-center justify-between w-full ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                          <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>
                          {isInventoryCheckOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0"/> : <ChevronRight size={16} className="text-gray-400 shrink-0"/>}
                        </div>
                      </button>
                      {sidebarExpanded && isInventoryCheckOpen && (
                        <div className={`mt-1 mb-2 ml-6 pl-3 border-l-2 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200 whitespace-nowrap ${isTet || isXmas || isNationalDay ? 'border-red-200/50' : isMidAutumn ? 'border-white/20' : 'border-slate-200/60'}`}>
                          <Link to="/thong-ke-kiem-ke" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/thong-ke-kiem-ke' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <BarChart3 size={16} className={location.pathname === '/thong-ke-kiem-ke' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Báo cáo chung</span>
                          </Link>
                          <Link to="/danh-sach-kiem-ke" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/danh-sach-kiem-ke' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <ListChecks size={16} className={location.pathname === '/danh-sach-kiem-ke' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Danh sách cần kiểm kê</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.id === 'inventory_report') {
                  const isChildActive = location.pathname === '/bao-cao-ton-kho' || location.pathname === '/vi-tri-san-pham';
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <button onClick={() => setIsInventoryReportOpen(!isInventoryReportOpen)} className={`w-full flex items-center px-4 py-3 rounded-2xl group cursor-pointer overflow-hidden whitespace-nowrap ${isChildActive && !isInventoryReportOpen ? activeParentClass : `${wiggleClass} font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                        <div className="flex items-center shrink-0">
                          <Icon size={20} strokeWidth={2} className={`transition-colors ${isChildActive ? iconActiveColor : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + iconHoverColor}`}`} />
                        </div>
                        <div className={`flex items-center justify-between w-full ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                          <span className={`text-sm ${isChildActive ? 'font-bold' : ''}`}>{item.label}</span>
                          {isInventoryReportOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0"/> : <ChevronRight size={16} className="text-gray-400 shrink-0"/>}
                        </div>
                      </button>
                      {sidebarExpanded && isInventoryReportOpen && (
                        <div className={`mt-1 mb-2 ml-6 pl-3 border-l-2 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200 whitespace-nowrap ${isTet || isXmas || isNationalDay ? 'border-red-200/50' : isMidAutumn ? 'border-white/20' : 'border-slate-200/60'}`}>
                          <Link to="/bao-cao-ton-kho" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/bao-cao-ton-kho' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <Boxes size={16} className={location.pathname === '/bao-cao-ton-kho' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Tồn kho thực tế</span>
                          </Link>
                          <Link to="/vi-tri-san-pham" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${wiggleClass} ${location.pathname === '/vi-tri-san-pham' ? activeChildClass : `${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <MapPin size={16} className={location.pathname === '/vi-tri-san-pham' ? iconActiveColor : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Vị trí sản phẩm</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                const isActive = location.pathname === item.path;
                return (
                  <div key={item.path} className="space-y-1.5">
                    <Link to={item.path} className={`flex items-center px-4 py-3 rounded-2xl group overflow-hidden whitespace-nowrap ${wiggleClass} ${isActive ? (isTet ? 'bg-red-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-yellow-500/20' : isXmas ? 'bg-red-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-red-500/20' : isMidAutumn ? 'bg-yellow-500/90 backdrop-blur-md text-indigo-950 font-semibold shadow-lg shadow-yellow-500/30' : isNationalDay ? 'bg-red-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-yellow-500/20' : 'bg-blue-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-blue-500/20') : `${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                      <div className="flex items-center shrink-0">
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors duration-200 ${isActive ? (isMidAutumn ? 'text-indigo-950' : 'text-white') : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + iconHoverColor}`}`} />
                      </div>
                      <span className={`text-sm ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>{item.label}</span>
                    </Link>
                  </div>
                )
              })}
            </nav>

            {isAdmin && (
              <>
                <div className={`px-5 mb-3 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                  isTet || isXmas || isNationalDay ? 'text-red-400/80' : 
                  isMidAutumn ? 'text-yellow-200/80' : 
                  'text-gray-400'
                } ${sidebarExpanded ? 'opacity-100 h-auto' : 'opacity-0 h-0 overflow-hidden'}`}>
                  Hệ thống
                </div>
                <nav className="space-y-1.5 px-3">
                  <Link to="/admin" className={`flex items-center px-4 py-3 rounded-2xl group overflow-hidden whitespace-nowrap ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/admin' ? (isTet ? 'bg-red-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-yellow-500/20' : isXmas ? 'bg-red-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-red-500/20' : isMidAutumn ? 'bg-yellow-500/90 backdrop-blur-md text-indigo-950 font-semibold shadow-lg shadow-yellow-500/30' : isNationalDay ? 'bg-red-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-yellow-500/20' : 'bg-blue-600/90 backdrop-blur-md text-white font-semibold shadow-lg shadow-blue-500/20') : `hover:bg-white/60 hover:text-gray-900 font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                    <div className="flex items-center shrink-0">
                      <Settings size={20} strokeWidth={location.pathname === '/admin' ? 2.5 : 2} className={`transition-colors duration-200 ${location.pathname === '/admin' ? (isMidAutumn ? 'text-indigo-950' : 'text-white') : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + (isTet ? 'text-yellow-500' : isXmas ? 'text-green-500' : isNationalDay ? 'text-yellow-500' : 'text-blue-500')}`}`} />
                    </div>
                    <span className={`text-sm ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>Quản trị Hệ thống</span>
                  </Link>

                  <div className="pt-1">
                    <button onClick={() => setIsKpiMenuOpen(!isKpiMenuOpen)} className={`w-full flex items-center px-4 py-3 rounded-2xl group cursor-pointer overflow-hidden whitespace-nowrap ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle hover:bg-red-50' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${(location.pathname.includes('/quan-ly-kpi') || location.pathname.includes('/nhap-lieu-kpi')) && !isKpiMenuOpen ? (isTet || isXmas || isNationalDay ? 'bg-red-50 text-red-600 border-red-200/50 shadow-sm' : isMidAutumn ? 'bg-indigo-900/60 text-yellow-300 border-white/10 shadow-sm' : 'bg-blue-50 text-blue-600') : `hover:bg-white/60 hover:text-gray-900 font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}`}>
                      <div className="flex items-center shrink-0">
                        <Target size={20} strokeWidth={2} className={`transition-colors ${(location.pathname.includes('/quan-ly-kpi') || location.pathname.includes('/nhap-lieu-kpi')) ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : `${isMidAutumn ? 'text-gray-400 group-hover:text-yellow-300' : 'text-gray-400 group-hover:' + (isTet ? 'text-yellow-500' : isXmas ? 'text-green-500' : isNationalDay ? 'text-yellow-500' : 'text-blue-500')}`}`} />
                      </div>
                      <div className={`flex items-center justify-between w-full ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                        <span className="text-sm">Quản lý KPI & Lỗi</span>
                        {isKpiMenuOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0"/> : <ChevronRight size={16} className="text-gray-400 shrink-0"/>}
                      </div>
                    </button>
                    {sidebarExpanded && isKpiMenuOpen && (
                      <div className={`mt-1 mb-2 ml-6 pl-3 border-l-2 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200 whitespace-nowrap ${isTet || isXmas || isNationalDay ? 'border-red-200/50' : isMidAutumn ? 'border-white/20' : 'border-slate-200/60'}`}>
                        <Link to="/quan-ly-kpi" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/quan-ly-kpi' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <Settings2 size={16} className={location.pathname === '/quan-ly-kpi' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Cấu hình KPI</span>
                        </Link>
                        <Link to="/nhap-lieu-kpi" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/nhap-lieu-kpi' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <FileEdit size={16} className={location.pathname === '/nhap-lieu-kpi' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Nhập liệu hàng ngày</span>
                        </Link>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-1">
                    <button onClick={() => setIsAdjustMenuOpen(!isAdjustMenuOpen)} className={`w-full flex items-center px-4 py-3 rounded-2xl group cursor-pointer overflow-hidden whitespace-nowrap ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle hover:bg-red-50' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : 'hover:bg-white/60'} hover:text-gray-900 font-medium ${isMidAutumn ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div className="flex items-center shrink-0">
                        <Wrench size={20} strokeWidth={2} className={`text-gray-400 transition-colors group-hover:${isTet ? 'text-yellow-500' : isXmas ? 'text-green-500' : isMidAutumn ? 'text-yellow-300' : isNationalDay ? 'text-yellow-500' : 'text-blue-500'}`} />
                      </div>
                      <div className={`flex items-center justify-between w-full ml-3 transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                        <span className="text-sm">Cập nhật & Hiệu chỉnh</span>
                        {isAdjustMenuOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0"/> : <ChevronRight size={16} className="text-gray-400 shrink-0"/>}
                      </div>
                    </button>
                    {sidebarExpanded && isAdjustMenuOpen && (
                      <div className={`mt-1 mb-2 ml-6 pl-3 border-l-2 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2 duration-200 whitespace-nowrap ${isTet || isXmas || isNationalDay ? 'border-red-200/50' : isMidAutumn ? 'border-white/20' : 'border-slate-200/60'}`}>
                        {isOwner && (
                          <Link to="/cap-nhat-tinh-nang" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/cap-nhat-tinh-nang' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                            <ShieldAlert size={16} className={location.pathname === '/cap-nhat-tinh-nang' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                            <span className="text-sm">Khóa tính năng</span>
                          </Link>
                        )}
                        <Link to="/cap-nhat-nguoi-dong-goi" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/cap-nhat-nguoi-dong-goi' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <UserCog size={16} className={location.pathname === '/cap-nhat-nguoi-dong-goi' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Người đóng gói</span>
                        </Link>
                        <Link to="/cap-nhat-lich-lam-viec" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/cap-nhat-lich-lam-viec' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <CalendarDays size={16} className={location.pathname === '/cap-nhat-lich-lam-viec' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Lịch làm việc</span>
                        </Link>
                        <Link to="/cap-nhat-san-pham" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/cap-nhat-san-pham' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <PackageSearch size={16} className={location.pathname === '/cap-nhat-san-pham' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Hiệu chỉnh sản phẩm</span>
                        </Link>
                        <Link to="/cap-nhat-so-do-kho" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/cap-nhat-so-do-kho' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <MapPin size={16} className={location.pathname === '/cap-nhat-so-do-kho' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Sơ đồ Kho hàng</span>
                        </Link>
                        <Link to="/cap-nhat-day-ke" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/cap-nhat-day-ke' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <LayoutGrid size={16} className={location.pathname === '/cap-nhat-day-ke' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Quy ước dãy kệ</span>
                        </Link>
                        <Link to="/cap-nhat-webhook" className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTet ? 'hover-tet-gold transition-all duration-300 border border-transparent' : isXmas ? 'hover-xmas-wiggle' : isMidAutumn ? 'hover:bg-white/10 hover:text-white transition-all duration-300' : isNationalDay ? 'hover:bg-yellow-50 hover:text-red-700 transition-all duration-300' : ''} ${location.pathname === '/cap-nhat-webhook' ? (isTet ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : isXmas ? 'bg-red-50 text-red-700 font-bold' : isMidAutumn ? 'bg-indigo-900/70 text-yellow-300 font-bold border-white/10 shadow-sm' : isNationalDay ? 'bg-red-50 text-red-700 font-bold border-yellow-200/50 shadow-sm' : 'bg-blue-50 text-blue-700 font-bold') : `hover:bg-white/60 hover:text-gray-900 ${isMidAutumn ? 'text-gray-300' : 'text-gray-500'} font-medium text-sm`}`}>
                          <Webhook size={16} className={location.pathname === '/cap-nhat-webhook' ? (isTet || isXmas || isNationalDay ? 'text-red-600' : isMidAutumn ? 'text-yellow-300' : 'text-blue-600') : 'text-gray-400 shrink-0'} />
                          <span className="text-sm">Chạy lại Webhook</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </nav>
              </>
            )}
          </div>
          
          <div className={`p-4 backdrop-blur-lg border-t rounded-tr-2xl overflow-hidden whitespace-nowrap transition-colors ${
            isTet ? 'bg-red-50/80 border-yellow-300/50' : 
            isMidAutumn ? 'bg-indigo-900/80 border-white/10' : 
            isNationalDay ? 'bg-white/40 border-yellow-300/50' : 
            isXmas ? 'bg-red-50/50 border-red-200/50' : 
            'bg-white/40 border-white/20'
          }`}>
            <div className={`flex items-center justify-between transition-all duration-300 ${!sidebarExpanded ? 'flex-col gap-2' : ''}`}>
              <div className={`flex items-center gap-3 ${sidebarExpanded ? 'max-w-[75%]' : ''}`}>
                
                <div className="relative">
                  <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md ring-2 ring-white/50 uppercase transition-colors ${
                    isTet ? 'bg-gradient-to-tr from-yellow-500 to-red-600' : 
                    isMidAutumn ? 'bg-gradient-to-tr from-yellow-500 to-indigo-700' : 
                    isNationalDay ? 'bg-gradient-to-tr from-red-600 to-yellow-600' : 
                    isXmas ? 'bg-gradient-to-tr from-red-600 to-green-500' : 
                    'bg-gradient-to-tr from-blue-600 to-indigo-500'
                  }`}>
                    {avatarLetter}
                  </div>
                  {isTet ? (
                    <div className="absolute -bottom-1 -right-2 text-xl drop-shadow-md z-10 pointer-events-none animate-bounce" style={{animationDuration: '3s'}}>🌸</div>
                  ) : isXmas ? (
                    <div className="absolute -top-4 -right-3 w-6 h-6 transform rotate-12 drop-shadow-md z-10 pointer-events-none animate-bounce" style={{animationDuration: '2s'}}>
                      <SantaHatIcon />
                    </div>
                  ) : isMidAutumn ? (
                    <div className="absolute -top-4 -right-3 text-lg drop-shadow-md z-10 pointer-events-none">🐇</div>
                  ) : isNationalDay ? (
                    <div className="absolute -top-2 -right-2 text-lg drop-shadow-md z-10 pointer-events-none">🇻🇳</div>
                  ) : null}
                </div>

                <div className={`flex flex-col transition-all duration-300 overflow-hidden ${sidebarExpanded ? 'opacity-100 max-w-[150px]' : 'opacity-0 max-w-0 hidden'}`}>
                  <span className={`text-sm font-bold leading-tight truncate capitalize ${
                    isTet ? 'text-red-900' : 
                    isMidAutumn ? 'text-white' : 
                    isNationalDay ? 'text-gray-900' : 
                    isXmas ? 'text-gray-900' : 
                    'text-gray-900'
                  }`}>{displayName}</span>
                  <span className={`text-[10px] font-medium mt-0.5 truncate ${
                    isTet ? 'text-yellow-700' : 
                    isMidAutumn ? 'text-yellow-300' : 
                    isNationalDay ? 'text-yellow-600' : 
                    isXmas ? 'text-red-500' : 
                    'text-gray-500'
                  }`}>{isAdmin ? '🛡️ Admin' : '📦 Nhân viên'}</span>
                </div>
              </div>
              
              <button onClick={() => setShowLogoutModal(true)} title="Đăng xuất" className={`p-2 transition-colors rounded-xl cursor-pointer shrink-0 ${
                isTet ? 'text-red-500 hover:text-red-700 hover:bg-yellow-100/50' : 
                isMidAutumn ? 'text-gray-300 hover:text-white hover:bg-white/10' : 
                isNationalDay ? 'text-red-400 hover:text-red-600 hover:bg-yellow-50' : 
                isXmas ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 
                'text-gray-400 hover:text-red-500 hover:bg-white/60'
              } ${!sidebarExpanded ? 'p-1' : ''}`}>
                <LogOut size={!sidebarExpanded ? 16 : 18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto relative bg-transparent">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden absolute top-4 left-4 z-30 p-2 bg-white/80 backdrop-blur-md rounded-xl shadow-lg hover:bg-white/90 transition-colors"
          >
            <Menu size={20} className={isTet || isXmas || isNationalDay ? 'text-red-700' : isMidAutumn ? 'text-yellow-300' : 'text-gray-700'} />
          </button>

          <div className={`absolute inset-0 pointer-events-none transition-colors duration-1000 ${
            isTet ? 'bg-gradient-to-b from-yellow-50/20 via-transparent to-red-50/10' : 
            isMidAutumn ? 'bg-gradient-to-b from-indigo-950/30 via-transparent to-black/20' : 
            isNationalDay ? 'bg-gradient-to-b from-yellow-50/20 via-transparent to-blue-50/10' : 
            isXmas ? 'bg-gradient-to-b from-red-50/20 via-transparent to-green-50/10' : 
            'bg-gradient-to-b from-blue-50/20 via-white to-transparent'
          }`} />
          <div className={`absolute top-0 left-0 right-0 h-40 pointer-events-none transition-colors duration-1000 ${
            isTet ? 'bg-gradient-to-b from-red-100/40 to-transparent' : 
            isMidAutumn ? 'bg-gradient-to-b from-indigo-900/40 to-transparent' : 
            isNationalDay ? 'bg-gradient-to-b from-yellow-50/40 to-transparent' : 
            isXmas ? 'bg-gradient-to-b from-red-100/30 to-transparent' : 
            'bg-gradient-to-b from-blue-50/40 to-transparent'
          }`} />
          <div className="relative z-10 p-8 h-full">
            <Outlet />
          </div>
        </div>

        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

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
    </>
  );
}