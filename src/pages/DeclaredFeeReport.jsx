import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, Search, AlertTriangle, RefreshCw, 
  ChevronLeft, ChevronRight, FileX, User, Filter, Truck
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

  // ⚡️ STATES KHỞI TẠO BỘ LỌC NÂNG CAO MỚI BỔ SUNG
  const [selectedChannel, setSelectedChannel] = useState('all'); // all, 1, 2
  const [selectedCarrier, setSelectedCarrier] = useState('all'); // all, Viettel Post, SPX Express
  const [selectedStatus, setSelectedStatus] = useState('all');   // all, hoặc các mã số trạng thái

  // --- STATES QUẢN LÝ PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // --- HÀM GỌI DỮ LIỆU TỪ SUPABASE (TÍCH HỢP BỘ LỌC ĐỘNG) ---
  const fetchUnorderedFees = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          id, created_at, carrier_code, carrier_name, status, is_declared_fee, sale_channel, created_by_name,
          order_products (product_name, quantity)
        `, { count: 'exact' })
        .or('is_declared_fee.eq.0,is_declared_fee.is.null') // Lọc đơn chưa khai giá
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`);

      // ⚡️ 1. XỬ LÝ LỌC KÊNH BÁN ĐỘNG
      if (selectedChannel === 'all') {
        query = query.in('sale_channel', [1, 2]);
      } else {
        query = query.eq('sale_channel', Number(selectedChannel));
      }

      // ⚡️ 2. XỬ LÝ LỌC NHÀ VẬN CHUYỂN ĐỘNG
      if (selectedCarrier !== 'all') {
        query = query.eq('carrier_name', selectedCarrier);
      }

      // ⚡️ 3. XỬ LÝ LỌC TRẠNG THÁI ĐƠN ĐỘNG
      if (selectedStatus !== 'all') {
        query = query.eq('status', Number(selectedStatus));
      }

      // Xử lý ô tìm kiếm văn bản chuỗi
      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`id.ilike.%${term}%,carrier_code.ilike.%${term}%,created_by_name.ilike.%${term}%`);
      }

      // Tính toán vị trí phân trang lật mảnh
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

  // Tự động kích hoạt quét lại database khi bất kỳ bộ lọc dropdown nào thay đổi giá trị
  useEffect(() => {
    fetchUnorderedFees();
  }, [startDate, endDate, currentPage, selectedChannel, selectedCarrier, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(0);
    fetchUnorderedFees();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-5 pb-10">
      
      {/* 1. HEADER TIÊU ĐỀ THẨM MỸ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-red-50 text-red-500 rounded-lg"><AlertTriangle size={18} /></span>
            Đơn hàng Không Khai Giá
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Rà soát rủi ro bảo hiểm hàng hóa lỗi luồng cấu hình</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl w-full md:w-auto shadow-inner">
          <Calendar size={16} className="text-slate-400 ml-1" />
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setCurrentPage(0); }} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
          <span className="text-slate-400 font-bold text-xs px-1">Đến</span>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setCurrentPage(0); }} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
        </div>
      </div>

      {/* 2. THANH TÌM KIẾM CHÍNH VÀ ĐO SỐ LƯỢNG */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
        <form onSubmit={handleSearchSubmit} className="w-full lg:max-w-md flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm nhanh theo ID, Mã vận đơn, Người tạo..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer">
            Tìm kiếm
          </button>
        </form>

        {/* ⚡️ KHỐI BỘ LỌC DROPDOWN NÂNG CAO ĐA CHIỀU */}
        <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center justify-start lg:justify-end">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            <Filter size={12} /> Lọc nhanh:
          </div>

          {/* Dropdown Kênh bán */}
          <select 
            value={selectedChannel} 
            onChange={e => { setSelectedChannel(e.target.value); setCurrentPage(0); }}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none text-slate-700 cursor-pointer hover:bg-slate-100"
          >
            <option value="all">Tất cả Kênh (1 & 2)</option>
            <option value="1">Kênh Bán 1</option>
            <option value="2">Kênh Bán 2</option>
          </select>

          {/* Dropdown Nhà vận chuyển */}
          <select 
            value={selectedCarrier} 
            onChange={e => { setSelectedCarrier(e.target.value); setCurrentPage(0); }}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none text-slate-700 cursor-pointer hover:bg-slate-100"
          >
            <option value="all">Tất cả Nhà xe</option>
            <option value="Viettel Post">Viettel Post</option>
            <option value="SPX Express">SPX Express</option>
          </select>

          {/* Dropdown Trạng thái đơn */}
          <select 
            value={selectedStatus} 
            onChange={e => { setSelectedStatus(e.target.value); setCurrentPage(0); }}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 outline-none text-slate-700 cursor-pointer hover:bg-slate-100 max-w-[160px]"
          >
            <option value="all">Tất cả Trạng thái</option>
            {Object.entries(STATUS_MAP).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>

          <div className="text-xs font-bold text-slate-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl ml-auto lg:ml-2">
            Phát hiện: <span className="text-red-600 font-black text-sm">{totalCount}</span> đơn rủi ro
          </div>
        </div>
      </div>

      {/* 3. BẢNG HIỂN THỊ DANH SÁCH ĐƠN HÀNG BIẾN ĐỘNG */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-slate-400 font-bold uppercase border-b border-slate-200/80">
                <th className="p-4 w-28">ID Đơn Nhanh</th>
                {/* ⚡️ CỘT NHÀ VẬN CHUYỂN MỚI THÊM VÀO THEO YÊU CẦU */}
                <th className="p-4 w-36">ĐVVC</th>
                <th className="p-4 w-44">Mã vận đơn</th>
                <th className="p-4 w-36">Ngày tạo đơn</th>
                <th className="p-4 w-36">Người tạo đơn</th>
                <th className="p-4 w-32">Trạng thái sàn</th>
                <th className="p-4">Chi tiết sản phẩm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                /* HIỂN THỊ LOADING XOAY TRÒN */
                <tr><td colSpan={7} className="p-20 text-center text-slate-400 animate-pulse font-bold"><RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-500" />Đang áp bộ lọc quét database...</td></tr>
              ) : orders.length === 0 ? (
                /* HIỂN THỊ THÔNG BÁO TRỐNG */
                <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-medium"><FileX size={36} className="mx-auto mb-2 text-slate-300" />Bộ lọc này không dính đơn rủi ro nào ông ơi!</td></tr>
              ) : (
                orders.map(order => {
                  const statusText = STATUS_MAP[order.status] || `Mã lạ (${order.status})`;
                  const formattedDate = new Date(order.created_at).toLocaleString('vi-VN');

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 font-black text-blue-600 tracking-wide">{order.id}</td>
                      
                      {/* ⚡️ RENDER CHI TIẾT TÊN NHÀ XE CÓ ICON ĐẸP MẮT */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                          <Truck size={13} className="text-slate-400" />
                          <span>{order.carrier_name || <span className="text-slate-300 font-normal">Chưa rõ bưu cục</span>}</span>
                        </div>
                      </td>

                      <td className="p-4 text-slate-900 font-bold">{order.carrier_code || <span className="text-slate-300 font-normal">Chưa có mã</span>}</td>
                      <td className="p-4 text-slate-400 font-medium">{formattedDate}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-800 font-black">
                          <User size={12} className="text-slate-400" />
                          <span>{order.created_by_name || <span className="text-slate-300 font-normal">Hệ thống</span>}</span>
                        </div>
                      </td>
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

        {/* 4. ĐIỀU KHIỂN PHÂN TRANG */}
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