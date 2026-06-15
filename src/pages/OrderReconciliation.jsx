import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ScanBarcode, Calendar, Trash2, PackagePlus, PackageMinus, AlertCircle, Package, CheckCircle2, XCircle, CheckCircle, Download
} from 'lucide-react';

const STATUS_MAP = {
  40: 'Đã đóng gói', 42: 'Đang đóng gói', 43: 'Chờ thu gom',
  54: 'Đơn mới', 55: 'Đang xác nhận', 56: 'Đã xác nhận',
  57: 'Chờ khách xác nhận', 58: 'Hãng vận chuyển hủy đơn',
  59: 'Đang chuyển', 60: 'Thành công', 61: 'Thất bại',
  63: 'Khách hủy', 64: 'Hệ thống hủy', 68: 'Hết hàng',
  71: 'Đang chuyển hoàn', 72: 'Đã chuyển hoàn', 73: 'Đổi kho xuất hàng', 74: 'Xác nhận hoàn'
};

// ⚡️ BỘ MÃ LOẠI TRỪ: Đã đi hàng hoặc đã đóng gói xong
const EXCLUDED_STATUS_CODES = [40, 43, 59, 60, 61, 71, 72, 74];

// ⚡️ MÃ TRẠNG THÁI HỦY ĐƠN: Khách hủy (63), Hệ thống hủy (64), ĐVVC hủy (58)
const CANCELED_STATUS_CODES = [58, 63, 64];

export default function OrderReconciliation() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  
  const [auditDate, setAuditDate] = useState(getTodayStr());
  const [inputCode, setInputCode] = useState('');
  const [todayOrders, setTodayOrders] = useState([]);
  const [scannedCodes, setScannedCodes] = useState([]);
  
  // 4 Danh sách phân loại hàng hóa đầu ra
  const [correctOrders, setCorrectOrders] = useState([]); // Đơn đúng kẹt lại (Chưa hủy)
  const [canceledOrders, setCanceledOrders] = useState([]); // Đơn quét trúng bị HỦY
  const [surplusOrders, setSurplusOrders] = useState([]); // Đơn hàng thừa (Mã lạ/Đã đi rồi)
  
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // State quản lý âm thanh/banner cảnh báo nhanh khi bắn trúng đơn hủy
  const [alertBanner, setAlertBanner] = useState(null);

  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [scannedCodes, inputCode, alertBanner]);

  const fetchTodayOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, carrier_code, status, printed_at, packed_at, carrier_date,
          order_products (product_code, product_name, quantity)
        `)
        .gte('printed_at', `${auditDate}T00:00:00Z`)
        .lte('printed_at', `${auditDate}T23:59:59Z`);

      if (error) throw error;
      setTodayOrders(data || []);
      setScannedCodes([]);
      setCorrectOrders([]);
      setCanceledOrders([]);
      setSurplusOrders([]);
      setIsConfirmed(false);
      setAlertBanner(null);
    } catch (err) {
      console.error("❌ Lỗi tải đơn hàng đối soát:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayOrders();
  }, [auditDate]);

  // Danh sách gốc các đơn bắt buộc kho phải trả về (Chưa xử lý xong hoặc bị kẹt/hủy)
  const baselineOrders = todayOrders.filter(o => !EXCLUDED_STATUS_CODES.includes(Number(o.status)));

  // --- XỬ LÝ KHI SÚNG BẮN QUÉT MÃ ---
  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const code = inputCode.trim();
    if (!code) return;

    if (scannedCodes.includes(code)) {
      alert(`⚠️ Mã [${code}] này ông đã bắn quét rồi!`);
      setInputCode('');
      return;
    }

    setAlertBanner(null); // Reset lại banner cảnh báo trước đó
    setScannedCodes(prev => [...prev, code]);
    setInputCode('');

    // Tìm xem đơn có nằm trong tệp danh sách in hôm nay không
    const matchedOrder = todayOrders.find(o => o.id.trim() === code || (o.carrier_code && o.carrier_code.trim() === code));

    if (matchedOrder) {
      const statusCode = Number(matchedOrder.status);
      
      // ⚡️ TRƯỜNG HỢP 1: ĐƠN BỊ HỦY (Mã 58, 63, 64)
      if (CANCELED_STATUS_CODES.includes(statusCode)) {
        setCanceledOrders(prev => [...prev, matchedOrder]);
        setAlertBanner({
          type: 'danger',
          message: `🚨 ĐƠN HÀNG HỦY! Mã đơn ${matchedOrder.id} đã bị [${STATUS_MAP[statusCode]}]. Hãy bỏ riêng ra để rã hàng hoàn kho ngay!`
        });
        return;
      }

      // ⚡️ TRƯỜNG HỢP 2: ĐƠN ĐÚNG CHƯA HỦY (Kẹt lại chưa đóng được)
      if (!EXCLUDED_STATUS_CODES.includes(statusCode)) {
        setCorrectOrders(prev => [...prev, matchedOrder]);
        return;
      }
    }

    // ⚡️ TRƯỜNG HỢP 3: HÀNG THỪA (Đơn đã đi rồi, đơn ngày khác hoặc mã lạ)
    // Nếu đơn trùng khớp nhưng có trạng thái lọt vào EXCLUDED_STATUS_CODES (đã đi) hoặc không tìm thấy trong ngày
    const isInsideBaseline = baselineOrders.some(o => o.id.trim() === code || (o.carrier_code && o.carrier_code.trim() === code));
    
    if (!isInsideBaseline) {
      const { data } = await supabase
        .from('orders')
        .select(`
          id, carrier_code, status,
          order_products (product_code, product_name, quantity)
        `)
        .or(`id.eq.${code},carrier_code.eq.${code}`)
        .maybeSingle();

      if (data) {
        // Nếu tìm thấy đơn hệ thống nhưng trạng thái đã xử lý xong hoặc của ngày khác
        if (CANCELED_STATUS_CODES.includes(Number(data.status))) {
          setCanceledOrders(prev => [...prev, data]);
          setAlertBanner({
            type: 'danger',
            message: `🚨 ĐƠN HÀNG HỦY TRÊN HỆ THỐNG! Mã đơn ${data.id} báo [${STATUS_MAP[data.status]}]. Thu hồi hàng lập tức!`
          });
        } else {
          setSurplusOrders(prev => [...prev, data]);
        }
      } else {
        setSurplusOrders(prev => [...prev, { id: code, carrier_code: 'Không rõ', status: 'Mã lạ hoắc', order_products: [] }]);
      }
    }
  };

  // ⚡️ LUỒNG ĐỐI SOÁT 4: TÍNH TOÁN ĐƠN HÀNG THIẾU KHI BẤM CHỐT
  const missingOrders = baselineOrders.filter(order => {
    return !scannedCodes.includes(order.id.trim()) && (!order.carrier_code || !scannedCodes.includes(order.carrier_code.trim()));
  });

  // ⚡️ LUỒNG XUẤT EXCEL DANH SÁCH ĐƠN ĐÚNG CHƯA HỦY KÈM CHI TIẾT SẢN PHẨM
  const handleExportCorrectOrdersExcel = () => {
    if (correctOrders.length === 0) {
      alert("Chưa có đơn hàng đúng nào được quét để xuất file đối soát!");
      return;
    }

    let csvContent = "\uFEFF"; // Thẻ BOM tránh lỗi chữ Tiếng Việt trên Microsoft Excel
    csvContent += "Mã Đơn Hàng (ID),Mã Vận Đơn,Trạng Thái Hiện Tại,Mã Sản Phẩm,Tên Sản Phẩm,Số Lượng,Lý Do Không Đóng Được (Ghi chú tay)\n";

    correctOrders.forEach(order => {
      const carrierCode = order.carrier_code || '---';
      const statusText = STATUS_MAP[order.status] || order.status;
      
      if (order.order_products && order.order_products.length > 0) {
        order.order_products.forEach(p => {
          csvContent += `"${order.id}","${carrierCode}","${statusText}","${p.product_code || '---'}","${p.product_name}","${p.quantity}",""\n`;
        });
      } else {
        csvContent += `"${order.id}","${carrierCode}","${statusText}","---","Đơn trống sản phẩm","0",""\n`;
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Don_Ket_Chua_Huy_${auditDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetAudit = () => {
    if (confirm("Ông có chắc chắn muốn xóa tiến trình đối soát này để bắn lại không?")) {
      setScannedCodes([]);
      setCorrectOrders([]);
      setCanceledOrders([]);
      setSurplusOrders([]);
      setIsConfirmed(false);
      setAlertBanner(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ScanBarcode size={18} /></span>
            ĐỐI SOÁT PHIẾU IN TRẢ VỀ CUỐI NGÀY
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Đối soát lại thừa, thiếu các đơn in trong ngày</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-inner">
          <Calendar size={16} className="text-slate-400 ml-1" />
          <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
        </div>
      </div>

      {/* 🚨 THÔNG BÁO CẢNH BÁO NHANH KHI BẮN TRÚNG ĐƠN HỦY */}
      {alertBanner && (
        <div className="p-4 bg-red-600 text-white font-black text-sm rounded-2xl shadow-lg flex items-center gap-3 animate-bounce">
          <XCircle size={24} className="flex-shrink-0" />
          <span>{alertBanner.message}</span>
        </div>
      )}

      {/* 2. KHỐI Ô NHẬP QUÉT MÃ VÀ ĐIỀU HƯỚNG */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-4">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Quét mã vạch để đối soát đơn hàng cuối ngày</label>
        
        <form onSubmit={handleBarcodeSubmit} className="relative max-w-md mx-auto">
          <input 
            ref={inputRef}
            type="text"
            placeholder="Bắn mã vạch đơn hàng vào đây..."
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            disabled={isConfirmed}
            className="w-full text-center text-sm font-bold tracking-wide py-3 px-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition disabled:opacity-50"
          />
        </form>

        <div className="flex justify-center gap-3 pt-2">
          <button 
            onClick={() => setIsConfirmed(true)} 
            disabled={isConfirmed || scannedCodes.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            ✓ Xác nhận đối soát (Chốt đơn thiếu)
          </button>
          <button 
            onClick={handleResetAudit}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Bắn lại từ đầu
          </button>
        </div>
      </div>

      {/* 3. BẢNG KHỐI KPIs ĐO LƯỜNG VẬN HÀNH */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng đơn in</span>
          <span className="text-lg font-black text-slate-900 block mt-0.5">{loading ? "..." : todayOrders.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Đúng cần trả</span>
          <span className="text-lg font-black text-emerald-600 block mt-0.5">{correctOrders.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng HỦY phát hiện</span>
          <span className="text-lg font-black text-red-600 block mt-0.5">{canceledOrders.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Thừa ngoài luồng</span>
          <span className="text-lg font-black text-slate-500 block mt-0.5">{surplusOrders.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Thiếu chưa thu</span>
          <span className="text-lg font-black text-amber-600 block mt-0.5">{isConfirmed ? missingOrders.length : '?'}</span>
        </div>
      </div>

      {/* 4. MẠN DIỆN DANH SÁCH 4 Ô CHI TIẾT SẢN PHẨM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ô 1: DANH SÁCH ĐƠN ĐÚNG CHƯA HỦY (CÓ EXCEL) */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="p-1 bg-emerald-50 rounded-md"><CheckCircle size={14} /></span>
              Đơn in hôm nay chưa bị hủy ({correctOrders.length})
            </h3>
            <button
              onClick={handleExportCorrectOrdersExcel}
              disabled={correctOrders.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-[11px] font-bold rounded-lg shadow transition cursor-pointer"
            >
              <Download size={12} /> Xuất Excel
            </button>
          </div>
          <p className="text-[11px] text-slate-400 font-medium -mt-2 mb-3">Đơn in trong hôm nay, chưa bị hủy và chưa đóng</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {correctOrders.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-14">Chưa quét mã đơn đúng nào.</div>
            ) : (
              correctOrders.map((order, idx) => (
                <div key={order.id + idx} className="p-3 bg-emerald-50/30 border border-emerald-200/50 rounded-xl space-y-2">
                  <div className="text-xs font-bold flex justify-between">
                    <span className="text-emerald-800 font-black">ID: {order.id}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Mã vận đơn: {order.carrier_code || '---'}</span>
                  </div>
                  <div className="pt-1.5 border-t border-emerald-100 space-y-1">
                    {order.order_products?.map((p, pIdx) => (
                      <div key={pIdx} className="text-[11px] text-slate-600 flex justify-between font-medium">
                        <span className="truncate max-w-[80%]">📦 {p.product_name}</span>
                        <span className="font-bold text-slate-900">x{p.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ô 2: DANH SÁCH ĐƠN HÀNG HỦY (CÓ CẢNH BÁO) */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-red-50 rounded-md"><XCircle size={14} /></span>
            Danh sách đơn bị hủy hôm nay ({canceledOrders.length})
          </h3>
          <p className="text-[11px] text-slate-400 font-medium -mt-2 mb-3">Đơn in trong hôm nay nhưng đã bị hủy</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {canceledOrders.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-14">Chưa phát hiện đơn hủy nào.</div>
            ) : (
              canceledOrders.map((order, idx) => (
                <div key={order.id + idx} className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 animate-pulse">
                  <div className="flex justify-between items-start gap-2 text-xs font-bold">
                    <div className="flex flex-col">
                      <span className="text-red-700 font-black">ID: {order.id}</span>
                      <span className="text-[10px] text-slate-500 font-medium">Mã vận đơn: {order.carrier_code || '---'}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-white border border-red-300 text-red-600 text-[10px] rounded font-black whitespace-nowrap">
                      {STATUS_MAP[order.status] || 'Đã hủy'}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-red-200/60 space-y-1">
                    {order.order_products?.map((p, pIdx) => (
                      <div key={pIdx} className="text-[11px] text-red-900 flex justify-between font-medium">
                        <span className="truncate max-w-[80%]">📦 {p.product_name}</span>
                        <span className="font-bold">x{p.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ô 3: DANH SÁCH ĐƠN HÀNG THỪA */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-slate-50 rounded-md"><PackagePlus size={14} /></span>
            Danh sách đơn HÀNG THỪA ({surplusOrders.length})
          </h3>
          <p className="text-[11px] text-slate-400 font-medium -mt-2 mb-3">Đơn quét nhầm từ ngày khác hoặc đơn đã đóng gói xuất kho từ trước</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {surplusOrders.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-14">Chưa phát hiện mã hàng thừa nào.</div>
            ) : (
              surplusOrders.map((order, idx) => (
                <div key={order.id + idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between gap-2 text-xs font-bold">
                    <div className="flex flex-col">
                      <span className="text-slate-700 font-black">ID: {order.id}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Mã VC: {order.carrier_code || '---'}</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 text-[10px] rounded whitespace-nowrap">
                      Sàn báo: {STATUS_MAP[order.status] || order.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ô 4: DANH SÁCH ĐƠN HÀNG THIẾU */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-amber-50 rounded-md"><PackageMinus size={14} /></span>
            Danh sách đơn HÀNG THIẾU ({isConfirmed ? missingOrders.length : '?'})
          </h3>
          <p className="text-[11px] text-slate-400 font-medium -mt-2 mb-3">Đơn chưa đóng gói nhưng cuối ngày kho chưa hoàn trả</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {!isConfirmed ? (
              <div className="text-center text-slate-400 text-xs py-14 flex flex-col items-center justify-center gap-2 font-medium">
                <AlertCircle size={28} className="text-slate-300" />
                <span>Bấm nút "Xác nhận đối soát" ở trên để chốt sổ hàng thiếu.</span>
              </div>
            ) : missingOrders.length === 0 ? (
              <div className="text-center text-green-600 font-bold text-xs py-14 flex flex-col items-center justify-center gap-1.5">
                <CheckCircle2 size={32} className="text-green-500" />
                <span>Đã nhận đủ đơn</span>
              </div>
            ) : (
              missingOrders.map(order => (
                <div key={order.id} className="p-3 bg-amber-50/40 border border-amber-200/60 rounded-xl space-y-2">
                  <div className="text-xs font-bold flex justify-between">
                    <span className="text-amber-800 font-black">ID: {order.id}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Trạng thái: {STATUS_MAP[order.status] || order.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}