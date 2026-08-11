import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, Search, Filter, Loader2, ArrowRight, 
  PackageSearch, Clock, User, Box, Hash 
} from 'lucide-react';

export default function StatusTransitionTracker() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [statuses, setStatuses] = useState([]);

  // Form State
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    fromStatus: '',
    toStatus: '',
    productSearch: '',
    minQuantity: '',
  });

  // Load danh sách trạng thái để đưa vào Dropdown
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

  const handleSearch = async () => {
    if (!filters.fromStatus || !filters.toStatus) {
      alert("Vui lòng chọn trạng thái ban đầu và trạng thái chuyển mới!");
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      // Bắt đầu query với Inner Join để có thể filter dựa trên bảng con
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
        `)
        .eq('status_old', parseInt(filters.fromStatus))
        .eq('status_new', parseInt(filters.toStatus))
        .gte('created_at', `${filters.startDate}T00:00:00.000Z`)
        .lte('created_at', `${filters.endDate}T23:59:59.999Z`)
        .order('created_at', { ascending: false });

      // Nếu có nhập tên/mã sản phẩm
      if (filters.productSearch.trim()) {
        query = query.ilike('orders.order_products.product_name', `%${filters.productSearch.trim()}%`);
      }

      // Nếu có nhập số lượng tối thiểu
      if (filters.minQuantity) {
        query = query.gte('orders.order_products.quantity', parseFloat(filters.minQuantity));
      }

      const { data, error } = await query;

      if (error) throw error;
      setResults(data || []);

    } catch (error) {
      console.error("Lỗi khi truy vấn dữ liệu:", error);
      alert("Lỗi khi lấy dữ liệu: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper để lấy tên trạng thái từ ID
  const getStatusName = (id) => {
    const st = statuses.find(s => s.id === id);
    return st ? st.name : `Trạng thái ${id}`;
  };

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

      {/* BỘ LỌC (FILTERS) */}
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

          {/* Cột 2: Trạng thái */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-red-500">Trạng thái cũ *</label>
              <select 
                name="fromStatus" 
                value={filters.fromStatus} 
                onChange={handleFilterChange}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
              >
                <option value="">-- Chọn trạng thái --</option>
                {statuses.map(st => (
                  <option key={st.id} value={st.id}>{st.id} - {st.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-green-600">Trạng thái mới *</label>
              <select 
                name="toStatus" 
                value={filters.toStatus} 
                onChange={handleFilterChange}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
              >
                <option value="">-- Chọn trạng thái --</option>
                {statuses.map(st => (
                  <option key={st.id} value={st.id}>{st.id} - {st.name}</option>
                ))}
              </select>
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
          Lọc dữ liệu
        </button>
      </div>

      {/* KẾT QUẢ TÌM KIẾM */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <span className="font-bold text-slate-700">Kết quả tra cứu</span>
          <span className="text-xs font-medium px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">
            Tìm thấy {results.length} bản ghi
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-4 border-b border-slate-200">Thời gian thao tác</th>
                <th className="px-5 py-4 border-b border-slate-200">Mã đơn hàng</th>
                <th className="px-5 py-4 border-b border-slate-200">Người thực hiện</th>
                <th className="px-5 py-4 border-b border-slate-200">Luân chuyển</th>
                <th className="px-5 py-4 border-b border-slate-200">Chi tiết sản phẩm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-slate-400 font-medium">
                    {isLoading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu phù hợp với bộ lọc.'}
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
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                          {getStatusName(row.status_old)}
                        </span>
                        <ArrowRight size={14} className="text-slate-400" />
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md border border-blue-200">
                          {getStatusName(row.status_new)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-[300px]">
                      <div className="space-y-2">
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
      </div>
    </div>
  );
}