import { Wrench, Sparkles, Heart } from 'lucide-react';

export default function CuteTestingBanner() {
  return (
    <div className="relative mb-6 overflow-hidden rounded-[2rem] border-2 border-pink-200/70 bg-gradient-to-br from-pink-100 via-purple-50 to-blue-50 p-5 shadow-lg shadow-pink-200/40">
      
      {/* Nền hoa văn chấm bi siêu nhẹ */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #ec4899 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} 
      />

      {/* Lấp lánh bay xung quanh */}
      <div className="absolute top-2 left-4 animate-float-slow text-pink-300/60 text-lg">✦</div>
      <div className="absolute bottom-3 right-6 animate-float-slower text-purple-300/60 text-sm">✧</div>
      <div className="absolute top-6 right-8 animate-float text-amber-300/60 text-base">⭐</div>

      <div className="relative flex items-start gap-4">
        {/* Khu vực nhân vật dễ thương */}
        <div className="relative flex-shrink-0">
          <div className="relative bg-white/70 backdrop-blur-sm p-3.5 rounded-full shadow-md shadow-pink-200/50 border border-pink-100">
            <img 
              src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWFvd3Zzbzk2dzFmNncxaWJzM2F0dmlpc3Jyb2Q4dDhnazI5MHF6cSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/EnaDBEa8Q7eVdW3Jac/giphy.gif" 
              alt="Mèo kỹ thuật đang sửa chữa"
              className="w-20 h-20 object-contain animate-gentle-bounce select-none rounded-full"
            />
            
            {/* Cờ lê nhỏ xinh bên cạnh */}
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-pink-100 animate-wobble">
              <Wrench size={24} className="text-pink-400" />
            </div>

            {/* Trái tim bay lên từ mèo */}
            <div className="absolute -top-1 -right-2 animate-heart-float">
              <Heart size={16} className="text-pink-400 fill-pink-400" />
            </div>
          </div>
        </div>

        {/* Nội dung thông báo */}
        <div className="flex-1 min-w-0">
          {/* Tiêu đề */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-pink-200/50 border border-pink-200 rounded-full">
              <Sparkles size={14} className="text-pink-500" />
              <span className="text-[10px] font-extrabold text-pink-600 tracking-wider uppercase">
                Đang thử nghiệm (Bản chính thức sẽ hoàn thiện trước 30/08/2026)
              </span>
            </div>
            
            {/* Badge trạng thái dễ thương */}
            <div className="flex items-center gap-1 px-2.5 py-0.5 bg-purple-100/80 border border-purple-200 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-[9px] font-bold text-purple-500">Close test beta</span>
            </div>
          </div>

          {/* Dòng mô tả chính */}
          <p className="text-sm font-bold text-purple-800 mb-1 leading-tight">
            Hệ thống đang trong giai đoạn{' '}
            <span className="text-pink-600 decoration-pink-300/60 decoration-wavy">
              KIỂM THỬ VÀ HOÀN THIỆN
            </span>
          </p>

          {/* Mô tả phụ */}
          <p className="text-[13px] text-purple-600/80 leading-relaxed mb-3">
            Chức năng và giao diện đang được em Vinh chăm chút từng chi tiết. 
            Báo cáo có thể chưa chính xác 100% trong lúc này nhé!
          </p>

          {/* Thanh tiến trình pastel */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-pink-100 rounded-full overflow-hidden border border-pink-200/50 shadow-inner">
              <div className="h-full bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 rounded-full animate-progress-glow"
                   style={{ width: '65%', backgroundSize: '200% 100%', animation: 'progress-shine 2s linear infinite' }} 
              />
            </div>
            <span className="text-[10px] font-bold text-purple-500">65%</span>
          </div>

          {/* Dòng note nhỏ cuối cùng */}
          <div className="mt-2 flex items-center gap-1 text-[14px] text-purple-400/80">
            <span className="text-pink-400">🐾</span> 
            Trong lúc chờ đợi thì tại sao không nhảy lên với em Vinh =)))
          </div>
        </div>
      </div>

      {/* CSS animation tùy chỉnh */}
      <style jsx>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(8deg); }
          75% { transform: rotate(-8deg); }
        }
        @keyframes heart-float {
          0% { opacity: 0; transform: translateY(0) scale(0.5); }
          30% { opacity: 1; transform: translateY(-8px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-16px) scale(0.8); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(5deg); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        @keyframes progress-shine {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-gentle-bounce { animation: gentle-bounce 2.5s ease-in-out infinite; }
        .animate-wobble { animation: wobble 3s ease-in-out infinite; }
        .animate-heart-float { animation: heart-float 2s ease-in-out infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-float-slower { animation: float-slower 5s ease-in-out infinite; }
        .animate-progress-glow { animation: progress-shine 2s linear infinite; }
      `}</style>
    </div>
  );
}