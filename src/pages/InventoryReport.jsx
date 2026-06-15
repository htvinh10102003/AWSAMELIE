import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Boxes, Search, RefreshCw, ChevronLeft, 
  ChevronRight, FileX, Package, Truck, Home
} from 'lucide-react';

export default function InventoryReport() {
  // --- STATES QUẢN LÝ DỮ LIỆU & BỘ LỌC ---
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState([]);

  // --- STATES QUẢN LÝ PHÂN TRANG (CHỐNG SẬP KHI SỐ SKU LỚN) ---
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50; // Hiển thị 50 mặt hàng mỗi trang cho tối ưu tốc độ

  // --- HÀM KÉO DATA TỪ BẢNG product_inventories ---
  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('product_inventories')
        .select('product_code, product_name, remain, shipping, on_hand', { count: 'exact' });

      // Nếu có nhập thanh tìm kiếm (Tìm theo Tên hoặc SKU Code)
      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`product_name.ilike.%${term}%,product_code.ilike.%${term}%`);
      }

      // Xử lý phân trang range dựa trên số trang hiện tại
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('remain', { ascending: false }) // Ưu tiên các mã có tổng tồn nhiều nhất lên đầu
        .range(from, to);

      if (error) throw error;

      setInventory(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("❌ Lỗi tải báo cáo tồn kho:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tự động gọi lại data khi lật trang
  useEffect(() => {
    fetchInventoryData();
  }, [currentPage]);

  // Xử lý khi nhấn nút tìm kiếm hoặc Enter
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(0); // Reset về trang 1
    fetchInventoryData();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 provinces pb-10">
      
      {/* 1. HEADER TIÊU ĐỀ TRANG CÔNG NGHỆ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Boxes size={18} /></span>
            Báo cáo Tồn Kho Tổng Hợp
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Theo dõi chi tiết cán cân tổng tồn, hàng đang chuyển và thực tế on-hand tại kho Amelie</p>
        </div>

        <div className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-4 py-2.5 rounded-xl shadow-inner">
          Tổng số mặt hàng (SKU): <span className="text-blue-600 font-black text-sm">{totalCount}</span> mã
        </div>
      </div>

      {/* 2. THANH TÌM KIẾM SIÊU TỐC */}
      <div className="w-full md:max-w-md flex gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm theo tên sản phẩm hoặc mã SKU..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition shadow-sm"
            />
          </div>
          <button type="submit" className="px-5 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm flex-shrink-0">
            Tìm kiếm
          </button>
        </form>
      </div>

      {/* 3. BẢNG HIỂN THỊ DỮ LIỆU TỒN KHO BAO MƯỢT */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 font-bold uppercase border-b border-slate-200/80">
                <th className="p-4 w-44">Mã SKU Sản phẩm</th>
                <th className="p-4">Tên sản phẩm thiết kế</th>
                <th className="p-4 w-32 text-center">Tổng tồn (Remain)</th>
                <th className="p-4 w-32 text-center">Đang chuyển (Shipping)</th>
                <th className="p-4 w-36 text-center">Tồn thực tế (On Hand)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                /* LOADING LOADING LOADING */
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400 animate-pulse font-bold">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Đang bốc tách dữ liệu kho hàng...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                /* EMPTY STATE TRỐNG */
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400 font-medium">
                    <FileX size={36} className="mx-auto mb-2 text-slate-300" />
                    Không tìm thấy sản phẩm nào khớp với từ khóa tìm kiếm.
                  </td>
                </tr>
              ) : (
                inventory.map(item => (
                  <tr key={item.product_code} className="hover:bg-slate-50/50 transition">
                    {/* Cột SKU */}
                    <td className="p-4 font-black text-slate-900 tracking-wide font-mono text-[11px]">
                      {item.product_code}
                    </td>
                    
                    {/* Cột Tên sản phẩm */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 text-slate-500 rounded-md"><Package size={12} /></div>
                        <span className="font-bold text-slate-800 text-xs truncate max-w-sm" title={item.product_name}>
                          {item.product_name}
                        </span>
                      </div>
                    </td>

                    {/* Cột Tổng tồn - Badge màu Xám trung tính */}
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-black min-w-[56px] justify-center">
                        {item.remain}
                      </span>
                    </td>

                    {/* Cột Đang chuyển - Badge màu Xanh Dương chuyển động */}
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black min-w-[56px] justify-center border ${
                        Number(item.shipping) > 0 
                          ? 'bg-blue-50 border-blue-200 text-blue-600' 
                          : 'bg-slate-50 border-slate-100 text-slate-400 font-medium'
                      }`}>
                        {Number(item.shipping) > 0 && <Truck size={10} />}
                        {item.shipping}
                      </span>
                    </td>

                    {/* Cột Tồn thực tế trong kho - Badge màu Xanh Lá cực nét */}
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black min-w-[64px] justify-center border ${
                        Number(item.on_hand) > 0 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600 text-sm' 
                          : 'bg-red-50 border-red-100 text-red-500'
                      }`}>
                        {Number(item.on_hand) > 0 && <Home size={10} />}
                        {item.on_hand}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 4. THANH PHÂN TRANG ĐIỀU HƯỚNG MƯỢT MÀ */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              Trang {currentPage + 1} / {totalPages} (Hiển thị {inventory.length} dòng dữ liệu)
            </span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0 || loading}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage === totalPages - 1 || loading}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}