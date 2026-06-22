import { Wrench, Cpu, ShieldAlert } from 'lucide-react';

export default function UnderDevelopment() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full flex items-center justify-center font-sans relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      
      {/* Họa tiết nền: bánh răng quay */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-10 left-10 w-24 h-24 text-slate-200/60 animate-[spin_20s_linear_infinite]" viewBox="0 0 100 100">
          <path d="M50 10 L60 20 L90 20 L90 40 L100 50 L90 60 L90 80 L60 80 L50 90 L40 80 L10 80 L10 60 L0 50 L10 40 L10 20 L40 20 Z" fill="currentColor" />
          <circle cx="50" cy="50" r="15" fill="white" />
        </svg>
        <svg className="absolute bottom-20 right-16 w-20 h-20 text-slate-200/50 animate-[spin_15s_linear_infinite_reverse]" viewBox="0 0 100 100">
          <path d="M50 10 L55 25 L70 25 L70 45 L85 50 L70 55 L70 75 L55 75 L50 90 L45 75 L30 75 L30 55 L15 50 L30 45 L30 25 L45 25 Z" fill="currentColor" />
          <circle cx="50" cy="50" r="12" fill="white" />
        </svg>
      </div>

      {/* Khối Card Trung Tâm */}
      <div className="w-full max-w-lg p-8 bg-white/80 backdrop-blur-xl border border-white/80 rounded-3xl shadow-2xl shadow-blue-500/5 text-center relative z-10">
        
        {/* Badge thông báo */}
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-200/60 rounded-full text-blue-700 text-xs font-bold uppercase tracking-wider mb-8 animate-pulse">
          <Cpu size={14} className="text-blue-600" /> Feature Coming Soon
        </div>

        {/* Khu vực nhân vật chính */}
        <div className="relative w-48 h-48 mx-auto mb-6">
          {/* Nhân vật robot kỹ sư tự vẽ bằng SVG */}
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
            {/* Bóng đổ dưới chân */}
            <ellipse cx="100" cy="185" rx="40" ry="6" fill="#e2e8f0" />
            
            {/* Thân */}
            <rect x="75" y="105" width="50" height="55" rx="12" fill="#3b82f6" />
            <rect x="80" y="110" width="40" height="30" rx="6" fill="#1e3a8a" opacity="0.2" />
            
            {/* Chân */}
            <rect x="80" y="155" width="14" height="25" rx="5" fill="#1e40af" />
            <rect x="106" y="155" width="14" height="25" rx="5" fill="#1e40af" />
            
            {/* Tay trái (cố định) */}
            <rect x="60" y="115" width="12" height="30" rx="6" fill="#2563eb" />
            <circle cx="66" cy="148" r="6" fill="#3b82f6" />
            
            {/* Tay phải cầm cờ lê - có chuyển động */}
            <g className="origin-top-right" style={{ animation: 'swingWrench 1.2s ease-in-out infinite' }}>
              <rect x="128" y="115" width="12" height="30" rx="6" fill="#2563eb" />
              {/* Cờ lê */}
              <g transform="translate(135, 148) rotate(30)">
                <rect x="-4" y="-2" width="40" height="6" rx="3" fill="#94a3b8" />
                <circle cx="38" cy="-2" r="7" fill="none" stroke="#64748b" strokeWidth="4" />
                <circle cx="38" cy="-2" r="3" fill="#cbd5e1" />
                <circle cx="-6" cy="-2" r="5" fill="none" stroke="#64748b" strokeWidth="4" />
              </g>
            </g>
            
            {/* Đầu */}
            <rect x="82" y="60" width="36" height="40" rx="10" fill="#3b82f6" />
            {/* Kính bảo hộ */}
            <rect x="75" y="68" width="50" height="18" rx="9" fill="#1e293b" />
            <rect x="79" y="72" width="18" height="10" rx="5" fill="#38bdf8" opacity="0.8" />
            <rect x="103" y="72" width="18" height="10" rx="5" fill="#38bdf8" opacity="0.8" />
            {/* Nụ cười */}
            <path d="M90 86 Q100 95 110 86" fill="none" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
            {/* Ăng-ten nhấp nháy */}
            <g className="animate-bounce [animation-duration:2s]">
              <line x1="100" y1="60" x2="100" y2="40" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
              <circle cx="100" cy="37" r="5" fill="#ef4444" className="animate-ping [animation-duration:1.5s]" />
              <circle cx="100" cy="37" r="5" fill="#f87171" />
            </g>
            {/* Mũ bảo hiểm */}
            <path d="M74 68 Q82 50 100 48 Q118 50 126 68 Z" fill="#fbbf24" />
            <rect x="78" y="65" width="44" height="4" rx="2" fill="#f59e0b" />
          </svg>
        </div>

        {/* Text */}
        <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-2">Đang trong giai đoạn phát triển</h3>
        <p className="text-sm text-slate-500 font-medium mt-2 max-w-sm mx-auto leading-relaxed">
          Vinh đang cố gắng hoàn thiện những bước cuối cùng. Hệ thống phân tích kho vận nâng cao sẽ sớm hoạt động trở lại.
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200/50 rounded-full h-2 mt-8 mb-2 overflow-hidden border border-slate-200">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full w-[99%] relative">
            <div className="absolute inset-0 bg-white/30 animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between text-[11px] font-bold text-slate-400 tracking-wide uppercase px-0.5">
          <span>Giai đoạn kiểm thử</span>
          <span className="text-blue-600">99% Hoàn thành</span>
        </div>
      </div>

      {/* Thêm keyframes cho animation cầm cờ lê */}
      <style>{`
        @keyframes swingWrench {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(12deg); }
          75% { transform: rotate(-5deg); }
        }
      `}</style>
    </div>
  );
}