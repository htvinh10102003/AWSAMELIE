import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  Calendar, Printer, Truck, Layers, 
  Package, X, Eye, AlertTriangle 
} from 'lucide-react';

const STATUS_MAP = {
  40: 'Đã đóng gói', 42: 'Đang đóng gói', 43: 'Chờ thu gom',
  54: 'Đơn mới', 55: 'Đang xác nhận', 56: 'Đã xác nhận', 57: 'Chờ khách xác nhận',
  58: 'Hãng vận chuyển hủy đơn', 59: 'Đang chuyển', 60: 'Thành công', 61: 'Thất bại',
  63: 'Khách hủy', 64: 'Hệ thống hủy', 68: 'Hết hàng',
  71: 'Đang chuyển hoàn', 72: 'Đã chuyển hoàn', 73: 'Đổi kho xuất hàng', 74: 'Xác nhận hoàn'
};

const CANCELED_STATUS_CODES = [58, 63, 64];
const DISPATCHED_STATUS_CODES = [59, 60, 61, 71, 72];

export default function Dashboard() {
  // ⚡️ TỐI ƯU 1: Lấy mặc định 7 ngày gần nhất cho nhẹ Database
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getLast7DaysStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6); // Lùi 6 ngày + hôm nay = 7 ngày
    return d.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getLast7DaysStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [topProductLimit, setTopProductLimit] = useState(5);

  const [selectedModalDate, setSelectedModalDate] = useState(null);
  const [modalOrdersList, setModalOrdersList] = useState([]);

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
          if (data.length < pageSize) hasMore = false;
          else page++;
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
      if (pDate && chartMap.has(pDate)) chartMap.get(pDate)['Đơn in'] += 1;
      if (sDate && chartMap.has(sDate)) chartMap.get(sDate)['Đơn đi'] += 1;
    });
    return Array.from(chartMap.values());
  };

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
        const dispatchedCount = list.filter(o => DISPATCHED_STATUS_CODES.includes(Number(o.status))).length;
        return { date, count: list.length, canceledCount, dispatchedCount, ordersList: list };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const generateTopProductsData = () => {
    const productMap = new Map();
    orders.forEach(order => {
      const sDate = formatDateStr(order.carrier_date);
      if (sDate && sDate >= startDate && sDate <= endDate && order.order_products) {
        order.order_products.forEach(p => {
          const code = p.product_code?.trim() || 'CHƯA_RÕ';
          const name = p.product_name || 'Sản phẩm không tên';
          const qty = Number(p.quantity || 0);
          if (!productMap.has(code)) productMap.set(code, { code, name, quantity: 0 });
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
  const totalDispatchedNow = pendingShippingData.reduce((sum, item) => sum + item.dispatchedCount, 0);

  // ⚡️ TỐI ƯU 2: Tính toán Trung bình cộng để vẽ line
  const avgPrinted = chartData.length > 0 ? Math.round(totalPrintedInRange / chartData.length) : 0;
  const avgShipped = chartData.length > 0 ? Math.round(totalShippedInRange / chartData.length) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-3 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-16 animate-in fade-in duration-300">
        
        {/* HEADER & THANH BỘ LỌC NGÀY (Responsive) */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-5 sm:p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-sm gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Báo cáo đơn đi hàng ngày</h2>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">DESIGNED AND DEVELOPED BY VINH</p>
          </div>
          
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 bg-white/80 backdrop-blur-md border border-white/40 p-2 sm:p-2.5 rounded-2xl shadow-sm w-full lg:w-auto">
            <Calendar size={18} className="text-gray-400 ml-1.5 hidden sm:block" />
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="flex-1 bg-transparent text-xs sm:text-sm font-semibold text-gray-700 outline-none cursor-pointer" 
            />
            <span className="text-gray-300 font-bold text-xs sm:text-sm px-1">đến</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="flex-1 bg-transparent text-xs sm:text-sm font-semibold text-gray-700 outline-none cursor-pointer" 
            />
          </div>
        </div>

        {/* KHỐI THẺ KPI (Responsive Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-5 sm:p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-sm flex items-center gap-4 sm:gap-5 transition-transform hover:-translate-y-1">
            <div className="p-3 sm:p-4 bg-blue-100/70 rounded-2xl text-blue-600 shadow-sm shrink-0">
              <Printer size={24} />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng đơn đã in</span>
              <h4 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{loading ? "..." : totalPrintedInRange} <span className="text-sm sm:text-base font-medium text-gray-400">đơn</span></h4>
            </div>
          </div>

          <div className="p-5 sm:p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-sm flex items-center gap-4 sm:gap-5 transition-transform hover:-translate-y-1">
            <div className="p-3 sm:p-4 bg-emerald-100/70 rounded-2xl text-emerald-600 shadow-sm shrink-0">
              <Truck size={24} />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Tổng đơn đã đi</span>
              <h4 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{loading ? "..." : totalShippedInRange} <span className="text-sm sm:text-base font-medium text-gray-400">đơn</span></h4>
            </div>
          </div>

          <div className="p-5 sm:p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-sm flex items-center gap-4 sm:gap-5 transition-transform hover:-translate-y-1 sm:col-span-2 lg:col-span-1">
            <div className="p-3 sm:p-4 bg-amber-100/70 rounded-2xl text-amber-600 shadow-sm shrink-0">
              <Layers size={24} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Số lượng đơn tồn</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1 flex items-baseline gap-x-2">
                <span>{loading ? "..." : totalPendingNow}</span>
                <span className="text-sm sm:text-base font-medium text-gray-400">đơn</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {totalCanceledNow > 0 && <span className="text-[10px] sm:text-[11px] font-bold text-red-600 bg-red-50/80 px-2 py-0.5 rounded-full border border-red-100/50">🚫 {totalCanceledNow} hủy</span>}
                {totalDispatchedNow > 0 && <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded-full border border-blue-100/50">📦 {totalDispatchedNow} đã đi</span>}
              </div>
            </div>
          </div>
        </div>

        {/* 1. BIỂU ĐỒ BIẾN ĐỘNG (CÓ ĐƯỜNG TRUNG BÌNH) */}
        <div className="p-4 sm:p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-sm">
          <h3 className="text-sm sm:text-base font-bold text-gray-800 uppercase tracking-wider mb-6 flex items-center gap-2">
            <div className="w-1.5 h-5 bg-blue-600 rounded-full" /> Tương quan Đơn in và Đơn đi
          </h3>
          <div className="w-full h-64 sm:h-80 -ml-2 sm:ml-0">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold animate-pulse text-xs sm:text-sm">Đang quét phân trang dữ liệu...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                  
                  {/* ⚡️ ĐƯỜNG TRUNG BÌNH ĐƠN IN */}
                  <ReferenceLine 
                    y={avgPrinted} 
                    stroke="#3b82f6" 
                    strokeDasharray="4 4" 
                    opacity={0.6}
                    label={{ position: 'insideTopLeft', value: `TB In: ${avgPrinted}`, fill: '#3b82f6', fontSize: 10, fontWeight: 800 }} 
                  />
                  {/* ⚡️ ĐƯỜNG TRUNG BÌNH ĐƠN ĐI */}
                  <ReferenceLine 
                    y={avgShipped} 
                    stroke="#10b981" 
                    strokeDasharray="4 4" 
                    opacity={0.6}
                    label={{ position: 'insideTopRight', value: `TB Đi: ${avgShipped}`, fill: '#10b981', fontSize: 10, fontWeight: 800 }} 
                  />

                  <Bar dataKey="Đơn in" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Đơn đi" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* KHỐI CHIA ĐÔI DƯỚI (Responsive) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          
          {/* 2. BẢNG THỐNG KÊ ĐƠN TỒN */}
          <div className="p-4 sm:p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-sm flex flex-col h-[400px] sm:h-[480px]">
            <h3 className="text-sm sm:text-base font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1.5 h-5 bg-amber-500 rounded-full" /> Đơn đã in chưa đi
            </h3>
            {/* ⚡️ Bọc overflow-x-auto để cuộn ngang trên mobile */}
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-100 bg-white/50">
              <table className="w-full text-left text-sm border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-slate-50/80 sticky top-0 backdrop-blur-md text-gray-500 font-bold text-[10px] sm:text-xs uppercase z-10">
                    <th className="p-3 sm:p-4">Ngày in</th>
                    <th className="p-3 sm:p-4 text-center">Trạng thái tồn</th>
                    <th className="p-3 sm:p-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                  {loading ? (
                    <tr><td colSpan={3} className="text-center p-10 text-gray-400 animate-pulse text-xs">Đang bóc tách số liệu...</td></tr>
                  ) : pendingShippingData.length === 0 ? (
                    <tr><td colSpan={3} className="text-center p-10 text-gray-400 text-xs sm:text-sm">🎉 Không có đơn tồn.</td></tr>
                  ) : (
                    pendingShippingData.map(item => (
                      <tr key={item.date} className="hover:bg-blue-50/30 transition">
                        <td className="p-3 sm:p-4 text-xs sm:text-sm font-bold text-gray-900 whitespace-nowrap">{item.date}</td>
                        <td className="p-3 sm:p-4 text-center flex flex-col items-center gap-1">
                          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200/50 text-amber-700 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap">
                            {item.count} đơn tổng tồn
                          </span>
                          <div className="flex gap-1 flex-wrap justify-center max-w-[150px]">
                            {item.canceledCount > 0 && <span className="text-[9px] sm:text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">🚫 {item.canceledCount}</span>}
                            {item.dispatchedCount > 0 && <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">🚚 {item.dispatchedCount}</span>}
                          </div>
                        </td>
                        <td className="p-3 sm:p-4 text-right">
                          <button 
                            onClick={() => { setSelectedModalDate(item.date); setModalOrdersList(item.ordersList); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] sm:text-xs font-bold shadow-sm transition"
                          >
                            <Eye size={14} /> <span className="hidden sm:inline">Xem</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. BÁO CÁO TOP SẢN PHẨM */}
          <div className="p-4 sm:p-6 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-sm flex flex-col h-[400px] sm:h-[480px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
              <h3 className="text-sm sm:text-base font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <div className="w-1.5 h-5 bg-emerald-500 rounded-full" /> Top {topProductLimit} Xuất kho
              </h3>
              <select 
                value={topProductLimit} 
                onChange={(e) => setTopProductLimit(Number(e.target.value))}
                className="w-full sm:w-auto text-[11px] sm:text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-gray-700 cursor-pointer"
              >
                <option value={5}>Xem Top 5</option>
                <option value={10}>Xem Top 10</option>
                <option value={20}>Xem Top 20</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 py-1">
              {loading ? (
                <div className="text-center text-gray-400 animate-pulse text-xs sm:text-sm py-10">Đang sắp xếp kho hàng...</div>
              ) : topProductsData.length === 0 ? (
                <div className="text-center text-gray-400 text-xs sm:text-sm py-10">Chưa có sản phẩm xuất kho.</div>
              ) : (
                topProductsData.map((prod, idx) => {
                  const maxQty = topProductsData[0]?.quantity || 1;
                  const progressPercent = (prod.quantity / maxQty) * 100;
                  
                  return (
                    <div key={prod.code} className="space-y-1.5">
                      <div className="flex justify-between items-start text-xs font-bold">
                        <div className="flex items-start sm:items-center gap-2 sm:gap-3 max-w-[75%]">
                          <span className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-gray-500 font-black text-[10px] sm:text-[11px] mt-0.5 sm:mt-0">{idx + 1}</span>
                          <div className="flex flex-col truncate">
                            <span className="text-gray-900 truncate font-semibold text-[11px] sm:text-sm">{prod.name}</span>
                            <span className="text-[9px] sm:text-[11px] text-gray-400 font-medium mt-0.5">SKU: {prod.code}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-gray-900 font-black bg-slate-50 border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs sm:text-sm">{prod.quantity} <span className="hidden sm:inline text-[10px] text-gray-400 font-medium">cái</span></span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 sm:h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-700" 
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

        {/* 4. POPUP MODAL (Responsive Table) */}
        {selectedModalDate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in zoom-in-95 duration-200">
            <div className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
              
              <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl sm:rounded-t-3xl">
                <div>
                  <h4 className="text-base sm:text-lg font-black text-slate-800">Chi tiết đơn tồn: {selectedModalDate}</h4>
                  <p className="text-[11px] sm:text-sm text-slate-500 font-medium mt-0.5">Tìm thấy {modalOrdersList.length} đơn hàng</p>
                </div>
                <button 
                  onClick={() => { setSelectedModalDate(null); setModalOrdersList([]); }} 
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* ⚡️ Bọc overflow-x-auto cho bảng trên điện thoại */}
              <div className="flex-1 overflow-auto p-0 sm:p-6">
                <table className="w-full text-left text-[11px] sm:text-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] sm:text-xs sticky top-0 z-10">
                      <th className="p-3 sm:p-4">ID Đơn</th>
                      <th className="p-3 sm:p-4">Mã vận đơn</th>
                      <th className="p-3 sm:p-4">Trạng thái</th>
                      <th className="p-3 sm:p-4 text-right">Sản phẩm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {modalOrdersList.map(order => {
                      const statusNum = Number(order.status);
                      const isCanceled = CANCELED_STATUS_CODES.includes(statusNum);
                      const isDispatched = DISPATCHED_STATUS_CODES.includes(statusNum);
                      const statusText = STATUS_MAP[order.status] || `Mã lạ (${order.status})`;

                      let badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                      if (isCanceled) badgeClass = "bg-red-50 text-red-600 border-red-200";
                      else if (isDispatched) badgeClass = "bg-blue-50 text-blue-600 border-blue-200";
                      else if ([40, 42, 43].includes(statusNum)) badgeClass = "bg-amber-50 text-amber-700 border-amber-200";

                      return (
                        <tr key={order.id} className={`hover:bg-slate-50 transition ${isCanceled ? 'opacity-50' : ''}`}>
                          <td className="p-3 sm:p-4 font-black text-blue-600">{order.id}</td>
                          <td className="p-3 sm:p-4">{order.carrier_code || "❌ Chưa có"}</td>
                          <td className="p-3 sm:p-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-lg text-[9px] sm:text-[10px] uppercase font-black border ${badgeClass}`}>
                              {isCanceled ? `🚫 ${statusText}` : isDispatched ? `🚚 ${statusText}` : statusText}
                            </span>
                          </td>
                          <td className="p-3 sm:p-4 text-right text-[10px] sm:text-xs max-w-[150px] sm:max-w-[240px] truncate">
                            {order.order_products?.length > 0 ? (
                              order.order_products.map(p => `${p.product_name} (x${p.quantity})`).join(', ')
                            ) : (
                              <span className="text-slate-400">Trống</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl sm:rounded-b-3xl flex justify-end">
                <button 
                  onClick={() => { setSelectedModalDate(null); setModalOrdersList([]); }} 
                  className="px-6 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm"
                >
                  Đóng
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}