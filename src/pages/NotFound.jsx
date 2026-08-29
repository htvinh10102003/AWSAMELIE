import { useNavigate } from 'react-router-dom';
import { SearchX, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto">
      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 border-[8px] border-slate-50 shadow-inner">
        <SearchX size={40} className="text-slate-500" />
      </div>
      <h1 className="text-4xl font-black text-slate-800 mb-2 uppercase tracking-tight">404</h1>
      <h2 className="text-xl font-bold text-slate-700 mb-3">Không tìm thấy trang</h2>
      <p className="text-slate-500 mb-8 text-sm leading-relaxed font-medium">
        Đường dẫn bạn đang cố truy cập không tồn tại, đã bị thay đổi hoặc bạn gõ sai địa chỉ. Vui lòng kiểm tra lại.
      </p>
      <button 
        onClick={() => navigate('/')} 
        className="px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 shadow-md transition-all flex items-center gap-2"
      >
        <Home size={18} /> Quay lại trang chủ
      </button>
    </div>
  );
}