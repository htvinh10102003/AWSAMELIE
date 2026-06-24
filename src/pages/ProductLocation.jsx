import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MapPin, Search, List, Map, Loader2, Package, ChevronLeft, ChevronRight, AlertCircle, Box
} from 'lucide-react';

export default function ProductLocation() {
  const [activeTab, setActiveTab] = useState('map');

  // ==========================================
  // STATES CHO TAB 1: SƠ ĐỒ KHO
  // ==========================================
  const [mapSearchTerm, setMapSearchTerm] = useState('');
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [searchedProduct, setSearchedProduct] = useState(null);
  const [highlightedRack, setHighlightedRack] = useState(null);
  const [mapMessage, setMapMessage] = useState({ text: '', type: '' });
  
  const [racks, setRacks] = useState([]);

  // ==========================================
  // STATES CHO TAB 2: DANH SÁCH VỊ TRÍ
  // ==========================================
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 50;

  // ==========================================
  // LẤY DỮ LIỆU BAN ĐẦU
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
  // XỬ LÝ TAB 1: TÌM TRÊN SƠ ĐỒ
  // ==========================================
  const handleMapSearch = async (e) => {
    e.preventDefault();
    if (!mapSearchTerm.trim()) return;

    setIsSearchingMap(true);
    setMapMessage({ text: '', type: '' });
    setHighlightedRack(null);
    setSearchedProduct(null);

    const term = mapSearchTerm.trim();

    const { data, error } = await supabase
        .from('product_inventories')
        .select('product_name, product_code, location_code')
        .or(`product_name.ilike.%${term}%,product_code.eq.${term}`)
        .limit(1)
        .single();

    setIsSearchingMap(false);

    if (error || !data) {
        setMapMessage({ text: '❌ Không tìm thấy sản phẩm này trong kho!', type: 'error' });
    } else {
        setSearchedProduct(data);
        if (data.location_code) {
            const targetRack = racks.find(r => r.name.toLowerCase().trim() === data.location_code.toLowerCase().trim());
            if (targetRack) {
                setHighlightedRack(targetRack.id);
            } else {
                setMapMessage({ text: `⚠️ Sản phẩm nằm ở "${data.location_code}" nhưng vị trí này chưa được vẽ trên sơ đồ!`, type: 'warning' });
            }
        } else {
            setMapMessage({ text: '⚠️ Sản phẩm này chưa được gán vị trí nào cả!', type: 'warning' });
        }
    }
  };

  // ==========================================
  // XỬ LÝ TAB 2: DANH SÁCH & PHÂN TRANG
  // ==========================================
  const fetchProductList = async (isNewSearch = false) => {
    setIsLoadingList(true);
    if (isNewSearch) setPage(0);
    
    const currentPage = isNewSearch ? 0 : page;
    const term = listSearchTerm.trim();

    let query = supabase.from('product_inventories')
        .select('product_name, product_code, location_code', { count: 'exact' });

    if (term) {
        query = query.or(`product_name.ilike.%${term}%,product_code.ilike.%${term}%`);
    }

    query = query.order('location_code', { ascending: false, nullsFirst: false }).order('product_name', { ascending: true });
    query = query.range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

    const { data, count, error } = await query;
    
    setIsLoadingList(false);
    if (!error && data) {
        setProducts(data);
        setTotalCount(count);
    }
  };

  const handleListSearch = (e) => {
    e.preventDefault();
    fetchProductList(true);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // ==========================================
  // RESPONSIVE MAP - tự động scale vừa khung
  // ==========================================
  const mapContainerRef = useRef(null);
  const [mapScale, setMapScale] = useState(1);
  const [mapContentSize, setMapContentSize] = useState({ width: 800, height: 600 });

  // Tính kích thước bao phủ tất cả racks
  useEffect(() => {
    if (!racks || racks.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    racks.forEach(rack => {
      const x = Number(rack.x) || 0;
      const y = Number(rack.y) || 0;
      const w = Number(rack.w) || 100;
      const h = Number(rack.h) || 40;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    });

    const padding = 60;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    setMapContentSize({ width: Math.max(width, 800), height: Math.max(height, 600) });
  }, [racks]);

  // Tính scale khi tab map active và container sẵn sàng
  useEffect(() => {
    if (activeTab !== 'map') return;
    const container = mapContainerRef.current;
    if (!container) return;

    let rafId;
    const calculateScale = () => {
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw === 0 || ch === 0) {
        // Chưa có kích thước, thử lại frame sau
        rafId = requestAnimationFrame(calculateScale);
        return;
      }
      const scaleX = cw / mapContentSize.width;
      const scaleY = ch / mapContentSize.height;
      const newScale = Math.min(scaleX, scaleY, 1);
      setMapScale(newScale);
    };

    // Đợi layout hoàn tất rồi mới tính
    rafId = requestAnimationFrame(calculateScale);

    // Theo dõi thay đổi kích thước
    const observer = new ResizeObserver(() => {
      calculateScale();
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [activeTab, mapContentSize]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 pb-20 sm:pb-16 mt-2 sm:mt-4 animate-in fade-in duration-300 px-2 sm:px-0">
      
      {/* HEADER & CHUYỂN TAB */}
      <div className="bg-white p-3 sm:p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
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
            onClick={() => setActiveTab('map')} 
            className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] sm:min-h-0 ${activeTab === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Map size={16} /> Sơ đồ
          </button>
          <button 
            onClick={() => setActiveTab('list')} 
            className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] sm:min-h-0 ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <List size={16} /> Danh sách
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: SƠ ĐỒ ĐỊNH VỊ TRỰC QUAN (RESPONSIVE) */}
      {/* ========================================== */}
      {activeTab === 'map' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            
            {/* Thanh tìm kiếm */}
            <div className="p-3 sm:p-5 bg-slate-50 border-b border-slate-200">
                <form onSubmit={handleMapSearch} className="flex gap-2 sm:gap-3">
                    <input 
                        type="text" 
                        inputMode="search"
                        placeholder="Nhập tên SP hoặc mã vạch..." 
                        value={mapSearchTerm}
                        onChange={(e) => setMapSearchTerm(e.target.value)}
                        className="flex-1 px-4 py-3 text-base sm:text-sm border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-800 bg-white min-w-0"
                    />
                    <button 
                        type="submit" 
                        disabled={isSearchingMap || !mapSearchTerm.trim()}
                        className="flex items-center justify-center px-5 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 transition disabled:opacity-50 shrink-0 min-h-[48px] sm:min-h-0"
                    >
                        {isSearchingMap ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                    </button>
                </form>

                {/* Kết quả tìm kiếm */}
                {searchedProduct && (
                    <div className="mt-4 p-4 bg-white border border-blue-100 rounded-xl shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center animate-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5"><Package size={20}/></div>
                            <div className="min-w-0">
                                <h3 className="font-black text-slate-800 text-sm sm:text-base leading-snug break-words">{searchedProduct.product_name}</h3>
                                <p className="text-xs text-slate-500 mt-0.5 uppercase">Mã: {searchedProduct.product_code}</p>
                            </div>
                        </div>
                        <div className="w-full sm:w-auto text-center sm:text-right bg-slate-100 sm:bg-transparent p-2 sm:p-0 rounded-lg shrink-0">
                            <span className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-bold tracking-widest block mb-0.5">Vị trí nhặt hàng</span>
                            <span className={`text-base sm:text-lg font-black ${highlightedRack ? 'text-red-600' : 'text-amber-600'}`}>
                                {searchedProduct.location_code || 'CHƯA GÁN VỊ TRÍ'}
                            </span>
                        </div>
                    </div>
                )}

                {mapMessage.text && (
                    <div className={`mt-3 p-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border ${mapMessage.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        <AlertCircle size={16} className="shrink-0" /> {mapMessage.text}
                    </div>
                )}
            </div>

            {/* KHUNG BẢN ĐỒ RESPONSIVE - CĂN GIỮA BẰNG FLEX */}
            <div 
              ref={mapContainerRef}
              className="relative w-full h-[65vh] sm:h-[600px] bg-slate-100 overflow-hidden flex items-center justify-center"
            >
              {racks.length === 0 ? (
                <div className="text-slate-400 text-sm font-medium">Chưa có sơ đồ kho. Báo Admin cấu hình nhé!</div>
              ) : (
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
                            ? 'bg-red-500 border-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse z-50 scale-105' 
                            : 'bg-white border-slate-300 text-slate-700 shadow-sm'
                        }`}
                        style={{ left: rack.x, top: rack.y, width: rack.w, height: rack.h }}
                      >
                        <span className="font-black text-xs sm:text-sm text-center px-1 break-words line-clamp-2">{rack.name}</span>
                        {isHighlight && (
                          <div className="absolute -top-10 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap animate-bounce z-10">
                            👇 LẤY HÀNG Ở ĐÂY
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-300/80 backdrop-blur text-slate-700 px-8 py-2 rounded-xl font-bold text-xs uppercase tracking-widest pointer-events-none shadow-sm">
                    Cửa Chính
                  </div>
                </div>
              )}
            </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: BẢNG TỔNG HỢP VỊ TRÍ */}
      {/* ========================================== */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            
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
                        <p className="text-xs font-bold">Đang tải danh sách...</p>
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
                                <tr key={p.product_code} className="hover:bg-blue-50/30 transition flex flex-col sm:table-row p-3 sm:p-0 border-b border-slate-100 sm:border-b-0">
                                    <td className="p-1 sm:p-4">
                                        <div className="font-black text-slate-800 text-sm sm:text-base leading-tight break-words">{p.product_name}</div>
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
                            className="flex items-center gap-1 px-4 py-2.5 sm:py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[40px] sm:min-h-0"
                        >
                            <ChevronLeft size={16} /> <span className="hidden sm:inline">Trang trước</span>
                        </button>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                            disabled={page >= totalPages - 1}
                            className="flex items-center gap-1 px-4 py-2.5 sm:py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[40px] sm:min-h-0"
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