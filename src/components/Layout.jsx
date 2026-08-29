import { useEffect, useState, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { VietnamMapSVG } from './VietnamMapSVG';
import { 
  TrendingUp, Printer, Timer, Settings, PackageSearch, LogOut, Undo2, ScanLine, 
  Boxes, AlertTriangle, X, Wrench, ChevronDown, ChevronRight, UserCog, CalendarDays, 
  BarChart3, User, Pin, PinOff, ClipboardCheck, PackageMinus, CheckCircle2, 
  LayoutDashboard, Target, Box, ListChecks, MapPin, BarChart2, Menu,
  Filter, FileEdit, LayoutGrid, Webhook, History, ShieldAlert, Settings2, Loader2
} from 'lucide-react';

// ==========================================
// ❄️ & 🎅 & 🌸 & 🌕 & 🇻🇳 THEME COMPONENTS
// ==========================================
const Snowfall = () => (
  <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
    {[...Array(40)].map((_, i) => (
      <div key={i} className="absolute text-white/80 select-none animate-snowfall" style={{ left: `${Math.random() * 100}vw`, top: `-20px`, animationDuration: `${Math.random() * 5 + 5}s`, animationDelay: `${Math.random() * 5}s`, fontSize: `${Math.random() * 10 + 8}px`, opacity: Math.random() * 0.8 + 0.2 }}>❄</div>
    ))}
  </div>
);

const FlyingSanta = ({ customText }) => {
  const [fly, setFly] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');
  const defaultMsgs = ["Ho Ho Ho! Chốt đơn mỏi tay nhé các sếp! 🎁", "Giáng sinh an lành! Gói hàng cẩn thận nha! 🎄"];

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

const PetalFall = () => {
  const items = ['🌸', '🌼', '✨']; 
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(35)].map((_, i) => (
        <div key={i} className="absolute select-none animate-petal-fall" style={{ left: `${Math.random() * 100}vw`, top: `-20px`, animationDuration: `${Math.random() * 6 + 6}s`, animationDelay: `${Math.random() * 5}s`, fontSize: `${Math.random() * 12 + 10}px`, opacity: Math.random() * 0.7 + 0.3 }}>
          {items[Math.floor(Math.random() * items.length)]}
        </div>
      ))}
    </div>
  );
};

const TetBanner = ({ customText }) => {
  const [show, setShow] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');
  const defaultMsgs = ["🧧 Chúc Mừng Năm Mới! Vạn sự hanh thông!", "🌸 Xuân sang – Đơn tới – Đóng hàng hết công suất!"];

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
        <div className="text-yellow-300 font-black text-lg tracking-wide uppercase drop-shadow-md whitespace-nowrap">{bannerMsg}</div>
      </div>
      <div className="absolute -left-8 -top-2 text-3xl animate-sway">🏮</div>
      <div className="absolute -right-8 -top-2 text-3xl animate-sway" style={{animationDelay: '0.5s'}}>🏮</div>
    </div>
  );
};

const MidAutumnBanner = ({ customText }) => {
  const [show, setShow] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');
  const defaultMsgs = ["🌕 Trung Thu Đoàn Viên - Giao Đơn Hết Xảy!", "🏮 Rước Đèn Mỏi Tay - Chốt Đơn Cháy Máy!"];

  useEffect(() => {
    const messages = customText ? customText.split('\n').filter(m => m.trim()) : defaultMsgs;
    const finalMsgs = messages.length > 0 ? messages : defaultMsgs;
    const interval = setInterval(() => {
      if(Math.random() > 0.4 && !show) {
        setBannerMsg(finalMsgs[Math.floor(Math.random() * finalMsgs.length)]);
        setShow(true);
        setTimeout(() => setShow(false), 10000); 
      }
    }, 48000); 
    return () => clearInterval(interval);
  }, [show, customText]);

  if(!show) return null;
  return (
    <div className="fixed z-[100] pointer-events-none top-0 left-1/2 transform -translate-x-1/2 animate-drop-down">
      <div className="flex flex-col items-center justify-center bg-gradient-to-b from-orange-600 to-orange-500 border-4 border-yellow-400 px-8 py-4 shadow-2xl rounded-b-3xl">
        <div className="text-4xl drop-shadow-md mb-2">🏮🐇🥮</div>
        <div className="text-yellow-200 font-black text-lg tracking-wide uppercase drop-shadow-md whitespace-nowrap">{bannerMsg}</div>
      </div>
    </div>
  );
};

const NationalDayBanner = ({ customText }) => {
  const [show, setShow] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');
  const defaultMsgs = ["🇻🇳 Chào mừng Quốc khánh 2/9!", "Tự hào Việt Nam - Đóng hàng thần tốc!"];

  useEffect(() => {
    const messages = customText ? customText.split('\n').filter(m => m.trim()) : defaultMsgs;
    const finalMsgs = messages.length > 0 ? messages : defaultMsgs;
    const interval = setInterval(() => {
      if(Math.random() > 0.4 && !show) {
        setBannerMsg(finalMsgs[Math.floor(Math.random() * finalMsgs.length)]);
        setShow(true);
        setTimeout(() => setShow(false), 8000); 
      }
    }, 52000); 
    return () => clearInterval(interval);
  }, [show, customText]);

  if(!show) return null;
  return (
    <div className="fixed z-[100] pointer-events-none top-6 left-1/2 transform -translate-x-1/2 animate-drop-down">
      <div className="bg-white/95 backdrop-blur-md border border-red-100 shadow-[0_8px_30px_rgb(218,37,29,0.12)] px-6 py-2.5 rounded-full flex items-center gap-3">
        <div className="w-6 h-6 bg-[#da251d] rounded-full flex items-center justify-center shadow-inner shrink-0">
          <svg viewBox="0 0 100 100" className="w-3.5 h-3.5">
            <polygon points="50,10 60,40 90,40 65,60 75,90 50,70 25,90 35,60 10,40 40,40" fill="#ffff00"/>
          </svg>
        </div>
        <div className="text-slate-700 font-bold text-sm tracking-wide">{bannerMsg}</div>
      </div>
    </div>
  );
};

const SantaHatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <path d="M12 2C13.5 2 15 3.5 15 5L21 16H3L9 5C9 3.5 10.5 2 12 2Z" fill="#ef4444" />
    <circle cx="12" cy="2" r="2.5" fill="white" />
    <path d="M3 16C6 12 9 11 12 11C15 11 18 12 21 16" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

const MidAutumnOverlay = ({ theme }) => {
  const [lanterns] = useState([{ id: 1, left: '4%', top: '12%', delay: '0s' }, { id: 2, left: '8%', top: '35%', delay: '0.5s' }, { id: 3, left: '90%', top: '15%', delay: '1s' }, { id: 4, left: '84%', top: '40%', delay: '1.5s' }]);
  const [rabbitJump, setRabbitJump] = useState(false);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      <div className="absolute top-8 right-12 w-48 h-56 animate-sway-lantern origin-top drop-shadow-2xl">
        <svg viewBox="0 0 100 120" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="50" y1="70" x2="50" y2="120" stroke="#d946ef" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="50" cy="50" r="45" stroke="#facc15" strokeWidth="6" strokeDasharray="2 4" />
          <circle cx="50" cy="50" r="45" stroke="#eab308" strokeWidth="3" strokeDasharray="4 6" strokeDashoffset="2" />
          <circle cx="50" cy="50" r="46" stroke="#ca8a04" strokeWidth="1" opacity="0.8" />
          <path d="M 40 36 L 50 5 L 60 36 Z" fill="#16a34a" />
          <path d="M 66 55 L 76 86 L 50 67 Z" fill="#16a34a" />
          <path d="M 50 67 L 24 86 L 34 55 Z" fill="#16a34a" />
          <path d="M 60 36 L 93 36 L 66 55 Z" fill="#dc2626" />
          <path d="M 34 55 L 7 36 L 40 36 Z" fill="#dc2626" />
          <path d="M 60 36 L 66 55 L 50 67 L 34 55 L 40 36 Z" fill="#dc2626" />
          <circle cx="50" cy="50" r="11" fill="none" stroke="white" strokeWidth="1" strokeDasharray="1.5 1.5" />
          <circle cx="50" cy="50" r="9" fill="none" stroke="white" strokeWidth="0.75" />
          <polygon points="50,44 51.5,47.5 55,47.5 52.5,50 53.5,53.5 50,51.5 46.5,53.5 47.5,50 45,47.5 48.5,47.5" fill="white" />
          <path d="M 50 5 L 76 86 L 7 36 L 93 36 L 24 86 Z" stroke="#facc15" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M 50 5 L 60 36 L 93 36 L 66 55 L 76 86 L 50 67 L 24 86 L 34 55 L 7 36 L 40 36 Z" stroke="#facc15" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
      {[...Array(30)].map((_, i) => (
        <div key={i} className="absolute animate-twinkle text-orange-400" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s`, fontSize: `${Math.random() * 4 + 2}px` }}>✦</div>
      ))}
      <div className="absolute top-1/4 left-0 w-64 h-20 bg-white/60 rounded-full blur-2xl animate-drift" style={{ animationDelay: '0s' }} />
      <div className="absolute top-1/3 left-1/3 w-80 h-24 bg-white/60 rounded-full blur-2xl animate-drift" style={{ animationDelay: '2s' }} />
      {theme.isLanternEnabled && lanterns.map((l) => (
        <div key={l.id} className="absolute animate-sway-lantern pointer-events-auto cursor-pointer" style={{ left: l.left, top: l.top, animationDelay: l.delay }} onClick={(e) => { e.currentTarget.classList.add('animate-shake'); setTimeout(() => e.currentTarget.classList.remove('animate-shake'), 500); }}>
          <div className="flex flex-col items-center group">
            <div className="w-2 h-4 bg-yellow-500 rounded-full mb-1" />
            <div className="w-8 h-12 bg-red-500 rounded-full border-2 border-yellow-300 shadow-lg shadow-yellow-500/50 transition-transform group-hover:scale-110 group-hover:shadow-yellow-400/80" />
            <div className="w-2 h-2 bg-yellow-300 rounded-full -mt-1" />
          </div>
        </div>
      ))}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-orange-900/20 to-transparent" />
      <div className="absolute bottom-10 left-10 text-4xl pointer-events-none drop-shadow-md">🥮</div>
      <div className="absolute bottom-20 right-20 text-4xl pointer-events-none drop-shadow-md">🍵</div>
      <div className="absolute bottom-5 left-1/3 text-4xl pointer-events-none drop-shadow-md">🏮</div>
      {theme.isJadeRabbitEnabled && (
        <div className={`absolute bottom-10 left-1/2 transform -translate-x-1/2 cursor-pointer pointer-events-auto ${rabbitJump ? 'animate-rabbit-jump' : 'animate-rabbit-run'}`} onClick={() => { setRabbitJump(true); setTimeout(() => setRabbitJump(false), 1000); }}>
          <span className="text-4xl drop-shadow-md">🐇</span>
        </div>
      )}
    </div>
  );
};

const NationalDayOverlay = ({ theme }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!theme.isFireworksEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    const fireworks = [];

    const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const createFirework = (x, y) => {
      for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        // Pháo hoa chuyên nghiệp chỉ dùng màu đỏ và vàng
        fireworks.push({ 
          x, y, 
          vx: Math.cos(angle) * speed, 
          vy: Math.sin(angle) * speed, 
          alpha: 1, 
          color: Math.random() > 0.4 ? '#da251d' : '#ffff00' 
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fireworks.forEach((p, index) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.alpha -= 0.015;
        if (p.alpha <= 0) { fireworks.splice(index, 1); return; }
        ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
      });
      animationId = requestAnimationFrame(animate);
    };

    // Tần suất pháo hoa nhẹ nhàng hơn
    const interval = setInterval(() => { 
      if (Math.random() > 0.6) createFirework(Math.random() * canvas.width, Math.random() * canvas.height * 0.4); 
    }, 2000);
    animate();

    return () => { cancelAnimationFrame(animationId); clearInterval(interval); window.removeEventListener('resize', resizeCanvas); };
  }, [theme.isFireworksEnabled]);

  // Tạo mảng 24 lá cờ để phủ kín chiều ngang màn hình
  const flags = Array.from({ length: 24 }); 

  return (
    <div className="fixed inset-0 z-[40] pointer-events-none overflow-hidden">
      
      {/* 🇻🇳 DẢI CỜ GIĂNG NGANG (BUNTING) */}
      <div className="absolute top-0 left-0 w-full flex justify-between px-2 overflow-hidden opacity-95">
        {/* Sợi dây cong nhẹ */}
        <div className="absolute top-[-20px] left-[-5%] w-[110%] h-[40px] border-b-[1.5px] border-slate-800/20 rounded-[50%]" />
        
        {flags.map((_, i) => {
          // Tính toán khoảng cách rủ xuống để tạo độ cong 3D tự nhiên ở giữa màn hình
          const sag = Math.sin((i / (flags.length - 1)) * Math.PI) * 12; 
          return (
            <div 
              key={i} 
              className="relative origin-top animate-flag-wave drop-shadow-sm" 
              style={{ 
                animationDelay: `${(i % 4) * 0.25}s`, 
                width: '3.5vw', minWidth: '32px', maxWidth: '42px', 
                marginTop: `${12 + sag}px` 
              }}
            >
              <svg viewBox="0 0 100 120" className="w-full h-auto">
                {/* Cờ chữ nhật đuôi nheo */}
                <polygon points="0,0 100,0 100,80 50,120 0,80" fill="#da251d" />
                {/* Ngôi sao vàng */}
                <polygon points="50,25 56,43 75,43 60,55 65,75 50,62 35,75 40,55 25,43 44,43" fill="#ffff00" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* Hiệu ứng pháo hoa */}
      {theme.isFireworksEnabled && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />}
      
      {/* Lớp màu chuyển sắc gradient dưới đáy trang */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-red-900/5 to-transparent" />
      
      {/* Bản đồ VN mờ ở góc phải */}
      <div className="absolute bottom-8 right-8 opacity-25 drop-shadow-sm scale-90 transition-opacity">
        <VietnamMapSVG />
      </div>
    </div>
  );
};

// ==========================================
// 🏗️ MAIN LAYOUT COMPONENT
// ==========================================
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
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
  const [xmasTheme, setXmasTheme] = useState({ isXmasEnabled: false, isSantaFlying: false, customMessages: '' });
  const [tetTheme, setTetTheme] = useState({ isTetEnabled: false, isPetalFalling: false, customMessages: '' });
  const [midAutumnTheme, setMidAutumnTheme] = useState({ isMidAutumnEnabled: false, isJadeRabbitEnabled: true, isLanternEnabled: true, customMessages: '' });
  const [nationalDayTheme, setNationalDayTheme] = useState({ isNationalDayEnabled: false, isFireworksEnabled: true, customMessages: '' });

  // Tự động mở menu dựa trên URL
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

  // Auth & System Config Sync
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

    const fetchThemeConfig = async () => {
      const { data } = await supabase.from('system_configs').select('key, value').in('key', ['theme_christmas', 'theme_tet', 'theme_mid_autumn', 'theme_national_day']);
      if (data) {
        data.forEach(item => {
          try {
            if (item.key === 'theme_christmas') setXmasTheme(JSON.parse(item.value));
            if (item.key === 'theme_tet') setTetTheme(JSON.parse(item.value));
            if (item.key === 'theme_mid_autumn') setMidAutumnTheme(JSON.parse(item.value));
            if (item.key === 'theme_national_day') setNationalDayTheme(JSON.parse(item.value));
          } catch(e) {}
        });
      }
    };
    fetchThemeConfig();

    const channel = supabase.channel('theme_listener')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_configs' }, 
        (payload) => {
          try {
            if (payload.new && payload.new.key === 'theme_christmas') setXmasTheme(JSON.parse(payload.new.value));
            if (payload.new && payload.new.key === 'theme_tet') setTetTheme(JSON.parse(payload.new.value));
            if (payload.new && payload.new.key === 'theme_mid_autumn') setMidAutumnTheme(JSON.parse(payload.new.value));
            if (payload.new && payload.new.key === 'theme_national_day') setNationalDayTheme(JSON.parse(payload.new.value));
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

  // Tính toán quyền truy cập User
  const userEmail = user?.email || '';
  const displayName = user?.user_metadata?.full_name || userEmail.split('@')[0] || 'Đang tải...';
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

  // Lấy cờ Theme đang active
  const isTet = tetTheme?.isTetEnabled || false;
  const isMidAutumn = (midAutumnTheme?.isMidAutumnEnabled || false) && !isTet;
  const isNationalDay = (nationalDayTheme?.isNationalDayEnabled || false) && !isTet && !isMidAutumn;
  const isXmas = (xmasTheme?.isXmasEnabled || false) && !isTet && !isMidAutumn && !isNationalDay;

  // Trình sinh CSS dựa theo Theme
  const getThemeVars = () => {
    if (isTet) return {
      sidebar: 'bg-white/95 border-r border-red-100 shadow-[4px_0_24px_rgba(220,38,38,0.08)]',
      textPrimary: 'text-red-800', textMuted: 'text-red-500/80',
      activeBg: 'bg-red-50', activeText: 'text-red-700 font-bold', activeBorder: 'border-l-[3px] border-red-500',
      hoverBg: 'hover:bg-red-50/50', iconColor: 'text-red-400 group-hover:text-red-600', iconActive: 'text-red-600',
      logoGradient: 'bg-gradient-to-tr from-red-600 to-yellow-500', bgMain: 'bg-red-50/30',
      headerBorder: 'border-b border-red-100 bg-red-50/30'
    };
    if (isMidAutumn) return {
      sidebar: 'bg-white/95 border-r border-orange-100 shadow-[4px_0_24px_rgba(234,88,12,0.08)]',
      textPrimary: 'text-orange-900', textMuted: 'text-orange-500/80',
      activeBg: 'bg-orange-50', activeText: 'text-orange-700 font-bold', activeBorder: 'border-l-[3px] border-orange-500',
      hoverBg: 'hover:bg-orange-50/50', iconColor: 'text-orange-400 group-hover:text-orange-600', iconActive: 'text-orange-600',
      logoGradient: 'bg-gradient-to-tr from-orange-500 to-amber-500', bgMain: 'bg-orange-50/30',
      headerBorder: 'border-b border-orange-100 bg-orange-50/30'
    };
    if (isNationalDay) return {
      sidebar: 'bg-white/95 border-r border-yellow-200/50 shadow-[4px_0_24px_rgba(220,38,38,0.05)]',
      textPrimary: 'text-slate-800', textMuted: 'text-red-500/80',
      activeBg: 'bg-red-50/60', activeText: 'text-red-700 font-bold', activeBorder: 'border-l-[3px] border-yellow-500',
      hoverBg: 'hover:bg-red-50/40', iconColor: 'text-slate-400 group-hover:text-red-500', iconActive: 'text-red-600',
      logoGradient: 'bg-gradient-to-tr from-red-600 to-yellow-500', bgMain: 'bg-slate-50',
      headerBorder: 'border-b border-yellow-200/30 bg-white/50'
    };
    if (isXmas) return {
      sidebar: 'bg-white/95 border-r border-green-100 shadow-[4px_0_24px_rgba(22,163,74,0.05)]',
      textPrimary: 'text-slate-800', textMuted: 'text-green-600/70',
      activeBg: 'bg-red-50', activeText: 'text-red-700 font-bold', activeBorder: 'border-l-[3px] border-red-500',
      hoverBg: 'hover:bg-green-50/50', iconColor: 'text-slate-400 group-hover:text-green-600', iconActive: 'text-red-600',
      logoGradient: 'bg-gradient-to-tr from-red-600 to-green-600', bgMain: 'bg-green-50/20',
      headerBorder: 'border-b border-green-100 bg-green-50/30'
    };
    // Default Professional SaaS Theme
    return {
      sidebar: 'bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)]',
      textPrimary: 'text-slate-700', textMuted: 'text-slate-400',
      activeBg: 'bg-blue-50/80', activeText: 'text-blue-700 font-bold', activeBorder: 'border-l-[3px] border-blue-600',
      hoverBg: 'hover:bg-slate-50', iconColor: 'text-slate-400 group-hover:text-blue-600', iconActive: 'text-blue-600',
      logoGradient: 'bg-gradient-to-tr from-blue-600 to-indigo-600', bgMain: 'bg-slate-50',
      headerBorder: 'border-b border-slate-100 bg-white'
    };
  };

  const themeVars = getThemeVars();

  // ==========================================
  // CONFIG DỮ LIỆU MENU
  // ==========================================
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

  // Helper toggle submenu
  const toggleSubmenu = (id) => {
    setMenuStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <style>{`
        /* Giữ nguyên toàn bộ CSS Keyframes Animations */
        @keyframes snowfall { 0% { transform: translateY(-10px) translateX(0) rotate(0deg); } 50% { transform: translateY(50vh) translateX(20px) rotate(180deg); } 100% { transform: translateY(100vh) translateX(-20px) rotate(360deg); } } .animate-snowfall { animation: snowfall linear infinite; }
        @keyframes petal-fall { 0% { transform: translateY(-10px) translateX(0) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 50% { transform: translateY(50vh) translateX(30px) rotate(180deg); } 100% { transform: translateY(100vh) translateX(-30px) rotate(360deg); opacity: 0.2; } } .animate-petal-fall { animation: petal-fall linear infinite; }
        @keyframes sway { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } } .animate-sway { animation: sway 3s ease-in-out infinite; transform-origin: top center; }
        @keyframes drop-down-up { 0% { transform: translateY(-100%) translateX(-50%); opacity: 0; } 10% { transform: translateY(20px) translateX(-50%); opacity: 1; } 15% { transform: translateY(0) translateX(-50%); opacity: 1; } 85% { transform: translateY(0) translateX(-50%); opacity: 1; } 90% { transform: translateY(20px) translateX(-50%); opacity: 1; } 100% { transform: translateY(-100%) translateX(-50%); opacity: 0; } } .animate-drop-down { animation: drop-down-up 10s ease-in-out forwards; }
        @keyframes fly-across { 0% { transform: translateX(100vw) translateY(0) scale(1) rotate(-5deg); opacity: 0; } 10% { opacity: 1; } 30% { transform: translateX(60vw) translateY(-30px) scale(1.1) rotate(5deg); } 70% { transform: translateX(-20vw) translateY(20px) scale(0.9) rotate(-5deg); } 90% { opacity: 1; } 100% { transform: translateX(-50vw) translateY(0) scale(1) rotate(0); opacity: 0; } } .animate-fly-across { animation: fly-across 12s linear forwards; }
        @keyframes run-1 { 0%, 100% { transform: rotate(15deg); } 50% { transform: rotate(-15deg); } } @keyframes run-2 { 0%, 100% { transform: rotate(-15deg); } 50% { transform: rotate(15deg); } } .animate-run-1 { animation: run-1 0.4s infinite ease-in-out; } .animate-run-2 { animation: run-2 0.4s infinite ease-in-out; }
        @keyframes twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } } .animate-twinkle { animation: twinkle 2s ease-in-out infinite; }
        @keyframes drift { 0% { transform: translateX(0); } 50% { transform: translateX(30px); } 100% { transform: translateX(0); } } .animate-drift { animation: drift 10s ease-in-out infinite; }
        @keyframes sway-lantern { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } } .animate-sway-lantern { animation: sway-lantern 4s ease-in-out infinite; transform-origin: top center; }
        @keyframes rabbit-jump { 0%, 100% { transform: translateY(0) scale(1); } 30% { transform: translateY(-30px) scale(1.1); } 50% { transform: translateY(0) scale(1); } 70% { transform: translateY(-15px) scale(1.05); } 100% { transform: translateY(0) scale(1); } } .animate-rabbit-jump { animation: rabbit-jump 1s ease-in-out; }
        @keyframes rabbit-run { 0% { transform: translateX(0) rotate(0deg); } 50% { transform: translateX(120px) rotate(10deg); } 100% { transform: translateX(0) rotate(0deg); } } .animate-rabbit-run { animation: rabbit-run 6s ease-in-out infinite; }
        @keyframes shake { 0% { transform: translateX(0); } 25% { transform: translateX(-3px); } 50% { transform: translateX(3px); } 75% { transform: translateX(-2px); } 100% { transform: translateX(0); } } .animate-shake { animation: shake 0.5s ease-in-out; }
        @keyframes flag-wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(5deg); } } .animate-flag-wave { animation: flag-wave 2s ease-in-out infinite; }
        @keyframes star-pulse { 0%, 100% { opacity: 0.05; transform: scale(1); } 50% { opacity: 0.1; transform: scale(1.1); } } .animate-star-pulse { animation: star-pulse 4s ease-in-out infinite; }
      `}</style>

      {/* FESTIVE INJECTIONS */}
      {isXmas && <Snowfall />}
      {isXmas && xmasTheme.isSantaFlying && <FlyingSanta customText={xmasTheme.customMessages} />}
      {isTet && tetTheme.isPetalFalling && <PetalFall />}
      {isTet && <TetBanner customText={tetTheme.customMessages} />}
      {isMidAutumn && <MidAutumnBanner customText={midAutumnTheme.customMessages} />}
      {isMidAutumn && <MidAutumnOverlay theme={midAutumnTheme} />}
      {isNationalDay && <NationalDayBanner customText={nationalDayTheme.customMessages} />}
      {isNationalDay && <NationalDayOverlay theme={nationalDayTheme} />}

      <div className={`flex h-screen font-sans antialiased text-slate-800 tracking-normal transition-colors duration-1000 ${themeVars.bgMain}`}>
        
        {/* ----------------------------- */}
        {/* SIDEBAR NAVIGATION            */}
        {/* ----------------------------- */}
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
              <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-md ${themeVars.logoGradient}`}>
                <PackageSearch className="text-white" size={20} strokeWidth={2.5}/>
              </div>
              <div className={`transition-opacity duration-300 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5 leading-none whitespace-nowrap">
                  Amelie <span className={isTet ? 'text-yellow-600' : isXmas ? 'text-green-600' : isMidAutumn ? 'text-orange-600' : isNationalDay ? 'text-red-600' : 'text-blue-600'}>WMS</span>
                  {isTet && <span className="animate-pulse text-sm">🧧</span>}
                  {isXmas && <span className="animate-pulse text-sm">🎄</span>}
                  {isMidAutumn && <span className="animate-pulse text-sm">🌕</span>}
                  {isNationalDay && <span className="animate-pulse text-sm">🇻🇳</span>}
                </h1>
              </div>
            </div>
            
            {/* PIN BUTTON */}
            <button
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0 max-md:hidden text-slate-400 hover:text-slate-600 ${!sidebarExpanded ? 'absolute right-[16px]' : ''}`}
            >
              {isSidebarPinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
          </div>

          {/* MENU SCROLL AREA */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scrollbar-track-transparent">
            {MENU_CONFIG.map((group, gIdx) => (
              <div key={gIdx} className="mb-6">
                <div className={`px-5 mb-2 text-[11px] font-black uppercase tracking-widest ${themeVars.textMuted} transition-opacity duration-300 whitespace-nowrap ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                  {group.groupLabel}
                </div>
                
                <nav className="space-y-1 px-3">
                  {group.items.map(item => {
                    const hasSubItems = !!item.subItems;
                    const isActive = hasSubItems 
                      ? item.matchRoutes.some(route => location.pathname.includes(route)) || (location.pathname === '/' && item.id === 'dashboard')
                      : location.pathname === item.path;
                    const isOpen = menuStates[item.id];

                    // Render Submenu Structure
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
                          
                          {/* Mượt mà Submenu CSS Grid Expand */}
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
                                        {sub.subtitle && <span className="text-[11px] text-slate-400 mt-0.5 whitespace-normal leading-tight">{sub.subtitle}</span>}
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

                    // Render Standalone Link
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
          <div className={`p-4 border-t ${themeVars.headerBorder} bg-slate-50/50 backdrop-blur-md transition-all duration-300 flex items-center justify-between ${sidebarExpanded ? 'flex-row' : 'flex-col gap-3 py-4'}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${!sidebarExpanded ? 'justify-center' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0 relative ${themeVars.logoGradient}`}>
                {avatarLetter}
                {/* Avatar Decorators */}
                {isTet && <div className="absolute -bottom-1 -right-2 text-lg drop-shadow-md z-10 pointer-events-none animate-bounce">🌸</div>}
                {isXmas && <div className="absolute -top-4 -right-3 w-6 h-6 transform rotate-12 drop-shadow-md z-10 pointer-events-none"><SantaHatIcon/></div>}
              </div>
              <div className={`flex flex-col transition-all duration-300 overflow-hidden ${sidebarExpanded ? 'opacity-100 w-auto whitespace-normal' : 'opacity-0 w-0 hidden whitespace-nowrap'}`}>
                <span className="text-sm font-bold text-slate-800 truncate leading-tight">{displayName}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{isAdmin ? 'Admin' : 'Nhân viên'}</span>
              </div>
            </div>
            <button onClick={() => setShowLogoutModal(true)} title="Đăng xuất" className={`p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 ${!sidebarExpanded ? 'w-full flex justify-center' : ''}`}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* ----------------------------- */}
        {/* MAIN CONTENT AREA             */}
        {/* ----------------------------- */}
        <div className="flex-1 overflow-auto relative">
          
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden absolute top-4 left-4 z-30 p-2.5 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/60 hover:bg-white transition-colors"
          >
            <Menu size={20} className="text-slate-700" />
          </button>

          {/* Main Layout Wrapper */}
          <div className="relative z-10 p-4 sm:p-8 h-full min-h-screen">
            {isInitializing ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 size={32} className="animate-spin text-blue-600" />
                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Đang tải phân quyền...</span>
              </div>
            ) : hasAccess ? (
              <Outlet />
            ) : (
              <div className="flex flex-col items-center justify-center h-[80vh] text-center animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 border-[8px] border-red-50/50 shadow-inner">
                  <ShieldAlert size={40} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Truy cập bị từ chối</h2>
                <p className="text-slate-500 mb-8 text-sm leading-relaxed font-medium">Bạn không có đủ thẩm quyền để xem trang này. Vui lòng liên hệ Quản trị viên để được cấp quyền.</p>
                <button onClick={() => navigate('/')} className="px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 shadow-md transition-all flex items-center gap-2">
                  <Undo2 size={18} /> Quay lại trang chủ
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------- */}
        {/* MODALS & OVERLAYS             */}
        {/* ----------------------------- */}
        
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* Logout Modal */}
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
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

      </div>
    </>
  );
}