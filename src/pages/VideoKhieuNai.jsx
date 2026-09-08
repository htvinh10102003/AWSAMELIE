import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, Video, Package, Calendar, Loader2, ExternalLink, PlaySquare, 
  AlertCircle, MoreVertical, Trash2, Edit, Filter, CheckCircle2, Clock, XCircle, FileText
} from 'lucide-react';

export default function VideoKhieuNai() {
  // === QUẢN LÝ NGÀY THÁNG MẶC ĐỊNH (7 NGÀY) ===
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const formatDateInput = (date) => date.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(formatDateInput(sevenDaysAgo));
  const [endDate, setEndDate] = useState(formatDateInput(today));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // === QUẢN LÝ MENU THAO TÁC VÀ MODAL ===
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [statusModal, setStatusModal] = useState({ isOpen: false, item: null });
  const actionMenuRef = useRef(null);

  // Kiểm tra quyền Admin và tự động load data khi vào trang
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAdmin(user?.user_metadata?.role === 'admin' || user?.user_metadata?.is_owner === true);
      fetchData();
    };
    init();

    // Click outside để đóng menu thao tác
    const handleClickOutside = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hàm tải dữ liệu
  const fetchData = async () => {
    setIsLoading(true);
    setOpenActionMenuId(null);
    try {
      let query = supabase.from('order_complaints').select('*');

      // Lọc theo khoảng ngày
      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);

      // Tìm kiếm theo text
      if (searchQuery.trim()) {
        query = query.or(`nhanh_id.ilike.%${searchQuery}%,hvc_code.ilike.%${searchQuery}%,order_id.ilike.%${searchQuery}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Lỗi lấy dữ liệu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  // === THAO TÁC CẬP NHẬT TRẠNG THÁI ===
  const handleUpdateStatus = async (newStatus) => {
    if (!statusModal.item) return;
    try {
      const { error } = await supabase
        .from('order_complaints')
        .update({ status: newStatus })
        .eq('id', statusModal.item.id);

      if (error) throw error;
      
      // Update local state
      setResults(prev => prev.map(r => r.id === statusModal.item.id ? { ...r, status: newStatus } : r));
      setStatusModal({ isOpen: false, item: null });
    } catch (error) {
      alert('Lỗi cập nhật trạng thái: ' + error.message);
    }
  };

  // === THAO TÁC XÓA (CHỈ ADMIN) ===
  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khiếu nại này không? Thao tác này không thể hoàn tác!')) return;
    
    try {
      const { error } = await supabase.from('order_complaints').delete().eq('id', id);
      if (error) throw error;
      
      setResults(prev => prev.filter(r => r.id !== id));
      setOpenActionMenuId(null);
    } catch (error) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  // === UI HELPERS ===
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Đã hoàn tiền':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200"><CheckCircle2 size={14}/> {status}</span>;
      case 'Khiếu nại thất bại':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200"><XCircle size={14}/> {status}</span>;
      case 'Đang khiếu nại':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200"><Clock size={14}/> {status}</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200"><FileText size={14}/> {status}</span>;
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-12 mt-8 font-sans px-4 md:px-6 lg:px-8 2xl:max-w-[1600px]">
      
      {/* HEADER */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm border border-blue-100">
          <PlaySquare size={26} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Tra cứu & Quản lý Khiếu nại</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Tìm kiếm video đóng hàng, theo dõi tiến độ và xử lý bồi thường</p>
        </div>
      </div>

      {/* THANH CÔNG CỤ: TÌM KIẾM & LỌC */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-4">
          
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={20} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập ID Nhanh, Mã HVC hoặc ID Đơn hàng..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition-colors">
              <Filter size={18} className="text-slate-400 mr-2 shrink-0" />
              <div className="flex items-center gap-2 text-sm font-medium">
                <input 
                  type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent outline-none text-slate-700 cursor-pointer"
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent outline-none text-slate-700 cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Tra cứu'}
            </button>
          </div>
        </form>
      </div>

      {/* KẾT QUẢ TÌM KIẾM */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
           <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
           <p className="text-slate-500 font-bold">Đang tải dữ liệu...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Không tìm thấy dữ liệu</h3>
          <p className="text-sm text-slate-500 mt-2">Không có đơn khiếu nại nào trong khoảng thời gian hoặc từ khóa này.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
            <Package size={18} /> Kết quả tra cứu ({results.length})
          </h3>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {results.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
                
                {/* HEAD: TRẠNG THÁI & THAO TÁC */}
                <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    {getStatusBadge(item.status)}
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                      <Calendar size={14} /> {new Date(item.created_at).toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                    </span>
                  </div>

                  {/* NÚT THAO TÁC 3 CHẤM */}
                  <div className="relative">
                    <button 
                      onClick={() => setOpenActionMenuId(openActionMenuId === item.id ? null : item.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MoreVertical size={20} />
                    </button>

                    {/* MENU DROPDOWN */}
                    {openActionMenuId === item.id && (
                      <div ref={actionMenuRef} className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <button 
                          onClick={() => { setStatusModal({ isOpen: true, item }); setOpenActionMenuId(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50"
                        >
                          <Edit size={16} className="text-blue-500" /> Cập nhật trạng thái
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={16} /> Xóa khiếu nại
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* BODY: THÔNG TIN ĐƠN & VIDEO */}
                <div className="flex flex-col lg:flex-row justify-between gap-6 mb-5">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    {item.nhanh_id && (
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">ID Nhanh</span>
                        <span className="text-lg font-black text-slate-800">{item.nhanh_id}</span>
                      </div>
                    )}
                    {item.hvc_code && (
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Mã HVC</span>
                        <span className="text-lg font-black text-blue-600">{item.hvc_code}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end shrink-0">
                    {item.packing_video_url ? (
                      <a href={item.packing_video_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2.5 px-4 rounded-xl transition-colors border border-blue-100 text-sm">
                        <Video size={16} /> Đóng Hàng
                      </a>
                    ) : (
                      <span className="flex items-center gap-2 bg-slate-50 text-slate-400 font-bold py-2.5 px-4 rounded-xl border border-slate-200 cursor-not-allowed text-sm">
                        Chưa có Video Đóng
                      </span>
                    )}

                    {item.return_video_url ? (
                      <a href={item.return_video_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold py-2.5 px-4 rounded-xl transition-colors border border-rose-100 text-sm">
                        <Video size={16} /> Bóc Hoàn
                      </a>
                    ) : (
                      <span className="flex items-center gap-2 bg-slate-50 text-slate-400 font-bold py-2.5 px-4 rounded-xl border border-slate-200 cursor-not-allowed text-sm">
                        Chưa có Video Bóc
                      </span>
                    )}
                  </div>
                </div>

                {/* FOOTER: SẢN PHẨM */}
                {item.products && item.products.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-3 flex items-center gap-1.5"><Package size={14}/> Chi tiết sản phẩm khiếu nại</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {item.products.map((prod, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-start gap-3 shadow-sm">
                          <div className="flex-1 pr-2">
                            <p className="text-xs font-bold text-slate-800 line-clamp-1 mb-1">{prod.product_name || 'Sản phẩm không tên'}</p>
                            <p className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded inline-block">{prod.product_code || 'N/A'}</p>
                          </div>
                          <div className="shrink-0 bg-red-50 text-red-600 text-xs font-black px-2 py-1 rounded">
                            x{prod.quantity || 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL ĐỔI TRẠNG THÁI */}
      {statusModal.isOpen && statusModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-1">Cập nhật trạng thái</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">Đơn: <span className="font-bold text-slate-700">{statusModal.item.nhanh_id || statusModal.item.hvc_code}</span></p>
            
            <div className="space-y-2 mb-8">
              {['Chưa khiếu nại', 'Đang khiếu nại', 'Đã hoàn tiền', 'Khiếu nại thất bại'].map(st => (
                <button
                  key={st}
                  onClick={() => handleUpdateStatus(st)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
                    statusModal.item.status === st 
                      ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-500' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setStatusModal({ isOpen: false, item: null })}
              className="w-full px-5 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}