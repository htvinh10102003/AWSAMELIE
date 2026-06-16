import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ScanBarcode, Calendar, Trash2, PackagePlus, PackageMinus, AlertCircle, CheckCircle2, XCircle, CheckCircle, Download
} from 'lucide-react';

const STATUS_MAP = {
  40: 'Đã đóng gói', 42: 'Đang đóng gói', 43: 'Chờ thu gom',
  54: 'Đơn mới', 55: 'Đang xác nhận', 56: 'Đã xác nhận',
  57: 'Chờ khách xác nhận', 58: 'Hãng vận chuyển hủy đơn',
  59: 'Đang chuyển', 60: 'Thành công', 61: 'Thất bại',
  63: 'Khách hủy', 64: 'Hệ thống hủy', 68: 'Hết hàng',
  71: 'Đang chuyển hoàn', 72: 'Đã chuyển hoàn', 73: 'Đổi kho xuất hàng', 74: 'Xác nhận hoàn'
};

const EXCLUDED_STATUS_CODES = [40, 43, 59, 60, 61, 71, 72, 74];
const CANCELED_STATUS_CODES = [58, 63, 64];

export default function OrderReconciliation() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  
  const [auditDate, setAuditDate] = useState(getTodayStr());
  const [inputCode, setInputCode] = useState('');
  const [todayOrders, setTodayOrders] = useState([]);
  const [scannedCodes, setScannedCodes] = useState([]);
  const [surplusOrders, setSurplusOrders] = useState([]); 
  
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertBanner, setAlertBanner] = useState(null);

  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [scannedCodes, inputCode, alertBanner]);

  const fetchTodayOrders = async () => {
    setLoading(true);
    try {
      // ⚡️ VÁ LỖI MÚI GIỜ CHÍ MẠNG: Ép chuẩn giờ Local (Việt Nam) thay vì UTC
      const startOfDay = new Date(`${auditDate}T00:00:00`).toISOString();
      const endOfDay = new Date(`${auditDate}T23:59:59.999`).toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, carrier_code, status, printed_at, packed_at, carrier_date,
          order_products (product_code, product_name, quantity)
        `)
        .gte('printed_at', startOfDay)
        .lte('printed_at', endOfDay);

      if (error) throw error;
      setTodayOrders(data || []);
      setScannedCodes([]);
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

  // ⚡️ PHÂN LOẠI DANH SÁCH DỰ KIẾN (CHECKLIST)
  const expectedCorrect = todayOrders.filter(o => !EXCLUDED_STATUS_CODES.includes(Number(o.status)) && !CANCELED_STATUS_CODES.includes(Number(o.status)));
  const expectedCanceled = todayOrders.filter(o => CANCELED_STATUS_CODES.includes(Number(o.status)));

  // Hàm kiểm tra xem đơn đã được súng bắn quét chưa
  const isScanned = (order) => scannedCodes.includes(order.id) || (order.carrier_code && scannedCodes.includes(order.carrier_code));

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

    setAlertBanner(null);
    
    // Tìm đơn trong cục in hôm nay
    const matchedOrder = todayOrders.find(o => o.id === code || o.carrier_code === code);

    if (matchedOrder) {
      const statusCode = Number(matchedOrder.status);
      
      if (CANCELED_STATUS_CODES.includes(statusCode)) {
        setAlertBanner({ type: 'danger', message: `🚨 ĐƠN HÀNG HỦY! Mã ${matchedOrder.id} đã bị [${STATUS_MAP[statusCode]}]. Lọc ra rã hàng ngay!` });
      } else if (EXCLUDED_STATUS_CODES.includes(statusCode)) {
        // Nếu quét trúng đơn đã đóng gói rồi (Status 40, 59...) -> Là hàng thừa vì đáng lẽ nó không được nằm trong đống hàng kẹt
        setSurplusOrders(prev => [...prev, matchedOrder]);
        setAlertBanner({ type: 'warning', message: `⚠️ ĐƠN ĐÃ ĐÓNG GÓI RỒI! Mã ${matchedOrder.id} bị kẹt nhầm. Bỏ ra giao đi!` });
      }
      // Lưu vết đã quét (Tự động Check xanh trên UI)
      setScannedCodes(prev => [...prev, code]);
    } else {
      // Nếu quét không thấy trong tệp in hôm nay -> Chắc chắn là hàng Thừa/Lạc từ ngày khác
      const { data } = await supabase
        .from('orders')
        .select(`id, carrier_code, status, order_products (product_code, product_name, quantity)`)
        .or(`id.eq.${code},carrier_code.eq.${code}`)
        .maybeSingle();

      if (data) {
        setSurplusOrders(prev => [...prev, data]);
        if (CANCELED_STATUS_CODES.includes(Number(data.status))) {
          setAlertBanner({ type: 'danger', message: `🚨 ĐƠN HỦY LẠC NGÀY KHÁC! Mã ${data.id} báo hủy. Thu hồi ngay!` });
        }
      } else {
        setSurplusOrders(prev => [...prev, { id: code, carrier_code: 'Không rõ', status: 'Mã vạch lạ hoắc', order_products: [] }]);
      }
      setScannedCodes(prev => [...prev, code]);
    }
    
    setInputCode('');
  };

  // ⚡️ XỬ LÝ HÀNG THIẾU: Những đơn dự kiến chưa được quét
  const missingCorrect = expectedCorrect.filter(o => !isScanned(o));
  const missingCanceled = expectedCanceled.filter(o => !isScanned(o));
  const allMissing = [...missingCorrect, ...missingCanceled];

  // ⚡️ LUỒNG XUẤT EXCEL: Chỉ xuất các ĐƠN ĐÚNG MÀ ÔNG ĐÃ QUÉT ĐƯỢC
  const handleExportCorrectOrdersExcel = () => {
    const scannedCorrectOrders = expectedCorrect.filter(o => isScanned(o));
    if (scannedCorrectOrders.length === 0) {
      alert("Ông chưa quét được đơn đúng nào để xuất Excel cả!");
      return;
    }

    let csvContent = "\uFEFF"; 
    csvContent += "Mã Đơn Hàng (ID),Mã Vận Đơn,Trạng Thái Sàn,Mã Sản Phẩm,Tên Sản Phẩm,Số Lượng,Lý Do Không Đóng Được (Ghi chú tay)\n";

    scannedCorrectOrders.forEach(order => {
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
    link.setAttribute("download", `Bao_Cao_Don_Ket_${auditDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetAudit = () => {
    if (confirm("Ông có chắc chắn muốn xóa tiến trình đối soát này để bắn lại không?")) {
      setScannedCodes([]);
      setSurplusOrders([]);
      setIsConfirmed(false);
      setAlertBanner(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ScanBarcode size={18} /></span>
            ĐỐI SOÁT PHIẾU IN TRẢ VỀ CUỐI NGÀY
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Checklist đối soát hàng kẹt, hàng hủy và rác kho tự động</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-inner">
          <Calendar size={16} className="text-slate-400 ml-1" />
          <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
        </div>
      </div>

      {alertBanner && (
        <div className={`p-4 font-black text-sm rounded-2xl shadow-lg flex items-center gap-3 animate-bounce ${alertBanner.type === 'danger' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
          <XCircle size={24} className="flex-shrink-0" />
          <span>{alertBanner.message}</span>
        </div>
      )}

      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-4">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Giao diện súng bắn quét đối soát</label>
        
        <form onSubmit={handleBarcodeSubmit} className="relative max-w-md mx-auto">
          <input 
            ref={inputRef}
            type="text"
            placeholder="Bắn mã vạch đơn kẹt kho vào đây..."
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            disabled={isConfirmed}
            className="w-full text-center text-sm font-bold tracking-wide py-3 px-4 bg-slate-50 border-2 border-dashed border-blue-400 rounded-xl outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition disabled:opacity-50"
          />
        </form>

        <div className="flex justify-center gap-3 pt-2">
          <button 
            onClick={() => setIsConfirmed(true)} 
            disabled={isConfirmed || scannedCodes.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            ✓ Chốt sổ đối soát (Báo cáo hàng thiếu)
          </button>
          <button 
            onClick={handleResetAudit}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Bắn lại từ đầu
          </button>
        </div>
      </div>

      {/* 3. BẢNG KHỐI KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng đơn in hôm nay</span>
          <span className="text-lg font-black text-slate-900 block mt-0.5">{loading ? "..." : todayOrders.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Đúng (Kẹt lại)</span>
          <span className="text-lg font-black text-emerald-600 block mt-0.5">{expectedCorrect.filter(o=>isScanned(o)).length} / {expectedCorrect.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Hủy (Kẹt lại)</span>
          <span className="text-lg font-black text-red-600 block mt-0.5">{expectedCanceled.filter(o=>isScanned(o)).length} / {expectedCanceled.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Thừa (Ngoài luồng)</span>
          <span className="text-lg font-black text-slate-500 block mt-0.5">{surplusOrders.length}</span>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center bg-amber-50">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Hàng Thiếu (Chưa thu)</span>
          <span className="text-lg font-black text-amber-700 block mt-0.5">{isConfirmed ? allMissing.length : '?'}</span>
        </div>
      </div>

      {/* 4. GIAO DIỆN CHECKLIST CỰC ĐỈNH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ô 1: DANH SÁCH ĐƠN ĐÚNG CẦN TRẢ */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="p-1 bg-emerald-50 rounded-md"><CheckCircle size={14} /></span>
              Đơn kẹt lại chưa hủy ({expectedCorrect.length})
            </h3>
            <button
              onClick={handleExportCorrectOrdersExcel}
              disabled={expectedCorrect.filter(o=>isScanned(o)).length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-[11px] font-bold rounded-lg shadow transition cursor-pointer"
            >
              <Download size={12} /> Xuất Excel Đã Quét
            </button>
          </div>
          <p className="text-[11px] text-slate-400 font-medium -mt-2 mb-3">Checklist các đơn in hôm nay đáng lẽ phải thu lại từ kho</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {expectedCorrect.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-14">Hôm nay in đơn nào đi đơn nấy, không kẹt đơn nào!</div>
            ) : (
              expectedCorrect.map((order, idx) => {
                const scanned = isScanned(order);
                return (
                  <div key={order.id + idx} className={`p-3 border rounded-xl space-y-2 transition-all duration-300 ${scanned ? 'bg-emerald-50/60 border-emerald-300 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex justify-between items-start text-xs font-bold">
                      <div className="flex flex-col">
                        <span className={scanned ? 'text-emerald-700 font-black' : 'text-slate-800 font-black'}>ID: {order.id}</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">Mã vận đơn: {order.carrier_code || '---'}</span>
                      </div>
                      {scanned ? (
                        <CheckCircle2 size={20} className="text-emerald-500" />
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] rounded font-black whitespace-nowrap uppercase">Chưa thấy mã</span>
                      )}
                    </div>
                    <div className={`pt-1.5 border-t space-y-1 ${scanned ? 'border-emerald-200/50' : 'border-slate-100'}`}>
                      {order.order_products?.map((p, pIdx) => (
                        <div key={pIdx} className="text-[11px] text-slate-600 flex justify-between font-medium">
                          <span className="truncate max-w-[80%]">📦 {p.product_name}</span>
                          <span className="font-bold">x{p.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Ô 2: DANH SÁCH ĐƠN HÀNG HỦY CHỜ RÃ HÀNG */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-red-50 rounded-md"><XCircle size={14} /></span>
            Danh sách ĐƠN BỊ HỦY ({expectedCanceled.length})
          </h3>
          <p className="text-[11px] text-slate-400 font-medium -mt-2 mb-3">Các đơn bị khách/sàn hủy trong ngày. Bắt buộc phải tìm để rã hàng!</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {expectedCanceled.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-14">Tuyệt vời, không có đơn nào bị hủy giữa chừng!</div>
            ) : (
              expectedCanceled.map((order, idx) => {
                const scanned = isScanned(order);
                return (
                  <div key={order.id + idx} className={`p-3 border rounded-xl space-y-2 transition-all duration-300 ${scanned ? 'bg-red-50 border-red-300 opacity-60' : 'bg-white border-red-200 shadow-sm animate-pulse'}`}>
                    <div className="flex justify-between items-start gap-2 text-xs font-bold">
                      <div className="flex flex-col">
                        <span className={scanned ? 'text-red-800 font-black' : 'text-red-600 font-black'}>ID: {order.id}</span>
                        <span className="text-[10px] text-slate-500 font-medium">Mã vận đơn: {order.carrier_code || '---'}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-0.5 bg-red-100 border border-red-200 text-red-700 text-[9px] rounded font-black whitespace-nowrap uppercase">
                          {STATUS_MAP[order.status] || 'Đã hủy'}
                        </span>
                        {scanned && <CheckCircle2 size={16} className="text-red-500" />}
                      </div>
                    </div>
                  </div>
                )
              })
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
              <div className="text-center text-slate-400 text-xs py-14">Chưa quét trúng mã hàng lạc nào.</div>
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

        {/* Ô 4: DANH SÁCH ĐƠN HÀNG THIẾU (CHỐT SỔ) */}
        <div className="p-6 bg-amber-50/50 border border-amber-200/50 rounded-2xl shadow-sm flex flex-col min-h-[350px]">
          <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-amber-100 rounded-md"><PackageMinus size={14} /></span>
            Danh sách đơn HÀNG THIẾU ({isConfirmed ? allMissing.length : '?'})
          </h3>
          <p className="text-[11px] text-amber-700/60 font-medium -mt-2 mb-3">Tổng hợp các đơn dự kiến kẹt hoặc hủy nhưng kho không đem nộp lại</p>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px]">
            {!isConfirmed ? (
              <div className="text-center text-amber-500 text-xs py-14 flex flex-col items-center justify-center gap-2 font-medium">
                <AlertCircle size={28} className="text-amber-300" />
                <span>Bấm nút "Chốt sổ đối soát" ở trên để khoanh vùng hàng thiếu.</span>
              </div>
            ) : allMissing.length === 0 ? (
              <div className="text-center text-emerald-600 font-bold text-xs py-14 flex flex-col items-center justify-center gap-1.5">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <span>Kho làm việc 100% chuẩn xác, không bị lạc mất đơn nào!</span>
              </div>
            ) : (
              allMissing.map(order => (
                <div key={order.id} className="p-3 bg-white border border-amber-200 rounded-xl space-y-2">
                  <div className="text-xs font-bold flex justify-between">
                    <span className="text-amber-800 font-black">ID: {order.id}</span>
                    <span className="text-[10px] text-slate-400 font-medium text-right">Mã: {order.carrier_code || '---'}<br/>{STATUS_MAP[order.status]}</span>
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