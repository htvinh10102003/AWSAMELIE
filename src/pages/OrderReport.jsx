import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, CheckCircle, AlertTriangle, XCircle, RefreshCw, MessageSquare, Lock, User, ChevronDown, Printer, ChevronLeft, ChevronRight, Copy, Send, Settings2, PackageSearch, Save } from 'lucide-react';

const SALE_CHANNELS = {
    '1': 'Admin', '2': 'Website', '10': 'API', '20': 'Facebook', '21': 'Instagram',
    '41': 'Lazada', '42': 'Shopee', '43': 'Sendo', '45': 'Tiki', '48': 'Tiktok Shop',
    '49': 'Zalo OA', '50': 'Shopee chat', '51': 'Lazada chat', '52': 'Zalo cá nhân'
};

const CHANNEL_COLORS = {
    '1': 'bg-blue-600 text-white border-blue-700 shadow-sm', // Admin - Xanh
    '2': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    '10': 'bg-violet-100 text-violet-700 border-violet-200',
    '20': 'bg-blue-100 text-blue-700 border-blue-200',
    '21': 'bg-pink-100 text-pink-700 border-pink-200',
    '41': 'bg-orange-100 text-orange-700 border-orange-200',
    '42': 'bg-red-600 text-white border-red-700 shadow-sm', // Shopee - Đỏ
    '43': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    '45': 'bg-teal-100 text-teal-700 border-teal-200',
    '48': 'bg-black text-white border-gray-900 shadow-sm', // Tiktok Shop - Đen
    '49': 'bg-blue-100 text-blue-700 border-blue-200',
    '50': 'bg-red-100 text-red-700 border-red-200',
    '51': 'bg-orange-100 text-orange-700 border-orange-200',
    '52': 'bg-green-100 text-green-700 border-green-200'
};

// Chuẩn hóa ID Trạng thái Nhanh.vn sang màu sắc
const STATUS_COLORS = {
    '1': 'bg-blue-700 text-white shadow-sm', // Đơn mới -> Xanh dương đậm
    '2': 'bg-orange-500 text-white shadow-sm', // Chờ khách xác nhận -> Cam
    '3': 'bg-blue-100 text-blue-800 border border-blue-300', // Đã xác nhận -> Xanh dương nhạt
    '4': 'bg-gray-500 text-white shadow-sm', // Đang đóng gói -> Xám
    '5': 'bg-[#8B4513] text-white shadow-sm', // Đã đóng gói -> Nâu
    '6': 'bg-green-600 text-white shadow-sm', // Đã gửi HVC
    '7': 'bg-teal-600 text-white shadow-sm',
    '8': 'bg-rose-100 text-rose-700 border border-rose-300',
    '9': 'bg-red-600 text-white shadow-sm',
    '10': 'bg-orange-100 text-orange-700',
};

const DEPOT_NAMES = {
    '180540': 'AMELIE',
    '225005': 'LUNARA'
};

const OPTIONAL_COLUMNS = [
    { id: 'carrier', label: 'Hãng vận chuyển & Trạng thái' },
    { id: 'source', label: 'Nguồn đơn & Kênh' },
    { id: 'notes', label: 'Ghi chú' },
    { id: 'aging', label: 'Tồn kho / Ngày tồn' },
    { id: 'creator', label: 'Người tạo đơn' },
    { id: 'printed_at', label: 'Hiện Ngày in cuối (dưới thông tin đơn)' }
];

const DEFAULT_VISIBLE_COLS = ['carrier', 'source', 'notes', 'aging', 'creator'];

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
        <div className="relative w-full" ref={ref}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left flex items-center justify-between shadow-sm">
                <span className={`truncate mr-2 ${selected.length === 0 ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>{selected.length === 0 ? placeholder : `Đã chọn ${selected.length}`}</span>
                <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
                        <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-medium">Chọn tất cả</span>
                    </label>
                    {options.map(opt => {
                        const val = getValue(opt);
                        const label = getLabel(opt);
                        return (
                            <label key={val} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors">
                                <input type="checkbox" checked={selected.includes(val)} onChange={() => toggleOption(val)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm truncate" title={label}>{label}</span>
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
    const [userEmail, setUserEmail] = useState('');
    
    // UI State
    const [activeTab, setActiveTab] = useState('printable');
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [showCopyMenu, setShowCopyMenu] = useState(false);
    const [showMissedModal, setShowMissedModal] = useState(false);
    const [showColSettings, setShowColSettings] = useState(false);
    
    // Config State
    const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE_COLS);
    const [isSavingCols, setIsSavingCols] = useState(false);

    // Filter State
    const [searchId, setSearchId] = useState('');
    const [searchProduct, setSearchProduct] = useState('');
    const [searchNote, setSearchNote] = useState('');
    const [selectedStatus, setSelectedStatus] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState([]);
    const [selectedCreator, setSelectedCreator] = useState([]);
    const [selectedDepot, setSelectedDepot] = useState([]);
    const [printedFilter, setPrintedFilter] = useState(''); // Bộ lọc ngày in
    const [selectedOrders, setSelectedOrders] = useState([]);
    const [sortOrder, setSortOrder] = useState('');
    const [agingFilter, setAgingFilter] = useState(false);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    
    // Action State
    const [isUpdatingWebhooks, setIsUpdatingWebhooks] = useState(false);
    const [updatingSelected, setUpdatingSelected] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [copyMessage, setCopyMessage] = useState('');
    const [sendingOrder, setSendingOrder] = useState(false);

    // Options mapping
    const [carrierOptions, setCarrierOptions] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);
    const [channelOptions, setChannelOptions] = useState([]);
    const [creatorOptions, setCreatorOptions] = useState([]);
    const [depotOptions, setDepotOptions] = useState([]);

    const colSettingsRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            try {
                const { data: authData } = await supabase.auth.getUser();
                const email = authData?.user?.email || 'default_user';
                setUserEmail(email);

                const dict = await fetchSystemData(email);
                await fetchAllocation(dict);
            } catch (err) {
                console.error('Init error:', err);
                setLoading(false);
            }
        };
        init();

        const handleClickOutside = (event) => {
            if (colSettingsRef.current && !colSettingsRef.current.contains(event.target)) {
                setShowColSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (activeTab !== 'printable') setAgingFilter(false);
    }, [activeTab]);

    useEffect(() => {
        setSelectedOrders([]);
        setShowActionMenu(false);
        setShowCopyMenu(false);
        setCurrentPage(1);
    }, [activeTab, searchId, searchProduct, selectedStatus, selectedCarrier, selectedChannel, selectedCreator, selectedDepot, searchNote, sortOrder, pageSize, agingFilter, printedFilter]);

    const fetchSystemData = async (email) => {
        const { data: stData } = await supabase.from('order_statuses').select('*');
        const dict = {};
        stData?.forEach(s => dict[s.id] = s.name);
        setStatusDict(dict);

        const [confRes, userConfRes] = await Promise.all([
            supabase.from('system_configs').select('*').eq('key', 'nhanh_business_id').maybeSingle(),
            supabase.from('system_configs').select('*').eq('key', `order_cols_pref_${email}`).maybeSingle()
        ]);

        if (confRes.data) setBusinessId(confRes.data.value);
        if (userConfRes.data) {
            try {
                const savedCols = JSON.parse(userConfRes.data.value);
                if (Array.isArray(savedCols)) setVisibleCols(savedCols);
            } catch (e) { console.error("Error parsing col settings"); }
        }
        return dict;
    };

    const handleToggleColumn = (colId) => {
        const newCols = visibleCols.includes(colId) 
            ? visibleCols.filter(c => c !== colId) 
            : [...visibleCols, colId];
        setVisibleCols(newCols);
    };

    const handleSaveColumnConfig = async () => {
        if (!userEmail) return;
        setIsSavingCols(true);
        try {
            await supabase.from('system_configs').upsert({
                key: `order_cols_pref_${userEmail}`,
                value: JSON.stringify(visibleCols),
                description: `Column visibility preferences for user ${userEmail}`
            });
            setCopyMessage('✅ Đã lưu cấu hình hiển thị cột');
            setTimeout(() => setCopyMessage(''), 3000);
            setShowColSettings(false);
        } catch (error) {
            console.error("Lỗi khi lưu cấu hình hiển thị:", error);
            setCopyMessage('⚠️ Đã xảy ra lỗi khi lưu cấu hình');
            setTimeout(() => setCopyMessage(''), 3000);
        } finally {
            setIsSavingCols(false);
        }
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

            const uniqueCreators = [...new Set(allOrders.map(o => o.created_by_name).filter(Boolean))];
            setCreatorOptions(uniqueCreators.map(c => ({
                value: String(c),
                label: c
            })));
            
            const uniqueDepots = [...new Set(allOrders.map(o => o.depot_id).filter(Boolean))];
            setDepotOptions(uniqueDepots.map(id => ({
                value: String(id),
                label: DEPOT_NAMES[id] || `Kho ${id}`
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
            // Text filters
            if (searchId) {
                const query = searchId.trim().toLowerCase();
                const matchId = String(order.id).toLowerCase().includes(query);
                const matchEcom = order.ecom_order_id && String(order.ecom_order_id).toLowerCase().includes(query);
                const matchCarrier = order.carrier_code && String(order.carrier_code).toLowerCase().includes(query);
                if (!matchId && !matchEcom && !matchCarrier) return false;
            }

            if (searchProduct) {
                const prodQuery = searchProduct.trim().toLowerCase();
                const hasProductMatch = order.order_products?.some(p => 
                    (p.product_name && p.product_name.toLowerCase().includes(prodQuery)) ||
                    (p.product_code && p.product_code.toLowerCase().includes(prodQuery))
                );
                if (!hasProductMatch) return false;
            }

            if (searchNote) {
                const note = (order.description || '') + ' ' + (order.private_description || '');
                if (!note.toLowerCase().includes(searchNote.toLowerCase())) return false;
            }

            // Status and Option Filters
            if (selectedStatus.length > 0 && !selectedStatus.includes(String(order.status))) return false;
            if (selectedCarrier.length > 0 && !selectedCarrier.includes(order.carrier_name)) return false;
            if (selectedChannel.length > 0 && !selectedChannel.includes(String(order.sale_channel))) return false;
            if (selectedCreator.length > 0 && !selectedCreator.includes(order.created_by_name)) return false;
            if (selectedDepot.length > 0 && !selectedDepot.includes(String(order.depot_id))) return false;
            
            // Lọc Ngày in gần nhất
            if (printedFilter === 'not_printed' && order.printed_at) return false;
            if (printedFilter === 'printed' && !order.printed_at) return false;
            if (printedFilter === 'today') {
                if (!order.printed_at) return false;
                const isToday = new Date(order.printed_at).toDateString() === new Date().toDateString();
                if (!isToday) return false;
            }

            // Aging Filter
            if (agingFilter && activeTab === 'printable') {
                const days = order.printable_date
                    ? Math.floor((new Date() - new Date(order.printable_date)) / (1000 * 60 * 60 * 24))
                    : 0;
                if (days <= 2) return false;
            }
            
            return true;
        });

        if (sortOrder === 'asc') filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        else if (sortOrder === 'desc') filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return filtered;
    };

    const currentRawList = data[activeTab] || [];
    const filteredOrders = getFilteredOrders(currentRawList);
    
    // Xác định list đơn hàng mục tiêu để COPY (Các đơn đã tick HOẶC Tất cả các đơn hiển thị)
    const targetOrdersForCopy = selectedOrders.length > 0 
        ? filteredOrders.filter(o => selectedOrders.includes(o.id)) 
        : filteredOrders;

    const copyTargetCount = targetOrdersForCopy.length;
    const ecomOrdersCount = targetOrdersForCopy.filter(o => ['42', '48'].includes(String(o.sale_channel)) && o.ecom_order_id).length;
    const carrierOrdersCount = targetOrdersForCopy.filter(o => o.carrier_code).length;

    const totalOrdersCount = filteredOrders.length;
    const totalPages = Math.ceil(totalOrdersCount / pageSize) || 1;
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    
    const allRawOrders = [...(data.printable || []), ...(data.holding || []), ...(data.outOfStock || [])];
    const missedWebhookOrders = allRawOrders.filter(order => !order.order_products || order.order_products.length === 0);

    const handleAutoUpdateWebhooks = async () => {
        setIsUpdatingWebhooks(true);
        setUpdateProgress(0);
        for (let i = 0; i < missedWebhookOrders.length; i++) {
            const orderId = missedWebhookOrders[i].id;
            try {
                await fetch(`https://nhanh.vn/auto/posevent/orderupdate?id=${orderId}&businessId=176023`, { method: 'GET', mode: 'no-cors' });
            } catch (err) { console.error(`Lỗi kích hoạt webhook đơn ${orderId}:`, err); }
            setUpdateProgress(i + 1);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchAllocation(statusDict);
        setIsUpdatingWebhooks(false);
        setShowMissedModal(false);
    };

    const handleUpdateSelectedWebhooks = async () => {
        if (selectedOrders.length === 0) return;
        setUpdatingSelected(true);
        setShowActionMenu(false);
        setCopyMessage(`Đang cập nhật webhook cho ${selectedOrders.length} đơn...`);
        for (let i = 0; i < selectedOrders.length; i++) {
            const orderId = selectedOrders[i];
            try {
                await fetch(`https://nhanh.vn/auto/posevent/orderupdate?id=${orderId}&businessId=176023`, { method: 'GET', mode: 'no-cors' });
            } catch (err) {}
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchAllocation(statusDict);
        setUpdatingSelected(false);
        setCopyMessage(`✅ Đã gửi lệnh cập nhật webhook xong.`);
        setSelectedOrders([]);
        setTimeout(() => setCopyMessage(''), 5000);
    };

    const executeCopy = async (type) => {
        if (targetOrdersForCopy.length === 0) return;
        
        let textToCopy = '';
        let count = 0;

        if (type === 'system') {
            textToCopy = targetOrdersForCopy.map(order => order.id).join('\n');
            count = targetOrdersForCopy.length;
        } else if (type === 'ecom') {
            const validOrders = targetOrdersForCopy.filter(o => ['42', '48'].includes(String(o.sale_channel)) && o.ecom_order_id);
            textToCopy = validOrders.map(o => o.ecom_order_id).join('\n');
            count = validOrders.length;
        } else if (type === 'carrier') {
            const validOrders = targetOrdersForCopy.filter(o => o.carrier_code);
            textToCopy = validOrders.map(o => o.carrier_code).join('\n');
            count = validOrders.length;
        }

        if (!textToCopy) {
            setCopyMessage('⚠️ Không có mã nào hợp lệ để copy.');
            setTimeout(() => setCopyMessage(''), 3000);
            setShowCopyMenu(false);
            return;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopyMessage(`✅ Đã copy ${count} mã ${type === 'ecom' ? 'đơn sàn' : type === 'carrier' ? 'vận đơn' : 'hệ thống'}.`);
        } catch (err) {
            setCopyMessage('⚠️ Copy thất bại, vui lòng thử lại.');
        }
        
        setTimeout(() => setCopyMessage(''), 3000);
        setShowCopyMenu(false);
    };

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
            printUrl = `https://nhanh.vn/order/manage/pickup?storeId=${businessId}&businessId=${businessId}&ids=${idString}&emptyLayout=true&printDialogMode=manual&format=print${printSize === 'K80' ? '&typePrint=k80' : ''}`;
        } else if (selectedOrders.length > 1) {
            printUrl = `https://nhanh.vn/order/manage/pickup?ids=${idString}&storeId=${businessId}&format=print&printDialogMode=manual&noclose=1${printSize === 'K80' ? '&typePrint=k80' : ''}`;
        }
        if (printUrl) { window.open(printUrl, '_blank'); setShowActionMenu(false); }
    };

    const handleSendCarrier = async () => {
        if (selectedOrders.length === 0) return;
        setSendingOrder(true);
        setShowActionMenu(false);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nhanh-carrier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ action: 'sendCarrier', orderIds: selectedOrders })
            });
            const result = await response.json();
            if (result.success) {
                setCopyMessage(`✅ Đã gửi ${selectedOrders.length} đơn sang hãng vận chuyển.`);
                setSelectedOrders([]);
                fetchAllocation(statusDict); 
            } else {
                setCopyMessage(`⚠️ Lỗi gửi đơn: ${result.message}`);
            }
        } catch (error) {
            setCopyMessage('⚠️ Đã xảy ra lỗi hệ thống.');
        } finally {
            setSendingOrder(false);
            setTimeout(() => setCopyMessage(''), 5000);
        }
    };

    const renderAgingBadge = (dateStr) => {
        if (!dateStr) return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[11px] font-medium border border-green-200">Hôm nay</span>;
        const diffTime = new Date() - new Date(dateStr);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[11px] font-medium border border-green-200">Mới</span>;
        else if (diffDays <= 2) return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[11px] font-medium border border-amber-200">{diffDays} ngày</span>;
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[11px] font-bold border border-red-300 shadow-sm animate-pulse">{diffDays} ngày</span>;
    };

    return (
        <div className="min-h-screen p-4 md:p-6 font-sans">
            <div className="max-w-[1400px] mx-auto space-y-6">
                
                {/* Header Area */}
                <div className="flex justify-between items-center bg-white border border-gray-200 rounded-xl px-6 py-5 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Quản lý kho & Đơn hàng</h2>
                        <p className="text-gray-500 text-sm mt-1">Phân bổ tự động dựa trên tồn kho thực tế</p>
                    </div>
                    <button
                        onClick={() => fetchAllocation(statusDict)}
                        disabled={loading}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 focus:ring-2 focus:ring-blue-100 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Làm mới dữ liệu
                    </button>
                </div>

                {/* Dashboard Tabs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div onClick={() => setActiveTab('printable')} className={`cursor-pointer p-5 rounded-xl border bg-white flex items-center gap-4 transition-all ${activeTab === 'printable' ? 'ring-2 ring-green-500 border-transparent shadow-md' : 'border-gray-200 hover:border-green-300 shadow-sm'}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${activeTab === 'printable' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-800">{data.printable?.length || 0}</div>
                            <div className="text-sm text-gray-500 font-medium">Đủ hàng (Có thể in)</div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('holding')} className={`cursor-pointer p-5 rounded-xl border bg-white flex items-center gap-4 transition-all ${activeTab === 'holding' ? 'ring-2 ring-yellow-500 border-transparent shadow-md' : 'border-gray-200 hover:border-yellow-300 shadow-sm'}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${activeTab === 'holding' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-800">{data.holding?.length || 0}</div>
                            <div className="text-sm text-gray-500 font-medium">Tạm giữ (Thiếu 1 phần)</div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('outOfStock')} className={`cursor-pointer p-5 rounded-xl border bg-white flex items-center gap-4 transition-all ${activeTab === 'outOfStock' ? 'ring-2 ring-red-500 border-transparent shadow-md' : 'border-gray-200 hover:border-red-300 shadow-sm'}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${activeTab === 'outOfStock' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                            <XCircle size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-800">{data.outOfStock?.length || 0}</div>
                            <div className="text-sm text-gray-500 font-medium">Hết hàng</div>
                        </div>
                    </div>
                </div>

                {missedWebhookOrders.length > 0 && (
                    <div className="flex bg-red-50 border border-red-200 rounded-lg p-3">
                        <button onClick={() => setShowMissedModal(true)} className="flex items-center gap-2 text-red-700 font-medium text-sm hover:text-red-800 transition-colors">
                            <AlertTriangle size={18} className="animate-pulse" />
                            Phát hiện {missedWebhookOrders.length} đơn hàng bị thiếu sản phẩm (Miss Webhook). Nhấn để xử lý.
                        </button>
                    </div>
                )}

                {/* Filters & Actions Bar */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search Inputs */}
                            <div className="relative min-w-[240px]">
                                <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Tìm ID, Mã Sàn, Mã Vận Đơn..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-colors" />
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            </div>
                            <div className="relative min-w-[200px]">
                                <input type="text" value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} placeholder="Tìm tên/mã SP..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-colors" />
                                <PackageSearch className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            </div>
                            
                            {/* Selects */}
                            <div className="w-[150px]">
                                <MultiSelect options={channelOptions} selected={selectedChannel} onChange={setSelectedChannel} placeholder="Kênh bán" />
                            </div>
                            <div className="w-[150px]">
                                <MultiSelect options={carrierOptions} selected={selectedCarrier} onChange={setSelectedCarrier} placeholder="Hãng VC" />
                            </div>
                            <div className="w-[150px]">
                                <MultiSelect options={statusOptions} selected={selectedStatus} onChange={setSelectedStatus} placeholder="Trạng thái" />
                            </div>
                            <div className="w-[150px]">
                                <MultiSelect options={depotOptions} selected={selectedDepot} onChange={setSelectedDepot} placeholder="Kho hàng" />
                            </div>
                            <div className="w-[150px]">
                                <MultiSelect options={creatorOptions} selected={selectedCreator} onChange={setSelectedCreator} placeholder="Nhân viên" />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {/* Copy Dropdown */}
                            <div className="relative" onMouseLeave={() => setShowCopyMenu(false)}>
                                <button 
                                    onClick={() => setShowCopyMenu(!showCopyMenu)} 
                                    disabled={copyTargetCount === 0} 
                                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm ${copyTargetCount > 0 ? 'bg-gray-800 text-white hover:bg-gray-900' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}
                                >
                                    <Copy size={15} /> Copy ({copyTargetCount}) <ChevronDown size={14} />
                                </button>
                                
                                {showCopyMenu && copyTargetCount > 0 && (
                                    <div className="absolute right-0 top-full pt-2 w-[270px] z-50">
                                        <div className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden py-1">
                                            <button 
                                                onClick={() => executeCopy('system')} 
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                                            >
                                                <span className="font-medium">ID Hệ thống</span>
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-bold">{copyTargetCount}</span>
                                            </button>
                                            <button 
                                                onClick={() => executeCopy('ecom')} 
                                                disabled={ecomOrdersCount === 0}
                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between border-t border-gray-100 ${ecomOrdersCount > 0 ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}
                                            >
                                                <span className="font-medium">ID Đơn sàn (Shopee/TikTok)</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${ecomOrdersCount > 0 ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {ecomOrdersCount}
                                                </span>
                                            </button>
                                            <button 
                                                onClick={() => executeCopy('carrier')} 
                                                disabled={carrierOrdersCount === 0}
                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between border-t border-gray-100 ${carrierOrdersCount > 0 ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}
                                            >
                                                <span className="font-medium">Mã Vận đơn</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${carrierOrdersCount > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {carrierOrdersCount}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Column Settings */}
                            <div className="relative" ref={colSettingsRef}>
                                <button onClick={() => setShowColSettings(!showColSettings)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-gray-100 transition-all shadow-sm">
                                    <Settings2 size={18} />
                                </button>
                                {showColSettings && (
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-2 flex flex-col">
                                        <div className="px-4 py-2 border-b border-gray-100 font-semibold text-sm text-gray-700">Hiển thị cột</div>
                                        <div className="max-h-[300px] overflow-y-auto p-2">
                                            {OPTIONAL_COLUMNS.map(col => (
                                                <label key={col.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={visibleCols.includes(col.id)} 
                                                        onChange={() => handleToggleColumn(col.id)}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{col.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="px-3 pt-2 pb-1 border-t border-gray-100">
                                            <button 
                                                onClick={handleSaveColumnConfig}
                                                disabled={isSavingCols}
                                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                                            >
                                                {isSavingCols ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                                Lưu cấu hình
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="relative" onMouseLeave={() => setShowActionMenu(false)}>
                                <button onClick={() => setShowActionMenu(!showActionMenu)} disabled={selectedOrders.length === 0 || sendingOrder || updatingSelected} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm ${selectedOrders.length > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}>
                                    {sendingOrder || updatingSelected ? <RefreshCw size={16} className="animate-spin" /> : "Thao tác"} ({selectedOrders.length}) <ChevronDown size={14} />
                                </button>
                                {showActionMenu && selectedOrders.length > 0 && (
                                    <div className="absolute right-0 top-full pt-2 w-56 z-50">
                                        <div className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden py-1">
                                            <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase bg-gray-50">In Ấn</div>
                                            <button onClick={() => executePrint('A4')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Printer size={15} /> In khổ A4/A5</button>
                                            <button onClick={() => executePrint('K80')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Printer size={15} /> In khổ K80</button>
                                            
                                            <div className="px-3 py-1.5 mt-1 text-[11px] font-semibold text-gray-400 uppercase bg-gray-50 border-t border-gray-100">Vận Chuyển</div>
                                            <button onClick={handleSendCarrier} className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"><Send size={15} /> Gửi Hãng Vận Chuyển</button>

                                            <div className="px-3 py-1.5 mt-1 text-[11px] font-semibold text-gray-400 uppercase bg-gray-50 border-t border-gray-100">Hệ Thống</div>
                                            <button onClick={handleUpdateSelectedWebhooks} className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"><RefreshCw size={15} /> Cập nhật lại Webhook</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                        <input type="text" value={searchNote} onChange={(e) => setSearchNote(e.target.value)} placeholder="Lọc nội dung ghi chú..." className="w-[240px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 hover:bg-white" />
                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-[160px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50">
                            <option value="">Sắp xếp mặc định</option>
                            <option value="asc">Cũ nhất trước</option>
                            <option value="desc">Mới nhất trước</option>
                        </select>
                        <select value={printedFilter} onChange={(e) => setPrintedFilter(e.target.value)} className="w-[180px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50">
                            <option value="">Lọc theo Trạng thái in</option>
                            <option value="not_printed">Chưa có ngày in gần nhất</option>
                            <option value="printed">Đã có ngày in</option>
                            <option value="today">Đã in hôm nay</option>
                        </select>
                        {activeTab === 'printable' && (
                            <label className="flex items-center gap-2 cursor-pointer ml-2">
                                <input type="checkbox" checked={agingFilter} onChange={(e) => setAgingFilter(e.target.checked)} className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                                <span className="text-sm font-medium text-gray-700">Chỉ đơn tồn &gt; 2 ngày</span>
                            </label>
                        )}
                    </div>
                </div>

                {/* Notifications */}
                {copyMessage && (
                    <div className={`px-4 py-2 text-sm font-medium rounded-lg border flex items-center ${copyMessage.includes('✅') ? 'bg-green-50 text-green-700 border-green-200' : copyMessage.includes('Đang') ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {copyMessage}
                    </div>
                )}

                {/* Main Table */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-16 text-center text-gray-400 font-medium text-sm flex flex-col items-center gap-3">
                                <RefreshCw className="animate-spin text-blue-500" size={24} /> Đang tải dữ liệu...
                            </div>
                        ) : paginatedOrders.length === 0 ? (
                            <div className="p-16 text-center text-gray-400 text-sm">Không tìm thấy đơn hàng nào phù hợp.</div>
                        ) : (
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                                    <tr>
                                        <th className="py-3 px-4 w-12 text-center">
                                            <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                        </th>
                                        <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[140px]">Thông tin Đơn</th>
                                        
                                        {visibleCols.includes('carrier') && <th className="py-3 px-4 font-semibold whitespace-nowrap">Vận chuyển</th>}
                                        {visibleCols.includes('source') && <th className="py-3 px-4 font-semibold whitespace-nowrap">Kênh & Nguồn</th>}
                                        {visibleCols.includes('notes') && <th className="py-3 px-4 font-semibold w-64">Ghi chú</th>}
                                        
                                        <th className="py-3 px-4 font-semibold min-w-[200px]">Sản phẩm</th>
                                        <th className="py-3 px-4 font-semibold text-center whitespace-nowrap w-24">Số lượng</th>
                                        
                                        {visibleCols.includes('aging') && <th className="py-3 px-4 font-semibold whitespace-nowrap">{activeTab === 'printable' ? 'Ngày tồn' : 'Kho / Thiếu'}</th>}
                                        {visibleCols.includes('creator') && <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Nhân viên</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedOrders.map(order => {
                                        const products = order.order_products || [];
                                        const rowCount = Math.max(1, products.length);
                                        const statusName = statusDict[order.status] || `Mã ${order.status}`;
                                        const channelName = SALE_CHANNELS[order.sale_channel] || order.sale_channel || 'Khác';
                                        const isChecked = selectedOrders.includes(order.id);
                                        
                                        const channelColorClass = CHANNEL_COLORS[order.sale_channel] || 'bg-gray-100 text-gray-600 border-gray-200';
                                        const statusColorClass = STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600 border border-gray-200';

                                        const agingDays = order.printable_date ? Math.floor((new Date() - new Date(order.printable_date)) / (1000 * 60 * 60 * 24)) : 0;
                                        const isAgingOrder = activeTab === 'printable' && agingDays > 2;

                                        return products.map((prod, index) => {
                                            const shortItem = data.holding?.concat(data.outOfStock)?.find(o => o.id === order.id)?.debug_shortItems?.find(i => i.name === prod.product_name);

                                            return (
                                                <tr key={`${order.id}-${index}`} 
                                                    className={`${isChecked ? 'bg-blue-50/60' : isAgingOrder ? 'bg-red-50/40' : 'hover:bg-gray-50/50'} transition-colors`}
                                                >
                                                    {/* Cột 1: Checkbox */}
                                                    {index === 0 && (
                                                        <td rowSpan={rowCount} className="py-3 px-4 align-top border-r border-gray-100 text-center">
                                                            <input type="checkbox" checked={isChecked} onChange={() => handleSelectOne(order.id)} className="w-4 h-4 mt-1 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                                        </td>
                                                    )}

                                                    {/* Cột 2: Gộp ID (Order ID, Ecom ID, Carrier Code) và Hiện ngày in */}
                                                    {index === 0 && (
                                                        <td rowSpan={rowCount} className="py-3 px-4 align-top border-r border-gray-100">
                                                            <div className="font-bold text-gray-800 cursor-pointer hover:text-blue-600 mb-1" onClick={() => handleSelectOne(order.id)}>
                                                                {order.id}
                                                            </div>
                                                            {order.ecom_order_id && (
                                                                <div className="text-[11px] mb-0.5 flex items-center gap-1.5">
                                                                    <span className="font-medium bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded shadow-sm border border-pink-200">Sàn</span>
                                                                    <span className="text-pink-600 font-semibold">{order.ecom_order_id}</span>
                                                                </div>
                                                            )}
                                                            {order.carrier_code && (
                                                                <div className="text-[11px] mb-1 flex items-center gap-1.5">
                                                                    <span className="font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shadow-sm border border-purple-200">MVD</span>
                                                                    <span className="text-purple-600 font-semibold">{order.carrier_code}</span>
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] text-gray-400 mt-1">
                                                                {new Date(order.created_at).toLocaleString('vi-VN')}
                                                            </div>
                                                            
                                                            {/* Thông tin Ngày in cuối */}
                                                            {visibleCols.includes('printed_at') && (
                                                                <div className="text-[10px] text-gray-500 mt-1">
                                                                    Ngày in cuối: <span className="font-medium text-gray-700">{order.printed_at ? new Date(order.printed_at).toLocaleDateString('vi-VN') : 'Chưa in'}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Cột 3 (Tùy chọn): Vận chuyển */}
                                                    {index === 0 && visibleCols.includes('carrier') && (
                                                        <td rowSpan={rowCount} className="py-3 px-4 align-top border-r border-gray-100">
                                                            <div className="font-semibold text-gray-700 text-sm mb-1.5">{order.carrier_name || 'Chưa phân bổ'}</div>
                                                            <div className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${statusColorClass}`}>
                                                                {statusName}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* Cột 4 (Tùy chọn): Kênh & Nguồn */}
                                                    {index === 0 && visibleCols.includes('source') && (
                                                        <td rowSpan={rowCount} className="py-3 px-4 align-top border-r border-gray-100">
                                                            <div className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border mb-1.5 ${channelColorClass}`}>
                                                                {channelName}
                                                            </div>
                                                            {order.traffic_source && (
                                                                <div className="text-[11px] text-gray-500 truncate max-w-[120px]" title={order.traffic_source}>
                                                                    Nguồn: {order.traffic_source}
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Cột 5 (Tùy chọn): Ghi chú */}
                                                    {index === 0 && visibleCols.includes('notes') && (
                                                        <td rowSpan={rowCount} className="py-3 px-4 align-top border-r border-gray-100">
                                                            <div className="space-y-1.5 text-xs">
                                                                {order.description && (
                                                                    <div className="flex gap-1.5 text-gray-700">
                                                                        <MessageSquare size={13} className="mt-0.5 shrink-0 text-blue-500" />
                                                                        <span className="line-clamp-2" title={order.description}>{order.description}</span>
                                                                    </div>
                                                                )}
                                                                {order.private_description && (
                                                                    <div className="flex gap-1.5 text-red-700 bg-red-50 p-1.5 rounded">
                                                                        <Lock size={13} className="mt-0.5 shrink-0" />
                                                                        <span className="line-clamp-2" title={order.private_description}>{order.private_description}</span>
                                                                    </div>
                                                                )}
                                                                {!order.description && !order.private_description && (
                                                                    <span className="text-gray-400 italic">Không có</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* Cột 6: Sản phẩm */}
                                                    <td className="py-2.5 px-4 align-top">
                                                        <div className="font-medium text-gray-800 text-sm leading-tight mb-1">{prod.product_name}</div>
                                                        <div className="text-[11px] text-gray-500 font-mono">{prod.product_code}</div>
                                                    </td>

                                                    {/* Cột 7: Số lượng */}
                                                    <td className="py-2.5 px-4 align-top text-center font-bold text-gray-900">
                                                        {prod.quantity}
                                                    </td>

                                                    {/* Cột 8 (Tùy chọn): Tồn kho / Ngày tồn */}
                                                    {visibleCols.includes('aging') && (
                                                        <td className="py-2.5 px-4 align-top">
                                                            {activeTab === 'printable' ? (
                                                                renderAgingBadge(order.printable_date)
                                                            ) : shortItem ? (
                                                                <div className="bg-red-50 text-red-600 rounded px-2 py-1 text-[11px] font-medium border border-red-100">
                                                                    <div className="flex items-center gap-1 mb-0.5"><XCircle size={12} /> Thiếu {shortItem.missing}</div>
                                                                    <span className="text-gray-500">Tồn: {shortItem.remaining}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-green-600 text-[11px] font-medium flex items-center gap-1 bg-green-50 rounded px-2 py-1 border border-green-100">
                                                                    <CheckCircle size={12} /> Giữ hàng
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Cột 9 (Tùy chọn): Nhân viên (Đã fix lỗi hiển thị ...) */}
                                                    {index === 0 && visibleCols.includes('creator') && (
                                                        <td rowSpan={rowCount} className="py-3 px-4 align-top text-center border-l border-gray-100">
                                                            <div className="inline-flex items-center gap-1.5 text-gray-600 bg-gray-50 px-2 py-1 rounded text-xs">
                                                                <User size={13} className="text-gray-400 shrink-0" /> 
                                                                <span title={order.created_by_name || 'Hệ thống'}>{order.created_by_name || 'Hệ thống'}</span>
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

                    {/* Pagination */}
                    {!loading && totalOrdersCount > 0 && (
                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-600">
                                    Đang xem <span className="font-semibold text-gray-900">{(currentPage - 1) * pageSize + 1}</span> - <span className="font-semibold text-gray-900">{Math.min(currentPage * pageSize, totalOrdersCount)}</span> / <span className="font-semibold text-gray-900">{totalOrdersCount}</span> đơn
                                </span>
                                <div className="border-l border-gray-300 pl-4">
                                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500">
                                        <option value={20}>20 dòng / trang</option>
                                        <option value={50}>50 dòng / trang</option>
                                        <option value={100}>100 dòng / trang</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft size={18} /></button>
                                <div className="flex items-center px-2 text-sm">
                                    Trang <span className="font-semibold text-gray-900 mx-1">{currentPage}</span> / {totalPages}
                                </div>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight size={18} /></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Missed Webhook Modal */}
            {showMissedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Cảnh báo Đơn hàng lỗi (Miss Webhook)</h3>
                            <button onClick={() => !isUpdatingWebhooks && setShowMissedModal(false)} disabled={isUpdatingWebhooks} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex flex-col gap-3">
                                <div className="text-sm font-medium">Hệ thống ghi nhận <strong className="text-red-600 text-base">{missedWebhookOrders.length}</strong> đơn hàng chưa tải được danh sách sản phẩm.</div>
                                <button
                                    onClick={handleAutoUpdateWebhooks}
                                    disabled={isUpdatingWebhooks}
                                    className="self-start flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                                >
                                    <RefreshCw size={16} className={isUpdatingWebhooks ? "animate-spin" : ""} />
                                    {isUpdatingWebhooks ? "Đang xử lý..." : "Cập nhật dữ liệu từ Nhanh.vn"}
                                </button>
                                {isUpdatingWebhooks && (
                                    <div className="w-full mt-2">
                                        <div className="flex justify-between text-xs mb-1 text-blue-700 font-medium">
                                            <span>Tiến trình...</span>
                                            <span>{updateProgress} / {missedWebhookOrders.length}</span>
                                        </div>
                                        <div className="w-full bg-blue-200 rounded-full h-2">
                                            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${missedWebhookOrders.length > 0 ? (updateProgress / missedWebhookOrders.length) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}