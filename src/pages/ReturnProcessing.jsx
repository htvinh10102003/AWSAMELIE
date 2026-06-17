import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  PackageMinus, Search, CheckCircle2, AlertCircle, ScanBarcode, 
  Download, Loader2, ArrowLeftRight, Trash2, XCircle
} from 'lucide-react';

export default function ReturnProcessing() {
  const [loading, setLoading] = useState(false);
  
  // States quét Vận đơn
  const [trackingCode, setTrackingCode] = useState('');
  const [currentOrder, setCurrentOrder] = useState(null); // Đơn gốc lấy từ Nhanh
  
  // States quét Sản phẩm
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedItems, setScannedItems] = useState([]); // Các sản phẩm thực tế quét được
  
  // Nhớ kéo sẵn từ điển kho để cross-match Barcode -> ID Nhanh
  const [inventoryMap, setInventoryMap] = useState([]);
  
  // ⚡️ NHẬT KÝ PHIÊN LÀM VIỆC (ĐỂ XUẤT EXCEL CUỐI NGÀY)
  const [sessionLogs, setSessionLogs] = useState([]);

  const trackingInputRef = useRef(null);
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    // Load từ điển kho 1 lần khi mở trang
    const fetchDict = async () => {
      const { data } = await supabase.from('product_inventories').select('product_id, product_code, product_name');
      setInventoryMap(data || []);
    };
    fetchDict();
    trackingInputRef.current?.focus();
  }, []);

  // 1. TÌM KIẾM ĐƠN GỐC
  const searchOrder = async (e) => {
    e.preventDefault();
    if (!trackingCode.trim()) return;
    setLoading(true);
    setCurrentOrder(null);
    setScannedItems([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'search', payload: { code: trackingCode.trim() } })
      });
      const data = await res.json();

      if (data.success && data.order) {
        setCurrentOrder(data.order);
        // Tự động focus vào ô quét SP
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      } else {
        // NẾU KHÔNG THẤY -> CHUYỂN SANG CHẾ ĐỘ ĐƠN HOÀN NGOÀI
        setCurrentOrder({
          isExternal: true,
          id: 'N/A',
          customerName: 'Khách Vô Danh',
          customerMobile: '',
          products: [] // Không có SP dự kiến
        });
        alert("Không tìm thấy đơn gốc! Hệ thống đã chuyển sang chế độ: HOÀN NGOÀI.");
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      }
    } catch (err) {
      alert("Lỗi kết nối máy chủ Nhanh.vn");
    } finally {
      setLoading(false);
    }
  };

  // 2. BẮN MÃ VẠCH SẢN PHẨM HOÀN
  const handleScanProduct = (e) => {
    e.preventDefault();
    const code = barcodeInput.trim().toUpperCase();
    if (!code) return;

    // Tìm trong Database kho xem là SP gì
    const dbMatch = inventoryMap.find(item => String(item.product_code).toUpperCase() === code);
    
    if (!dbMatch) {
      alert(`Mã vạch [${code}] chưa có trong danh bạ hệ thống!`);
      setBarcodeInput('');
      return;
    }

    setScannedItems(prev => {
      const existing = prev.find(i => i.id === dbMatch.product_id);
      if (existing) {
        return prev.map(i => i.id === dbMatch.product_id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: dbMatch.product_id, code: dbMatch.product_code, name: dbMatch.product_name, qty: 1 }];
    });
    setBarcodeInput('');
  };

  const removeScannedItem = (id) => {
    setScannedItems(prev => prev.filter(i => i.id !== id));
  };

  // 3. THUẬT TOÁN XÁC ĐỊNH LOẠI HOÀN VÀ GỬI LÊN NHANH
  const submitReturn = async () => {
    if (scannedItems.length === 0) return alert("Bạn chưa quét sản phẩm thực nhận nào!");
    
    setLoading(true);
    let returnType = 'EXTERNAL';

    // Xác định logic
    if (currentOrder && !currentOrder.isExternal) {
      const expectedProducts = currentOrder.products || [];
      // Đếm tổng dự kiến và tổng thực nhận
      const totalExpected = expectedProducts.reduce((sum, p) => sum + Number(p.quantity), 0);
      const totalScanned = scannedItems.reduce((sum, p) => sum + p.qty, 0);

      // (Đơn giản hóa logic: Nếu tổng quét == tổng gốc -> Hoàn toàn bộ. Nếu ít hơn -> 1 phần)
      if (totalScanned === totalExpected) returnType = 'FULL';
      else returnType = 'PARTIAL';
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        returnType,
        orderId: currentOrder.id,
        trackingCode: trackingCode.trim(),
        customerName: currentOrder.customerName,
        customerMobile: currentOrder.customerMobile,
        returnedProducts: scannedItems // Gửi mảng SP lên
      };

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'submit', payload })
      });
      const data = await res.json();

      if (data.success) {
        // Ghi vào Nhật ký Phiên
        setSessionLogs(prev => [{
          time: new Date().toLocaleTimeString('vi-VN'),
          tracking: trackingCode.trim(),
          type: returnType === 'FULL' ? 'Hoàn toàn bộ' : returnType === 'PARTIAL' ? 'Hoàn 1 phần' : 'Hoàn ngoài',
          status: 'Thành công',
          items: scannedItems.map(i => `${i.name} (x${i.qty})`).join(' | ')
        }, ...prev]);

        // Reset để quét đơn mới
        setCurrentOrder(null);
        setScannedItems([]);
        setTrackingCode('');
        trackingInputRef.current?.focus();
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch (err) {
      alert("Lỗi kết nối khi đẩy đơn hoàn!");
    } finally {
      setLoading(false);
    }
  };

  // 4. XUẤT EXCEL (CSV) NHẬT KÝ CUỐI NGÀY
  const exportSessionLogs = () => {
    if (sessionLogs.length === 0) return alert("Phiên làm việc chưa có dữ liệu nào.");
    let csvContent = "\uFEFFThời gian,Mã Vận Đơn/Đơn hàng,Loại Hoàn,Sản phẩm thực nhận,Trạng thái\n";
    sessionLogs.forEach(log => {
      csvContent += `"${log.time}","${log.tracking}","${log.type}","${log.items}","${log.status}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Nhat_Ky_Hoan_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl"><PackageMinus size={22} /></span>
            Xử lý Đơn Hoàn / Boom Hàng
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">Đổi trạng thái Đã hoàn hoặc Tạo đơn hoàn 1 phần tự động</p>
        </div>
        <button onClick={exportSessionLogs} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2">
          <Download size={16} /> Xuất Excel Nhật ký phiên
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KHU VỰC TRÁI (2/3): QUÉT MÃ VÀ KIỂM ĐẾM */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* BƯỚC 1: QUÉT MÃ VẬN ĐƠN */}
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ScanBarcode size={14}/> Bước 1: Quét Mã Vận Đơn / Mã Đơn</label>
            <form onSubmit={searchOrder} className="flex gap-2">
              <input 
                ref={trackingInputRef} type="text" placeholder="Nhập mã vận đơn vào đây..." value={trackingCode} onChange={e => setTrackingCode(e.target.value)}
                className="w-full text-sm font-bold tracking-widest py-3 px-4 bg-slate-50 border-2 border-slate-300 rounded-xl outline-none focus:bg-white focus:border-rose-500 transition"
              />
              <button type="submit" disabled={loading} className="px-6 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition shadow-sm">
                {loading && !currentOrder ? <Loader2 size={18} className="animate-spin" /> : 'Tìm'}
              </button>
            </form>
          </div>

          {/* BƯỚC 2: HIỂN THỊ ĐƠN GỐC & QUÉT SP */}
          {currentOrder && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
              
              <div className={`p-4 border-b ${currentOrder.isExternal ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-100'} flex justify-between items-center`}>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-wide ${currentOrder.isExternal ? 'text-amber-800' : 'text-rose-800'}`}>
                    {currentOrder.isExternal ? '⚠️ CHẾ ĐỘ: ĐƠN HOÀN NGOÀI' : `ĐƠN GỐC: #${currentOrder.id}`}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-600 mt-1">Khách hàng: <strong className="text-slate-800">{currentOrder.customerName}</strong> - {currentOrder.customerMobile}</p>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Cột SP Dự kiến */}
                {!currentOrder.isExternal && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Sản phẩm dự kiến (Khách đã mua)</h4>
                    <div className="space-y-2">
                      {currentOrder.products?.map((p, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-700">{p.productName}</span>
                          <span className="text-[11px] font-black bg-white px-2 py-1 border border-slate-200 rounded text-slate-500">x{p.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cột SP Thực nhận */}
                <div className={currentOrder.isExternal ? 'md:col-span-2' : ''}>
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Sản phẩm Thực nhận (Quét mã)</span>
                    <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">Tổng: {scannedItems.reduce((s,p)=>s+p.qty,0)}</span>
                  </h4>
                  
                  <form onSubmit={handleScanProduct} className="mb-4">
                    <input 
                      ref={barcodeInputRef} type="text" placeholder="Quét mã vạch sản phẩm hoàn..." value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
                      className="w-full text-xs font-bold tracking-widest py-2.5 px-3 bg-white border border-rose-200 rounded-lg outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition shadow-sm"
                    />
                  </form>

                  <div className="space-y-2">
                    {scannedItems.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs font-medium border border-dashed rounded-xl">Chưa quét sản phẩm nào.</div>
                    ) : (
                      scannedItems.map((item) => (
                        <div key={item.id} className="p-2.5 bg-rose-50/50 rounded-xl border border-rose-100 flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800">{item.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">{item.code}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-rose-600 bg-white px-2 py-1 border border-rose-200 rounded shadow-sm">x{item.qty}</span>
                            <button onClick={()=>removeScannedItem(item.id)} className="p-1 text-slate-400 hover:text-red-500"><XCircle size={14}/></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* NÚT CHỐT HOÀN */}
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={submitReturn} 
                  disabled={loading || scannedItems.length === 0}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-sm font-black rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeftRight size={18} />} 
                  XÁC NHẬN CHỐT HOÀN VÀ CỘNG TỒN KHO
                </button>
              </div>

            </div>
          )}
        </div>

        {/* KHU VỰC PHẢI (1/3): NHẬT KÝ PHIÊN LÀM VIỆC */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[600px] overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">Nhật ký phiên ({sessionLogs.length})</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
            {sessionLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                Chưa có đơn nào được xử lý trong phiên này.
              </div>
            ) : (
              sessionLogs.map((log, idx) => (
                <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${log.type.includes('toàn bộ') ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                  <div className="flex justify-between items-center pl-2">
                    <span className="text-[10px] font-bold text-slate-400">{log.time}</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${log.type.includes('toàn bộ') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{log.type}</span>
                  </div>
                  <div className="pl-2 text-xs font-black text-slate-800 tracking-wider truncate">{log.tracking}</div>
                  <div className="pl-2 text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{log.items}</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}