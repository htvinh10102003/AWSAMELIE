import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserCog, Loader2, CheckCircle2, AlertCircle, Search, Calendar, Check, Filter, RefreshCw, Users, Package, Truck } from 'lucide-react';

const NHANH_STATUS_MAP = {
  '40': 'Đã đóng gói', '42': 'Đang đóng gói', '43': 'Chờ thu gom', '54': 'Đơn mới',
  '55': 'Đang xác nhận', '56': 'Đã xác nhận', '57': 'Chờ khách xác nhận',
  '58': 'Hãng vận chuyển hủy đơn', '59': 'Đang chuyển', '60': 'Thành công',
  '61': 'Thất bại', '63': 'Khách hủy', '64': 'Hệ thống hủy', '68': 'Hết hàng',
  '71': 'Đang chuyển hoàn', '72': 'Đã chuyển hoàn', '73': 'Đổi kho xuất hàng', '74': 'Xác nhận hoàn',
};

export default function UpdatePacker() {
  const [orders, setOrders] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchId, setSearchId] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCarrier, setFilterCarrier] = useState('all');
  const [filterAssignment, setFilterAssignment] = useState('all');

  const [localSelections, setLocalSelections] = useState({});
  
  // ⚡️ State phục vụ việc cào log lịch sử tự động từ Nhanh.vn
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);

  useEffect(() => {
    loadDynamicStaff();
  }, []);

  useEffect(() => {
    fetchPackerOrders();
  }, [selectedDate]);

  const loadDynamicStaff = async () => {
    const { data } = await supabase.from('warehouse_staff').select('full_name').order('full_name');
    if (data) setStaffList(data.map(s => s.full_name));
  };

  // Thay thế ruột hàm fetchPackerOrders trong file UpdatePacker.jsx
  const fetchPackerOrders = async () => {
    setLoading(true);
    setMessage('');
    try {
      const startOfDay = `${selectedDate}T00:00:00.000Z`;
      const endOfDay = `${selectedDate}T23:59:59.999Z`;

      const { data, error } = await supabase
        .from('orders')
        .select('id, status, packed_at, packed_by_name, carrier_name')
        .not('packed_at', 'is', null)
        .gte('packed_at', startOfDay) 
        .lte('packed_at', endOfDay)
        .order('packed_at', { ascending: false });

      if (error) throw error;
      
      // ⚡️ BƯỚC LỌC MỚI: Đuổi cổ đơn Đang đóng gói (42), Đơn mới (54)... ra khỏi danh sách gán tay
      const ALLOWED_STATUSES = ['40', '43', '59', '60', '61', '71', '72', '74'];
      const validOrders = data ? data.filter(o => ALLOWED_STATUSES.includes(String(o.status))) : [];
      
      setOrders(validOrders); // Chỉ nạp các đơn thực sự hợp lệ lên bảng UI
      
      const initialSelections = {};
      validOrders.forEach(o => { if (o.packed_by_name) initialSelections[o.id] = o.packed_by_name; });
      setLocalSelections(initialSelections);
    } catch (err) {
      setMessage(`❌ Lỗi tải dữ liệu: ${err.message}`);
    } finally { setLoading(false); }
  };

  // ⚡️ HÀM CÀO TỰ ĐỘNG LOG LỊCH SỬ CHO NGÀY ĐANG CHỌN
  const handleAutoSyncFromHistory = async () => {
    setIsSyncingHistory(true);
    setMessage(`⏳ Đang truy vết log hệ thống Nhanh.vn để khôi phục nhân sự ngày ${selectedDate}...`);
    
    try {
      // Thuật toán tự động tính toán số ngày lùi lại (offset) dựa trên ngày đang chọn trên lịch
      const today = new Date();
      const selected = new Date(selectedDate);
      const diffTime = today.getTime() - selected.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const daysParam = diffDays < 1 ? 1 : diffDays; // Đảm bảo tối thiểu cào 1 ngày

      const projectUrl = "https://infljrayvhidhfimksfp.supabase.co";
      const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZmxqcmF5dmhpZGhmaW1rc2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzAyNjksImV4cCI6MjA5NjkwNjI2OX0.ap1UnciJ5OccAvC-l5sm-JGqObTkEC038Kjf2L_IFr0";

      const res = await fetch(`${projectUrl}/functions/v1/sync-packer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({ daysToSync: Number(daysParam) })
      });

      const textData = await res.text();
      let data;
      try { data = JSON.parse(textData); } catch(e) { throw new Error(`Server lỗi: ${textData}`); }

      if (!res.ok) throw new Error(data.error || `Lỗi kết nối: ${res.status}`);

      if (data && data.success) {
        setMessage(`✅ Hoàn tất vá log tự động! Đã khôi phục thành công ${data.totalFixed} đơn hàng.`);
        // ⚡️ Kéo lại data bảng ngay lập tức để đồng bộ thông tin mới về UI
        await fetchPackerOrders();
      } else {
        throw new Error(data?.error || 'Lỗi xử lý luồng lịch sử');
      }

    } catch (err) {
      console.error(err);
      setMessage(`❌ Thất bại khi cào log tự động: ${err.message}`);
    } finally {
      setIsSyncingHistory(false);
    }
  };

  const handleUpdateSingleOrder = async (orderId) => {
    const packerName = localSelections[orderId];
    if (!packerName) return;

    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ packed_by_name: packerName })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, packed_by_name: packerName } : o));
      setMessage(`✅ Đã cập nhật nhân sự [${packerName}] cho đơn hàng ${orderId}`);
    } catch (err) {
      setMessage(`❌ Lỗi lưu dữ liệu: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const uniqueCarriers = [...new Set(orders.map(o => o.carrier_name).filter(Boolean))];
  const uniqueStatuses = [...new Set(orders.map(o => o.status).filter(Boolean))];

  const filteredOrders = orders.filter(order => {
    const matchesId = order.id.toLowerCase().includes(searchId.toLowerCase().trim());
    const matchesStatus = filterStatus === 'all' || String(order.status) === filterStatus;
    const matchesCarrier = filterCarrier === 'all' || order.carrier_name === filterCarrier;
    
    let matchesAssignment = true;
    if (filterAssignment === 'assigned') matchesAssignment = !!order.packed_by_name;
    if (filterAssignment === 'unassigned') matchesAssignment = !order.packed_by_name;

    return matchesId && matchesStatus && matchesCarrier && matchesAssignment;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER CHUYÊN NGHIỆP */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <UserCog size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Hiệu chỉnh người đóng gói</h1>
                <p className="text-indigo-100 text-sm mt-1">Kiểm tra & phân công lại nhân sự đóng gói cho các đơn hàng đã quét</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* BỘ CHỌN NGÀY VẬN HÀNH */}
              <div className="flex items-center bg-white/15 rounded-xl px-4 py-2 backdrop-blur-sm">
                <Calendar size={18} className="text-white mr-2" />
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer [color-scheme:dark]"
                />
              </div>

              {/* ⚡️ NÚT CÀO LOG TỰ ĐỘNG CHỐNG MISS DATA MỚI TÍCH HỢP */}
              <button
                onClick={handleAutoSyncFromHistory}
                disabled={isSyncingHistory || loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSyncingHistory ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Tự động vá log ngày này
              </button>

              <button 
                onClick={fetchPackerOrders}
                disabled={loading || isSyncingHistory}
                className="p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition-colors backdrop-blur-sm cursor-pointer disabled:opacity-50"
                title="Làm mới bảng"
              >
                <RefreshCw size={20} className="text-white" />
              </button>
            </div>
          </div>
          
          {/* STATS BAR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50/80">
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
              <Package size={20} className="text-indigo-500" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Tổng đơn</p>
                <p className="text-lg font-bold text-slate-800">{orders.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
              <Users size={20} className="text-emerald-500" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Đã gán</p>
                <p className="text-lg font-bold text-emerald-600">{orders.filter(o => o.packed_by_name).length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
              <AlertCircle size={20} className="text-amber-500" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Chưa gán</p>
                <p className="text-lg font-bold text-amber-600">{orders.filter(o => !o.packed_by_name).length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
              <Truck size={20} className="text-blue-500" />
              <div>
                <p className="text-xs text-slate-500 font-medium">ĐVVC</p>
                <p className="text-lg font-bold text-blue-600">{uniqueCarriers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* BỘ LỌC NÂNG CAO */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Bộ lọc tìm kiếm</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Tìm mã đơn hàng..."
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">📋 Tất cả trạng thái</option>
              {uniqueStatuses.map(st => (
                <option key={st} value={st}>{NHANH_STATUS_MAP[st] || st}</option>
              ))}
            </select>

            <select 
              value={filterCarrier} 
              onChange={e => setFilterCarrier(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">🚚 Tất cả đơn vị vận chuyển</option>
              {uniqueCarriers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select 
              value={filterAssignment} 
              onChange={e => setFilterAssignment(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">🔍 Tất cả phân công</option>
              <option value="assigned">✅ Đã có người đóng</option>
              <option value="unassigned">❌ Chưa có người đóng</option>
            </select>
          </div>
        </div>

        {/* THÔNG BÁO */}
        {message && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium animate-fadeIn ${
            message.includes('✅') 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : message.includes('❌') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {message.includes('✅') ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-amber-500" />}
            {message}
          </div>
        )}

        {/* BẢNG DỮ LIỆU */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-indigo-500" />
              <span className="text-sm font-bold text-slate-700">
                Danh sách đơn hàng <span className="text-indigo-600">({filteredOrders.length})</span>
              </span>
            </div>
            {filteredOrders.length > 0 && !loading && (
              <div className="text-xs text-slate-500 font-medium">
                Hiển thị đơn hàng đã quét đóng gói trong ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 size={36} className="animate-spin text-indigo-500" />
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-transparent animate-spin"></div>
              </div>
              <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu đơn hàng...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="p-4 bg-slate-100 rounded-full">
                <Package size={36} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">Không tìm thấy đơn hàng nào phù hợp</p>
              <p className="text-xs text-slate-400">Thử thay đổi bộ lọc hoặc chọn ngày khác</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 pl-6 pr-4">Mã đơn hàng</th>
                    <th className="py-3.5 px-4">Thời gian quét</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4">Đơn vị VC</th>
                    <th className="py-3.5 pr-6 pl-4 text-center">Nhân sự đóng gói</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(order => (
                    <tr 
                      key={order.id} 
                      className={`group transition-colors ${
                        !order.packed_by_name 
                          ? 'bg-amber-50/50 hover:bg-amber-50' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-4 pl-6 pr-4">
                        <span className="text-sm font-bold text-indigo-600 tracking-tight">{order.id}</span>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {new Date(order.packed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${
                          String(order.status) === '40' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : String(order.status) === '42' 
                            ? 'bg-blue-100 text-blue-700' 
                            : String(order.status) === '60' 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {NHANH_STATUS_MAP[String(order.status)] || order.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm font-medium text-slate-700">
                        {order.carrier_name || '---'}
                      </td>
                      <td className="py-4 pr-6 pl-4">
                        <div className="flex items-center justify-center gap-2">
                          <select
                            value={localSelections[order.id] || ""}
                            onChange={(e) => setLocalSelections({ ...localSelections, [order.id]: e.target.value })}
                            disabled={updatingId === order.id}
                            className={`min-w-[140px] py-2 px-3 rounded-xl text-sm font-medium border outline-none transition-all cursor-pointer ${
                              order.packed_by_name 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 focus:ring-2 focus:ring-emerald-500' 
                                : 'bg-white text-slate-700 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                          >
                            <option value="" disabled>-- Chưa gán --</option>
                            {staffList.map(staff => (
                              <option key={staff} value={staff}>{staff}</option>
                            ))}
                          </select>
                          
                          <button
                            onClick={() => handleUpdateSingleOrder(order.id)}
                            disabled={updatingId === order.id || localSelections[order.id] === order.packed_by_name}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 disabled:cursor-not-allowed cursor-pointer"
                            title="Lưu thay đổi"
                          >
                            {updatingId === order.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Check size={16} strokeWidth={2.5} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}