import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, CheckCircle, AlertTriangle, XCircle, RefreshCw, MessageSquare, Lock, User, ChevronDown, Printer, ChevronLeft, ChevronRight } from 'lucide-react';

const SALE_CHANNELS = {
    '1': 'Admin', '2': 'Website', '10': 'API', '20': 'Facebook', '21': 'Instagram',
    '41': 'Lazada', '42': 'Shopee', '43': 'Sendo', '45': 'Tiki', '48': 'Tiktok Shop',
    '49': 'Zalo OA', '50': 'Shopee chat', '51': 'Lazada chat', '52': 'Zalo cá nhân'
};

// Bảng màu cho từng kênh bán hàng
const CHANNEL_COLORS = {
    '1': 'bg-slate-100 text-slate-700',
    '2': 'bg-indigo-100 text-indigo-700',
    '10': 'bg-violet-100 text-violet-700',
    '20': 'bg-blue-100 text-blue-700',
    '21': 'bg-pink-100 text-pink-700',
    '41': 'bg-orange-100 text-orange-700',
    '42': 'bg-red-100 text-red-700',
    '43': 'bg-cyan-100 text-cyan-700',
    '45': 'bg-teal-100 text-teal-700',
    '48': 'bg-gray-100 text-gray-700',
    '49': 'bg-blue-100 text-blue-700',
    '50': 'bg-red-100 text-red-700',
    '51': 'bg-orange-100 text-orange-700',
    '52': 'bg-green-100 text-green-700'
};

// Bảng màu cho trạng thái đơn hàng (theo status code phổ biến trên Nhanh.vn)
const STATUS_COLORS = {
    '1': 'bg-gray-100 text-gray-700',      // Mới
    '2': 'bg-yellow-100 text-yellow-700',   // Đang xử lý
    '3': 'bg-blue-100 text-blue-700',       // Đã xác nhận
    '4': 'bg-purple-100 text-purple-700',   // Đang đóng gói
    '5': 'bg-indigo-100 text-indigo-700',   // Đã xuất kho
    '6': 'bg-green-100 text-green-700',     // Đang giao
    '7': 'bg-teal-100 text-teal-700',       // Giao thành công
    '8': 'bg-rose-100 text-rose-700',       // Hoàn hàng
    '9': 'bg-red-100 text-red-700',         // Hủy
    '10': 'bg-orange-100 text-orange-700',  // Chờ duyệt
    '20': 'bg-cyan-100 text-cyan-700',      // Chờ in
    '30': 'bg-green-100 text-green-700',    // Đã in
    '40': 'bg-emerald-100 text-emerald-700',// Đã giao cho đơn vị vận chuyển
    '42': 'bg-green-100 text-green-700',
};

export default function OrderReport() {
    const [data, setData] = useState({ printable: [], holding: [], outOfStock: [], invalidCount: 0 });
    const [loading, setLoading] = useState(true);
    const [statusDict, setStatusDict] = useState({});
    const [businessId, setBusinessId] = useState('');

    const [activeTab, setActiveTab] = useState('printable'); 
    const [searchId, setSearchId] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedCarrier, setSelectedCarrier] = useState('');
    
    const [selectedOrders, setSelectedOrders] = useState([]); 
    const [showPrintMenu, setShowPrintMenu] = useState(false); 

    const [carrierOptions, setCarrierOptions] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);

    // === PHÂN TRANG STATES ===
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20); // Mặc định 20 đơn/trang

    useEffect(() => {
        fetchSystemData();
        fetchAllocation();
    }, []);

    // Reset trang và tick chọn khi đổi bộ lọc hoặc Tab
    useEffect(() => {
        setSelectedOrders([]);
        setShowPrintMenu(false);
        setCurrentPage(1); 
    }, [activeTab, searchId, selectedStatus, selectedCarrier, pageSize]);

    const fetchSystemData = async () => {
        const { data: stData } = await supabase.from('order_statuses').select('*');
        const dict = {};
        stData?.forEach(s => dict[s.id] = s.name);
        setStatusDict(dict);

        const { data: confData } = await supabase.from('system_configs').select('*').eq('key', 'nhanh_business_id').single();
        if (confData) setBusinessId(confData.value);
    };

    const fetchAllocation = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('wms-allocation');
            if (error) throw error;
            
            setData(data || { printable: [], holding: [], outOfStock: [], invalidCount: 0 });

            const allOrders = [...(data.printable || []), ...(data.holding || []), ...(data.outOfStock || [])];
            setCarrierOptions([...new Set(allOrders.map(o => o.carrier_name).filter(Boolean))]);
            setStatusOptions([...new Set(allOrders.map(o => o.status).filter(Boolean))]);
            setSelectedOrders([]);
        } catch (error) {
            console.error("Lỗi đồng bộ:", error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredOrders = (orderList) => {
        if (!orderList) return [];
        return orderList.filter(order => {
            if (searchId && !String(order.id).toLowerCase().includes(searchId.trim().toLowerCase())) return false;
            if (selectedStatus && String(order.status) !== String(selectedStatus)) return false;
            if (selectedCarrier && order.carrier_name !== selectedCarrier) return false;
            return true;
        });
    };

    const currentRawList = data[activeTab] || [];
    const filteredOrders = getFilteredOrders(currentRawList);

    // === LOGIC PHÂN TRANG (PAGINATION SLICE) ===
    const totalOrdersCount = filteredOrders.length;
    const totalPages = Math.ceil(totalOrdersCount / pageSize) || 1;
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedOrders(paginatedOrders.map(o => o.id)); // Chỉ check các đơn ở trang hiện tại
        } else {
            setSelectedOrders([]);
        }
    };

    const handleSelectOne = (orderId) => {
        setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
    };

    const isAllSelected = paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrders.includes(o.id));

    const executePrint = (printSize) => {
        if (!businessId) {
            alert("⚠️ Chưa cấu hình Business ID!"); return;
        }
        let printUrl = "";
        const idString = selectedOrders.join(',');

        if (selectedOrders.length === 1) {
            if (printSize === 'A4') printUrl = `https://nhanh.vn/order/manage/pickup?storeId=${businessId}&businessId=${businessId}&ids=${idString}&emptyLayout=true&printDialogMode=manual&format=print`;
            else if (printSize === 'K80') printUrl = `https://nhanh.vn/order/manage/pickup?storeId=${businessId}&businessId=${businessId}&ids=${idString}&emptyLayout=true&printDialogMode=manual&format=print&typePrint=k80`;
        } else if (selectedOrders.length > 1) {
            if (printSize === 'A4') printUrl = `https://nhanh.vn/order/manage/pickup?ids=${idString}&storeId=${businessId}&format=print&printDialogMode=manual&noclose=1`;
            else if (printSize === 'K80') printUrl = `https://nhanh.vn/order/manage/pickup?ids=${idString}&storeId=${businessId}&format=print&printDialogMode=manual&noclose=1&typePrint=k80`;
        }

        if (printUrl) { window.open(printUrl, '_blank'); setShowPrintMenu(false); }
    };

    const renderAgingBadge = (dateStr) => {
        if (!dateStr) return <span className="px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-100 rounded-lg text-xs font-semibold">🟢 Hôm nay (0 ngày)</span>;
        const diffTime = new Date() - new Date(dateStr);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return <span className="px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1">🟢 Hôm nay</span>;
        else if (diffDays <= 2) return <span className="px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1">🟡 Tồn {diffDays} ngày</span>;
        return <span className="px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 animate-pulse">🔴 Nghẽn {diffDays} ngày!</span>;
    };

    return (
        <div className="space-y-8 pb-12">
            {/* TIÊU ĐỀ */}
            <div className="flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-700 -mx-6 -mt-6 px-8 py-6 rounded-b-2xl shadow-lg mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Đơn có thể in</h2>
                    <p className="text-blue-100 text-sm mt-1">Danh sách các đơn hàng đủ điều kiện in phiếu xuất kho</p>
                </div>
                <button 
                    onClick={fetchAllocation} 
                    disabled={loading} 
                    className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-white/30 shadow-lg transition-all flex items-center gap-2 disabled:opacity-60"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    Cập nhật tồn kho
                </button>
            </div>

            {/* CARD ĐIỀU HƯỚNG */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div 
                    onClick={() => setActiveTab('printable')} 
                    className={`cursor-pointer p-5 rounded-2xl border-2 shadow-md flex items-center gap-4 transition-all transform hover:scale-[1.02] ${
                        activeTab === 'printable' 
                        ? 'bg-green-50 border-green-400 ring-2 ring-green-200' 
                        : 'bg-white border-gray-100 hover:border-green-200'
                    }`}
                >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === 'printable' ? 'bg-green-500 text-white shadow-lg' : 'bg-green-50 text-green-600'}`}>
                        <CheckCircle size={28} />
                    </div>
                    <div>
                        <div className="text-3xl font-extrabold text-gray-800">{data.printable?.length || 0}</div>
                        <div className="text-sm font-semibold text-gray-500">Đủ hàng / Có thể in</div>
                    </div>
                </div>
                <div 
                    onClick={() => setActiveTab('holding')} 
                    className={`cursor-pointer p-5 rounded-2xl border-2 shadow-md flex items-center gap-4 transition-all transform hover:scale-[1.02] ${
                        activeTab === 'holding' 
                        ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-200' 
                        : 'bg-white border-gray-100 hover:border-yellow-200'
                    }`}
                >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === 'holding' ? 'bg-yellow-500 text-white shadow-lg' : 'bg-yellow-50 text-yellow-600'}`}>
                        <AlertTriangle size={28} />
                    </div>
                    <div>
                        <div className="text-3xl font-extrabold text-gray-800">{data.holding?.length || 0}</div>
                        <div className="text-sm font-semibold text-gray-500">Tạm giữ (Thiếu 1 phần)</div>
                    </div>
                </div>
                <div 
                    onClick={() => setActiveTab('outOfStock')} 
                    className={`cursor-pointer p-5 rounded-2xl border-2 shadow-md flex items-center gap-4 transition-all transform hover:scale-[1.02] ${
                        activeTab === 'outOfStock' 
                        ? 'bg-red-50 border-red-400 ring-2 ring-red-200' 
                        : 'bg-white border-gray-100 hover:border-red-200'
                    }`}
                >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeTab === 'outOfStock' ? 'bg-red-500 text-white shadow-lg' : 'bg-red-50 text-red-600'}`}>
                        <XCircle size={28} />
                    </div>
                    <div>
                        <div className="text-3xl font-extrabold text-gray-800">{data.outOfStock?.length || 0}</div>
                        <div className="text-sm font-semibold text-gray-500">Hết sạch hàng</div>
                    </div>
                </div>
            </div>

            {/* BỘ LỌC VÀ IN ĐƠN HÀNG LOẠT */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-md flex flex-wrap gap-4 items-end justify-between">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="w-64">
                        <div className="relative">
                            <input 
                                type="text" 
                                value={searchId} 
                                onChange={(e) => setSearchId(e.target.value)} 
                                placeholder="Tìm kiếm ID đơn hàng..." 
                                className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 hover:bg-white"
                            />
                            <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        </div>
                    </div>
                    <div className="w-52">
                        <select 
                            value={selectedCarrier} 
                            onChange={(e) => setSelectedCarrier(e.target.value)} 
                            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 hover:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            <option value="">🚚 Hãng vận chuyển</option>
                            {carrierOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="w-52">
                        <select 
                            value={selectedStatus} 
                            onChange={(e) => setSelectedStatus(e.target.value)} 
                            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 hover:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        >
                            <option value="">📌 Trạng thái Nhanh.vn</option>
                            {statusOptions.map(s => <option key={s} value={s}>{statusDict[s] || `Mã ${s}`}</option>)}
                        </select>
                    </div>
                </div>

                <div className="relative" onMouseLeave={() => setShowPrintMenu(false)}>
                    <button 
                        onClick={() => setShowPrintMenu(!showPrintMenu)} 
                        disabled={selectedOrders.length === 0} 
                        className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${
                            selectedOrders.length > 0 
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-200' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        }`}
                    >
                        <Printer size={18} /> In đơn ({selectedOrders.length}) <ChevronDown size={16} />
                    </button>
                    {showPrintMenu && selectedOrders.length > 0 && (
                        <div className="absolute right-0 top-[105%] w-48 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in">
                            <button 
                                onClick={() => executePrint('A4')} 
                                className="w-full text-left px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                            >
                                <Printer size={16} /> In khổ A4/A5
                            </button>
                            <button 
                                onClick={() => executePrint('K80')} 
                                className="w-full text-left px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-t flex items-center gap-2"
                            >
                                <Printer size={16} /> In khổ K80
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* BẢNG DỮ LIỆU ĐƠN HÀNG */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-md overflow-hidden flex flex-col justify-between">
                <div className="overflow-x-auto">
                    {loading ? ( 
                        <div className="p-20 text-center text-gray-400 font-medium text-lg">Đang tải dữ liệu...</div> 
                    ) : paginatedOrders.length === 0 ? ( 
                        <div className="p-20 text-center text-gray-400 font-medium text-lg">Không có đơn hàng nào khớp.</div> 
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 font-bold border-b-2 border-gray-200 text-sm">
                                    <th className="py-4 px-4 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={isAllSelected} 
                                            onChange={handleSelectAll} 
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
                                        />
                                    </th>
                                    <th className="py-4 px-4 whitespace-nowrap">ID Đơn</th>
                                    <th className="py-4 px-4 whitespace-nowrap">Hãng Vận Chuyển</th>
                                    <th className="py-4 px-4 w-64">Ghi Chú</th>
                                    <th className="py-4 px-4">Sản Phẩm</th>
                                    <th className="py-4 px-4 text-center whitespace-nowrap">Số Lượng</th>
                                    <th className="py-4 px-4 whitespace-nowrap">
                                        {activeTab === 'printable' ? 'Ngày Tồn (Tuổi Đơn)' : 'Sản Phẩm Thiếu / Tồn Kho'}
                                    </th>
                                    <th className="py-4 px-4 text-center whitespace-nowrap">Người Tạo Đơn</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedOrders.map(order => {
                                    const products = order.order_products || [];
                                    const rowCount = Math.max(1, products.length);
                                    const statusName = statusDict[order.status] || `Mã ${order.status}`;
                                    const channelName = SALE_CHANNELS[order.sale_channel] || order.sale_channel || 'Khác';
                                    const isChecked = selectedOrders.includes(order.id);

                                    // Lấy class màu cho kênh và trạng thái
                                    const channelColorClass = CHANNEL_COLORS[order.sale_channel] || 'bg-gray-100 text-gray-600';
                                    const statusColorClass = STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600';

                                    return products.map((prod, index) => {
                                        const shortItem = data.holding?.concat(data.outOfStock)?.find(o => o.id === order.id)?.debug_shortItems?.find(i => i.name === prod.product_name);

                                        return (
                                            <tr 
                                                key={`${order.id}-${index}`} 
                                                className={`${isChecked ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'} transition-colors font-medium`}
                                            >
                                                {index === 0 && (
                                                    <>
                                                        <td rowSpan={rowCount} className="py-4 px-4 align-top border-r border-gray-100 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isChecked} 
                                                                onChange={() => handleSelectOne(order.id)} 
                                                                className="w-4 h-4 mt-1 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
                                                            />
                                                        </td>
                                                        <td rowSpan={rowCount} className="py-4 px-4 align-top border-r border-gray-100">
                                                            <div className="font-extrabold text-blue-600 text-base mb-1 cursor-pointer hover:underline hover:text-blue-800 transition-colors" onClick={() => handleSelectOne(order.id)}>
                                                                #{order.id}
                                                            </div>
                                                            <div className="text-xs text-gray-400 mb-2 font-normal">
                                                                {new Date(order.created_at).toLocaleString('vi-VN')}
                                                            </div>
                                                            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${channelColorClass}`}>
                                                                Kênh: {channelName}
                                                            </div>
                                                        </td>
                                                        <td rowSpan={rowCount} className="py-4 px-4 align-top border-r border-gray-100">
                                                            <div className="font-bold text-gray-800 mb-2">{order.carrier_name || 'Chưa phân bổ'}</div>
                                                            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${statusColorClass}`}>
                                                                {statusName}
                                                            </div>
                                                        </td>
                                                        <td rowSpan={rowCount} className="py-4 px-4 align-top border-r border-gray-100 text-xs font-normal">
                                                            <div className="space-y-2">
                                                                {order.description && (
                                                                    <div className="flex gap-1.5 text-gray-700 bg-blue-50 p-2 rounded-lg">
                                                                        <MessageSquare size={14} className="mt-0.5 shrink-0 text-blue-500" />
                                                                        <span><strong>Khách:</strong> {order.description}</span>
                                                                    </div>
                                                                )}
                                                                {order.private_description && (
                                                                    <div className="flex gap-1.5 text-red-700 bg-red-50 p-2 rounded-lg">
                                                                        <Lock size={14} className="mt-0.5 shrink-0" />
                                                                        <span><strong>Nội bộ:</strong> {order.private_description}</span>
                                                                    </div>
                                                                )}
                                                                {!order.description && !order.private_description && (
                                                                    <span className="text-gray-400 italic text-xs">Không có ghi chú</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}

                                                <td className="py-3 px-4 align-top font-bold text-slate-800">
                                                    <div>{prod.product_name}</div>
                                                    <div className="text-xs text-gray-400 font-normal mt-0.5">{prod.product_code}</div>
                                                </td>
                                                <td className="py-3 px-4 align-top text-center font-black text-slate-900 text-base">
                                                    {prod.quantity}
                                                </td>
                                                
                                                <td className="py-3 px-4 align-top">
                                                    {activeTab === 'printable' ? (
                                                        renderAgingBadge(order.printable_date)
                                                    ) : shortItem ? (
                                                        <div className="bg-red-50 rounded-lg p-2 text-red-600 text-xs font-bold border border-red-200">
                                                            <div className="flex items-center gap-1 mb-1"><XCircle size={14} /> Thiếu {shortItem.missing}</div>
                                                            <span className="text-gray-500 font-normal">Tồn kho: {shortItem.remaining}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-green-600 text-xs font-bold flex items-center gap-1 bg-green-50 rounded-lg p-2 border border-green-200">
                                                            <CheckCircle size={14} /> Đủ món này
                                                        </div>
                                                    )}
                                                </td>

                                                {index === 0 && (
                                                    <td rowSpan={rowCount} className="py-4 px-4 align-top text-center border-l border-gray-100">
                                                        <div className="inline-flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full border border-gray-200 font-semibold text-xs shadow-sm">
                                                            <User size={12} className="text-gray-500" /> {order.created_by_name || 'Hệ thống'}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    });
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ==========================================
                    ⚡️ THANH PHÂN TRANG (PAGINATION CONTROLS)
                   ========================================== */}
                {!loading && totalOrdersCount > 0 && (
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between text-sm font-medium text-gray-600 gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-gray-500">
                                Hiển thị <b className="text-gray-700">{(currentPage - 1) * pageSize + 1}</b> đến <b className="text-gray-700">{Math.min(currentPage * pageSize, totalOrdersCount)}</b> trong tổng <b className="text-gray-700">{totalOrdersCount}</b> đơn
                            </span>
                            
                            <div className="flex items-center gap-2 border-l pl-4">
                                <span className="text-xs font-bold uppercase text-gray-400 tracking-wide">Số dòng:</span>
                                <select 
                                    value={pageSize} 
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="px-3 py-1.5 border border-gray-300 bg-white rounded-lg font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-200 transition"
                                >
                                    <option value={20}>20 dòng</option>
                                    <option value={50}>50 dòng</option>
                                    <option value={100}>100 dòng</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                            >
                                <ChevronLeft size={16} className="text-gray-600" />
                            </button>
                            
                            <div className="flex items-center gap-1">
                                {[...Array(totalPages)].map((_, i) => {
                                    const pageNum = i + 1;
                                    if (pageNum === 1 || pageNum === totalPages || Math.abs(currentPage - pageNum) <= 1) {
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`min-w-[2.5rem] h-10 rounded-xl border text-sm font-bold shadow-sm transition-all ${
                                                    currentPage === pageNum 
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200' 
                                                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    }
                                    if (pageNum === 2 || pageNum === totalPages - 1) {
                                        return <span key={pageNum} className="px-2 text-gray-400 font-bold">...</span>;
                                    }
                                    return null;
                                })}
                            </div>

                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                            >
                                <ChevronRight size={16} className="text-gray-600" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}