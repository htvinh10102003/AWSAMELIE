import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ScanBarcode, Calendar, Trash2, PackagePlus, PackageMinus, AlertCircle, CheckCircle2, XCircle, CheckCircle, Download, Camera, CameraOff, RefreshCw
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

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

  // Camera
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState(''); // thông báo lỗi camera
  const scannerRef = useRef(null);
  const cameraContainerRef = useRef(null);

  // Popup trùng mã
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [duplicateCode, setDuplicateCode] = useState('');

  const inputRef = useRef(null);
  const audioCtxRef = useRef(null); // Dùng cho Web Audio

  // Tập trung input khi không mở camera
  useEffect(() => {
    if (inputRef.current && !isCameraOpen) inputRef.current.focus();
  }, [scannedCodes, inputCode, alertBanner, isCameraOpen]);

  const fetchTodayOrders = async () => {
    setLoading(true);
    try {
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
      setShowDuplicatePopup(false);
    } catch (err) {
      console.error("❌ Lỗi tải đơn hàng đối soát:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayOrders();
  }, [auditDate]);

  const expectedCorrect = todayOrders.filter(o => !EXCLUDED_STATUS_CODES.includes(Number(o.status)) && !CANCELED_STATUS_CODES.includes(Number(o.status)));
  const expectedCanceled = todayOrders.filter(o => CANCELED_STATUS_CODES.includes(Number(o.status)));

  const isScanned = (order) => scannedCodes.includes(order.id) || (order.carrier_code && scannedCodes.includes(order.carrier_code));

  // Phát âm thanh bằng Web Audio API
  const playSound = (type) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'error') {
        osc.frequency.value = 330;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // Bỏ qua lỗi âm thanh
    }
  };

  // Xử lý khi quét được một mã (từ input hoặc camera)
  const processBarcode = useCallback(async (code) => {
    if (!code) return;

    // Kiểm tra trùng lặp
    if (scannedCodes.includes(code)) {
      setDuplicateCode(code);
      setShowDuplicatePopup(true);
      playSound('error');
      setInputCode('');
      return;
    }

    setAlertBanner(null);
    playSound('success');

    const matchedOrder = todayOrders.find(o => o.id === code || o.carrier_code === code);

    if (matchedOrder) {
      const statusCode = Number(matchedOrder.status);
      
      if (CANCELED_STATUS_CODES.includes(statusCode)) {
        setAlertBanner({ type: 'danger', message: `🚨 ĐƠN HÀNG HỦY! Mã ${matchedOrder.id} đã bị [${STATUS_MAP[statusCode]}]. Lọc ra rã hàng ngay!` });
      } else if (EXCLUDED_STATUS_CODES.includes(statusCode)) {
        setSurplusOrders(prev => [...prev, matchedOrder]);
        setAlertBanner({ type: 'warning', message: `⚠️ ĐƠN ĐÃ ĐÓNG GÓI RỒI! Mã ${matchedOrder.id} bị kẹt nhầm. Bỏ ra giao đi!` });
      }
      setScannedCodes(prev => [...prev, code]);
    } else {
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
  }, [scannedCodes, todayOrders]);

  // Submit từ input tay
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    processBarcode(inputCode.trim());
  };

  // Đóng popup trùng mã
  const closeDuplicatePopup = () => {
    setShowDuplicatePopup(false);
    setDuplicateCode('');
  };

  // Camera
  const startCamera = async () => {
    setCameraErrorMsg('');
    setIsCameraOpen(true);
    try {
      const html5QrCode = new Html5Qrcode("camera-container");
      scannerRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Gọi xử lý mã
          processBarcode(decodedText);
        },
        (errorMessage) => {
          // Lỗi quét, có thể bỏ qua
        }
      );
    } catch (err) {
      console.error("Không thể mở camera:", err);
      setCameraErrorMsg('Không thể truy cập camera. Hãy kiểm tra quyền trong trình duyệt hoặc thử lại.');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.warn("Lỗi khi dừng camera:", e);
      }
      scannerRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraErrorMsg('');
  };

  // Khi popup trùng hiển thị => tạm dừng camera
  useEffect(() => {
    if (showDuplicatePopup && scannerRef.current && isCameraOpen) {
      scannerRef.current.pause();
    } else if (!showDuplicatePopup && scannerRef.current && isCameraOpen) {
      scannerRef.current.resume();
    }
  }, [showDuplicatePopup, isCameraOpen]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleToggleCamera = () => {
    if (isCameraOpen) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  // Xuất Excel
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
      setShowDuplicatePopup(false);
      if (isCameraOpen) stopCamera();
    }
  };

  const missingCorrect = expectedCorrect.filter(o => !isScanned(o));
  const missingCanceled = expectedCanceled.filter(o => !isScanned(o));
  const allMissing = [...missingCorrect, ...missingCanceled];

  return (
    <div className="space-y-4 sm:space-y-6 pb-10 px-2 sm:px-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ScanBarcode size={18} /></span>
            ĐỐI SOÁT PHIẾU IN TRẢ VỀ CUỐI NGÀY
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Checklist đối soát hàng kẹt, hàng hủy và rác kho tự động</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl shadow-inner w-full sm:w-auto">
          <Calendar size={16} className="text-slate-400 ml-1" />
          <input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer flex-1" />
        </div>
      </div>

      {alertBanner && (
        <div className={`p-3 sm:p-4 font-black text-xs sm:text-sm rounded-2xl shadow-lg flex items-center gap-3 animate-bounce ${alertBanner.type === 'danger' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
          <XCircle size={20} className="flex-shrink-0" />
          <span>{alertBanner.message}</span>
        </div>
      )}

      {/* Popup trùng mã */}
      {showDuplicatePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-lg font-black text-red-600">Mã đã quét rồi!</h3>
            <p className="text-sm text-slate-600 font-medium">
              Mã <span className="font-black text-slate-800">{duplicateCode}</span> đã được quét trước đó.<br/>
              Vui lòng kiểm tra lại hàng hoặc bỏ qua.
            </p>
            <button
              onClick={closeDuplicatePopup}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition w-full"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Khu vực quét mã */}
      <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-4">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Giao diện súng bắn quét đối soát</label>
        
        <form onSubmit={handleBarcodeSubmit} className="relative max-w-md mx-auto flex items-center gap-2">
          <input 
            ref={inputRef}
            type="text"
            placeholder="Bắn mã vạch đơn kẹt kho..."
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            disabled={isConfirmed || isCameraOpen}
            className="flex-1 text-center text-sm font-bold tracking-wide py-2.5 sm:py-3 px-3 sm:px-4 bg-slate-50 border-2 border-dashed border-blue-400 rounded-xl outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleToggleCamera}
            disabled={isConfirmed || showDuplicatePopup}
            className={`p-2.5 sm:p-3 rounded-xl border-2 font-bold text-xs flex items-center gap-1.5 transition ${
              isCameraOpen 
                ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' 
                : 'bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100'
            } disabled:opacity-50`}
            title={isCameraOpen ? "Tắt camera" : "Quét bằng camera"}
          >
            {isCameraOpen ? <CameraOff size={18} /> : <Camera size={18} />}
            <span className="hidden sm:inline">{isCameraOpen ? 'Tắt' : 'Camera'}</span>
          </button>
        </form>

        {cameraErrorMsg && (
          <div className="mt-2 text-red-600 text-xs font-medium flex flex-col items-center gap-1">
            <span>{cameraErrorMsg}</span>
            <button
              onClick={() => startCamera()}
              className="flex items-center gap-1 px-3 py-1 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold hover:bg-red-100 transition"
            >
              <RefreshCw size={12} /> Thử lại
            </button>
          </div>
        )}

        {isCameraOpen && !cameraErrorMsg && (
          <div className="mt-4 flex flex-col items-center">
            <div id="camera-container" ref={cameraContainerRef} className="w-full max-w-xs sm:max-w-sm rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg" style={{ minHeight: '200px' }} />
            <p className="text-xs text-slate-400 mt-2">Đưa mã vạch vào khung để quét tự động</p>
          </div>
        )}

        <div className="flex justify-center gap-2 sm:gap-3 pt-2 flex-wrap">
          <button 
            onClick={() => setIsConfirmed(true)} 
            disabled={isConfirmed || scannedCodes.length === 0}
            className="px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            ✓ Chốt sổ đối soát
          </button>
          <button 
            onClick={handleResetAudit}
            className="px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={13} /> Bắn lại
          </button>
        </div>
      </div>

      {/* KPI - responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng đơn in</span>
          <span className="text-base sm:text-lg font-black text-slate-900 block mt-0.5">{loading ? "..." : todayOrders.length}</span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Đúng</span>
          <span className="text-base sm:text-lg font-black text-emerald-600 block mt-0.5">{expectedCorrect.filter(o=>isScanned(o)).length} / {expectedCorrect.length}</span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Hủy</span>
          <span className="text-base sm:text-lg font-black text-red-600 block mt-0.5">{expectedCanceled.filter(o=>isScanned(o)).length} / {expectedCanceled.length}</span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hàng Thừa</span>
          <span className="text-base sm:text-lg font-black text-slate-500 block mt-0.5">{surplusOrders.length}</span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center bg-amber-50">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Hàng Thiếu</span>
          <span className="text-base sm:text-lg font-black text-amber-700 block mt-0.5">{isConfirmed ? allMissing.length : '?'}</span>
        </div>
      </div>

      {/* Checklist - responsive 1 cột trên mobile, 2 cột trên desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Đơn đúng cần trả */}
        <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="p-1 bg-emerald-50 rounded-md"><CheckCircle size={14} /></span>
              Đơn kẹt ({expectedCorrect.length})
            </h3>
            <button
              onClick={handleExportCorrectOrdersExcel}
              disabled={expectedCorrect.filter(o=>isScanned(o)).length === 0}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-[10px] sm:text-[11px] font-bold rounded-lg shadow transition cursor-pointer"
            >
              <Download size={12} /> Excel
            </button>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium -mt-1 mb-3">Checklist các đơn in hôm nay đáng lẽ phải thu lại từ kho</p>
          
          <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-1 max-h-[350px]">
            {expectedCorrect.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-10">Hôm nay in đơn nào đi đơn nấy, không kẹt đơn nào!</div>
            ) : (
              expectedCorrect.map((order, idx) => {
                const scanned = isScanned(order);
                return (
                  <div key={order.id + idx} className={`p-2 sm:p-3 border rounded-xl space-y-1.5 transition-all duration-300 ${scanned ? 'bg-emerald-50/60 border-emerald-300 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex justify-between items-start text-xs font-bold">
                      <div className="flex flex-col">
                        <span className={scanned ? 'text-emerald-700 font-black' : 'text-slate-800 font-black'}>ID: {order.id}</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">Mã vận đơn: {order.carrier_code || '---'}</span>
                      </div>
                      {scanned ? (
                        <CheckCircle2 size={18} className="text-emerald-500" />
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] rounded font-black whitespace-nowrap uppercase">Chưa thấy mã</span>
                      )}
                    </div>
                    <div className={`pt-1.5 border-t space-y-1 ${scanned ? 'border-emerald-200/50' : 'border-slate-100'}`}>
                      {order.order_products?.map((p, pIdx) => (
                        <div key={pIdx} className="text-[11px] text-slate-600 flex justify-between font-medium">
                          <span className="truncate max-w-[75%]">📦 {p.product_name}</span>
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

        {/* Đơn hủy */}
        <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
          <h3 className="text-xs sm:text-sm font-bold text-red-600 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-red-50 rounded-md"><XCircle size={14} /></span>
            Đơn bị hủy ({expectedCanceled.length})
          </h3>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium -mt-1 mb-3">Các đơn bị khách/sàn hủy trong ngày. Bắt buộc phải tìm để rã hàng!</p>
          
          <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-1 max-h-[350px]">
            {expectedCanceled.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-10">Tuyệt vời, không có đơn nào bị hủy!</div>
            ) : (
              expectedCanceled.map((order, idx) => {
                const scanned = isScanned(order);
                return (
                  <div key={order.id + idx} className={`p-2 sm:p-3 border rounded-xl space-y-1.5 transition-all duration-300 ${scanned ? 'bg-red-50 border-red-300 opacity-60' : 'bg-white border-red-200 shadow-sm animate-pulse'}`}>
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

        {/* Hàng thừa */}
        <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
          <h3 className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-slate-50 rounded-md"><PackagePlus size={14} /></span>
            Hàng thừa ({surplusOrders.length})
          </h3>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium -mt-1 mb-3">Đơn quét nhầm từ ngày khác hoặc đơn đã đóng gói xuất kho từ trước</p>
          
          <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-1 max-h-[350px]">
            {surplusOrders.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-10">Chưa quét trúng mã hàng lạc nào.</div>
            ) : (
              surplusOrders.map((order, idx) => (
                <div key={order.id + idx} className="p-2 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
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

        {/* Hàng thiếu */}
        <div className="p-4 sm:p-6 bg-amber-50/50 border border-amber-200/50 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
          <h3 className="text-xs sm:text-sm font-bold text-amber-600 uppercase tracking-wider mb-3 sm:mb-4 flex items-center gap-1.5">
            <span className="p-1 bg-amber-100 rounded-md"><PackageMinus size={14} /></span>
            Hàng thiếu ({isConfirmed ? allMissing.length : '?'})
          </h3>
          <p className="text-[10px] sm:text-[11px] text-amber-700/60 font-medium -mt-1 mb-3">Tổng hợp các đơn dự kiến kẹt hoặc hủy nhưng kho không đem nộp lại</p>
          
          <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-1 max-h-[350px]">
            {!isConfirmed ? (
              <div className="text-center text-amber-500 text-xs py-10 flex flex-col items-center justify-center gap-2 font-medium">
                <AlertCircle size={28} className="text-amber-300" />
                <span>Bấm nút "Chốt sổ đối soát" ở trên để khoanh vùng hàng thiếu.</span>
              </div>
            ) : allMissing.length === 0 ? (
              <div className="text-center text-emerald-600 font-bold text-xs py-10 flex flex-col items-center justify-center gap-1.5">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <span>Kho làm việc 100% chuẩn xác, không bị lạc mất đơn nào!</span>
              </div>
            ) : (
              allMissing.map(order => (
                <div key={order.id} className="p-2 sm:p-3 bg-white border border-amber-200 rounded-xl space-y-1">
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