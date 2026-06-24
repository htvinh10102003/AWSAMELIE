import { Wrench, Cpu, ShieldAlert } from 'lucide-react';

export default function UnderDevelopment() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full flex items-center justify-center font-sans relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      
      {/* Họa tiết nền: bánh răng quay và chấm tròn nổi */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-10 left-10 w-28 h-28 text-slate-200/50 animate-[spin_20s_linear_infinite]" viewBox="0 0 100 100">
          <path d="M50 8 L57 22 L72 22 L72 42 L88 50 L72 58 L72 78 L57 78 L50 92 L43 78 L28 78 L28 58 L12 50 L28 42 L28 22 L43 22 Z" fill="currentColor" />
          <circle cx="50" cy="50" r="18" fill="white" />
        </svg>
        <svg className="absolute bottom-16 right-12 w-24 h-24 text-slate-200/50 animate-[spin_15s_linear_infinite_reverse]" viewBox="0 0 100 100">
          <path d="M50 10 L58 28 L76 28 L76 50 L90 58 L76 66 L76 88 L58 88 L50 100 L42 88 L24 88 L24 66 L10 58 L24 50 L24 28 L42 28 Z" fill="currentColor" />
          <circle cx="50" cy="50" r="14" fill="white" />
        </svg>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-300 rounded-full animate-float" />
        <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-purple-300 rounded-full animate-float-delayed" />
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-pink-300 rounded-full animate-float" />
        <div className="absolute bottom-1/3 right-1/4 text-xl text-yellow-300 animate-float">✦</div>
        <div className="absolute top-1/2 left-[15%] text-lg text-blue-200 animate-float-delayed">⚙️</div>
        <div className="absolute bottom-[20%] right-[15%] text-lg text-indigo-200 animate-float">🔧</div>
      </div>

      {/* Card chính */}
      <div className="w-full max-w-2xl p-8 md:p-12 bg-white/80 backdrop-blur-xl border border-white/80 rounded-[3rem] shadow-2xl shadow-blue-500/5 text-center relative z-10 mx-4">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/60 rounded-full text-blue-600 text-xs font-bold uppercase tracking-wider mb-8">
          <Cpu size={14} className="text-blue-500" /> Feature Coming Soon
        </div>

        {/* Robot chibi vẽ bằng CSS */}
        <div className="relative w-48 h-48 mx-auto mb-8 flex items-center justify-center">
          <div className="robot animate-float-slow">
            {/* Antenna */}
            <div className="antenna">
              <div className="antenna-line"></div>
              <div className="antenna-ball"></div>
            </div>
            {/* Head */}
            <div className="head">
              <div className="eye left-eye"></div>
              <div className="eye right-eye"></div>
              <div className="mouth"></div>
            </div>
            {/* Body */}
            <div className="body">
              <div className="chest-light"></div>
            </div>
            {/* Arms */}
            <div className="arm left-arm"></div>
            <div className="arm right-arm wrench-arm">
              {/* Cờ lê nhỏ */}
              <div className="wrench-icon">
                <Wrench size={20} className="text-slate-500" />
              </div>
            </div>
            {/* Legs */}
            <div className="leg left-leg"></div>
            <div className="leg right-leg"></div>
          </div>
        </div>

        {/* Text */}
        <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Đang trong giai đoạn phát triển
        </h3>
        <p className="text-sm text-slate-500 font-medium mt-4 max-w-md mx-auto leading-relaxed">
          Vinh đang cố gắng hoàn thiện những bước cuối cùng. Hệ thống phân tích kho vận nâng cao sẽ sớm hoạt động trở lại.
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200/50 rounded-full h-3 mt-8 mb-2 overflow-hidden border border-slate-200 shadow-inner">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full w-[99%] relative">
            <div className="absolute inset-0 bg-white/30 animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between text-[11px] font-bold text-slate-400 tracking-wide uppercase px-0.5">
          <span>Giai đoạn kiểm thử</span>
          <span className="text-blue-600">99% Hoàn thành</span>
        </div>
      </div>

      {/* CSS cho robot và animation */}
      <style>{`
        .robot {
          position: relative;
          width: 100px;
          height: 120px;
        }
        /* Antenna */
        .antenna {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
        }
        .antenna-line {
          width: 4px;
          height: 15px;
          background: #64748b;
          margin: 0 auto;
          border-radius: 2px;
        }
        .antenna-ball {
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          margin: 0 auto;
          animation: blink 1s infinite;
          box-shadow: 0 0 8px #ef4444;
        }
        /* Head */
        .head {
          width: 60px;
          height: 60px;
          background: #e0e7ff;
          border-radius: 50%;
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          box-shadow: inset -4px -4px 8px rgba(0,0,0,0.05);
        }
        .eye {
          width: 10px;
          height: 10px;
          background: #1e293b;
          border-radius: 50%;
          position: absolute;
          top: 22px;
        }
        .left-eye {
          left: 15px;
        }
        .right-eye {
          right: 15px;
        }
        .mouth {
          width: 16px;
          height: 4px;
          background: #1e293b;
          border-radius: 2px;
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
        }
        /* Body */
        .body {
          width: 40px;
          height: 35px;
          background: #93c5fd;
          border-radius: 12px;
          position: absolute;
          top: 72px;
          left: 50%;
          transform: translateX(-50%);
          box-shadow: inset -3px -3px 6px rgba(0,0,0,0.05);
        }
        .chest-light {
          width: 8px;
          height: 8px;
          background: #38bdf8;
          border-radius: 50%;
          margin: 12px auto 0;
          box-shadow: 0 0 10px #38bdf8;
          animation: pulse-light 1.5s infinite;
        }
        /* Arms */
        .arm {
          width: 12px;
          height: 28px;
          background: #93c5fd;
          border-radius: 6px;
          position: absolute;
          top: 78px;
        }
        .left-arm {
          left: 10px;
          transform: rotate(20deg);
        }
        .right-arm {
          right: 10px;
          transform: rotate(-20deg);
        }
        .wrench-arm {
          transform: rotate(-30deg);
          animation: wrench-swing 1.2s ease-in-out infinite;
          transform-origin: top center;
        }
        .wrench-icon {
          position: absolute;
          bottom: -24px;
          left: -4px;
          transform: rotate(90deg);
        }
        /* Legs */
        .leg {
          width: 14px;
          height: 20px;
          background: #64748b;
          border-radius: 6px;
          position: absolute;
          bottom: 0;
        }
        .left-leg {
          left: 28px;
        }
        .right-leg {
          right: 28px;
        }

        /* Keyframes */
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes pulse-light {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes wrench-swing {
          0%, 100% { transform: rotate(-30deg); }
          50% { transform: rotate(-15deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
          50% { transform: translateY(-15px) scale(1.2); opacity: 1; }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
          50% { transform: translateY(-20px) scale(1.3); opacity: 1; }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 5s ease-in-out infinite 1s;
        }
        .animate-float-slow {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}