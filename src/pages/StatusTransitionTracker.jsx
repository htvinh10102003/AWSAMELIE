import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, Search, Filter, Loader2, ArrowRight, 
  PackageSearch, Clock, User, Box, Hash, ChevronDown, 
  ChevronLeft, ChevronRight, CheckSquare, Square
} from 'lucide-react';

export default function StatusTransitionTracker() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [statuses, setStatuses] = useState([]);

  // States: Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50; // Hiển thị 50 dòng mỗi trang

  // States: Bộ lọc cơ bản
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    productSearch: '',
    minQuantity: '',
  });

  // States: Multi-select Trạng thái
  const [selectedFromStatuses, setSelectedFromStatuses] = useState([]);
  const [selectedToStatuses, setSelectedToStatuses] = useState([]);
  const [isFromOpen, setIsFromOpen] = useState(false);
  const [isToOpen, setIsToOpen] = useState(false);

  // Load danh sách trạng thái
  useEffect(() => {
    const fetchStatuses = async () => {
      const { data, error } = await supabase
        .from('order_statuses')
        .select('*')
        .order('id', { ascending: true });
      
      if (!error && data) {
        setStatuses(data);
      }
    };
    fetchStatuses();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Hàm toggle chọn nhiều trạng thái
  const toggleStatus = (type, id) => {
    if (type === 'from') {
      setSelectedFromStatuses(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    } else {
      setSelectedToStatuses(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    }
  };

  // Gắn page vào hàm fetch để gọi mỗi khi sang trang
  const fetchData = async (page = 1) => {
    if (selectedFromStatuses.length === 0 || selectedToStatuses.length === 0) {
      alert("Vui lòng chọn ít nhất 1 trạng thái ban đầu và 1 trạng thái chuyển mới!");
      return;
    }

    setIsLoading(true);
    
    // Nếu lọc mới thì clear list cũ
    if (page === 1) {
      setResults([]);
      setCurrentPage(1);
    }

    try {
      // Tính toán Range cho Phân trang
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('order_histories')
        .select(`
          id,
          created_at,
          created_by_name,
          status_old,
          status_new,
          order_id,
          orders!inner (
            id,
            carrier_name,
            order_products!inner (
              product_code,
              product_name,
              quantity
            )
          )
        `, { count: 'exact' }) // Cờ count: 'exact' báo cho Supabase trả về tổng số bản ghi thoả mãn
        .in('status_old', selectedFromStatuses)
        .in('status_new', selectedToStatuses)
        .gte('created_at', `${filters.startDate}T00:00:00.000Z`)
        .lte('created_at', `${filters.endDate}T23:59:59.999Z`)
        .order('created_at', { ascending: false });

      if (filters.productSearch.trim()) {
        query = query.ilike('orders.order_products.product_name', `%${filters.productSearch.trim()}%`);
      }

      if (filters.minQuantity) {
        query = query.gte('orders.order_products.quantity', parseFloat(filters.minQuantity));
      }

      // Áp dụng Phân trang
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;
      
      setResults(data || []);
      setTotalCount(count || 0);
      setCurrentPage(page);

    } catch (error) {
      console.error("Lỗi khi truy vấn dữ liệu:", error);
      alert("Lỗi khi lấy dữ liệu: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData(1); // Click nút tìm kiếm thì luôn về trang 1
  };

  const getStatusName = (id) => {
    const st = statuses.find(s => s.id === id);
    return st ? st.name : `Trạng thái ${id}`;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans animate-fade-in mt-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
          <Clock size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tra cứu luân chuyển trạng thái</h2>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Lọc lịch sử thao tác đơn hàng theo thời gian và sản phẩm</p>
        </div>
      </div>

      {/* BỘ LỌC */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          
          {/* Cột 1: Thời gian */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Từ ngày</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="date" 
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Đến ngày</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="date" 
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Cột 2: Trạng thái (Multi-select) */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-red-500">Trạng thái cũ *</label>
              <div className="relative">
                <div 
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 cursor-pointer flex justify-between items-center select-none"
                  onClick={() => setIsFromOpen(!isFromOpen)}
                >
                  <span className="truncate">
                    {selectedFromStatuses.length === 0 
                      ? '-- Chọn nhiều trạng thái --' 
                      : `Đã chọn ${selectedFromStatuses.length} trạng thái`}
                  </span>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isFromOpen ? 'rotate-180' : ''}`} />
                </div>
                {/* Dropdown Box */}
                {isFromOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsFromOpen(false)}></div>
                    <div className="absolute z-20 top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1 animate-in slide-in-from-top-2">
                      {statuses.map(st => (
                        <div 
                          key={st.id} 
                          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => toggleStatus('from', st.id)}
                        >
                          {selectedFromStatuses.includes(st.id) ? (
                            <CheckSquare size={16} className="text-blue-600 shrink-0" />
                          ) : (
                            <Square size={16} className="text-slate-300 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-slate-700">{st.id} - {st.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-green-600">Trạng thái mới *</label>
              <div className="relative">
                <div 
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 cursor-pointer flex justify-between items-center select-none"
                  onClick={() => setIsToOpen(!isToOpen)}
                >
                  <span className="truncate">
                    {selectedToStatuses.length === 0 
                      ? '-- Chọn nhiều trạng thái --' 
                      : `Đã chọn ${selectedToStatuses.length} trạng thái`}
                  </span>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${isToOpen ? 'rotate-180' : ''}`} />
                </div>
                {/* Dropdown Box */}
                {isToOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsToOpen(false)}></div>
                    <div className="absolute z-20 top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1 animate-in slide-in-from-top-2">
                      {statuses.map(st => (
                        <div 
                          key={st.id} 
                          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => toggleStatus('to', st.id)}
                        >
                          {selectedToStatuses.includes(st.id) ? (
                            <CheckSquare size={16} className="text-blue-600 shrink-0" />
                          ) : (
                            <Square size={16} className="text-slate-300 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-slate-700">{st.id} - {st.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Cột 3 & 4: Hàng hóa */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tên / Mã sản phẩm</label>
              <div className="relative">
                <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  name="productSearch"
                  placeholder="Nhập từ khóa sản phẩm cần lọc..."
                  value={filters.productSearch}
                  onChange={handleFilterChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Số lượng Tối thiểu</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="number" 
                  name="minQuantity"
                  placeholder="Ví dụ: Lọc đơn có SP này >= 2"
                  value={filters.minQuantity}
                  onChange={handleFilterChange}
                  min="1"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold transition-all shadow-sm"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Filter className="w-5 h-5" />}
          {isLoading ? 'Đang truy vấn dữ liệu...' : 'Lọc dữ liệu (Tối đa 50 dòng/trang)'}
        </button>
      </div>

      {/* KẾT QUẢ TÌM KIẾM */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-4 border-b border-slate-200">Thời gian thao tác</th>
                <th className="px-5 py-4 border-b border-slate-200">Mã đơn hàng</th>
                <th className="px-5 py-4 border-b border-slate-200">Người thực hiện</th>
                <th className="px-5 py-4 border-b border-slate-200">Luân chuyển</th>
                <th className="px-5 py-4 border-b border-slate-200 w-[300px]">Chi tiết sản phẩm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-16 text-center text-slate-400 font-medium">
                    {isLoading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu phù hợp với bộ lọc. Hãy điều chỉnh tiêu chí tìm kiếm.'}
                  </td>
                </tr>
              ) : (
                results.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {new Date(row.created_at).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(row.created_at).toLocaleTimeString('vi-VN')}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono font-bold text-blue-600">{row.order_id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{row.orders?.carrier_name || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                          <User size={12} className="text-slate-500" />
                        </div>
                        <span className="font-medium">{row.created_by_name || 'Hệ thống'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200 max-w-[120px] truncate" title={getStatusName(row.status_old)}>
                          {getStatusName(row.status_old)}
                        </span>
                        <ArrowRight size={14} className="text-slate-400 shrink-0" />
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md border border-blue-200 max-w-[120px] truncate" title={getStatusName(row.status_new)}>
                          {getStatusName(row.status_new)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-2 max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                        {row.orders?.order_products?.map((product, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <Box size={14} className="text-blue-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-700 truncate" title={product.product_name}>
                                {product.product_name}
                              </p>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-slate-400 font-mono text-[10px]">{product.product_code}</span>
                                <span className="font-bold text-orange-600 bg-orange-100 px-1.5 rounded">
                                  SL: {product.quantity}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* COMPONENT PHÂN TRANG */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-slate-200 bg-white gap-4">
          <div className="text-sm text-slate-500">
            Hiển thị <span className="font-bold text-slate-700">{totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> đến <span className="font-bold text-slate-700">{Math.min(currentPage * pageSize, totalCount)}</span> trong tổng số <span className="font-bold text-blue-600">{totalCount}</span> kết quả
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-slate-600 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
              Trang {currentPage} / {totalPages || 1}
            </span>
            <button
              onClick={() => fetchData(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}