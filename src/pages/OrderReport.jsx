import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, CheckCircle, AlertTriangle, XCircle, RefreshCw, MessageSquare, Lock, User, ChevronDown, Printer, ChevronLeft, ChevronRight, Copy, Send } from 'lucide-react';

const SALE_CHANNELS = {
    '1': 'Admin', '2': 'Website', '10': 'API', '20': 'Facebook', '21': 'Instagram',
    '41': 'Lazada', '42': 'Shopee', '43': 'Sendo', '45': 'Tiki', '48': 'Tiktok Shop',
    '49': 'Zalo OA', '50': 'Shopee chat', '51': 'Lazada chat', '52': 'Zalo cá nhân'
};

const CHANNEL_COLORS = {
    '1': 'bg-slate-100/80 text-slate-700',
    '2': 'bg-indigo-100/80 text-indigo-700',
    '10': 'bg-violet-100/80 text-violet-700',
    '20': 'bg-blue-100/80 text-blue-700',
    '21': 'bg-pink-100/80 text-pink-700',
    '41': 'bg-orange-100/80 text-orange-700',
    '42': 'bg-red-100/80 text-red-700',
    '43': 'bg-cyan-100/80 text-cyan-700',
    '45': 'bg-teal-100/80 text-teal-700',
    '48': 'bg-gray-100/80 text-gray-700',
    '49': 'bg-blue-100/80 text-blue-700',
    '50': 'bg-red-100/80 text-red-700',
    '51': 'bg-orange-100/80 text-orange-700',
    '52': 'bg-green-100/80 text-green-700'
};

const STATUS_COLORS = {
    '1': 'bg-gray-100/80 text-gray-700',
    '2': 'bg-yellow-100/80 text-yellow-700',
    '3': 'bg-blue-100/80 text-blue-700',
    '4': 'bg-purple-100/80 text-purple-700',
    '5': 'bg-indigo-100/80 text-indigo-700',
    '6': 'bg-green-100/80 text-green-700',
    '7': 'bg-teal-100/80 text-teal-700',
    '8': 'bg-rose-100/80 text-rose-700',
    '9': 'bg-red-100/80 text-red-700',
    '10': 'bg-orange-100/80 text-orange-700',
    '20': 'bg-cyan-100/80 text-cyan-700',
    '30': 'bg-green-100/80 text-green-700',
    '40': 'bg-emerald-100/80 text-emerald-700',
    '42': 'bg-green-100/80 text-green-700',
};

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
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full px-4 py-3 text-sm border border-white/30 rounded-2xl bg-white/60 backdrop-blur-xl hover:bg-white/80 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all text-left flex items-center justify-between shadow-sm">
                <span className={`${selected.length === 0 ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>{selected.length === 0 ? placeholder : `Đã chọn ${selected.length}`}</span>
                <ChevronDown size={16} className="text-gray-400" />
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white/90 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                    <label className="flex items-center gap-2 px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer border-b border-gray-100/50">
                        <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-medium">Chọn tất cả</span>
                    </label>
                    {options.map(opt => {
                        const val = getValue(opt);
                        const label = getLabel(opt);
                        return (
                            <label key={val} className="flex items-center gap-2 px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer transition-colors">
                                <input type="checkbox" checked={selected.includes(val)} onChange={() => toggleOption(val)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm">{label}</span>
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default function OrderReport() {
    const [data, setData] = useState({ printable: [], holding: [], outOfStock: [], invalidCount: 0 });
    const [loading, setLoading] = useState(true);
    const [statusDict, setStatusDict] = useState({});
    const [businessId, setBusinessId] = useState('');
    const [activeTab, setActiveTab] = useState('printable');
    const [searchId, setSearchId] = useState('');
    const [selectedStatus, setSelectedStatus] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState([]);
    const [selectedOrders, setSelectedOrders] = useState([]);
    
    // Đổi state quản lý menu từ "showPrintMenu" thành "showActionMenu"
    const [showActionMenu, setShowActionMenu] = useState(false);

    const [carrierOptions, setCarrierOptions] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);
    const [channelOptions, setChannelOptions] = useState([]);
    const [searchNote, setSearchNote] = useState('');
    const [sortOrder, setSortOrder] = useState('');
    const [minAgingDays, setMinAgingDays] = useState('');
    const [maxAgingDays, setMaxAgingDays] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [copyMessage, setCopyMessage] = useState('');
    const [sendingOrder, setSendingOrder] = useState(false); // State khi đang gửi đơn

    useEffect(() => {
        const init = async () => {
            try {
                const dict = await fetchSystemData();
                await fetchAllocation(dict);
            } catch (err) {
                console.error('Init error:', err);
                setLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        setSelectedOrders([]);
        setShowActionMenu(false); // Reset menu khi đổi tab/bộ lọc
        setCurrentPage(1);
    }, [activeTab, searchId, selectedStatus, selectedCarrier, selectedChannel, searchNote, sortOrder, minAgingDays, maxAgingDays, pageSize]);

    const fetchSystemData = async () => {
        const { data: stData } = await supabase.from('order_statuses').select('*');
        const dict = {};
        stData?.forEach(s => dict[s.id] = s.name);
        setStatusDict(dict);

        const { data: confData } = await supabase.from('system_configs').select('*').eq('key', 'nhanh_business_id').single();
        if (confData) setBusinessId(confData.value);
        
        return dict;
    };

    const fetchAllocation = async (statusDict) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('wms-allocation');
            if (error) throw error;

            setData(data || { printable: [], holding: [], outOfStock: [], invalidCount: 0 });

            const allOrders = [...(data.printable || []), ...(data.holding || []), ...(data.outOfStock || [])];
            setCarrierOptions([...new Set(allOrders.map(o => o.carrier_name).filter(Boolean))]);

            const uniqueStatusCodes = [...new Set(allOrders.map(o => o.status).filter(Boolean))];
            setStatusOptions(uniqueStatusCodes.map(code => ({
                value: String(code),
                label: statusDict[code] || `Mã ${code}`
            })));

            const uniqueChannels = [...new Set(allOrders.map(o => o.sale_channel).filter(Boolean))];
            setChannelOptions(uniqueChannels.map(ch => ({
                value: String(ch),
                label: SALE_CHANNELS[ch] || `Kênh ${ch}`
            })));

            setSelectedOrders([]);
        } catch (error) {
            console.error("Lỗi đồng bộ:", error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredOrders = (orderList) => {
        if (!orderList) return [];
        let filtered = orderList.filter(order => {
            if (searchId && !String(order.id).toLowerCase().includes(searchId.trim().toLowerCase())) return false;
            if (selectedStatus.length > 0 && !selectedStatus.includes(String(order.status))) return false;
            if (selectedCarrier.length > 0 && !selectedCarrier.includes(order.carrier_name)) return false;
            if (selectedChannel.length > 0 && !selectedChannel.includes(String(order.sale_channel))) return false;
            if (searchNote) {
                const note = (order.description || '') + ' ' + (order.private_description || '');
                if (!note.toLowerCase().includes(searchNote.toLowerCase())) return false;
            }
            if (minAgingDays || maxAgingDays) {
                const days = order.printable_date
                    ? Math.floor((new Date() - new Date(order.printable_date)) / (1000 * 60 * 60 * 24))
                    : 0;
                if (minAgingDays && days < Number(minAgingDays)) return false;
                if (maxAgingDays && days > Number(maxAgingDays)) return false;
            }
            return true;
        });

        if (sortOrder === 'asc') filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        else if (sortOrder === 'desc') filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return filtered;
    };

    const currentRawList = data[activeTab] || [];
    const filteredOrders = getFilteredOrders(currentRawList);

    const totalOrdersCount = filteredOrders.length;
    const totalPages = Math.ceil(totalOrdersCount / pageSize) || 1;
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedOrders(paginatedOrders.map(o => o.id));
        else setSelectedOrders([]);
    };

    const handleSelectOne = (orderId) => {
        setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
    };

    const isAllSelected = paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrders.includes(o.id));

    const executePrint = (printSize) => {
        if (!businessId) { alert("⚠️ Chưa cấu hình Business ID!"); return; }
        let printUrl = "";
        const idString = selectedOrders.join(',');

        if (selectedOrders.length === 1) {
            if (printSize === 'A4') printUrl = `https://nhanh.vn/order/manage/pickup?storeId=${businessId}&businessId=${businessId}&ids=${idString}&emptyLayout=true&printDialogMode=manual&format=print`;
            else if (printSize === 'K80') printUrl = `https://nhanh.vn/order/manage/pickup?storeId=${businessId}&businessId=${businessId}&ids=${idString}&emptyLayout=true&printDialogMode=manual&format=print&typePrint=k80`;
        } else if (selectedOrders.length > 1) {
            if (printSize === 'A4') printUrl = `https://nhanh.vn/order/manage/pickup?ids=${idString}&storeId=${businessId}&format=print&printDialogMode=manual&noclose=1`;
            else if (printSize === 'K80') printUrl = `https://nhanh.vn/order/manage/pickup?ids=${idString}&storeId=${businessId}&format=print&printDialogMode=manual&noclose=1&typePrint=k80`;
        }
        if (printUrl) { window.open(printUrl, '_blank'); setShowActionMenu(false); }
    };

    // Hàm gọi API gửi hãng vận chuyển thông qua Edge Function
    const handleSendCarrier = async () => {
        if (selectedOrders.length === 0) return;
        setSendingOrder(true);
        setShowActionMenu(false); // Ẩn menu
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            // Gọi Edge Function làm cầu nối với API Nhanh.vn
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nhanh-carrier`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ 
                    action: 'sendCarrier', 
                    orderIds: selectedOrders 
                })
            });

            const result = await response.json();
            
            if (result.success) {
                setCopyMessage(`✅ Đã gửi thành công ${selectedOrders.length} đơn sang hãng vận chuyển.`);
                // Bỏ chọn đơn và có thể làm mới lại dữ liệu nếu cần
                setSelectedOrders([]);
                fetchAllocation(statusDict); 
            } else {
                setCopyMessage(`⚠️ Lỗi gửi đơn: ${result.message}`);
            }
        } catch (error) {
            console.error("Carrier Error:", error);
            setCopyMessage('⚠️ Đã xảy ra lỗi hệ thống khi gửi hãng vận chuyển.');
        } finally {
            setSendingOrder(false);
            setTimeout(() => setCopyMessage(''), 5000);
        }
    };

    const handleCopyOrders = async () => {
        if (filteredOrders.length === 0) {
            setCopyMessage('Không có đơn hàng nào để sao chép.');
            setTimeout(() => setCopyMessage(''), 2000);
            return;
        }
        const ids = filteredOrders.map(order => order.id).join('\n');
        try {
            await navigator.clipboard.writeText(ids);
            setCopyMessage(`✅ Đã sao chép ${filteredOrders.length} đơn hàng.`);
        } catch (err) {
            setCopyMessage('⚠️ Sao chép thất bại, vui lòng thử lại.');
        }
        setTimeout(() => setCopyMessage(''), 3000);
    };

    const renderAgingBadge = (dateStr) => {
        if (!dateStr) return <span className="px-2.5 py-1.5 bg-green-100/80 backdrop-blur-sm text-green-700 border border-green-200/30 rounded-full text-xs font-semibold">🟢 Hôm nay</span>;
        const diffTime = new Date() - new Date(dateStr);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return <span className="px-2.5 py-1.5 bg-green-100/80 backdrop-blur-sm text-green-700 border border-green-200/30 rounded-full text-xs font-semibold inline-flex items-center gap-1">🟢Mới</span>;
        else if (diffDays <= 2) return <span className="px-2.5 py-1.5 bg-amber-100/80 backdrop-blur-sm text-amber-700 border border-amber-200/30 rounded-full text-xs font-semibold inline-flex items-center gap-1">🟡{diffDays} ngày</span>;
        return <span className="px-2.5 py-1.5 bg-red-100/80 backdrop-blur-sm text-red-600 border border-red-200/30 rounded-full text-xs font-extrabold inline-flex items-center gap-1 animate-pulse">🔴{diffDays} ngày</span>;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8 pb-12">
                <div className="flex justify-between items-center bg-white/70 backdrop-blur-2xl border border-white/30 -mx-6 -mt-6 px-8 py-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] mb-6 transition-shadow hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Đơn có thể in</h2>
                        <p className="text-gray-500 text-sm mt-1">Danh sách các đơn hàng đủ điều kiện in phiếu xuất kho</p>
                    </div>
                    <button
                        onClick={async () => fetchAllocation(statusDict)}
                        disabled={loading}
                        className="bg-white/80 backdrop-blur-md border border-white/30 text-gray-700 px-5 py-2.5 rounded-2xl font-medium hover:bg-white/90 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        Cập nhật tồn kho
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div onClick={() => setActiveTab('printable')} className={`cursor-pointer p-6 rounded-3xl border backdrop-blur-xl shadow-sm flex items-center gap-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${activeTab === 'printable' ? 'bg-green-100/60 border-green-300/50 shadow-green-100/30' : 'bg-white/70 border-white/30 hover:border-green-200/30'}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'printable' ? 'bg-green-500/90 text-white shadow-lg shadow-green-500/20' : 'bg-green-100/80 text-green-600'}`}>
                            <CheckCircle size={28} />
                        </div>
                        <div>
                            <div className="text-3xl font-extrabold text-gray-900">{data.printable?.length || 0}</div>
                            <div className="text-sm font-semibold text-gray-500">Đủ hàng / Có thể in</div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('holding')} className={`cursor-pointer p-6 rounded-3xl border backdrop-blur-xl shadow-sm flex items-center gap-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${activeTab === 'holding' ? 'bg-yellow-100/60 border-yellow-300/50 shadow-yellow-100/30' : 'bg-white/70 border-white/30 hover:border-yellow-200/30'}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'holding' ? 'bg-yellow-500/90 text-white shadow-lg shadow-yellow-500/20' : 'bg-yellow-100/80 text-yellow-600'}`}>
                            <AlertTriangle size={28} />
                        </div>
                        <div>
                            <div className="text-3xl font-extrabold text-gray-900">{data.holding?.length || 0}</div>
                            <div className="text-sm font-semibold text-gray-500">Tạm giữ (Thiếu 1 phần)</div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('outOfStock')} className={`cursor-pointer p-6 rounded-3xl border backdrop-blur-xl shadow-sm flex items-center gap-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${activeTab === 'outOfStock' ? 'bg-red-100/60 border-red-300/50 shadow-red-100/30' : 'bg-white/70 border-white/30 hover:border-red-200/30'}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'outOfStock' ? 'bg-red-500/90 text-white shadow-lg shadow-red-500/20' : 'bg-red-100/80 text-red-600'}`}>
                            <XCircle size={28} />
                        </div>
                        <div>
                            <div className="text-3xl font-extrabold text-gray-900">{data.outOfStock?.length || 0}</div>
                            <div className="text-sm font-semibold text-gray-500">Hết hàng</div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6 space-y-5 transition-shadow hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                    <div className="flex flex-wrap gap-4 items-end justify-between">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="w-64">
                                <div className="relative">
                                    <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Tìm kiếm ID đơn hàng..." className="w-full pl-11 pr-4 py-3 text-sm border border-white/30 rounded-2xl outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all bg-white/60 backdrop-blur-xl hover:bg-white/80 shadow-sm" />
                                    <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
                                </div>
                            </div>
                            <div className="w-52">
                                <MultiSelect options={carrierOptions} selected={selectedCarrier} onChange={setSelectedCarrier} placeholder="ĐVVC" />
                            </div>
                            <div className="w-52">
                                <MultiSelect options={statusOptions} selected={selectedStatus} onChange={setSelectedStatus} placeholder="Trạng thái" />
                            </div>
                            <div className="w-52">
                                <MultiSelect options={channelOptions} selected={selectedChannel} onChange={setSelectedChannel} placeholder="Kênh bán" />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button onClick={handleCopyOrders} disabled={filteredOrders.length === 0} className={`px-4 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg ${filteredOrders.length > 0 ? 'bg-gray-600/90 backdrop-blur-md text-white hover:bg-gray-700 shadow-gray-500/20' : 'bg-white/50 text-gray-400 cursor-not-allowed border border-white/20'}`}>
                                <Copy size={16} /> Copy ({filteredOrders.length})
                            </button>

                            {/* Menu Thao Tác Mới */}
                            <div className="relative" onMouseLeave={() => setShowActionMenu(false)}>
                                <button onClick={() => setShowActionMenu(!showActionMenu)} disabled={selectedOrders.length === 0 || sendingOrder} className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg ${selectedOrders.length > 0 ? 'bg-blue-600/90 backdrop-blur-md text-white hover:bg-blue-700 shadow-blue-500/20' : 'bg-white/50 text-gray-400 cursor-not-allowed border border-white/20'}`}>
                                    {sendingOrder ? <RefreshCw size={18} className="animate-spin" /> : "Thao tác"} ({selectedOrders.length}) <ChevronDown size={16} />
                                </button>
                                {showActionMenu && selectedOrders.length > 0 && (
                                    <div className="absolute right-0 top-[105%] w-56 bg-white/90 backdrop-blur-2xl border border-white/30 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                                        <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100/50 bg-gray-50/50">In Ấn</div>
                                        <button onClick={() => executePrint('A4')} className="w-full text-left px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50/50 hover:text-blue-700 transition-colors flex items-center gap-2">
                                            <Printer size={16} /> In khổ A4/A5
                                        </button>
                                        <button onClick={() => executePrint('K80')} className="w-full text-left px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50/50 hover:text-blue-700 transition-colors flex items-center gap-2">
                                            <Printer size={16} /> In khổ K80
                                        </button>
                                        <div className="px-3 py-2 mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-y border-gray-100/50 bg-gray-50/50">Vận Chuyển</div>
                                        <button onClick={handleSendCarrier} disabled={sendingOrder} className="w-full text-left px-5 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                            <Send size={16} /> Gửi Hãng Vận Chuyển
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {copyMessage && (
                        <div className={`text-xs font-medium bg-white/70 backdrop-blur-sm border rounded-2xl px-4 py-2 animate-fade-in ${copyMessage.includes('✅') ? 'text-green-700 border-green-200/50 bg-green-50/50' : 'text-red-700 border-red-200/50 bg-red-50/50'}`}>
                            {copyMessage}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="w-64">
                            <input type="text" value={searchNote} onChange={(e) => setSearchNote(e.target.value)} placeholder="Tìm trong ghi chú..." className="w-full px-4 py-3 text-sm border border-white/30 rounded-2xl outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all bg-white/60 backdrop-blur-xl hover:bg-white/80 shadow-sm" />
                        </div>
                        <div className="w-48">
                            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full px-4 py-3 text-sm border border-white/30 rounded-2xl bg-white/60 backdrop-blur-xl hover:bg-white/80 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all shadow-sm outline-none">
                                <option value="">Sắp xếp: Mặc định</option>
                                <option value="asc">Cũ nhất trước</option>
                                <option value="desc">Mới nhất trước</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col transition-shadow hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-20 text-center text-gray-400 font-medium text-lg animate-pulse">Đang tải dữ liệu...</div>
                        ) : paginatedOrders.length === 0 ? (
                            <div className="p-20 text-center text-gray-400 font-medium text-lg">Không có đơn hàng nào khớp.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="bg-white/60 backdrop-blur-md text-gray-700 font-bold border-b border-gray-100/70 text-sm">
                                        <th className="py-4 px-4 w-12 text-center">
                                            <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                        </th>
                                        <th className="py-4 px-4 whitespace-nowrap">ID đơn hàng</th>
                                        <th className="py-4 px-4 whitespace-nowrap">ĐVVC</th>
                                        <th className="py-4 px-4 w-64">Ghi chú</th>
                                        <th className="py-4 px-4">Sản phẩm</th>
                                        <th className="py-4 px-4 text-center whitespace-nowrap">Số lượng</th>
                                        <th className="py-4 px-4 whitespace-nowrap">{activeTab === 'printable' ? 'Ngày tồn' : 'Sản phẩm thiếu / Tồn kho'}</th>
                                        <th className="py-4 px-4 text-center whitespace-nowrap">Người tạo đơn</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100/70">
                                    {paginatedOrders.map(order => {
                                        const products = order.order_products || [];
                                        const rowCount = Math.max(1, products.length);
                                        const statusName = statusDict[order.status] || `Mã ${order.status}`;
                                        const channelName = SALE_CHANNELS[order.sale_channel] || order.sale_channel || 'Khác';
                                        const isChecked = selectedOrders.includes(order.id);
                                        const channelColorClass = CHANNEL_COLORS[order.sale_channel] || 'bg-gray-100/80 text-gray-600';
                                        const statusColorClass = STATUS_COLORS[order.status] || 'bg-gray-100/80 text-gray-600';

                                        return products.map((prod, index) => {
                                            const shortItem = data.holding?.concat(data.outOfStock)?.find(o => o.id === order.id)?.debug_shortItems?.find(i => i.name === prod.product_name);

                                            return (
                                                <tr key={`${order.id}-${index}`} className={`${isChecked ? 'bg-blue-50/50 backdrop-blur-sm' : 'hover:bg-white/50'} transition-colors duration-200 font-medium`}>
                                                    {index === 0 && (
                                                        <>
                                                            <td rowSpan={rowCount} className="py-4 px-4 align-top border-r border-gray-100/50 text-center">
                                                                <input type="checkbox" checked={isChecked} onChange={() => handleSelectOne(order.id)} className="w-4 h-4 mt-1 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                                            </td>
                                                            <td rowSpan={rowCount} className="py-4 px-4 align-top border-r border-gray-100/50">
                                                                <div className="font-extrabold text-blue-600 text-base mb-1 cursor-pointer hover:underline hover:text-blue-800 transition-colors" onClick={() => handleSelectOne(order.id)}>
                                                                    {order.id}
                                                                </div>
                                                                <div className="text-xs text-gray-400 mb-2 font-normal">
                                                                    {new Date(order.created_at).toLocaleString('vi-VN')}
                                                                </div>
                                                                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${channelColorClass}`}>
                                                                    Kênh: {channelName}
                                                                </div>
                                                            </td>
                                                            <td rowSpan={rowCount} className="py-4 px-4 align-top border-r border-gray-100/50">
                                                                <div className="font-bold text-gray-800 mb-2">{order.carrier_name || 'Chưa phân bổ'}</div>
                                                                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${statusColorClass}`}>
                                                                    {statusName}
                                                                </div>
                                                            </td>
                                                            <td rowSpan={rowCount} className="py-4 px-4 align-top border-r border-gray-100/50 text-xs font-normal">
                                                                <div className="space-y-2">
                                                                    {order.description && (
                                                                        <div className="flex gap-1.5 text-gray-700 bg-blue-50/70 backdrop-blur-sm p-2 rounded-2xl">
                                                                            <MessageSquare size={14} className="mt-0.5 shrink-0 text-blue-500" />
                                                                            <span><strong>Khách:</strong> {order.description}</span>
                                                                        </div>
                                                                    )}
                                                                    {order.private_description && (
                                                                        <div className="flex gap-1.5 text-red-700 bg-red-50/70 backdrop-blur-sm p-2 rounded-2xl">
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
                                                            <div className="bg-red-50/70 backdrop-blur-sm rounded-2xl p-2 text-red-600 text-xs font-bold border border-red-200/30">
                                                                <div className="flex items-center gap-1 mb-1"><XCircle size={14} /> Thiếu {shortItem.missing}</div>
                                                                <span className="text-gray-500 font-normal">Tồn kho: {shortItem.remaining}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-green-600 text-xs font-bold flex items-center gap-1 bg-green-50/70 backdrop-blur-sm rounded-2xl p-2 border border-green-200/30">
                                                                <CheckCircle size={14} /> Đã giữ hàng
                                                            </div>
                                                        )}
                                                    </td>   
                                                    {index === 0 && (
                                                        <td rowSpan={rowCount} className="py-4 px-4 align-top text-center border-l border-gray-100/50">
                                                            <div className="inline-flex items-center justify-center gap-1.5 bg-white/60 backdrop-blur-md text-gray-700 px-3 py-1.5 rounded-full border border-white/30 font-semibold text-xs shadow-sm">
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
                    {!loading && totalOrdersCount > 0 && (
                        <div className="bg-white/50 backdrop-blur-md px-6 py-4 border-t border-white/30 flex flex-col sm:flex-row items-center justify-between text-sm font-medium text-gray-600 gap-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <span className="text-gray-500">
                                    Hiển thị <b className="text-gray-700">{(currentPage - 1) * pageSize + 1}</b> đến <b className="text-gray-700">{Math.min(currentPage * pageSize, totalOrdersCount)}</b> trong tổng <b className="text-gray-700">{totalOrdersCount}</b> đơn
                                </span>
                                <div className="flex items-center gap-2 border-l border-gray-200/50 pl-4">
                                    <span className="text-xs font-bold uppercase text-gray-400 tracking-wide">Số dòng:</span>
                                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-3 py-1.5 border border-white/30 bg-white/60 backdrop-blur-md rounded-xl font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-400/20 transition shadow-sm">
                                        <option value={20}>20 dòng</option>
                                        <option value={50}>50 dòng</option>
                                        <option value={100}>100 dòng</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2.5 border border-white/30 bg-white/60 backdrop-blur-md rounded-xl hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm">
                                    <ChevronLeft size={16} className="text-gray-600" />
                                </button>
                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => {
                                        const pageNum = i + 1;
                                        if (pageNum === 1 || pageNum === totalPages || Math.abs(currentPage - pageNum) <= 1) {
                                            return (
                                                <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`min-w-[2.5rem] h-10 rounded-xl border text-sm font-bold shadow-sm transition-all ${currentPage === pageNum ? 'bg-blue-600/90 backdrop-blur-md border-blue-600/30 text-white shadow-blue-500/20' : 'bg-white/60 backdrop-blur-md hover:bg-white/80 text-gray-700 border-white/30'}`}>
                                                    {pageNum}
                                                </button>
                                            );
                                        }
                                        if (pageNum === 2 || pageNum === totalPages - 1) return <span key={pageNum} className="px-2 text-gray-400 font-bold">...</span>;
                                        return null;
                                    })}
                                </div>
                                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2.5 border border-white/30 bg-white/60 backdrop-blur-md rounded-xl hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm">
                                    <ChevronRight size={16} className="text-gray-600" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}