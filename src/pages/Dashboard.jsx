import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Calendar, Printer, Truck, Layers, 
  Package, X, Eye, AlertTriangle 
} from 'lucide-react';

// BẢNG TỪ ĐIỂN MÃ TRẠNG THÁI CHUẨN NHANH.VN
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

// Danh sách mã trạng thái định nghĩa là ĐƠN HỦY
const CANCELED_STATUS_CODES = [58, 63, 64];

// ⚡️ DANH SÁCH MÃ TRẠNG THÁI ĐỊNH NGHĨA LÀ ĐÃ KHỞI HÀNH (ĐANG CHUYỂN / THÀNH CÔNG...)
const DISPATCHED_STATUS_CODES = [59, 60, 61, 71, 72];

export default function Dashboard() {
  // --- STATES QUẢN LÝ THỜI GIAN & LOADING ---
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getFirstDayOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const [startDate, setStartDate] = useState(getFirstDayOfMonthStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [topProductLimit, setTopProductLimit] = useState(5);

  // --- STATES QUẢN LÝ POPUP MODAL ---
  const [selectedModalDate, setSelectedModalDate] = useState(null);
  const [modalOrdersList, setModalOrdersList] = useState([]);

  // --- API PHÂN TRANG KÉO DATA TỪ SUPABASE ---
  const fetchReportData = async () => {
    setLoading(true);
    try {
      let fetchedOrders = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id, created_at, carrier_code, carrier_date, printed_at, status,
            order_products (product_code, product_name, quantity)
          `)
          .or(`printed_at.gte.${startDate}T00:00:00Z,carrier_date.gte.${startDate}T00:00:00Z,created_at.gte.${startDate}T00:00:00Z`)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          fetchedOrders = [...fetchedOrders, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }
      setOrders(fetchedOrders);
    } catch (err) {
      console.error("❌ Lỗi load báo cáo:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate]);

  const formatDateStr = (isoString) => isoString ? isoString.split('T')[0] : null;

  // --- REPORT 1: TƯƠNG QUAN ĐƠN IN VÀ ĐƠN ĐI THEO NGÀY ---
  const generateChartData = () => {
    const chartMap = new Map();
    let start = new Date(startDate);
    const end = new Date(endDate);
    while (start <= end) {
      const dateStr = start.toISOString().split('T')[0];
      chartMap.set(dateStr, { date: dateStr, 'Đơn in': 0, 'Đơn đi': 0 });
      start.setDate(start.getDate() + 1);
    }

    orders.forEach(order => {
      const pDate = formatDateStr(order.printed_at);
      const sDate = formatDateStr(order.carrier_date);

      if (pDate && chartMap.has(pDate)) {
        chartMap.get(pDate)['Đơn in'] += 1;
      }
      if (sDate && chartMap.has(sDate)) {
        chartMap.get(sDate)['Đơn đi'] += 1;
      }
    });
    return Array.from(chartMap.values());
  };

  // --- REPORT 2: ĐƠN ĐÃ IN NHƯNG CHƯA ĐI HÀNG (TÍCH HỢP TÍNH TOÁN ĐƠN ĐANG CHUYỂN TRÊN SÀN) ---
  const generatePendingShippingData = () => {
    const pendingMap = new Map();

    orders.forEach(order => {
      if (order.printed_at && !order.carrier_date) {
        const pDate = formatDateStr(order.printed_at);
        if (pDate && pDate >= startDate && pDate <= endDate) {
          if (!pendingMap.has(pDate)) pendingMap.set(pDate, []);
          pendingMap.get(pDate).push(order);
        }
      }
    });

    return Array.from(pendingMap.entries())
      .map(([date, list]) => {
        const canceledCount = list.filter(o => CANCELED_STATUS_CODES.includes(Number(o.status))).length;
        // ⚡️ THUẬT TOÁN ĐẾM ĐƠN ĐÃ ĐI THỰC TẾ (Nhưng thiếu log sheet xe)
        const dispatchedCount = list.filter(o => DISPATCHED_STATUS_CODES.includes(Number(o.status))).length;
        return { 
          date, 
          count: list.length, 
          canceledCount, 
          dispatchedCount,
          ordersList: list 
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  // --- REPORT 3: TOP SẢN PHẨM ĐI HÀNG ---
  const generateTopProductsData = () => {
    const productMap = new Map();

    orders.forEach(order => {
      const sDate = formatDateStr(order.carrier_date);
      if (sDate && sDate >= startDate && sDate <= endDate && order.order_products) {
        order.order_products.forEach(p => {
          const code = p.product_code?.trim() || 'CHƯA_RÕ';
          const name = p.product_name || 'Sản phẩm không tên';
          const qty = Number(p.quantity || 0);

          if (!productMap.has(code)) {
            productMap.set(code, { code, name, quantity: 0 });
          }
          productMap.get(code).quantity += qty;
        });
      }
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, topProductLimit);
  };

  const chartData = generateChartData();
  const pendingShippingData = generatePendingShippingData();
  const topProductsData = generateTopProductsData();

  const totalPrintedInRange = chartData.reduce((sum, item) => sum + item['Đơn in'], 0);
  const totalShippedInRange = chartData.reduce((sum, item) => sum + item['Đơn đi'], 0);
  const totalPendingNow = pendingShippingData.reduce((sum, item) => sum + item.count, 0);
  const totalCanceledNow = pendingShippingData.reduce((sum, item) => sum + item.canceledCount, 0);
  // Tổng số đơn đã chuyển ảo trong kỳ lọc kpi đầu trang
  const totalDispatchedNow = pendingShippingData.reduce((sum, item) => sum + item.dispatchedCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8 pb-16">
        
        {/* HEADER & THANH BỘ LỌC NGÀY */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] gap-4 transition-shadow hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Báo cáo đơn đi hàng ngày</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">DESIGNED AND DEVELOPED BY VINH</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md border border-white/40 p-2.5 rounded-2xl shadow-sm w-full md:w-auto">
            <Calendar size={18} className="text-gray-400 ml-1.5" />
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer" 
            />
            <span className="text-gray-300 font-bold text-sm px-1">đến</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer" 
            />
          </div>
        </div>

        {/* KHỐI THẺ KPI CHÈN CHÚ THÍCH ĐA CHIỀU */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* KPI Card 1 */}
          <div className="p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex items-center gap-5 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
            <div className="p-4 bg-blue-100/70 backdrop-blur-md rounded-2xl text-blue-600 shadow-sm">
              <Printer size={24} />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng đơn đã in</span>
              <h4 className="text-3xl font-bold text-gray-900 mt-1">{loading ? "..." : totalPrintedInRange} <span className="text-base font-medium text-gray-400">đơn</span></h4>
            </div>
          </div>

          {/* KPI Card 2 */}
          <div className="p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex items-center gap-5 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
            <div className="p-4 bg-emerald-100/70 backdrop-blur-md rounded-2xl text-emerald-600 shadow-sm">
              <Truck size={24} />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng đơn đã đi</span>
              <h4 className="text-3xl font-bold text-gray-900 mt-1">{loading ? "..." : totalShippedInRange} <span className="text-base font-medium text-gray-400">đơn</span></h4>
            </div>
          </div>

          {/* KPI Card 3 */}
          <div className="p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex items-center gap-5 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
            <div className="p-4 bg-amber-100/70 backdrop-blur-md rounded-2xl text-amber-600 shadow-sm">
              <Layers size={24} />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Số lượng đơn tồn</span>
              <div className="text-3xl font-bold text-amber-600 mt-1 flex flex-wrap items-baseline gap-x-2">
                <span>{loading ? "..." : totalPendingNow}</span>
                <span className="text-base font-medium text-gray-400">đơn</span>
              </div>
              {/* Bộ nhãn cảnh báo động ở thẻ KPI chính */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {totalCanceledNow > 0 && (
                  <span className="text-[11px] font-bold text-red-600 bg-red-50/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-red-100/50">
                    🚫 {totalCanceledNow} đơn hủy
                  </span>
                )}
                {totalDispatchedNow > 0 && (
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-blue-100/50">
                    📦 {totalDispatchedNow} đã khởi hành
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 1. BIỂU ĐỒ BIẾN ĐỘNG */}
        <div className="p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
          <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-6 flex items-center gap-2">
            <div className="w-1.5 h-5 bg-blue-600 rounded-full" /> Tương quan Đơn in và Đơn đi thực tế
          </h3>
          <div className="w-full h-80">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold animate-pulse text-sm">Đang quét phân trang dữ liệu...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.9)', 
                      backdropFilter: 'blur(12px)',
                      borderRadius: '16px', 
                      color: '#0f172a', 
                      fontSize: '12px', 
                      fontWeight: 'bold',
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Bar dataKey="Đơn in" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28} />
                  <Bar dataKey="Đơn đi" fill="#10b981" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* KHỐI CHIA ĐÔI DƯỚI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 2. BẢNG THỐNG KÊ ĐƠN TỒN PHÂN LOẠI CHI TIẾT */}
          <div className="p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col h-[480px] transition-shadow hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1.5 h-5 bg-amber-500 rounded-full" /> Danh sách Đơn đã in nhưng chưa đi
            </h3>
            <div className="flex-1 overflow-y-auto rounded-2xl border border-white/30 bg-white/40 backdrop-blur-sm shadow-inner">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-white/60 backdrop-blur-md text-gray-500 font-bold text-xs uppercase">
                    <th className="p-4">Ngày in</th>
                    <th className="p-4 text-center">Đơn tồn và trạng thái</th>
                    <th className="p-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/70 font-semibold text-gray-700">
                  {loading ? (
                    <tr><td colSpan={3} className="text-center p-10 text-gray-400 animate-pulse text-xs">Đang bóc tách số liệu...</td></tr>
                  ) : pendingShippingData.length === 0 ? (
                    <tr><td colSpan={3} className="text-center p-10 text-gray-400 text-sm">🎉 Không có đơn tồn đọng nào.</td></tr>
                  ) : (
                    pendingShippingData.map(item => (
                      <tr key={item.date} className="hover:bg-white/50 transition-colors duration-200">
                        <td className="p-4 text-sm font-bold text-gray-900">{item.date}</td>
                        <td className="p-4 text-center flex flex-col items-center justify-center gap-1.5 py-3">
                          <span className="px-3 py-1 bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 text-amber-700 rounded-full text-xs font-bold shadow-sm">
                            {item.count} đơn tổng tồn
                          </span>
                          
                          {/* ⚡️ KHỐI HIỂN THỊ CHÚ THÍCH PHÂN LOẠI NGÀY HÀNG */}
                          <div className="flex gap-1.5 flex-wrap justify-center">
                            {item.canceledCount > 0 && (
                              <span className="px-2 py-0.5 bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-600 rounded-full text-[11px] font-bold flex items-center gap-1">
                                🚫 {item.canceledCount} Hủy
                              </span>
                            )}
                            {item.dispatchedCount > 0 && (
                              <span className="px-2 py-0.5 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 text-blue-600 rounded-full text-[11px] font-bold flex items-center gap-1">
                                🚚 {item.dispatchedCount} Đang chuyển
                              </span>
                            )}
                            {/* Tính toán con số đơn thực sự còn nằm chết gí ở kho
                            {item.count - item.canceledCount - item.dispatchedCount > 0 && (
                              <span className="px-2 py-0.5 bg-gray-100/80 backdrop-blur-sm border border-gray-200/50 text-gray-700 rounded-full text-[11px] font-bold">
                                📦 {item.count - item.canceledCount - item.dispatchedCount} Nằm tại kho
                              </span>
                            )} */}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => { setSelectedModalDate(item.date); setModalOrdersList(item.ordersList); }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
                          >
                            <Eye size={13} /> Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. BÁO CÁO TOP SẢN PHẨM CO GIÃN ĐỘNG */}
          <div className="p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col h-[480px] transition-shadow hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <div className="w-1.5 h-5 bg-emerald-500 rounded-full" /> Top {topProductLimit} Sản phẩm xuất kho nhiều nhất
              </h3>
              
              <select 
                value={topProductLimit} 
                onChange={(e) => setTopProductLimit(Number(e.target.value))}
                className="text-xs font-bold bg-white/80 backdrop-blur-md border border-white/30 rounded-xl px-3 py-2 outline-none text-gray-700 cursor-pointer hover:bg-white/90 transition shadow-sm"
              >
                <option value={5}>Xem Top 5</option>
                <option value={10}>Xem Top 10</option>
                <option value={20}>Xem Top 20</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1">
              {loading ? (
                <div className="text-center text-gray-400 animate-pulse text-sm py-10">Đang sắp xếp kho hàng...</div>
              ) : topProductsData.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">Chưa có sản phẩm xuất kho.</div>
              ) : (
                topProductsData.map((prod, idx) => {
                  const maxQty = topProductsData[0]?.quantity || 1;
                  const progressPercent = (prod.quantity / maxQty) * 100;
                  
                  return (
                    <div key={prod.code} className="space-y-1.5">
                      <div className="flex justify-between items-start text-xs font-bold">
                        <div className="flex items-center gap-3 max-w-[80%]">
                          <span className="w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm flex items-center justify-center text-gray-500 font-black text-[11px]">{idx + 1}</span>
                          <div className="flex flex-col truncate">
                            <span className="text-gray-900 truncate font-semibold text-sm">{prod.name}</span>
                            <span className="text-[11px] text-gray-400 font-medium mt-0.5">SKU: {prod.code}</span>
                          </div>
                        </div>
                        <span className="text-gray-900 font-bold bg-white/70 backdrop-blur-sm border border-white/30 px-2.5 py-0.5 rounded-full shadow-sm text-sm">{prod.quantity} <span className="text-[11px] text-gray-400 font-medium">cái</span></span>
                      </div>
                      <div className="w-full bg-gray-100/70 backdrop-blur-sm h-2.5 rounded-full overflow-hidden border border-white/30">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-700 ease-out" 
                          style={{ width: `${progressPercent}%` }} 
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>

        {/* 4. POPUP MODAL CHI TIẾT - HIỂN THỊ TRẠNG THÁI CHỮ & LOGIC BADGE MÀU ĐỘNG */}
        {selectedModalDate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white/90 backdrop-blur-xl w-full max-w-4xl rounded-3xl border border-white/40 shadow-2xl flex flex-col max-h-[85vh] animate-scale-up">
              
              <div className="p-6 border-b border-white/30 flex justify-between items-center bg-white/60 backdrop-blur-md rounded-t-3xl">
                <div>
                  <h4 className="text-lg font-bold text-gray-900">Chi tiết đơn tồn ngày in: {selectedModalDate}</h4>
                  <p className="text-sm text-gray-500 font-medium mt-1">Tìm thấy {modalOrdersList.length} đơn hàng đã in mã vận đơn nhưng chưa đi hàng</p>
                </div>
                <button 
                  onClick={() => { setSelectedModalDate(null); setModalOrdersList([]); }} 
                  className="p-2 text-gray-400 hover:text-gray-700 transition rounded-full hover:bg-white/80 backdrop-blur-sm cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-white/70 backdrop-blur-md text-gray-500 font-bold uppercase text-xs">
                      <th className="p-4 rounded-l-xl">ID Đơn</th>
                      <th className="p-4">Mã vận đơn</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4 text-right rounded-r-xl">Sản phẩm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/70 font-semibold text-gray-700">
                    {modalOrdersList.map(order => {
                      const statusNum = Number(order.status);
                      const isCanceled = CANCELED_STATUS_CODES.includes(statusNum);
                      // Kiểm tra xem đơn thuộc diện đã đi hàng ảo trên sàn chưa
                      const isDispatched = DISPATCHED_STATUS_CODES.includes(statusNum);
                      
                      const statusText = STATUS_MAP[order.status] || `Mã lạ (${order.status})`;

                      // Thiết lập màu sắc linh hoạt cho từng khối trạng thái chữ
                      let badgeClass = "bg-gray-50/80 border-gray-200/50 text-gray-600";
                      if (isCanceled) {
                        badgeClass = "bg-red-50/80 border-red-200/50 text-red-600";
                      } else if (isDispatched) {
                        badgeClass = "bg-blue-50/80 border-blue-200/50 text-blue-600";
                      } else if (statusNum === 40 || statusNum === 42 || statusNum === 43) {
                        badgeClass = "bg-amber-50/80 border-amber-200/50 text-amber-700";
                      }

                      return (
                        <tr key={order.id} className={`hover:bg-white/50 transition-colors duration-200 ${isCanceled ? 'opacity-65 bg-white/30' : ''}`}>
                          <td className="p-4 font-bold text-blue-600">{order.id}</td>
                          <td className="p-4 text-gray-900">{order.carrier_code || "❌ Chưa có mã"}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm ${badgeClass}`}>
                              {isCanceled ? `🚫 ${statusText}` : isDispatched ? `🚚 ${statusText}` : statusText}
                            </span>
                          </td>
                          <td className="p-4 text-right font-medium text-gray-500 max-w-[240px] truncate">
                            {order.order_products && order.order_products.length > 0 ? (
                              order.order_products.map(p => `${p.product_name} (x${p.quantity})`).join(', ')
                            ) : (
                              <span className="text-gray-400 text-[11px]">Trống sản phẩm</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-5 border-t border-white/30 bg-white/60 backdrop-blur-md rounded-b-3xl flex justify-end">
                <button 
                  onClick={() => { setSelectedModalDate(null); setModalOrdersList([]); }} 
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
                >
                  Đóng hộp thoại
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}