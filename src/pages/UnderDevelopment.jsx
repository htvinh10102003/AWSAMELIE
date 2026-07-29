import { Rocket, Sparkles } from 'lucide-react';

export default function UnderDevelopment() {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center bg-slate-50 p-4 font-sans relative overflow-hidden">
      
      {/* Background mờ ảo tạo chiều sâu nhẹ nhàng */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card chính - Tối giản, không viền nặng nề */}
      <div className="w-full max-w-lg bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 md:p-12 text-center relative z-10">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50/80 text-blue-600 rounded-full text-xs font-semibold uppercase tracking-wider mb-8">
          <Sparkles size={14} className="text-blue-500" /> 
          Feature Coming Soon
        </div>

        {/* Khối Icon Animation thay cho GIF */}
        <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center bg-gradient-to-tr from-blue-50 to-indigo-50 rounded-full shadow-inner">
          {/* Vòng tròn đứt nét xoay vòng */}
          <div className="absolute inset-0 border-2 border-blue-200 border-dashed rounded-full animate-[spin_10s_linear_infinite]" />
          {/* Icon bay lên xuống nhẹ */}
          <Rocket size={40} className="text-blue-600 animate-bounce" />
        </div>

        {/* Typography sạch sẽ, tập trung */}
        <h3 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight mb-3">
          Đang trong giai đoạn phát triển
        </h3>
        <p className="text-slate-500 text-sm md:text-base leading-relaxed max-w-sm mx-auto mb-10">
          Vinh đang cố gắng hoàn thiện những bước cuối cùng. Trong lúc chờ đợi thì hãy bật nhạc và thư giãn nhé!
        </p>

        {/* Progress Bar hiện đại */}
        <div className="relative text-left">
          <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            <span>Giai đoạn kiểm thử</span>
            <span className="text-blue-600">99%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full w-[99%] relative">
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}