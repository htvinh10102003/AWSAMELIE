import { AlertTriangle } from 'lucide-react';

export default function TestingNoticeBanner() {
  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm mb-6 relative overflow-hidden group">
      
      {/* Hiệu ứng ánh sáng chạy ngầm phía sau nhìn cho công nghệ */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

      {/* Khối Icon Hổ Phách Hoạt Họa */}
      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20 flex-shrink-0">
        <AlertTriangle size={16} className="animate-pulse" />
      </div>
      
      {/* Nội dung thông báo bọc chữ chuẩn chỉ */}
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          Môi trường kiểm thử (Beta Version)
        </span>
        <p className="text-xs text-slate-700 font-bold mt-0.5 leading-relaxed">
          Chức năng đang trong giai đoạn test thử cấu hình và giao diện, báo cáo có thể sẽ không chính xác.
        </p>
      </div>

    </div>
  );
}