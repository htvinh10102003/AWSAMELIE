import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MapPin, Search, List, Loader2, Package, ChevronLeft, ChevronRight, AlertCircle, Box, Camera, X
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export default function ProductLocation() {
  const [activeTab, setActiveTab] = useState('map');

  // ==========================================
  // STATES TAB 1: TÌM KIẾM, SƠ ĐỒ & KẾT QUẢ
  // ==========================================
  const [mapSearchTerm, setMapSearchTerm] = useState('');
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [searchedProduct, setSearchedProduct] = useState(null);
  const [highlightedRack, setHighlightedRack] = useState(null);
  const [mapMessage, setMapMessage] = useState({ text: '', type: '' });
  
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef(null);
const isProcessingRef = useRef(false);
  const [racks, setRacks] = useState([]);

  // ==========================================
  // STATES TAB 2: DANH SÁCH VỊ TRÍ
  // ==========================================
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 50;

  // ==========================================
  // KHỞI TẠO DỮ LIỆU
  // ==========================================
  useEffect(() => {
    fetchMapConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchProductList();
    }
  }, [activeTab, page]);

  const fetchMapConfig = async () => {
    const { data } = await supabase.from('system_configs').select('value').eq('key', 'warehouse_layout_map').single();
    if (data && data.value) {
      try { setRacks(JSON.parse(data.value)); } catch (e) { console.error("Lỗi parse map:", e); }
    }
  };

  // ==========================================
  // XỬ LÝ TÌM KIẾM & GỢI Ý
  // ==========================================
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setMapSearchTerm(value);

    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('product_inventories')
        .select('product_name, product_code, location_code')
        .or(`product_name.ilike.%${value.trim()}%,product_code.ilike.%${value.trim()}%`)
        .limit(10);

      if (data && data.length > 0) {
        setSuggestions(data);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    }, 300);
  };

  const processSelectedProduct = (product) => {
    setMapSearchTerm(product.product_code);
    setShowSuggestions(false);
    setSearchedProduct(product);
    setMapMessage({ text: '', type: '' });

    if (product.location_code) {
      const targetRack = racks.find(r => r.name.toLowerCase().trim() === product.location_code.toLowerCase().trim());
      if (targetRack) {
        setHighlightedRack(targetRack.id);
      } else {
        setHighlightedRack(null);
      }
    } else {
      setHighlightedRack(null);
      setMapMessage({ text: '⚠️ Sản phẩm này chưa được gán vị trí nào!', type: 'warning' });
    }
  };

  const handleExactSearch = async (term) => {
    if (!term.trim()) return;
    setIsSearchingMap(true);
    setShowSuggestions(false);
    setSearchedProduct(null);
    
    // Tìm chính xác mã
    let { data } = await supabase
      .from('product_inventories')
      .select('product_name, product_code, location_code')
      .eq('product_code', term.trim())
      .maybeSingle();

    // Nếu không khớp mã chính xác, thử tìm tương đối
    if (!data) {
        const fallback = await supabase
            .from('product_inventories')
            .select('product_name, product_code, location_code')
            .or(`product_name.ilike.%${term.trim()}%,product_code.ilike.%${term.trim()}%`)
            .limit(1)
            .maybeSingle();
        data = fallback.data;
    }

    if (data) {
      processSelectedProduct(data);
    } else {
      setMapMessage({ text: '❌ Không tìm thấy sản phẩm!', type: 'error' });
    }
    setIsSearchingMap(false);
  };

  // ==========================================
  // XỬ LÝ QUÉT MÃ VẠCH (CHỐNG TRẮNG MÀN HÌNH TỐI ĐA)
  // ==========================================
  const startScanner = () => {
    setIsScanning(true);
    isProcessingRef.current = false; // Reset lại khóa mỗi lần mở camera
    
    // Đợi 150ms để DOM render thẻ <div id="reader"> xong hoàn toàn
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;
      
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
        async (decodedText) => {
          // KHÓA LUỒNG: Nếu đang xử lý một mã rồi thì bỏ qua các mã quét được phía sau
          if (isProcessingRef.current) return;
          isProcessingRef.current = true; 

          // DỪNG CAMERA (Bất đồng bộ)
          if (html5QrCodeRef.current) {
            try {
                // CHỈ STOP camera, KHÔNG GỌI .clear() để tránh crash React
                await html5QrCodeRef.current.stop();
            } catch (err) {
                console.error("Lỗi khi tắt luồng camera:", err);
            }
          }
          
          // Sau khi camera tắt hẳn mới ẩn giao diện quét và gọi tìm kiếm
          setIsScanning(false);
          setMapSearchTerm(decodedText);
          handleExactSearch(decodedText);
        },
        (errorMessage) => { 
          // Bỏ qua các cảnh báo không tìm thấy mã liên tục
        }
      ).catch((err) => {
        console.error("Lỗi khởi động camera:", err);
        setMapMessage({ text: '❌ Lỗi mở camera. Vui lòng cấp quyền truy cập!', type: 'error' });
        setIsScanning(false);
      });
    }, 150); // Tăng lên 150ms để an toàn hơn trên các dòng máy chậm
  };

  // Nút Hủy quét bằng tay
  const stopScannerManually = async () => {
    if (html5QrCodeRef.current) {
        try {
            await html5QrCodeRef.current.stop();
            // Tương tự, không dùng clear() ở đây
        } catch (err) {
            console.error("Lỗi dọn dẹp camera:", err);
        }
    }
    setIsScanning(false);
  };

  // Dọn dẹp khi chuyển tab hoặc unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && isScanning) {
        html5QrCodeRef.current.stop().then(() => {
            html5QrCodeRef.current.clear();
        }).catch(() => {});
      }
    };
  }, [isScanning]);

  // ==========================================
  // XỬ LÝ TAB 2: DANH SÁCH (GIỮ NGUYÊN)
  // ==========================================
  const fetchProductList = async (isNewSearch = false) => {
    setIsLoadingList(true);
    if (isNewSearch) setPage(0);
    const currentPage = isNewSearch ? 0 : page;
    const term = listSearchTerm.trim();
    let query = supabase.from('product_inventories').select('product_name, product_code, location_code', { count: 'exact' });
    if (term) query = query.or(`product_name.ilike.%${term}%,product_code.ilike.%${term}%`);
    query = query.order('location_code', { ascending: false, nullsFirst: false }).order('product_name', { ascending: true });
    query = query.range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);
    const { data, count, error } = await query;
    setIsLoadingList(false);
    if (!error && data) { setProducts(data); setTotalCount(count); }
  };

  const handleListSearch = (e) => {
    e.preventDefault();
    fetchProductList(true);
  };
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // ==========================================
  // RESPONSIVE MAP (TỰ ĐỘNG SCALE CHO PC/TABLET)
  // ==========================================
  const mapContainerRef = useRef(null);
  const [mapScale, setMapScale] = useState(1);
  const [mapContentSize, setMapContentSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!racks || racks.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    racks.forEach(rack => {
      const x = Number(rack.x) || 0; const y = Number(rack.y) || 0;
      const w = Number(rack.w) || 100; const h = Number(rack.h) || 40;
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w; if (y + h > maxY) maxY = y + h;
    });
    const padding = 60;
    setMapContentSize({ width: Math.max(maxX - minX + padding * 2, 800), height: Math.max(maxY - minY + padding * 2, 600) });
  }, [racks]);

  useEffect(() => {
    if (activeTab !== 'map' || isScanning) return;
    const container = mapContainerRef.current;
    if (!container) return;
    let rafId;
    const calculateScale = () => {
      if (!container) return;
      const cw = container.clientWidth; const ch = container.clientHeight;
      if (cw === 0 || ch === 0) { rafId = requestAnimationFrame(calculateScale); return; }
      setMapScale(Math.min(cw / mapContentSize.width, ch / mapContentSize.height, 1));
    };
    rafId = requestAnimationFrame(calculateScale);
    const observer = new ResizeObserver(() => calculateScale());
    observer.observe(container);
    return () => { cancelAnimationFrame(rafId); observer.disconnect(); };
  }, [activeTab, mapContentSize, isScanning]);

  // Click ra ngoài để đóng suggest
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 pb-20 sm:pb-16 mt-2 sm:mt-4 animate-in fade-in duration-300 px-2 sm:px-0">
      
      {/* HEADER & CHUYỂN TAB */}
      <div className="bg-white p-3 sm:p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2 sm:p-3 bg-blue-50 text-blue-600 rounded-xl shadow-inner shrink-0">
            <MapPin size={22} strokeWidth={2.5} className="max-sm:w-5 max-sm:h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">Tra cứu Vị trí</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Dẫn đường nhặt hàng nhanh chóng</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 w-full sm:w-auto">
          <button 
            onClick={() => { setActiveTab('map'); stopScannerManually(); }} 
            className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Search size={16} /> Tra cứu <span className="hidden sm:inline">nhanh</span>
          </button>
          <button 
            onClick={() => { setActiveTab('list'); stopScannerManually(); }} 
            className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <List size={16} /> Danh sách
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: TÌM KIẾM, SCAN & KẾT QUẢ */}
      {/* ========================================== */}
      {activeTab === 'map' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col">
            
            <div className="p-3 sm:p-5 bg-slate-50 border-b border-slate-200 rounded-t-2xl">
                {isScanning ? (
                  // Giao diện Camera (Chỉ hiện khi đang quét)
                  <div className="relative w-full max-w-lg mx-auto overflow-hidden rounded-2xl bg-black animate-in fade-in zoom-in-95">
                    <button 
                      onClick={stopScannerManually}
                      className="absolute top-2 right-2 z-50 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm"
                      title="Hủy quét"
                    >
                      <X size={24} />
                    </button>
                    <div id="reader" className="w-full min-h-[300px]"></div>
                    <div className="absolute bottom-4 left-0 right-0 text-center text-white/90 text-sm font-bold bg-black/50 py-2 backdrop-blur-sm px-4">
                      Đưa mã vạch hoặc QR vào khung hình
                    </div>
                  </div>
                ) : (
                  // Form tìm kiếm
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleExactSearch(mapSearchTerm); }} 
                      className="flex gap-2 sm:gap-3 relative z-10"
                    >
                      <div className="relative flex-1">
                        <input 
                            type="text" 
                            placeholder="Nhập tên, mã vạch..." 
                            value={mapSearchTerm}
                            onChange={handleSearchInputChange}
                            onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
                            className="w-full px-4 py-3 sm:py-3 pr-12 text-base sm:text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-800 bg-white"
                        />
                        <button
                          type="button"
                          onClick={startScanner}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 transition bg-white rounded-lg"
                          title="Quét mã vạch"
                        >
                          <Camera size={22} />
                        </button>
                      </div>
                      
                      <button 
                          type="submit" 
                          disabled={isSearchingMap || !mapSearchTerm.trim()}
                          className="flex items-center justify-center px-4 sm:px-5 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 transition disabled:opacity-50 shrink-0"
                      >
                          {isSearchingMap ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                      </button>
                    </form>

                    {/* Drobdown Gợi ý tìm kiếm */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto animate-in slide-in-from-top-1">
                        {suggestions.map((p, index) => (
                          <div 
                            key={index}
                            onClick={() => processSelectedProduct(p)}
                            className="p-3.5 border-b border-slate-50 last:border-none hover:bg-blue-50 cursor-pointer flex flex-col transition"
                          >
                            <span className="font-bold text-slate-800 text-sm line-clamp-1">{p.product_name}</span>
                            <span className="text-xs text-slate-500 mt-1">Mã: {p.product_code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* THẺ KẾT QUẢ CỰC TO CHO DI ĐỘNG & NHẶT HÀNG */}
                {searchedProduct && !isScanning && (
                    <div className="mt-4 p-5 sm:p-6 bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-2xl shadow-md flex flex-col sm:flex-row gap-4 sm:gap-6 justify-between items-center animate-in slide-in-from-top-2">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 w-full sm:w-auto text-center sm:text-left">
                            <div className="p-4 bg-blue-100 text-blue-700 rounded-2xl shrink-0 hidden sm:block">
                                <Package size={36} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-black text-slate-900 text-xl sm:text-2xl leading-tight break-words">{searchedProduct.product_name}</h3>
                                <p className="text-sm font-bold text-slate-500 mt-2 uppercase bg-slate-100 inline-block px-3 py-1 rounded-lg">Mã: {searchedProduct.product_code}</p>
                            </div>
                        </div>
                        
                        <div className="w-full sm:w-auto bg-white border-4 border-red-50 sm:border-none p-5 sm:p-0 rounded-2xl text-center sm:text-right shrink-0 shadow-inner sm:shadow-none mt-2 sm:mt-0">
                            <span className="text-sm text-slate-500 uppercase font-black tracking-widest block mb-2">Vị trí lấy hàng</span>
                            <span className={`text-6xl sm:text-5xl font-black block leading-none tracking-tight ${searchedProduct.location_code ? 'text-red-600' : 'text-amber-500'}`}>
                                {searchedProduct.location_code || 'CHƯA CÓ'}
                            </span>
                        </div>
                    </div>
                )}

                {mapMessage.text && !isScanning && (
                    <div className={`mt-4 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border ${mapMessage.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        <AlertCircle size={20} className="shrink-0" /> {mapMessage.text}
                    </div>
                )}
            </div>

            {/* SƠ ĐỒ KHO (ẨN TRÊN ĐIỆN THOẠI) */}
            {!isScanning && racks.length > 0 && (
              <div 
                ref={mapContainerRef}
                className="relative w-full h-[550px] bg-slate-100 overflow-hidden hidden sm:flex items-center justify-center rounded-b-2xl border-t border-slate-200"
              >
                  <div 
                    style={{
                      width: mapContentSize.width,
                      height: mapContentSize.height,
                      transform: `scale(${mapScale})`,
                      transformOrigin: 'center center',
                      backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                      position: 'relative',
                      flexShrink: 0
                    }}
                  >
                    {racks.map(rack => {
                      const isHighlight = highlightedRack === rack.id;
                      return (
                        <div 
                          key={rack.id}
                          className={`absolute flex flex-col items-center justify-center border-2 rounded-lg transition-all duration-300 ${
                            isHighlight 
                              ? 'bg-red-500 border-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse z-40 scale-105' 
                              : 'bg-white border-slate-300 text-slate-700 shadow-sm'
                          }`}
                          style={{ left: rack.x, top: rack.y, width: rack.w, height: rack.h }}
                        >
                          <span className="font-black text-xs sm:text-sm text-center px-1 break-words line-clamp-2">{rack.name}</span>
                          {isHighlight && (
                            <div className="absolute -top-10 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap animate-bounce z-10 shadow-lg">
                              👇 LẤY HÀNG Ở ĐÂY
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-300/80 backdrop-blur text-slate-800 px-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest pointer-events-none shadow-sm">
                      Cửa Chính
                    </div>
                  </div>
              </div>
            )}
            
            {/* TRẠNG THÁI TRỐNG SƠ ĐỒ */}
            {!isScanning && racks.length === 0 && activeTab === 'map' && (
              <div className="hidden sm:flex flex-col items-center justify-center py-24 text-slate-400 bg-slate-100 rounded-b-2xl border-t border-slate-200">
                  <Box size={50} className="mb-4 opacity-30" />
                  <p className="text-sm font-medium">Chưa có sơ đồ kho.</p>
              </div>
            )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: DANH SÁCH (GIỮ NGUYÊN) */}
      {/* ========================================== */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col animate-in fade-in">
            <div className="p-3 sm:p-5 bg-slate-50 border-b border-slate-200">
                <form onSubmit={handleListSearch} className="flex gap-2 sm:gap-3">
                    <input 
                        type="text" 
                        inputMode="search"
                        placeholder="Lọc theo Tên SP, Mã Vạch..." 
                        value={listSearchTerm}
                        onChange={(e) => setListSearchTerm(e.target.value)}
                        className="flex-1 px-4 py-3 text-base sm:text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 bg-white min-w-0"
                    />
                    <button 
                        type="submit" 
                        disabled={isLoadingList} 
                        className="px-5 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-sm hover:bg-slate-900 transition disabled:opacity-50 shrink-0 min-h-[48px] sm:min-h-0 flex items-center justify-center"
                    >
                        {isLoadingList ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                    </button>
                </form>
            </div>

            <div className="p-0 sm:p-2 overflow-x-auto -mx-2 sm:mx-0">
                {isLoadingList ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                        <Loader2 size={24} className="animate-spin text-blue-500" />
                        <p className="text-xs font-bold mt-2">Đang tải danh sách...</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <Box size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-bold">Không tìm thấy sản phẩm nào.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider hidden sm:table-row">
                                <th className="p-4 border-b border-slate-100 w-2/3">Sản phẩm</th>
                                <th className="p-4 border-b border-slate-100 text-right w-1/3">Vị trí Lưu trữ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.map(p => (
                                <tr key={p.product_code} className="hover:bg-blue-50/30 transition flex flex-col sm:table-row p-3.5 sm:p-0 border-b border-slate-100 sm:border-b-0">
                                    <td className="p-1 sm:p-4">
                                        <div className="font-black text-slate-900 text-sm sm:text-base leading-tight break-words">{p.product_name}</div>
                                        <div className="text-[11px] font-medium text-slate-500 mt-1 uppercase tracking-wide">Mã: {p.product_code}</div>
                                    </td>
                                    <td className="p-1 sm:p-4 sm:text-right mt-2 sm:mt-0">
                                        <span className={`inline-block px-3 py-1.5 border rounded-lg text-xs font-black tracking-wide ${p.location_code ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                            {p.location_code ? p.location_code : 'Chưa có vị trí'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* PHÂN TRANG */}
            {!isLoadingList && totalPages > 1 && (
                <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-500 hidden sm:inline-block">
                        Hiển thị {(page * ITEMS_PER_PAGE) + 1} - {Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} / Tổng {totalCount} SP
                    </span>
                    <span className="text-xs font-bold text-slate-500 sm:hidden w-full text-center">
                        {totalCount} sản phẩm (Trang {page + 1}/{totalPages})
                    </span>
                    <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
                        <button 
                            onClick={() => setPage(p => Math.max(0, p - 1))} 
                            disabled={page === 0}
                            className="flex items-center justify-center gap-1 w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[40px] sm:min-h-0"
                        >
                            <ChevronLeft size={16} /> <span className="hidden sm:inline">Trang trước</span>
                        </button>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                            disabled={page >= totalPages - 1}
                            className="flex items-center justify-center gap-1 w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[40px] sm:min-h-0"
                        >
                            <span className="hidden sm:inline">Trang sau</span> <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
      )}

    </div>
  );
}