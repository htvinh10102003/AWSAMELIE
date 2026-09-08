import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, RefreshCw, Filter, FileText, CheckCircle2, 
  XCircle, Clock, Video, Loader2, MoreVertical, Edit, Trash2, Calendar
} from 'lucide-react';

export default function TongHopKhieuNai() {
  // === QUẢN LÝ NGÀY THÁNG MẶC ĐỊNH (7 NGÀY) ===
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const formatDateInput = (date) => date.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(formatDateInput(sevenDaysAgo));
  const [endDate, setEndDate] = useState(formatDateInput(today));
  
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); 
  const [isAdmin, setIsAdmin] = useState(false);

  // === QUẢN LÝ MENU THAO TÁC ===
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [statusModal, setStatusModal] = useState({ isOpen: false, item: null });
  const actionMenuRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAdmin(user?.user_metadata?.role === 'admin' || user?.user_metadata?.is_owner === true);
      fetchComplaints();
    };
    init();

    // Click outside để đóng menu
    const handleClickOutside = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchComplaints = async () => {
    setIsLoading(true);
    setOpenActionMenuId(null);
    try {
      let query = supabase.from('order_complaints').select('*');

      if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Lỗi lấy dữ liệu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!statusModal.item) return;
    try {
      const { error } = await supabase
        .from('order_complaints')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', statusModal.item.id);

      if (error) throw error;
      
      setComplaints(prev => prev.map(c => c.id === statusModal.item.id ? { ...c, status: newStatus, updated_at: new Date().toISOString() } : c));
      setStatusModal({ isOpen: false, item: null });
    } catch (error) {
      alert('Lỗi cập nhật trạng thái: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khiếu nại này không?')) return;
    try {
      const { error } = await supabase.from('order_complaints').delete().eq('id', id);
      if (error) throw error;
      
      setComplaints(prev => prev.filter(r => r.id !== id));
      setOpenActionMenuId(null);
    } catch (error) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

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

  const filteredComplaints = filter === 'all' ? complaints : complaints.filter(c => c.status === filter);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-12 mt-8 font-sans px-4 lg:px-8">
      
      {/* HEADER TÍNH NĂNG */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-2xl shadow-sm border border-fuchsia-100">
            <BarChart3 size={26} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Tổng hợp Đơn Khiếu Nại</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Theo dõi trạng thái và tiến độ xử lý hoàn tiền HVC</p>
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
        
        {/* Lọc trạng thái */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-none">
          <Filter size={18} className="text-slate-400 mr-1 shrink-0" />
          {['all', 'Chưa khiếu nại', 'Đang khiếu nại', 'Đã hoàn tiền', 'Khiếu nại thất bại'].map(st => (
            <button 
              key={st}
              onClick={() => setFilter(st)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === st ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              {st === 'all' ? 'Tất cả' : st}
            </button>
          ))}
        </div>

        {/* Lọc ngày tháng */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="flex flex-1 lg:flex-none items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus-within:border-blue-500 transition-colors">
            <Calendar size={18} className="text-slate-400 mr-2 shrink-0" />
            <div className="flex items-center gap-2 text-sm font-medium w-full">
              <input 
                type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="bg-transparent outline-none text-slate-700 cursor-pointer w-full"
              />
              <span className="text-slate-300">-</span>
              <input 
                type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="bg-transparent outline-none text-slate-700 cursor-pointer w-full"
              />
            </div>
          </div>

          <button onClick={fetchComplaints} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shrink-0 shadow-sm">
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>

      </div>

      {/* BẢNG DỮ LIỆU */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-visible">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-black border-b border-slate-200">
                <th className="p-5 whitespace-nowrap">Thời gian</th>
                <th className="p-5 whitespace-nowrap">Thông tin Đơn</th>
                <th className="p-5 min-w-[250px]">Sản phẩm khiếu nại</th>
                <th className="p-5 text-center whitespace-nowrap">Link Video</th>
                <th className="p-5 whitespace-nowrap">Trạng thái</th>
                <th className="p-5 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-3 text-blue-500" />
                    <span className="font-bold">Đang tải dữ liệu...</span>
                  </td>
                </tr>
              ) : filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500">
                    <FileText size={48} className="mx-auto text-slate-300 mb-3" />
                    <span className="font-bold">Không có đơn khiếu nại nào phù hợp.</span>
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                    
                    {/* Ngày tạo */}
                    <td className="p-5 align-top">
                      <div className="font-bold text-slate-800">{new Date(item.created_at).toLocaleDateString('vi-VN')}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(item.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}</div>
                    </td>

                    {/* Thông tin mã */}
                    <td className="p-5 align-top space-y-1.5">
                      {item.nhanh_id && <div className="text-xs"><span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">ID Nhanh:</span> <span className="font-black text-slate-800 block text-sm">{item.nhanh_id}</span></div>}
                      {item.hvc_code && <div className="text-xs mt-2"><span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Mã HVC:</span> <span className="font-black text-blue-600 block text-sm">{item.hvc_code}</span></div>}
                    </td>

                    {/* Mảng JSON Sản phẩm */}
                    <td className="p-5 align-top">
                      {item.products && item.products.length > 0 ? (
                        <div className="space-y-2">
                          {item.products.map((p, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 p-2 rounded-lg flex items-center justify-between shadow-sm">
                              <div className="pr-2">
                                <span className="font-bold text-slate-700 text-xs line-clamp-1">{p.product_name || p.product_code}</span>
                                {p.product_code && <span className="text-[10px] font-mono text-slate-400">{p.product_code}</span>}
                              </div>
                              <span className="shrink-0 font-black text-rose-600 px-1.5 py-0.5 bg-rose-50 rounded text-xs">x{p.quantity || 1}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic bg-slate-50 px-2 py-1 rounded">Không có chi tiết SP</span>
                      )}
                    </td>

                    {/* Nút Video mini */}
                    <td className="p-5 align-top text-center">
                      <div className="flex flex-col gap-2 items-center">
                        {item.packing_video_url ? (
                          <a href={item.packing_video_url} target="_blank" rel="noreferrer" title="Video đóng hàng" className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors w-full border border-blue-100"><Video size={14}/> Đóng</a>
                        ) : <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-400 text-xs font-bold rounded-lg w-full border border-slate-100"><Video size={14}/> Đóng</span>}
                        
                        {item.return_video_url ? (
                          <a href={item.return_video_url} target="_blank" rel="noreferrer" title="Video bóc hoàn" className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-100 transition-colors w-full border border-rose-100"><Video size={14}/> Bóc</a>
                        ) : <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-400 text-xs font-bold rounded-lg w-full border border-slate-100"><Video size={14}/> Bóc</span>}
                      </div>
                    </td>

                    {/* Trạng thái hiện tại */}
                    <td className="p-5 align-top">
                      <div className="mb-2">{getStatusBadge(item.status)}</div>
                      <div className="text-[10px] text-slate-400 font-medium">Cập nhật lúc: <br/>{new Date(item.updated_at).toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</div>
                    </td>

                    {/* Action Select Box */}
                    <td className="p-5 align-top text-right relative">
                      <button 
                        onClick={() => setOpenActionMenuId(openActionMenuId === item.id ? null : item.id)}
                        className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        <MoreVertical size={20} />
                      </button>

                      {/* Dropdown Menu */}
                      {openActionMenuId === item.id && (
                        <div ref={actionMenuRef} className="absolute right-8 top-12 w-48 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <button 
                            onClick={() => { setStatusModal({ isOpen: true, item }); setOpenActionMenuId(null); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50"
                          >
                            <Edit size={16} className="text-blue-500" /> Đổi trạng thái
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
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ĐỔI TRẠNG THÁI */}
      {statusModal.isOpen && statusModal.item && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
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