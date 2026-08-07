import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  RotateCcw, PackageX, Calendar, Search, 
  Loader2, ExternalLink, Clock, Box, ShieldAlert
} from 'lucide-react';

const STATUS_MAP = {
  71: { label: 'Đang hoàn', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  74: { label: 'Xác nhận hoàn', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  72: { label: 'Đã chuyển hoàn', color: 'bg-red-100 text-red-700 border-red-200' }
};

const formatDateToInput = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function DashboardDonHoan() {
  const [activeTab, setActiveTab] = useState('dang_hoan'); // 'dang_hoan' (71, 74) | 'da_hoan' (72)
  const [selectedDate, setSelectedDate] = useState(() => formatDateToInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchReturnOrders();
  }, [activeTab, selectedDate]);

  const fetchReturnOrders = async () => {
    if (!selectedDate) return;
    setLoading(true);
    
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Xác định cụm trạng thái theo tab
      const targetStatuses = activeTab === 'dang_hoan' ? [71, 74] : [72];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, 
          created_at, 
          updated_at, 
          status, 
          carrier_name, 
          tracking_url, 
          description,
          order_products ( product_name, quantity, product_code )
        `)
        .in('status', targetStatuses)
        .gte('updated_at', startOfDay.toISOString())
        .lte('updated_at', endOfDay.toISOString())
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Lỗi kéo dữ liệu đơn hoàn:", err);
      alert("Không thể tải dữ liệu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tính toán số liệu tổng quan
  const filteredOrders = orders.filter(o => o.id.toLowerCase().includes(searchText.toLowerCase()));
  const totalProducts = filteredOrders.reduce((sum, order) => {
    const orderItemCount = order.order_products?.reduce((sub, p) => sub + Number(p.quantity || 0), 0) || 0;
    return sum + orderItemCount;
  }, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12 mt-8 font-sans">
      
      {/* HEADER & TABS */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl shadow-sm border border-red-100">
            <RotateCcw size={26} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Quản lý Đơn Hoàn</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Theo dõi biến động hàng hoàn về kho theo thời gian thực</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 w-full sm:w-auto">
            <button 
              onClick={() => setActiveTab('dang_hoan')} 
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'dang_hoan' ? 'bg-white text-orange-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <PackageX size={16} /> Đang hoàn (71, 74)
            </button>
            <button 
              onClick={() => setActiveTab('da_hoan')} 
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'da_hoan' ? 'bg-white text-red-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ShieldAlert size={16} /> Đã chuyển hoàn (72)
            </button>
          </div>

          {/* Date Picker */}
          <div className="flex items-center bg-white border border-slate-300 rounded-xl px-4 py-2 w-full sm:w-auto shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Calendar size={16} className="text-slate-400 mr-2" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
              className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer w-full"
            />
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Tổng số đơn hàng</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{filteredOrders.length} <span className="text-sm font-bold text-slate-500">đơn</span></p>
          </div>
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 text-slate-400">
            <PackageX size={28} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-red-50/30 p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Tổng sản phẩm quay đầu</p>
            <p className="text-3xl font-black text-red-600 mt-1">{totalProducts} <span className="text-sm font-bold text-red-400">items</span></p>
          </div>
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center border border-red-200 text-red-500">
            <Box size={28} />
          </div>
        </div>
      </div>

      {/* DANH SÁCH ĐƠN HÀNG */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px]">
        {/* Toolbar Bảng */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h3 className="text-sm font-black text-slate-700 uppercase">Danh sách chi tiết</h3>
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="Tìm ID đơn hàng..." 
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <Search size={14} className="absolute left-3.5 top-2.5 text-slate-400" />
          </div>
        </div>

        {/* Bảng Dữ Liệu */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-sm font-bold text-slate-500">Đang cào dữ liệu trạng thái...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                <RotateCcw size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">Không có đơn hàng nào cập nhật trong ngày này!</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                <tr className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Thông tin Đơn</th>
                  <th className="py-4 px-6 w-1/3">Chi tiết Sản phẩm</th>
                  <th className="py-4 px-6">Thời gian cập nhật</th>
                  <th className="py-4 px-6 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Cột Thông tin đơn */}
                    <td className="py-4 px-6 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800 text-sm">#{order.id}</span>
                        {order.tracking_url && (
                          <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1 rounded-md" title="Tra cứu mã vận đơn">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                        Hãng vận chuyển: <span className="text-slate-600">{order.carrier_name || 'Không rõ'}</span>
                      </div>
                    </td>

                    {/* Cột Chi tiết Sản phẩm */}
                    <td className="py-4 px-6 align-top whitespace-normal">
                      {order.order_products && order.order_products.length > 0 ? (
                        <ul className="space-y-1.5">
                          {order.order_products.map((prod, idx) => (
                            <li key={idx} className="text-xs flex gap-2 leading-relaxed">
                              <span className="font-bold text-slate-500 shrink-0">{prod.quantity} x</span>
                              <span className="text-slate-800 font-semibold">{prod.product_name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Không có chi tiết</span>
                      )}
                    </td>

                    {/* Cột Thời gian */}
                    <td className="py-4 px-6 align-top">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <Clock size={14} className="text-slate-400" />
                        {new Date(order.updated_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium pl-5 mt-0.5">
                        {new Date(order.updated_at).toLocaleDateString('vi-VN')}
                      </div>
                    </td>

                    {/* Cột Trạng thái */}
                    <td className="py-4 px-6 align-top text-center">
                      <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border ${STATUS_MAP[order.status]?.color || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {STATUS_MAP[order.status]?.label || `Code: ${order.status}`}
                      </span>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}