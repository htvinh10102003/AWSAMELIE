import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, DownloadCloud, Loader2, CalendarDays, 
  ChevronDown, ChevronLeft, ChevronRight, PackageCheck
} from 'lucide-react';

const SALE_CHANNELS = {
    '1': 'Admin', '2': 'Website', '10': 'API', '20': 'Facebook', '21': 'Instagram',
    '41': 'Lazada', '42': 'Shopee', '43': 'Sendo', '45': 'Tiki', '48': 'Tiktok Shop',
    '49': 'Zalo OA', '50': 'Shopee chat', '51': 'Lazada chat', '52': 'Zalo cá nhân'
};

const CHANNEL_COLORS = {
    '1': 'bg-slate-100/80 text-slate-700', '2': 'bg-indigo-100/80 text-indigo-700',
    '10': 'bg-violet-100/80 text-violet-700', '20': 'bg-blue-100/80 text-blue-700',
    '21': 'bg-pink-100/80 text-pink-700', '41': 'bg-orange-100/80 text-orange-700',
    '42': 'bg-red-100/80 text-red-700', '43': 'bg-cyan-100/80 text-cyan-700',
    '45': 'bg-teal-100/80 text-teal-700', '48': 'bg-gray-100/80 text-gray-700',
    '49': 'bg-blue-100/80 text-blue-700', '50': 'bg-red-100/80 text-red-700',
    '51': 'bg-orange-100/80 text-orange-700', '52': 'bg-green-100/80 text-green-700'
};

const STATUS_COLORS = {
    '1': 'bg-gray-100/80 text-gray-700', '2': 'bg-yellow-100/80 text-yellow-700',
    '3': 'bg-blue-100/80 text-blue-700', '4': 'bg-purple-100/80 text-purple-700',
    '5': 'bg-indigo-100/80 text-indigo-700', '6': 'bg-green-100/80 text-green-700',
    '7': 'bg-teal-100/80 text-teal-700', '8': 'bg-rose-100/80 text-rose-700',
    '9': 'bg-red-100/80 text-red-700', '10': 'bg-orange-100/80 text-orange-700',
    '20': 'bg-cyan-100/80 text-cyan-700', '30': 'bg-green-100/80 text-green-700',
    '40': 'bg-emerald-100/80 text-emerald-700', '42': 'bg-green-100/80 text-green-700',
};

// Component MultiSelect dùng chung
const MultiSelect = ({ options, selected, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getValue = (opt) => typeof opt === 'string' ? opt : opt.value;
    const getLabel = (opt) => typeof opt === 'string' ? opt : opt.label;

    const toggleOption = (value) => {
        if (selected.includes(value)) onChange(selected.filter(v => v !== value));
        else onChange([...selected, value]);
    };

    const allValues = options.map(getValue);
    const isAllSelected = allValues.length > 0 && allValues.every(v => selected.includes(v));

    const handleSelectAll = () => {
        if (isAllSelected) onChange([]);
        else onChange([...allValues]);
    };

    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full px-4 py-2.5 text-sm border border-white/30 rounded-2xl bg-white/60 backdrop-blur-xl hover:bg-white/80 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all text-left flex items-center justify-between shadow-sm h-11">
                <span className={`${selected.length === 0 ? 'text-gray-400' : 'text-gray-700 font-medium truncate pr-2'}`}>{selected.length === 0 ? placeholder : `Đã chọn ${selected.length}`}</span>
                <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-2 w-full min-w-[200px] bg-white/90 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                    <label className="flex items-center gap-2 px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer border-b border-gray-100/50">
                        <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-bold text-gray-700">Chọn tất cả</span>
                    </label>
                    {options.map(opt => {
                        const val = getValue(opt);
                        const label = getLabel(opt);
                        return (
                            <label key={val} className="flex items-center gap-2 px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer transition-colors">
                                <input type="checkbox" checked={selected.includes(val)} onChange={() => toggleOption(val)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm text-gray-700">{label}</span>
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default function PrintedOrdersToday() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusDict, setStatusDict] = useState({});
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState([]);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Filter Options
    const [statusOptions, setStatusOptions] = useState([]);
    const [channelOptions, setChannelOptions] = useState([]);
    const [carrierOptions, setCarrierOptions] = useState([]);

    useEffect(() => {
        fetchPrintedOrdersToday();
    }, []);

    // Reset pagination khi lọc
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedStatus, selectedChannel, selectedCarrier, pageSize]);

    const fetchPrintedOrdersToday = async () => {
        setLoading(true);
        try {
            // 1. Lấy từ điển Status
            const { data: stData } = await supabase.from('order_statuses').select('*');
            const dict = {};
            stData?.forEach(s => dict[s.id] = s.name);
            setStatusDict(dict);

            // 2. Lấy giới hạn thời gian trong ngày hôm nay
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            // 3. ⚡️ VÁ LỖI: Lọc chính xác bằng cột printed_at thay vì updated_at
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id, 
                    carrier_code, 
                    carrier_name,
                    sale_channel, 
                    status, 
                    printed_at,
                    order_products ( product_id, product_code, product_name, quantity )
                `)
                .gte('printed_at', startOfDay.toISOString())
                .lte('printed_at', endOfDay.toISOString())
                .order('printed_at', { ascending: false });

            if (error) throw error;

            setOrders(data || []);

            // Trích xuất options cho bộ lọc
            if (data) {
                const uniqueStatuses = [...new Set(data.map(o => o.status).filter(Boolean))];
                setStatusOptions(uniqueStatuses.map(code => ({ value: String(code), label: dict[code] || `Mã ${code}` })));

                const uniqueChannels = [...new Set(data.map(o => o.sale_channel).filter(Boolean))];
                setChannelOptions(uniqueChannels.map(ch => ({ value: String(ch), label: SALE_CHANNELS[ch] || `Kênh ${ch}` })));

                const uniqueCarriers = [...new Set(data.map(o => o.carrier_name).filter(Boolean))];
                setCarrierOptions(uniqueCarriers);
            }
        } catch (error) {
            console.error("Lỗi tải đơn đã in:", error);
        } finally {
            setLoading(false);
        }
    };

    // Áp dụng bộ lọc
    const filteredOrders = orders.filter(order => {
        const matchSearch = !searchQuery || 
            String(order.id).includes(searchQuery) || 
            (order.carrier_code && order.carrier_code.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchStatus = selectedStatus.length === 0 || selectedStatus.includes(String(order.status));
        const matchChannel = selectedChannel.length === 0 || selectedChannel.includes(String(order.sale_channel));
        const matchCarrier = selectedCarrier.length === 0 || selectedCarrier.includes(order.carrier_name);
        
        return matchSearch && matchStatus && matchChannel && matchCarrier;
    });

    // Phân trang
    const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // ==========================================
    // ⚡️ XUẤT DỮ LIỆU RA EXCEL (CSV)
    // ==========================================
    const handleExportData = () => {
        if (filteredOrders.length === 0) {
            alert("Không có dữ liệu để xuất!");
            return;
        }

        // Bỏ cột Thời gian xuất Excel theo yêu cầu "Bỏ cái ngày giờ đi"
        const headers = ['Mã Đơn Nhanh', 'Mã Vận Đơn', 'Hãng Vận Chuyển', 'Kênh Bán', 'Trạng Thái', 'Mã Sản Phẩm', 'Tên Sản Phẩm', 'Số Lượng'];
        
        const rows = [];
        filteredOrders.forEach(order => {
            const channelName = SALE_CHANNELS[order.sale_channel] || order.sale_channel || 'Khác';
            const statusName = statusDict[order.status] || `Mã ${order.status}`;
            
            if (order.order_products && order.order_products.length > 0) {
                order.order_products.forEach(prod => {
                    rows.push([
                        order.id, 
                        order.carrier_code || '', 
                        order.carrier_name || '',
                        channelName, 
                        statusName, 
                        prod.product_code || '',
                        prod.product_name || '',
                        prod.quantity || 0
                    ]);
                });
            } else {
                rows.push([order.id, order.carrier_code || '', order.carrier_name || '', channelName, statusName, '', '', '']);
            }
        });

        // Đóng gói CSV
        const csvContent = "\uFEFF" + [
            headers.join(","),
            ...rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `Don_Da_In_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12 mt-8 animate-in fade-in duration-300">
            
            {/* TIÊU ĐỀ & NÚT XUẤT EXCEL */}
            <div className="bg-white/70 backdrop-blur-2xl border border-white/30 px-8 py-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-shadow hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <PackageCheck className="text-green-600" size={28} /> Đơn đã in hôm nay
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                        <CalendarDays size={14} /> Danh sách toàn bộ các đơn hàng đã được in phiếu xuất kho trong ngày.
                    </p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={fetchPrintedOrdersToday} 
                        disabled={loading}
                        className="px-4 py-2.5 bg-white/80 border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                        Tải lại
                    </button>
                    <button 
                        onClick={handleExportData}
                        disabled={filteredOrders.length === 0}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600/90 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <DownloadCloud size={18} /> Xuất Dữ Liệu
                    </button>
                </div>
            </div>

            {/* BỘ LỌC */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/30 p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm ID Nhanh hoặc Mã Vận Đơn..." 
                            className="w-full pl-10 pr-4 h-11 text-sm border border-white/30 rounded-2xl outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 bg-white/60 backdrop-blur-xl shadow-sm transition-all"
                        />
                        <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
                    </div>
                </div>
                <div className="w-full sm:w-48">
                    <MultiSelect options={carrierOptions} selected={selectedCarrier} onChange={setSelectedCarrier} placeholder="Hãng vận chuyển" />
                </div>
                <div className="w-full sm:w-48">
                    <MultiSelect options={channelOptions} selected={selectedChannel} onChange={setSelectedChannel} placeholder="Kênh bán hàng" />
                </div>
                <div className="w-full sm:w-48">
                    <MultiSelect options={statusOptions} selected={selectedStatus} onChange={setSelectedStatus} placeholder="Trạng thái đơn" />
                </div>
            </div>

            {/* BẢNG DỮ LIỆU */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
                            <Loader2 size={32} className="animate-spin text-blue-500" />
                            <p className="text-gray-500 font-medium text-sm">Đang tải dữ liệu hôm nay...</p>
                        </div>
                    ) : paginatedOrders.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
                            <div className="p-4 bg-slate-100 rounded-full text-slate-400"><Search size={32} /></div>
                            <p className="text-gray-500 font-medium text-lg">Chưa có đơn nào được in hôm nay.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="bg-white/60 backdrop-blur-md text-gray-700 font-bold border-b border-gray-100/70 text-sm">
                                    <th className="py-4 px-5 whitespace-nowrap">Mã Đơn Nhanh</th>
                                    <th className="py-4 px-5 whitespace-nowrap">Mã Vận Đơn</th>
                                    <th className="py-4 px-5 w-80">Sản phẩm</th>
                                    <th className="py-4 px-5 text-center whitespace-nowrap">SL</th>
                                    <th className="py-4 px-5 whitespace-nowrap">Kênh bán</th>
                                    <th className="py-4 px-5 whitespace-nowrap">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100/70">
                                {paginatedOrders.map((order, idx) => {
                                    const products = order.order_products || [];
                                    const rowCount = Math.max(1, products.length);
                                    const statusName = statusDict[order.status] || `Mã ${order.status}`;
                                    const channelName = SALE_CHANNELS[order.sale_channel] || order.sale_channel || 'Khác';
                                    const channelColorClass = CHANNEL_COLORS[order.sale_channel] || 'bg-gray-100/80 text-gray-600';
                                    const statusColorClass = STATUS_COLORS[order.status] || 'bg-gray-100/80 text-gray-600';

                                    return products.map((prod, index) => (
                                        <tr key={`${order.id}-${index}`} className="hover:bg-white/50 transition-colors duration-200 font-medium">
                                            {index === 0 && (
                                                <>
                                                    <td rowSpan={rowCount} className="py-4 px-5 align-top border-r border-gray-100/50">
                                                        <div className="font-extrabold text-blue-600 text-base">{order.id}</div>
                                                        {/* ⚡️ ĐÃ XÓA NGÀY GIỜ Ở ĐÂY THEO YÊU CẦU */}
                                                    </td>
                                                    <td rowSpan={rowCount} className="py-4 px-5 align-top border-r border-gray-100/50">
                                                        <div className="font-bold text-gray-800">{order.carrier_code || <span className="text-gray-400 italic font-normal">Chưa có mã</span>}</div>
                                                        <div className="text-[11px] text-gray-500 mt-1 uppercase font-bold">{order.carrier_name || ''}</div>
                                                    </td>
                                                </>
                                            )}
                                            
                                            <td className="py-3 px-5 align-top font-bold text-slate-800">
                                                <div>{prod.product_name}</div>
                                                <div className="text-[11px] text-gray-400 font-normal mt-0.5">{prod.product_code}</div>
                                            </td>
                                            <td className="py-3 px-5 align-top text-center font-black text-slate-900 text-base">
                                                {prod.quantity}
                                            </td>

                                            {index === 0 && (
                                                <>
                                                    <td rowSpan={rowCount} className="py-4 px-5 align-top border-l border-gray-100/50">
                                                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${channelColorClass}`}>
                                                            {channelName}
                                                        </div>
                                                    </td>
                                                    <td rowSpan={rowCount} className="py-4 px-5 align-top">
                                                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${statusColorClass}`}>
                                                            {statusName}
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ));
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* PHÂN TRANG */}
                {!loading && filteredOrders.length > 0 && (
                    <div className="bg-white/50 backdrop-blur-md px-6 py-4 border-t border-white/30 flex flex-col sm:flex-row items-center justify-between text-sm font-medium text-gray-600 gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-gray-500">
                                Hiển thị <b className="text-gray-700">{(currentPage - 1) * pageSize + 1}</b> - <b className="text-gray-700">{Math.min(currentPage * pageSize, filteredOrders.length)}</b> trên tổng <b className="text-gray-700">{filteredOrders.length}</b> đơn
                            </span>
                            <div className="flex items-center gap-2 border-l border-gray-200/50 pl-4">
                                <span className="text-xs font-bold uppercase text-gray-400 tracking-wide">Số dòng:</span>
                                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-3 py-1.5 border border-white/30 bg-white/60 backdrop-blur-md rounded-xl font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-400/20 transition shadow-sm">
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={500}>500</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2.5 border border-white/30 bg-white/60 backdrop-blur-md rounded-xl hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm">
                                <ChevronLeft size={16} className="text-gray-600" />
                            </button>
                            <span className="px-4 text-gray-500 font-bold text-sm">Trang {currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2.5 border border-white/30 bg-white/60 backdrop-blur-md rounded-xl hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm">
                                <ChevronRight size={16} className="text-gray-600" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}