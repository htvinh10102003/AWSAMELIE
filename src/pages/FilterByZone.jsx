import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Filter, UploadCloud, ScanBarcode, CheckCircle2, Box } from 'lucide-react';

export default function FilterByZone() {
  const [awbText, setAwbText] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderList, setOrderList] = useState([]);
  
  // States cho tính năng quét
  const [scanInput, setScanInput] = useState('');
  const [currentZone, setCurrentZone] = useState(null);
  const [scannedAwbs, setScannedAwbs] = useState(new Set());
  
  const scanInputRef = useRef(null);

  // Tự động focus vào ô quét mã
  useEffect(() => {
    if (orderList.length > 0) {
      scanInputRef.current?.focus();
    }
  }, [orderList]);

  // 1. Tải dữ liệu từ list AWB dán vào
  const handleLoadData = async () => {
    if (!awbText.trim()) return;
    
    setLoading(true);
    // Tách các mã bằng dấu xuống dòng hoặc dấu phẩy, lọc bỏ chuỗi rỗng
    const awbArray = awbText.split(/[\n,]+/).map(item => item.trim()).filter(Boolean);

    const { data, error } = await supabase.rpc('get_orders_by_zone', { awb_list: awbArray });

    if (error) {
      console.error(error);
      alert('Lỗi lấy dữ liệu từ Server');
    } else {
      setOrderList(data || []);
      setScannedAwbs(new Set()); // Reset lịch sử quét
      setCurrentZone(null);
    }
    setLoading(false);
  };

  // 2. Xử lý khi súng quét mã vạch Enter
  const handleScan = (e) => {
    if (e.key === 'Enter') {
      const code = scanInput.trim();
      if (!code) return;

      const foundOrder = orderList.find(o => o.carrier_code === code || o.order_id === code);
      
      if (foundOrder) {
        const zone = foundOrder.zone || 'KHÔNG RÕ';
        setCurrentZone(zone);
        setScannedAwbs(prev => new Set(prev).add(code));
      } else {
        setCurrentZone('LỖI - KHÔNG TÌM THẤY');
      }

      setScanInput(''); // Xoá ô input để quét tiếp
    }
  };

  // Thống kê nhanh
  const totalOrders = orderList.length;
  const totalScanned = scannedAwbs.size;

  return (
    <div className="flex flex-col h-full gap-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Filter size={24} /></div>
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Lọc & Chia Đơn Theo Dãy Kệ</h2>
          <p className="text-sm text-gray-500 font-medium">Tải danh sách đơn vừa in, quét mã vạch để phân loại rổ nhanh.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Cột 1: Nhập liệu */}
        <div className="lg:col-span-1 bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4">
          <label className="font-bold text-gray-800 flex items-center gap-2">
            <UploadCloud size={18} /> Dán danh sách Mã vận đơn / Mã đơn
          </label>
          <textarea
            value={awbText}
            onChange={(e) => setAwbText(e.target.value)}
            placeholder="Dán mã vào đây... (mỗi mã 1 dòng)"
            className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-sm"
          />
          <button
            onClick={handleLoadData}
            disabled={loading || !awbText}
            className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl transition-all disabled:opacity-50"
          >
            {loading ? 'Đang tải...' : 'Tải dữ liệu phân dãy'}
          </button>

          {orderList.length > 0 && (
            <div className="mt-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <div className="text-sm font-semibold text-indigo-800 mb-1">Tiến độ quét:</div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-indigo-600">{totalScanned} <span className="text-lg text-indigo-400">/ {totalOrders}</span></span>
                <span className="text-sm font-medium text-indigo-600 mb-1">đơn đã xử lý</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 w-full bg-indigo-200 rounded-full mt-3 overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-300" 
                  style={{ width: `${totalOrders > 0 ? (totalScanned / totalOrders) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cột 2: Quét mã vạch & Hiển thị kết quả to */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4">
            <label className="font-bold text-gray-800 flex items-center gap-2">
              <ScanBarcode size={18} /> Quét mã vạch tại đây
            </label>
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScan}
              placeholder="Sử dụng máy quét mã vạch..."
              className="w-full text-2xl font-bold px-6 py-4 bg-blue-50/50 border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-center placeholder:text-gray-400"
            />
          </div>

          {/* HIỂN THỊ DÃY SIÊU TO */}
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex items-center justify-center relative overflow-hidden">
            {!currentZone ? (
              <div className="text-gray-300 flex flex-col items-center gap-4">
                <Box size={64} strokeWidth={1} />
                <p className="font-medium text-lg">Kết quả phân dãy sẽ hiển thị ở đây</p>
              </div>
            ) : currentZone.includes('LỖI') ? (
              <div className="text-red-500 text-center animate-in zoom-in duration-200">
                <h1 className="text-5xl md:text-7xl font-black uppercase">KHÔNG TÌM THẤY</h1>
                <p className="mt-4 text-xl font-bold">Mã này không có trong danh sách vừa tải</p>
              </div>
            ) : (
              <div className="text-center animate-in zoom-in duration-200 scale-100">
                <p className="text-2xl font-bold text-gray-500 mb-2 tracking-widest uppercase">Phân loại vào</p>
                <h1 className="text-8xl md:text-[180px] leading-none font-black text-indigo-600">
                  DÃY {currentZone}
                </h1>
                <div className="absolute inset-0 bg-indigo-50/30 animate-pulse pointer-events-none rounded-3xl" />
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}