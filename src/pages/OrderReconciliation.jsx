import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ScanBarcode, Calendar, Trash2, PackagePlus, PackageMinus, AlertCircle, Package, CheckCircle2
} from 'lucide-react';

// BẢNG TỪ ĐIỂN TRẠNG THÁI CHUẨN NHANH.VN
const STATUS_MAP = {
  40: 'Đã đóng gói', 42: 'Đang đóng gói', 43: 'Chờ thu gom',
  54: 'Đơn mới', 55: 'Đang xác nhận', 56: 'Đã xác nhận',
  57: 'Chờ khách xác nhận', 58: 'Hãng vận chuyển hủy đơn',
  59: 'Đang chuyển', 60: 'Thành công', 61: 'Thất bại',
  63: 'Khách hủy', 64: 'Hệ thống hủy', 68: 'Hết hàng',
  71: 'Đang chuyển hoàn', 72: 'Đã chuyển hoàn', 73: 'Đổi kho xuất hàng', 74: 'Xác nhận hoàn'
};

// ⚡️ BỘ MÃ LOẠI TRỪ: Đã đi hàng hoặc đã đóng gói xong, không nằm trong diện hàng kẹt phải trả về
const EXCLUDED_STATUS_CODES = [40, 43, 59, 60, 61, 71, 72, 74];

export default function OrderReconciliation() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  
  const [auditDate, setAuditDate] = useState(getTodayStr());
  const [inputCode, setInputCode] = useState('');
  const [todayOrders, setTodayOrders] = useState([]);
  const [scannedCodes, setScannedCodes] = useState([]);
  const [surplusOrders, setSurplusOrders] = useState([]); 
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);

  // Tự động khóa focus vào ô nhập để súng bắn liên tục
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [scannedCodes, inputCode]);

  const fetchTodayOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, carrier_code, status,
          order_products (product_code, product_name, quantity)
        `)
        .gte('printed_at', `${auditDate}T00:00:00Z`)
        .lte('printed_at', `${auditDate}T23:59:59Z`);

      if (error) throw error;
      setTodayOrders(data || []);
      setScannedCodes([]);
      setSurplusOrders([]);
      setIsConfirmed(false);
    } catch (err) {
      console.error("❌ Lỗi tải đơn hàng:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayOrders();
  }, [auditDate]);

  // ⚡️ LUỒNG ĐỐI SOÁT 1: LỌC RA DANH SÁCH ĐƠN BẮT BUỘC KHO PHẢI TRẢ VỀ (BASELINE)
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

    setScannedCodes(prev => [...prev, code]);
    setInputCode('');

    // Đối chiếu trực tiếp xem mã bắn được có nằm trong danh sách hàng kẹt cần trả về không
    const isInsideBaseline = baselineOrders.some(o => o.id.trim() === code || (o.carrier_code && o.carrier_code.trim() === code));
    
    if (!isInsideBaseline) {
      // ⚡️ HÀNG THỪA: Đơn đáng lẽ đã đi, hoặc đơn ngày khác bốc nhầm vào đống hàng kẹt
      const { data } = await supabase
        .from('orders')
        .select(`
          id, carrier_code, status,
          order_products (product_code, product_name, quantity)
        `)
        .or(`id.eq.${code},carrier_code.eq.${code}`)
        .maybeSingle();

      if (data) {
        setSurplusOrders(prev => [...prev, data]);
      } else {
        setSurplusOrders(prev => [...prev, { id: code, carrier_code: 'Không rõ', status: 'Mã lạ hoắc', order_products: [] }]);
      }
    }
  };

  // ⚡️ LUỒNG ĐỐI SOÁT 2: TÍNH TOÁN ĐƠN HÀNG THIẾU KHI BẤM CHỐT
  // Đơn thiếu = Đơn bắt buộc phải trả về nhưng không thấy ông quét mã
  const missingOrders = baselineOrders.filter(order => {
    return !scannedCodes.includes(order.id.trim()) && (!order.carrier_code || !scannedCodes.includes(order.carrier_code.trim()));
  });

  const handleResetAudit = () => {
    if (confirm("Ông có chắc chắn muốn xóa tiến trình đối soát này để bắn lại không?")) {
      setScannedCodes([]);
      setSurplusOrders([]);
      setIsConfirmed(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ScanBarcode size={18} /></span>
            Đối Soát Đơn Hàng Thừa Thiếu cuối ngày
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Quét đống đơn kho không đóng gói được để kiểm tra thất lạc hàng hóa</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-inner">
          <Calendar size={16} className="text-slate-400 ml-1" />
          <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
        </div>
      </div>

      {/* 2. KHỐI Ô NHẬP QUÉT MÃ */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-4">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Quét đơn hoàn trả cuối ngày</label>
        
        <form onSubmit={handleBarcodeSubmit} className="relative max-w-md mx-auto">
          <input 
            ref={inputRef}
            type="text"
            placeholder="Mã vận đơn"
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
            ✓ Xác nhận đối soát (Tính đơn thiếu)
          </button>
          <button 
            onClick={handleResetAudit}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Bắn lại từ đầu
          </button>
        </div>
      </div>

      {/* 3. KHỐI KPIs PHẢN ÁNH ĐÚNG NGHĨA QUY TRÌNH CUỐI NGÀY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng đơn in hôm nay</span>
          <span className="text-xl font-black text-slate-900 block mt-0.5">{loading ? "..." : todayOrders.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Đã xử lý xong (Đã đi/Hủy)</span>
          <span className="text-xl font-black text-green-600 block mt-0.5">{loading ? "..." : (todayOrders.length - baselineOrders.length)}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Đơn kho phải trả về</span>
          <span className="text-xl font-black text-amber-600 block mt-0.5">{loading ? "..." : baselineOrders.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Thực tế đã quét trả</span>
          <span className="text-xl font-black text-blue-600 block mt-0.5">{scannedCodes.length}</span>
        </div>
      </div>

      {/* 4. DANH SÁCH CHI TIẾT THỪA THIẾU KÈM SẢN PHẨM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* KHỐI TRÁI: ĐƠN HÀNG THỪA */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-red-50 rounded-md"><PackagePlus size={14} /></span>
            Danh sách đơn HÀNG THỪA ({surplusOrders.length})
          </h3>
          <p className="text-[11px] text-slate-400 font-medium -mt-2 mb-3">Đơn quét được nhưng hệ thống ghi nhận đã đóng gói/giao đi hoặc của ngày khác</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {surplusOrders.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-14">Chưa phát hiện mã hàng thừa nào.</div>
            ) : (
              surplusOrders.map((order, idx) => {
                const statusText = STATUS_MAP[order.status] || order.status || 'Mã lạ';
                return (
                  <div key={order.id + idx} className="p-3 bg-red-50/40 border border-red-200/60 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-2 text-xs font-bold">
                      <div className="flex flex-col">
                        <span className="text-red-700 font-black">ID: {order.id}</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">Mã vận đơn: {order.carrier_code || 'Trống'}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-white border border-red-200 text-red-600 text-[10px] rounded font-black whitespace-nowrap">
                        Sàn báo: {statusText}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-red-200/30 space-y-1">
                      {order.order_products && order.order_products.length > 0 ? (
                        order.order_products.map((p, pIdx) => (
                          <div key={pIdx} className="text-[11px] text-slate-600 flex justify-between font-medium">
                            <span className="truncate max-w-[80%]">📦 {p.product_name}</span>
                            <span className="font-bold text-slate-900">x{p.quantity}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] text-red-400 font-normal">Mã đơn lạ không rõ thông tin sản phẩm</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* KHỐI PHẢI: ĐƠN HÀNG THIẾU */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-amber-50 rounded-md"><PackageMinus size={14} /></span>
            Danh sách đơn HÀNG THIẾU ({isConfirmed ? missingOrders.length : '?'})
          </h3>
          <p className="text-[11px] text-slate-400 font-medium -mt-2 mb-3">Đơn chưa đóng gói nhưng cuối ngày kho không đem trả lại giấy in mã vạch</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {!isConfirmed ? (
              <div className="text-center text-slate-400 text-xs py-14 flex flex-col items-center justify-center gap-2 font-medium">
                <AlertCircle size={28} className="text-slate-300" />
                <span>Bấm nút "Xác nhận đối soát" ở trên để hệ thống quét chốt và hiển thị danh sách đơn hàng thiếu kho chưa trả.</span>
              </div>
            ) : missingOrders.length === 0 ? (
              <div className="text-center text-green-600 font-bold text-xs py-14 flex flex-col items-center justify-center gap-1.5">
                <CheckCircle2 size={32} className="text-green-500" />
                <span>Tuyệt vời ông ơi! Đống hàng kẹt trả về khớp 100%, không bị lạc mất đơn nào!</span>
              </div>
            ) : (
              missingOrders.map(order => {
                const statusText = STATUS_MAP[order.status] || `Mã ${order.status}`;
                return (
                  <div key={order.id} className="p-3 bg-amber-50/40 border border-amber-200/60 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-2 text-xs font-bold">
                      <div className="flex flex-col">
                        <span className="text-amber-800 font-black">ID: {order.id}</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">Mã vận đơn: {order.carrier_code || 'Trống'}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-white border border-amber-200 text-amber-700 text-[10px] rounded font-black whitespace-nowrap">
                        Trạng thái: {statusText}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-amber-200/30 space-y-1">
                      {order.order_products && order.order_products.length > 0 ? (
                        order.order_products.map((p, pIdx) => (
                          <div key={pIdx} className="text-[11px] text-slate-600 flex justify-between font-medium">
                            <span className="truncate max-w-[80%]">📦 {p.product_name}</span>
                            <span className="font-bold text-slate-900">x{p.quantity}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">Đơn trống sản phẩm</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}