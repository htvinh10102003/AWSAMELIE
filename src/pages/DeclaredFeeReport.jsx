import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, Search, AlertTriangle, RefreshCw, 
  ChevronLeft, ChevronRight, FileX 
} from 'lucide-react';

// BẢNG TỪ ĐIỂN TRẠNG THÁI CHUẨN NHANH.VN
const STATUS_MAP = {
  40: 'Đã đóng gói',
  42: 'Đang đóng gói',
  43: 'Chờ thu gom',
  54: 'Đơn mới',
  55: 'Đang xác nhận',
  56: 'Đã xác nhận',
  57: 'Chờ khách xác nhận',
  58: 'Hãng vận chuyển hủy đơn',
  59: 'Đang chuyển',
  60: 'Thành công',
  61: 'Thất bại',
  63: 'Khách hủy',
  64: 'Hệ thống hủy',
  68: 'Hết hàng',
  71: 'Đang chuyển hoàn',
  72: 'Đã chuyển hoàn',
  73: 'Đổi kho xuất hàng',
  74: 'Xác nhận hoàn'
};

export default function DeclaredFeeReport() {
  // --- STATES QUẢN LÝ THỜI GIAN ---
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getFirstDayOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const [startDate, setStartDate] = useState(getFirstDayOfMonthStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);

  // --- STATES QUẢN LÝ PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50; // Hiển thị 50 dòng mỗi trang cho dễ nhìn

  // --- HÀM GỌI DỮ LIỆU TỪ SUPABASE (CÓ PHÂN TRANG & BỘ LỌC) ---
  const fetchUnorderedFees = async () => {
    setLoading(true);
    try {
      // --- SỬA LẠI ĐOẠN TRUY VẤN TRONG HÀM fetchUnorderedFees ---
 let query = supabase
  .from('orders')
  .select(`
    id, created_at, carrier_code, status, is_declared_fee,
    order_products (product_name, quantity)
  `, { count: 'exact' })
  // ⚡️ ĐỔI TẠI ĐÂY: Chuyển .eq.false thành .eq.0 vì kiểu dữ liệu là số nguyên int4
  .or('is_declared_fee.eq.0,is_declared_fee.is.null') 
  .gte('created_at', `${startDate}T00:00:00Z`)
  .lte('created_at', `${endDate}T23:59:59Z`);

      // Nếu người dùng nhập từ khóa tìm kiếm (ID đơn hoặc mã vận đơn)
      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`id.ilike.%${term}%,carrier_code.ilike.%${term}%`);
      }

      // Xử lý phân trang chuẩn chỉ trên Database
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setOrders(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("❌ Lỗi tải danh sách đơn không khai giá:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Kích hoạt nạp lại dữ liệu khi đổi bộ lọc ngày hoặc lật trang
  useEffect(() => {
    fetchUnorderedFees();
  }, [startDate, endDate, currentPage]);

  // Xử lý tìm kiếm khi người dùng nhấn Enter hoặc bấm nút Tìm
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(0); // Reset về trang đầu tiên khi tìm kiếm
    fetchUnorderedFees();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. HEADER TIÊU ĐỀ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-red-50 text-red-500 rounded-lg"><AlertTriangle size={18} /></span>
            Đơn hàng Không Khai Giá
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Danh sách các đơn hàng chưa được cấu hình phí khai giá bảo hiểm hàng hóa</p>
        </div>
        
        {/* Bộ chọn Khoảng thời gian */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl w-full md:w-auto">
          <Calendar size={16} className="text-slate-400 ml-1" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
          <span className="text-slate-400 font-bold text-xs px-1">至</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
        </div>
      </div>

      {/* 2. THANH TÌM KIẾM VÀ ĐO SỐ LƯỢNG */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <form onSubmit={handleSearchSubmit} className="w-full md:max-w-md flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Nhập ID đơn Nhanh hoặc Mã vận đơn..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition shadow-sm"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm">
            Tìm kiếm
          </button>
        </form>

        <div className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-3 py-2 rounded-xl">
          Phát hiện: <span className="text-red-600 font-black text-sm">{totalCount}</span> đơn rủi ro
        </div>
      </div>

      {/* 3. BẢNG HIỂN THỊ DANH SÁCH ĐƠN BIẾN ĐỘNG */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200/80">
                <th className="p-4 w-28">ID Đơn Nhanh</th>
                <th className="p-4 w-44">Mã vận đơn</th>
                <th className="p-4 w-40">Ngày tạo đơn</th>
                <th className="p-4 w-36">Trạng thái sàn</th>
                <th className="p-4">Chi tiết sản phẩm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400 animate-pulse font-bold">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Đang quét danh sách đơn không khai giá...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400 font-medium">
                    <FileX size={36} className="mx-auto mb-2 text-slate-300" />
                    Không tìm thấy đơn hàng rủi ro nào trong khoảng thời gian này.
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const statusText = STATUS_MAP[order.status] || `Mã lạ (${order.status})`;
                  const formattedDate = new Date(order.created_at).toLocaleString('vi-VN');

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 font-black text-blue-600 tracking-wide">{order.id}</td>
                      <td className="p-4 text-slate-900 font-bold">{order.carrier_code || <span className="text-slate-300 font-normal">Chưa có mã</span>}</td>
                      <td className="p-4 text-slate-400 font-medium">{formattedDate}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded font-bold text-[10px]">
                          {statusText}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-500 truncate max-w-xs">
                        {order.order_products && order.order_products.length > 0 ? (
                          order.order_products.map(p => `${p.product_name} (x${p.quantity})`).join(', ')
                        ) : (
                          <span className="text-slate-300 font-normal text-[10px]">Trống sản phẩm</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. THANH PHÂN TRANG (PAGINATION CONTROLS) */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              Trang {currentPage + 1} / {totalPages} (Hiển thị {orders.length} dòng)
            </span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0 || loading}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage === totalPages - 1 || loading}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}