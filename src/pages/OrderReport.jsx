import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, CheckCircle, AlertTriangle, XCircle, RefreshCw, MessageSquare, Lock, User, ChevronDown, Printer, ChevronLeft, ChevronRight, Copy, Send, Settings2, PackageSearch, Save, Download } from 'lucide-react';

const SALE_CHANNELS = {
    '1': 'Admin', '2': 'Website', '10': 'API', '20': 'Facebook', '21': 'Instagram',
    '41': 'Lazada', '42': 'Shopee', '43': 'Sendo', '45': 'Tiki', '48': 'Tiktok Shop',
    '49': 'Zalo OA', '50': 'Shopee chat', '51': 'Lazada chat', '52': 'Zalo cá nhân'
};

const CHANNEL_COLORS = {
    '1': 'bg-blue-600 text-white border-blue-700 shadow-sm',
    '2': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    '10': 'bg-violet-100 text-violet-700 border-violet-200',
    '20': 'bg-blue-100 text-blue-700 border-blue-200',
    '21': 'bg-pink-100 text-pink-700 border-pink-200',
    '41': 'bg-orange-100 text-orange-700 border-orange-200',
    '42': 'bg-red-600 text-white border-red-700 shadow-sm',
    '43': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    '45': 'bg-teal-100 text-teal-700 border-teal-200',
    '48': 'bg-black text-white border-gray-900 shadow-sm',
    '49': 'bg-blue-100 text-blue-700 border-blue-200',
    '50': 'bg-red-100 text-red-700 border-red-200',
    '51': 'bg-orange-100 text-orange-700 border-orange-200',
    '52': 'bg-green-100 text-green-700 border-green-200'
};

const STATUS_COLORS = {
    '1': 'bg-blue-700 text-white shadow-sm',
    '2': 'bg-orange-500 text-white shadow-sm',
    '3': 'bg-blue-100 text-blue-800 border border-blue-300',
    '4': 'bg-gray-500 text-white shadow-sm',
    '5': 'bg-[#8B4513] text-white shadow-sm',
    '6': 'bg-green-600 text-white shadow-sm',
    '7': 'bg-teal-600 text-white shadow-sm',
    '8': 'bg-rose-100 text-rose-700 border border-rose-300',
    '9': 'bg-red-600 text-white shadow-sm',
    '10': 'bg-orange-100 text-orange-700',
};

const DEPOT_NAMES = {
    '180540': 'AMELIE',
    '225005': 'LUNARA'
};

// Tên trạng thái Nhanh.vn dùng làm fallback khi order_statuses chưa tải xong.
// Map này khớp Dashboard / DeclaredFeeReport (40 Đã đóng gói, 42 Đang đóng gói,
// 43 Chờ thu gom, 54 Đơn mới, 55 Đang xác nhận, 56 Đã xác nhận, 57 Chờ khách
// xác nhận, 59 Đang chuyển, 61 Thất bại, 71 Đang chuyển hoàn, 74 Xác nhận hoàn).
const LOCAL_STATUS_NAMES = {
    '40': 'Đã đóng gói', '42': 'Đang đóng gói', '43': 'Chờ thu gom',
    '54': 'Đơn mới', '55': 'Đang xác nhận', '56': 'Đã xác nhận', '57': 'Chờ khách xác nhận',
    '58': 'Hãng vận chuyển hủy đơn', '59': 'Đang chuyển', '60': 'Thành công', '61': 'Thất bại',
    '63': 'Khách hủy', '64': 'Hệ thống hủy', '68': 'Hết hàng',
    '71': 'Đang chuyển hoàn', '72': 'Đã chuyển hoàn', '73': 'Đổi kho xuất hàng', '74': 'Xác nhận hoàn'
};

// Mặc định Admin > Cấu hình Lọc & Ưu tiên Đơn In khi chưa lưu cấu hình.
const PRINT_ALLOWED_DEFAULT = ['54', '55', '56', '42', '40'];

// Nhóm trạng thái cho báo cáo đặc biệt (theo tên trạng thái, dùng mã số).
// - Xác nhận: Đơn mới, Đang xác nhận, Đã xác nhận, Chờ khách xác nhận.
// - In và đóng gói: Đang đóng gói, Đã đóng gói.
// - Đang chuyển: Đang chuyển, Chờ thu gom, Xác nhận hoàn, Đang chuyển hoàn
//   (tên "Đang hoàn" trong yêu cầu được hiểu là mã 71 Đang chuyển hoàn),
//   Thất bại.
const SPECIAL_CONFIRM_STATUSES = ['54', '55', '56', '57'];
const SPECIAL_PRINT_STATUSES = ['42', '40'];
const SPECIAL_TRANSIT_STATUSES = ['59', '43', '74', '71', '61'];
// Kênh cho nút miss mã vận đơn: Shopee (42), Tiktok Shop (48). Không tính
// Shopee chat (50) hay Lazada chat (51) vì đó không phải kênh bán Shopee/TikTok.
const MISS_CARRIER_CHANNELS = ['42', '48'];
// Trạng thái cho nút miss mã vận đơn: Đã xác nhận (56), Chờ khách xác nhận (57),
// Đã đóng gói (40). Chỉ tính đơn đủ hàng (nhóm printable của wms-allocation).
const MISS_CARRIER_STATUSES = ['56', '57', '40'];

const isGHNCarrier = (carrierName) => {
    const n = String(carrierName || '').toUpperCase();
    return n.includes('GHN') || n.includes('GIAOHANGNHANH') || n.includes('GIAO HÀNG NHANH');
};

// Mã vận đơn "thật" trong báo cáo đặc biệt: có mã, và không phải trường hợp
// GHN mà mã bắt đầu bằng NVN (theo yêu cầu, trường hợp đó coi như chưa có mã).
const hasRealCarrier = (order) => {
    const code = String(order?.carrier_code || '').trim();
    if (!code) return false;
    if (isGHNCarrier(order?.carrier_name) && code.toUpperCase().startsWith('NVN')) return false;
    return true;
};

// --- Helpers trình bày số thành chữ thuần cho popup chi tiết ---
const fmtMoney = (v) => {
    if (v === null || v === undefined || v === '') return 'Chưa có';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return `${n.toLocaleString('vi-VN')} đ`;
};
const fmtNumber = (v) => {
    if (v === null || v === undefined || v === '') return 'Chưa có';
    const n = Number(v);
    return Number.isNaN(n) ? String(v) : n.toLocaleString('vi-VN');
};
const fmtUnix = (sec) => {
    if (!sec) return 'Chưa có';
    const d = new Date(Number(sec) * 1000);
    return Number.isNaN(d.getTime()) ? String(sec) : d.toLocaleString('vi-VN');
};
const fmtDateStr = (s) => {
    if (!s) return 'Chưa có';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString('vi-VN');
};
const fmtDateOnly = (s) => {
    if (!s) return 'Chưa có';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('vi-VN');
};
const fmtWeight = (g) => {
    if (g === null || g === undefined || g === '') return 'Chưa có';
    const n = Number(g);
    if (Number.isNaN(n)) return String(g);
    return `${n.toLocaleString('vi-VN')} g (${(n / 1000).toLocaleString('vi-VN')} kg)`;
};
const stripHtml = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim();

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
    // Owner được nhận diện giống Admin / maintenance: user_metadata.is_owner
    // hoặc email super owner. Chỉ owner thấy nút miss mã vận đơn và nút
    // chuyển sang báo cáo đặc biệt (super_admin cũng không thấy).
    const [isOwner, setIsOwner] = useState(false);
    // Trạng thái được chọn ở Admin > Cấu hình Lọc & Ưu tiên Đơn In.
    const [printAllowedStatuses, setPrintAllowedStatuses] = useState(PRINT_ALLOWED_DEFAULT);

    // --- Báo cáo đặc biệt (chỉ owner, mặc định tắt để báo cáo cũ không đổi) ---
    const [specialMode, setSpecialMode] = useState(false);
    const [specialTab, setSpecialTab] = useState('all'); // all | confirm | print | transit
    // Lazyload theo tab: chỉ kéo dữ liệu của tab đang mở, mỗi lần tối đa
    // 1000 đơn mới nhất. Cache: tabId -> {orders, nextPage, hasMore}.
    const [specialCache, setSpecialCache] = useState({});
    const [specialLoading, setSpecialLoading] = useState(false);
    const [specialError, setSpecialError] = useState('');
    const [specialOnlyMissingPrint, setSpecialOnlyMissingPrint] = useState(false);
    // Sắp xếp riêng của báo cáo đặc biệt, mặc định mới nhất trước,
    // ngược với báo cáo cũ (mặc định không sắp xếp).
    const [specialSortOrder, setSpecialSortOrder] = useState('desc');
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const getTodayStr = () => new Date().toISOString().split('T')[0];
    const get30DaysAgoStr = () => {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        return d.toISOString().split('T')[0];
    };
    const [specialStartDate, setSpecialStartDate] = useState(get30DaysAgoStr());
    const [specialEndDate, setSpecialEndDate] = useState(getTodayStr());
    // Popup chi tiết đơn (chỉ trong báo cáo đặc biệt).
    const [detailOrder, setDetailOrder] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showRawJson, setShowRawJson] = useState(false);
    
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
    const [printedFilter, setPrintedFilter] = useState(''); 
    const [selectedOrders, setSelectedOrders] = useState([]);
    const [sortOrder, setSortOrder] = useState('');
    const [agingFilter, setAgingFilter] = useState(false);
    const [missingCarrierFilter, setMissingCarrierFilter] = useState(false);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    
    // Action State
    const [isUpdatingWebhooks, setIsUpdatingWebhooks] = useState(false);
    const [updatingSelected, setUpdatingSelected] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [isUpdatingMissingCarrier, setIsUpdatingMissingCarrier] = useState(false);
    const [missingCarrierProgress, setMissingCarrierProgress] = useState(0);
    const [copyMessage, setCopyMessage] = useState('');
    const [sendingOrder, setSendingOrder] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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
                setIsOwner(authData?.user?.user_metadata?.is_owner === true || email === 'contact.hotavinh@gmail.com');

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
    }, [activeTab, searchId, searchProduct, selectedStatus, selectedCarrier, selectedChannel, selectedCreator, selectedDepot, searchNote, sortOrder, pageSize, agingFilter, printedFilter, missingCarrierFilter]);

    useEffect(() => {
        setSelectedOrders([]);
        setShowActionMenu(false);
        setShowCopyMenu(false);
        setCurrentPage(1);
    }, [specialMode, specialTab, specialOnlyMissingPrint]);

    const fetchSystemData = async (email) => {
        const { data: stData } = await supabase.from('order_statuses').select('id,name');
        const dict = {};
        stData?.forEach(s => dict[s.id] = s.name);
        setStatusDict(dict);

        const [confRes, userConfRes, printConfRes] = await Promise.all([
            supabase.from('system_configs').select('key,value').eq('key', 'nhanh_business_id').maybeSingle(),
            supabase.from('system_configs').select('key,value').eq('key', `order_cols_pref_${email}`).maybeSingle(),
            supabase.from('system_configs').select('key,value').eq('key', 'print_allowed_statuses').maybeSingle()
        ]);

        if (confRes.data) setBusinessId(confRes.data.value);
        if (printConfRes.data?.value) {
            const parsed = String(printConfRes.data.value).split(',').map(s => s.trim()).filter(Boolean);
            if (parsed.length > 0) setPrintAllowedStatuses(parsed);
        }
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
            setCopyMessage(' Đã lưu cấu hình hiển thị cột');
            setTimeout(() => setCopyMessage(''), 3000);
            setShowColSettings(false);
        } catch (error) {
            setCopyMessage('️ Đã xảy ra lỗi khi lưu cấu hình');
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

    // --- Báo cáo đặc biệt: tải trực tiếp đơn từ bảng orders ---
    // Lý do phải tải trực tiếp thay vì chỉ dùng wms-allocation: allocation
    // chỉ trả đơn trong các trạng thái được chọn ở Admin (mặc định là
    // 54, 55, 56, 42, 40), nên tab Đang chuyển (59, 43, 74, 71, 61) và tab
    // Xác nhận (gồm 57) sẽ trống nếu chỉ dùng allocation. Tải trực tiếp
    // theo ngày tạo trong khoảng đã chọn, rồi gộp với nhóm tồn kho của
    // allocation theo ID để giữ nguyên logic đủ hàng / tạm giữ / hết hàng.
    const SPECIAL_TAB_STATUSES = {
        all: null,
        confirm: [54, 55, 56, 57],
        print: [42, 40],
        transit: [59, 43, 74, 71, 61],
    };

    const fetchSpecialTab = async (tabId, { append = false, force = false, startDate, endDate } = {}) => {
        const sd = startDate || specialStartDate;
        const ed = endDate || specialEndDate;
        const existing = specialCache[tabId];
        if (!force && !append && existing) return;
        if (append && existing && !existing.hasMore) return;
        setSpecialLoading(true);
        if (!append) setSpecialError('');
        try {
            const page = append ? (existing?.nextPage || 0) : 0;
            let query = supabase
                .from('orders')
                .select('id, created_at, updated_at, packed_at, status, carrier_name, carrier_code, carrier_date, printed_at, sale_channel, ecom_order_id, created_by_name, depot_id, description, private_description, traffic_source, tracking_url, is_declared_fee, order_products (product_code, product_name, quantity)')
                .gte('created_at', `${sd}T00:00:00.000Z`)
                .lte('created_at', `${ed}T23:59:59.999Z`)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .range(page * 1000, (page + 1) * 1000 - 1);
            const statuses = SPECIAL_TAB_STATUSES[tabId];
            if (statuses) query = query.in('status', statuses);
            const { data: chunk, error } = await query;
            if (error) throw error;
            const rows = chunk || [];
            setSpecialCache(prev => {
                const prevTab = prev[tabId] || { orders: [], nextPage: 0, hasMore: true };
                return {
                    ...prev,
                    [tabId]: {
                        orders: append ? [...prevTab.orders, ...rows] : rows,
                        nextPage: page + 1,
                        hasMore: rows.length === 1000,
                    },
                };
            });
        } catch (err) {
            console.error('Lỗi tải báo cáo đặc biệt:', err);
            if (!append) setSpecialError(err.message || 'Không tải được đơn từ bảng orders.');
        } finally {
            setSpecialLoading(false);
        }
    };

    useEffect(() => {
        if (specialMode) fetchSpecialTab(specialTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [specialMode, specialTab, specialStartDate, specialEndDate]);

    const handleToggleSpecialMode = () => {
        const next = !specialMode;
        setSpecialMode(next);
        setSelectedOrders([]);
        setCurrentPage(1);
        setSpecialTab('all');
        setSpecialOnlyMissingPrint(false);
        setDetailOrder(null);
    };

    const openOrderDetail = async (order) => {
        setDetailOrder(order);
        setDetailData(null);
        setDetailLoading(true);
        setShowRawJson(false);
        try {
            // Lấy toàn bộ cột của đơn trong bảng orders. Nếu bảng có cột
            // chứa JSON gốc của Nhanh (ví dụ raw_data / data / payload),
            // select('*') sẽ lấy được nó và popup sẽ dùng nó làm nguồn chính.
            // Nếu không có cột đó, popup dùng các trường đã làm phẳng.
            const { data: full, error } = await supabase.from('orders').select('*').eq('id', order.id).single();
            if (!error && full) setDetailData(full);
        } catch (err) {
            console.error('Lỗi tải chi tiết đơn:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    // Tìm JSON gốc trong một dòng orders (nếu có): duyệt các cột, cột nào
    // là object có info/carrier/products, hoặc chuỗi JSON parse ra được
    // dạng đó, thì coi là dữ liệu gốc. Trả null nếu không có.
    const extractRawDetail = (row) => {
        if (!row || typeof row !== 'object') return null;
        const candidates = ['raw_data', 'raw', 'data', 'payload', 'nhanh_data', 'order_data'];
        for (const key of candidates) {
            const v = row[key];
            if (!v) continue;
            if (typeof v === 'object') {
                if (v.info || v.carrier || v.products) return v;
                if (v.data && (v.data.info || v.data.carrier)) return v.data;
            }
            if (typeof v === 'string' && v.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(v);
                    if (parsed.info || parsed.carrier || parsed.products) return parsed;
                    if (parsed.data && (parsed.data.info || parsed.data.carrier)) return parsed.data;
                } catch {}
            }
        }
        // Trường hợp chính dòng orders đã là dạng gốc (không qua cột riêng).
        if (row.info || row.carrier) return row;
        return null;
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

            // Lọc đơn chưa có Mã vận đơn
            if (missingCarrierFilter && order.carrier_code && String(order.carrier_code).trim() !== '') {
                return false;
            }

            // Aging Filter
            if (agingFilter && activeTab === 'printable') {
                const days = order.printable_date
                    ? Math.floor((new Date() - new Date(order.printable_date)) / (1000 * 60 * 60 * 24))
                    : 0;
                if (days < 2) return false;
            }
            
            return true;
        });

        if (sortOrder === 'asc') filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        else if (sortOrder === 'desc') filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return filtered;
    };

    const currentRawList = data[activeTab] || [];
    const filteredOrders = getFilteredOrders(currentRawList);

    const allRawOrders = [...(data.printable || []), ...(data.holding || []), ...(data.outOfStock || [])];
    const missedWebhookOrders = allRawOrders.filter(order => !order.order_products || order.order_products.length === 0);
    // Nút miss mã vận đơn (chỉ owner thấy, xem phần header): chỉ tính đơn
    // Shopee (42) / Tiktok Shop (48), ở trạng thái Đã xác nhận (56) /
    // Chờ khách xác nhận (57) / Đã đóng gói (40), chưa có mã vận đơn,
    // và phải đủ hàng (nằm trong nhóm printable của wms-allocation).
    // Đơn tạm giữ / hết hàng, đơn kênh khác, trạng thái khác đều không tính.
    const printableIds = new Set((data.printable || []).map(o => o.id));
    const missingCarrierOrders = allRawOrders.filter(order =>
        MISS_CARRIER_CHANNELS.includes(String(order.sale_channel)) &&
        MISS_CARRIER_STATUSES.includes(String(order.status)) &&
        (!order.carrier_code || String(order.carrier_code).trim() === '') &&
        printableIds.has(order.id)
    );

    // --- Báo cáo đặc biệt: nhóm tồn kho theo ID từ wms-allocation ---
    // Logic đủ hàng giữ nguyên: printable = đủ hàng, holding = tạm giữ,
    // outOfStock = hết hàng. Chỉ thay cách hiển thị, không tính lại tồn kho.
    const allocationStockById = new Map();
    (data.printable || []).forEach(o => allocationStockById.set(o.id, { group: 'printable', order: o }));
    (data.holding || []).forEach(o => allocationStockById.set(o.id, { group: 'holding', order: o }));
    (data.outOfStock || []).forEach(o => allocationStockById.set(o.id, { group: 'outOfStock', order: o }));

    const getStockInfo = (order) => {
        if (!printAllowedStatuses.includes(String(order.status))) {
            return { key: 'not_filtered', label: 'Trạng thái không lọc đơn in', detail: '' };
        }
        const stock = allocationStockById.get(order.id);
        if (!stock) return { key: 'unallocated', label: 'Chưa phân bổ', detail: '' };
        if (stock.group === 'printable') return { key: 'printable', label: 'Đủ hàng', detail: '' };
        if (stock.group === 'outOfStock') return { key: 'outOfStock', label: 'Hết hàng', detail: '' };
        // holding: lấy chi tiết thiếu hàng nếu allocation có debug_shortItems
        const products = order.order_products || [];
        const shortItems = stock.order?.debug_shortItems || [];
        const firstShort = shortItems[0];
        return {
            key: 'holding',
            label: 'Tạm giữ',
            detail: firstShort ? `Thiếu ${firstShort.missing ?? ''}, tồn ${firstShort.remaining ?? ''}` : (products.length ? 'Thiếu 1 phần' : '')
        };
    };

    const getStockBadge = (order) => {
        const info = getStockInfo(order);
        const cls = info.key === 'printable'
            ? 'bg-green-100 text-green-700 border-green-200'
            : info.key === 'holding'
            ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
            : info.key === 'outOfStock'
            ? 'bg-red-100 text-red-700 border-red-200'
            : info.key === 'not_filtered'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-gray-100 text-gray-600 border-gray-200';
        return (
            <span className={`inline-block px-2 py-1 rounded text-[11px] font-bold border ${cls}`}>
                {info.label}
                {info.detail ? <span className="block font-medium text-gray-600">{info.detail}</span> : null}
            </span>
        );
    };

    // Lọc phụ cho báo cáo đặc biệt: dùng chung các bộ lọc cũ (tìm kiếm,
    // kênh, hãng, trạng thái, kho, nhân viên, ghi chú, trạng thái in,
    // sắp xếp), nhưng bỏ lọc tồn >= 2 ngày (chỉ có ở tab đủ hàng cũ).
    // Riêng tick "Chưa có Mã vận đơn" ở báo cáo đặc biệt dùng định nghĩa
    // mã thật (GHN mã NVN coi như chưa có mã).
    const getSpecialFiltered = (orderList) => {
        if (!orderList) return [];
        let filtered = orderList.filter(order => {
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
            if (selectedStatus.length > 0 && !selectedStatus.includes(String(order.status))) return false;
            if (selectedCarrier.length > 0 && !selectedCarrier.includes(order.carrier_name)) return false;
            if (selectedChannel.length > 0 && !selectedChannel.includes(String(order.sale_channel))) return false;
            if (selectedCreator.length > 0 && !selectedCreator.includes(order.created_by_name)) return false;
            if (selectedDepot.length > 0 && !selectedDepot.includes(String(order.depot_id))) return false;
            if (printedFilter === 'not_printed' && order.printed_at) return false;
            if (printedFilter === 'printed' && !order.printed_at) return false;
            if (printedFilter === 'today') {
                if (!order.printed_at) return false;
                const isToday = new Date(order.printed_at).toDateString() === new Date().toDateString();
                if (!isToday) return false;
            }
            if (missingCarrierFilter && hasRealCarrier(order)) return false;
            return true;
        });
        if (specialSortOrder === 'asc') filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        else filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return filtered;
    };

    // Tên trạng thái ngắn chỉ dùng trong báo cáo đặc biệt: 57 là Chờ xác nhận.
    const specialStatusName = (code) => String(code) === '57' ? 'Chờ xác nhận' : (statusDict[code] || LOCAL_STATUS_NAMES[String(code)] || String(code));
    const specialCachedOrders = Object.values(specialCache).flatMap(tab => tab.orders);
    const specialCurrentRaw = specialCache[specialTab]?.orders || [];
    const specialFilteredByOther = getSpecialFiltered(specialCurrentRaw);
    const applySpecialTabFilter = (list, tabId) => {
        if (tabId === 'confirm') return list.filter(o => SPECIAL_CONFIRM_STATUSES.includes(String(o.status)) && !hasRealCarrier(o));
        if (tabId === 'print') return list.filter(o => SPECIAL_PRINT_STATUSES.includes(String(o.status)) && hasRealCarrier(o));
        if (tabId === 'transit') return list.filter(o => SPECIAL_TRANSIT_STATUSES.includes(String(o.status)));
        return list;
    };
    // Tab đang mở dùng dữ liệu vừa kéo; tab khác chỉ tính từ cache nếu đã
    // từng mở, chưa mở thì chưa có số (hiển thị … trên tab, không đoán).
    const specialTabLists = {
        all: specialTab === 'all' ? specialFilteredByOther : (specialCache.all ? getSpecialFiltered(specialCache.all.orders) : []),
        confirm: specialTab === 'confirm' ? applySpecialTabFilter(specialFilteredByOther, 'confirm') : (specialCache.confirm ? applySpecialTabFilter(getSpecialFiltered(specialCache.confirm.orders), 'confirm') : []),
        print: specialTab === 'print' ? applySpecialTabFilter(specialFilteredByOther, 'print') : (specialCache.print ? applySpecialTabFilter(getSpecialFiltered(specialCache.print.orders), 'print') : []),
        transit: specialTab === 'transit' ? specialFilteredByOther : (specialCache.transit ? getSpecialFiltered(specialCache.transit.orders) : []),
    };
    const specialTabCount = (tabId) => {
        if (!specialCache[tabId] && tabId !== specialTab) return null;
        const count = specialTabLists[tabId]?.length ?? 0;
        return specialCache[tabId]?.hasMore ? `${count}+` : String(count);
    };
    // Đơn Đang/Đã đóng gói chưa có mã thật, chỉ hiện khi tick ở tab In và đóng gói.
    const specialMissingPrintOrders = specialTab === 'print'
        ? specialFilteredByOther.filter(o => SPECIAL_PRINT_STATUSES.includes(String(o.status)) && !hasRealCarrier(o))
        : (specialCache.print ? getSpecialFiltered(specialCache.print.orders).filter(o => SPECIAL_PRINT_STATUSES.includes(String(o.status)) && !hasRealCarrier(o)) : []);
    const specialCurrentList = (specialMode && specialTab === 'print' && specialOnlyMissingPrint)
        ? specialMissingPrintOrders
        : (specialMode ? (specialTabLists[specialTab] || []) : []);

    // Danh sách hiển thị / thao tác: báo cáo đặc biệt dùng specialCurrentList,
    // báo cáo cũ dùng filteredOrders. Các nút Copy / Xuất Excel / Thao tác
    // ở dưới đều dùng chung các biến này nên không cần viết lại từng nút.
    const effectiveFiltered = specialMode ? specialCurrentList : filteredOrders;
    const targetOrdersAction = selectedOrders.length > 0
        ? effectiveFiltered.filter(o => selectedOrders.includes(o.id))
        : effectiveFiltered;

    const copyTargetCount = targetOrdersAction.length;
    const ecomOrdersCount = targetOrdersAction.filter(o => ['42', '48'].includes(String(o.sale_channel)) && o.ecom_order_id).length;
    const carrierOrdersCount = targetOrdersAction.filter(o => specialMode ? hasRealCarrier(o) : o.carrier_code).length;

    const totalOrdersCount = effectiveFiltered.length;
    const totalPages = Math.ceil(totalOrdersCount / pageSize) || 1;
    const paginatedOrders = effectiveFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Tùy chọn lọc cho báo cáo đặc biệt, lấy từ chính đơn đặc biệt để các
    // trạng thái Đang chuyển / Thất bại... cũng xuất hiện trong dropdown.
    const specialStatusOptions = [...new Set(specialCachedOrders.map(o => o.status).filter(v => v !== null && v !== undefined))].map(code => ({
        value: String(code),
        label: specialStatusName(code)
    }));
    const specialCarrierOptions = [...new Set(specialCachedOrders.map(o => o.carrier_name).filter(Boolean))];
    const specialChannelOptions = [...new Set(specialCachedOrders.map(o => o.sale_channel).filter(Boolean))].map(ch => ({
        value: String(ch),
        label: SALE_CHANNELS[ch] || `Kênh ${ch}`
    }));
    const specialCreatorOptions = [...new Set(specialCachedOrders.map(o => o.created_by_name).filter(Boolean))].map(c => ({ value: String(c), label: c }));
    const specialDepotOptions = [...new Set(specialCachedOrders.map(o => o.depot_id).filter(Boolean))].map(id => ({
        value: String(id),
        label: DEPOT_NAMES[id] || `Kho ${id}`
    }));
    const activeFilterCount = (searchProduct ? 1 : 0) + (searchNote ? 1 : 0) + selectedStatus.length + selectedCarrier.length + selectedChannel.length + selectedCreator.length + selectedDepot.length + (printedFilter ? 1 : 0) + (missingCarrierFilter ? 1 : 0);
    const handleClearSpecialFilters = () => {
        setSearchProduct('');
        setSearchNote('');
        setSelectedStatus([]);
        setSelectedCarrier([]);
        setSelectedChannel([]);
        setSelectedCreator([]);
        setSelectedDepot([]);
        setPrintedFilter('');
        setMissingCarrierFilter(false);
        setSpecialSortOrder('desc');
    };
    const effectiveStatusOptions = specialMode ? specialStatusOptions : statusOptions;
    const effectiveCarrierOptions = specialMode ? specialCarrierOptions : carrierOptions;
    const effectiveChannelOptions = specialMode ? specialChannelOptions : channelOptions;
    const effectiveCreatorOptions = specialMode ? specialCreatorOptions : creatorOptions;
    const effectiveDepotOptions = specialMode ? specialDepotOptions : depotOptions;

    // HÀM CHIA NHỎ MẢNG (CHUNK) ĐỂ CHẠY SONG SONG
    const chunkArray = (array, chunkSize) => {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    };

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

    // NÂNG CẤP: Chạy song song từng cục 5 ID cho các đơn được chọn
    const handleUpdateSelectedWebhooks = async () => {
        if (selectedOrders.length === 0) return;
        setUpdatingSelected(true);
        setShowActionMenu(false);
        setCopyMessage(`Đang cập nhật webhook cho ${selectedOrders.length} đơn...`);

        // Chia mảng ID thành các cục, mỗi cục 5 ID
        const chunks = chunkArray(selectedOrders, 5);

        const processChunk = async (chunk) => {
            for (let i = 0; i < chunk.length; i++) {
                const orderId = chunk[i];
                try {
                    await fetch(`https://nhanh.vn/auto/posevent/orderupdate?id=${orderId}&businessId=176023`, { method: 'GET', mode: 'no-cors' });
                } catch (err) {}
                // Tránh gọi quá dày đặc, delay nhẹ trong vòng lặp của chunk
                await new Promise(resolve => setTimeout(resolve, 200)); 
            }
        };

        // Kích hoạt tất cả các cục chạy song song cùng lúc
        await Promise.all(chunks.map(chunk => processChunk(chunk)));

        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchAllocation(statusDict);
        setUpdatingSelected(false);
        setCopyMessage(` Đã gửi lệnh cập nhật webhook xong.`);
        setSelectedOrders([]);
        setTimeout(() => setCopyMessage(''), 5000);
    };

    // TÍNH NĂNG MỚI: Cập nhật lại toàn bộ đơn đang thiếu Mã vận đơn (Chạy đa luồng song song)
    const handleUpdateMissingCarrierWebhooks = async () => {
        if (missingCarrierOrders.length === 0) {
            setCopyMessage('️ Không có đơn hàng nào đang thiếu Mã vận đơn.');
            setTimeout(() => setCopyMessage(''), 3000);
            return;
        }

        setIsUpdatingMissingCarrier(true);
        setMissingCarrierProgress(0);
        setCopyMessage(`Đang cập nhật lại webhook cho ${missingCarrierOrders.length} đơn thiếu Mã vận đơn...`);

        const orderIds = missingCarrierOrders.map(o => o.id);
        const chunks = chunkArray(orderIds, 5);
        let completed = 0;

        const processChunk = async (chunk) => {
            for (let i = 0; i < chunk.length; i++) {
                const orderId = chunk[i];
                try {
                    await fetch(`https://nhanh.vn/auto/posevent/orderupdate?id=${orderId}&businessId=176023`, { method: 'GET', mode: 'no-cors' });
                } catch (err) {
                    console.error(`Lỗi kích hoạt webhook đơn ${orderId}:`, err);
                }
                completed += 1;
                setMissingCarrierProgress(completed);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        };

        await Promise.all(chunks.map(chunk => processChunk(chunk)));

        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchAllocation(statusDict);
        setIsUpdatingMissingCarrier(false);
        setCopyMessage(` Đã cập nhật lại webhook cho ${orderIds.length} đơn miss Mã vận đơn.`);
        setTimeout(() => setCopyMessage(''), 5000);
    };

    // Cập nhật webhook cho toàn bộ đơn Đang/Đã đóng gói chưa có mã thật
    // đang hiển thị ở tab In và đóng gói (khi tick lọc thiếu mã).
    const handleUpdateMissingPrintWebhooks = async () => {
        if (specialMissingPrintOrders.length === 0) {
            setCopyMessage('Không có đơn Đang/Đã đóng gói nào chưa có mã vận đơn thực.');
            setTimeout(() => setCopyMessage(''), 3000);
            return;
        }
        setIsUpdatingMissingCarrier(true);
        setMissingCarrierProgress(0);
        setCopyMessage(`Đang cập nhật lại webhook cho ${specialMissingPrintOrders.length} đơn đóng gói chưa có mã vận đơn thực...`);
        const orderIds = specialMissingPrintOrders.map(o => o.id);
        const chunks = chunkArray(orderIds, 5);
        let completed = 0;
        const processChunk = async (chunk) => {
            for (let i = 0; i < chunk.length; i++) {
                try {
                    await fetch(`https://nhanh.vn/auto/posevent/orderupdate?id=${chunk[i]}&businessId=176023`, { method: 'GET', mode: 'no-cors' });
                } catch (err) {}
                completed += 1;
                setMissingCarrierProgress(completed);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        };
        await Promise.all(chunks.map(chunk => processChunk(chunk)));
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSpecialCache(prev => { const next = { ...prev }; delete next.print; return next; });
        await fetchSpecialTab('print', { force: true });
        await fetchAllocation(statusDict);
        setIsUpdatingMissingCarrier(false);
        setCopyMessage(`Đã cập nhật lại webhook cho ${orderIds.length} đơn đóng gói chưa có mã vận đơn thực.`);
        setTimeout(() => setCopyMessage(''), 5000);
    };

    const executeCopy = async (type) => {
        if (targetOrdersAction.length === 0) return;
        
        let textToCopy = '';
        let count = 0;

        if (type === 'system') {
            textToCopy = targetOrdersAction.map(order => order.id).join('\n');
            count = targetOrdersAction.length;
        } else if (type === 'ecom') {
            const validOrders = targetOrdersAction.filter(o => ['42', '48'].includes(String(o.sale_channel)) && o.ecom_order_id);
            textToCopy = validOrders.map(o => o.ecom_order_id).join('\n');
            count = validOrders.length;
        } else if (type === 'carrier') {
            // Báo cáo đặc biệt: GHN mã NVN coi như chưa có mã nên không copy.
            const validOrders = targetOrdersAction.filter(o => specialMode ? hasRealCarrier(o) : o.carrier_code);
            textToCopy = validOrders.map(o => o.carrier_code).join('\n');
            count = validOrders.length;
        }

        if (!textToCopy) {
            setCopyMessage('️ Không có mã nào hợp lệ để copy.');
            setTimeout(() => setCopyMessage(''), 3000);
            setShowCopyMenu(false);
            return;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopyMessage(` Đã copy ${count} mã ${type === 'ecom' ? 'đơn sàn' : type === 'carrier' ? 'vận đơn' : 'hệ thống'}.`);
        } catch (err) {
            setCopyMessage('️ Copy thất bại, vui lòng thử lại.');
        }
        
        setTimeout(() => setCopyMessage(''), 3000);
        setShowCopyMenu(false);
    };

    // TÍNH NĂNG: XUẤT EXCEL
    const handleExportExcel = async () => {
        if (targetOrdersAction.length === 0) {
            setCopyMessage('️ Không có dữ liệu để xuất.');
            setTimeout(() => setCopyMessage(''), 3000);
            return;
        }

        setIsExporting(true);
        setCopyMessage(`Đang xuất file Excel cho ${targetOrdersAction.length} đơn hàng...`);

        try {
            // Import động thư viện xlsx (Yêu cầu đã cài đặt qua npm install xlsx)
            const XLSX = await import('xlsx');

            const rowData = [];
            
            targetOrdersAction.forEach(order => {
                const products = order.order_products || [];
                
                // Gom các dữ liệu cơ bản luôn có
                const baseRow = {
                    "ID Đơn": order.id,
                    "ID Sàn": order.ecom_order_id || '',
                    "Trạng thái": statusDict[order.status] || `Mã ${order.status}`,
                };

                // Lắp ráp dữ liệu phụ thuộc vào cấu hình Cột đang hiển thị
                if (visibleCols.includes('carrier')) {
                    baseRow["Hãng vận chuyển"] = order.carrier_name || '';
                    baseRow["Mã vận đơn"] = order.carrier_code || '';
                }
                if (visibleCols.includes('source')) {
                    baseRow["Kênh bán"] = SALE_CHANNELS[order.sale_channel] || order.sale_channel || '';
                    baseRow["Nguồn"] = order.traffic_source || '';
                }
                if (visibleCols.includes('notes')) {
                    baseRow["Ghi chú khách"] = order.description || '';
                    baseRow["Ghi chú nội bộ"] = order.private_description || '';
                }
                if (specialMode) {
                    baseRow["Tình trạng kho"] = getStockInfo(order).label;
                } else if (visibleCols.includes('aging')) {
                    const agingDays = order.printable_date ? Math.floor((new Date() - new Date(order.printable_date)) / (1000 * 60 * 60 * 24)) : 0;
                    baseRow["Ngày tồn / Thiếu"] = activeTab === 'printable' ? `${agingDays} ngày` : 'Đang thiếu hàng';
                }
                if (visibleCols.includes('creator')) {
                    baseRow["Người tạo"] = order.created_by_name || 'Hệ thống';
                }
                if (visibleCols.includes('printed_at')) {
                    baseRow["Ngày in cuối"] = order.printed_at ? new Date(order.printed_at).toLocaleString('vi-VN') : 'Chưa in';
                }

                // Xử lý chèn thông tin Sản phẩm (Mỗi sản phẩm 1 dòng)
                if (products.length === 0) {
                    rowData.push({
                        ...baseRow,
                        "Tên sản phẩm": 'Không có dữ liệu SP',
                        "Mã sản phẩm": '',
                        "Số lượng": 0
                    });
                } else {
                    products.forEach(prod => {
                        rowData.push({
                            ...baseRow,
                            "Tên sản phẩm": prod.product_name || '',
                            "Mã sản phẩm": prod.product_code || '',
                            "Số lượng": prod.quantity || 0
                        });
                    });
                }
            });

            // Tạo sheet và workbook
            const worksheet = XLSX.utils.json_to_sheet(rowData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachDonHang");
            
            // Tự động tải file
            XLSX.writeFile(workbook, `Bao_cao_don_hang_${new Date().getTime()}.xlsx`);

            setCopyMessage(' Đã xuất file Excel thành công.');
        } catch (error) {
            console.error("Lỗi xuất Excel:", error);
            setCopyMessage('️ Lỗi: Chưa cài đặt thư viện xlsx (vui lòng chạy npm install xlsx)');
        } finally {
            setIsExporting(false);
            setTimeout(() => setCopyMessage(''), 5000);
        }
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
        if (!businessId) { alert("️ Chưa cấu hình Business ID!"); return; }
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
                setCopyMessage(` Đã gửi ${selectedOrders.length} đơn sang hãng vận chuyển.`);
                setSelectedOrders([]);
                fetchAllocation(statusDict); 
            } else {
                setCopyMessage(`️ Lỗi gửi đơn: ${result.message}`);
            }
        } catch (error) {
            setCopyMessage('️ Đã xảy ra lỗi hệ thống.');
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
                <div className="flex flex-wrap justify-between items-center gap-4 bg-white border border-gray-200 rounded-xl px-6 py-5 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Quản lý kho & Đơn hàng</h2>
                        <p className="text-gray-500 text-sm mt-1">Phân bổ tự động dựa trên tồn kho thực tế</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {isOwner && (
                            <button
                                onClick={handleUpdateMissingCarrierWebhooks}
                                disabled={loading || isUpdatingMissingCarrier || missingCarrierOrders.length === 0}
                                className="bg-purple-600 border border-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 focus:ring-2 focus:ring-purple-100 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Chỉ tính đơn Shopee / Tiktok Shop, ở trạng thái Đã xác nhận, Chờ khách xác nhận hoặc Đã đóng gói, chưa có mã vận đơn và đủ hàng"
                            >
                                <RefreshCw size={16} className={isUpdatingMissingCarrier ? "animate-spin" : ""} />
                                {isUpdatingMissingCarrier
                                    ? `Đang cập nhật (${missingCarrierProgress}/${missingCarrierOrders.length})...`
                                    : `Cập nhật lại đơn miss Mã vận đơn (${missingCarrierOrders.length})`}
                            </button>
                        )}
                        {isOwner && (
                            <button
                                onClick={handleToggleSpecialMode}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm border ${specialMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                                title="Chỉ Owner thấy nút này. Bật để chuyển sang báo cáo đặc biệt, tắt để quay về báo cáo cũ."
                            >
                                {specialMode ? 'Đang xem: Báo cáo đặc biệt' : 'Báo cáo đặc biệt'}
                            </button>
                        )}
                        <button
                            onClick={() => fetchAllocation(statusDict)}
                            disabled={loading || isUpdatingMissingCarrier}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 focus:ring-2 focus:ring-blue-100 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                            Làm mới dữ liệu
                        </button>
                    </div>
                </div>

                {/* Báo cáo đặc biệt: 4 tab làm việc, gộp đủ / tạm giữ / hết hàng */}
                {specialMode && (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-base font-bold text-slate-800">Báo cáo đặc biệt</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                                    Từ
                                    <input type="date" value={specialStartDate} onChange={(e) => { setSpecialCache({}); setSpecialStartDate(e.target.value); }} className="px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
                                </label>
                                <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                                    Đến
                                    <input type="date" value={specialEndDate} onChange={(e) => { setSpecialCache({}); setSpecialEndDate(e.target.value); }} className="px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
                                </label>
                                <button onClick={() => fetchSpecialTab(specialTab, { force: true })} disabled={specialLoading} className="px-2 py-1 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                                    <RefreshCw size={13} className={specialLoading ? 'animate-spin' : ''} /> Tải lại
                                </button>
                            </div>
                        </div>
                        {specialError && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm font-medium">Không tải được đơn trực tiếp từ bảng orders: {specialError}. Báo cáo cũ vẫn dùng được khi tắt chế độ này.</div>
                        )}
                        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                            {[
                                { id: 'all', label: 'Tất cả' },
                                { id: 'confirm', label: 'Xác nhận' },
                                { id: 'print', label: 'In và đóng gói' },
                                { id: 'transit', label: 'Đang chuyển' },
                            ].map(tab => {
                                const count = specialTabCount(tab.id);
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setSpecialTab(tab.id); setSpecialOnlyMissingPrint(false); }}
                                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 border ${specialTab === tab.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        {tab.label}
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${specialTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{count === null ? '…' : count}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {specialTab === 'print' && (
                            <label className="flex items-center gap-2 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                <input type="checkbox" checked={specialOnlyMissingPrint} onChange={(e) => setSpecialOnlyMissingPrint(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500" />
                                <span className="text-sm font-bold text-amber-800">Chỉ hiển thị đơn Đang/Đã đóng gói chưa có mã vận đơn thực ({specialMissingPrintOrders.length})</span>
                            </label>
                        )}
                        {specialTab === 'print' && specialOnlyMissingPrint && specialMissingPrintOrders.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
                                <p className="text-sm font-medium text-slate-700">{specialMissingPrintOrders.length} đơn đóng gói chưa có mã vận đơn thực.</p>
                                <button onClick={handleUpdateMissingPrintWebhooks} disabled={isUpdatingMissingCarrier} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                    <RefreshCw size={15} className={isUpdatingMissingCarrier ? 'animate-spin' : ''} />
                                    {isUpdatingMissingCarrier ? `Đang cập nhật (${missingCarrierProgress}/${specialMissingPrintOrders.length})...` : 'Cập nhật webhook cho tất cả đơn đang hiển thị'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Dashboard Tabs */}
                {!specialMode && (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </div>)}

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
                            {specialMode ? (
                                <button onClick={() => setShowFilterPopup(true)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                    Bộ lọc
                                    {activeFilterCount > 0 && <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-900 text-white">{activeFilterCount}</span>}
                                </button>
                            ) : (
                                <>
                                    <div className="relative min-w-[200px]">
                                        <input type="text" value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} placeholder="Tìm tên/mã SP..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-colors" />
                                        <PackageSearch className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    </div>
                                    <div className="w-[150px]">
                                        <MultiSelect options={effectiveChannelOptions} selected={selectedChannel} onChange={setSelectedChannel} placeholder="Kênh bán" />
                                    </div>
                                    <div className="w-[150px]">
                                        <MultiSelect options={effectiveCarrierOptions} selected={selectedCarrier} onChange={setSelectedCarrier} placeholder="Hãng VC" />
                                    </div>
                                    <div className="w-[150px]">
                                        <MultiSelect options={effectiveStatusOptions} selected={selectedStatus} onChange={setSelectedStatus} placeholder="Trạng thái" />
                                    </div>
                                    <div className="w-[150px]">
                                        <MultiSelect options={effectiveDepotOptions} selected={selectedDepot} onChange={setSelectedDepot} placeholder="Kho hàng" />
                                    </div>
                                    <div className="w-[250px]">
                                        <MultiSelect options={effectiveCreatorOptions} selected={selectedCreator} onChange={setSelectedCreator} placeholder="Nhân viên" />
                                    </div>
                                </>
                            )}
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

                            {/* Export Excel Button */}
                            <button
                                onClick={handleExportExcel}
                                disabled={isExporting || targetOrdersAction.length === 0}
                                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm ${targetOrdersAction.length > 0 ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}
                            >
                                {isExporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />} 
                                Xuất Excel
                            </button>

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

                            {/* Actions Dropdown */}
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

                    {!specialMode && (<div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
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
                        <label className="flex items-center gap-2 cursor-pointer ml-2">
                            <input
                                type="checkbox"
                                checked={missingCarrierFilter}
                                onChange={(e) => setMissingCarrierFilter(e.target.checked)}
                                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Chưa có Mã vận đơn</span>
                        </label>
                        {!specialMode && activeTab === 'printable' && (
                            <label className="flex items-center gap-2 cursor-pointer ml-2">
                                <input type="checkbox" checked={agingFilter} onChange={(e) => setAgingFilter(e.target.checked)} className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                                <span className="text-sm font-medium text-gray-700">Chỉ đơn tồn &gt;= 2 ngày</span>
                            </label>
                        )}
                    </div>)}
                </div>

                {/* Popup bộ lọc báo cáo đặc biệt */}
                {specialMode && showFilterPopup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" onClick={() => setShowFilterPopup(false)}>
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-800">Bộ lọc</h3>
                                <button onClick={() => setShowFilterPopup(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
                            </div>
                            <div className="p-5 overflow-y-auto space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input type="text" value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} placeholder="Tìm tên/mã SP..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                                    <input type="text" value={searchNote} onChange={(e) => setSearchNote(e.target.value)} placeholder="Lọc nội dung ghi chú..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <MultiSelect options={effectiveStatusOptions} selected={selectedStatus} onChange={setSelectedStatus} placeholder="Trạng thái" />
                                    <MultiSelect options={effectiveCarrierOptions} selected={selectedCarrier} onChange={setSelectedCarrier} placeholder="Hãng VC" />
                                    <MultiSelect options={effectiveChannelOptions} selected={selectedChannel} onChange={setSelectedChannel} placeholder="Kênh bán" />
                                    <MultiSelect options={effectiveDepotOptions} selected={selectedDepot} onChange={setSelectedDepot} placeholder="Kho hàng" />
                                    <MultiSelect options={effectiveCreatorOptions} selected={selectedCreator} onChange={setSelectedCreator} placeholder="Nhân viên" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <select value={printedFilter} onChange={(e) => setPrintedFilter(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-gray-50">
                                        <option value="">Lọc theo Trạng thái in</option>
                                        <option value="not_printed">Chưa có ngày in gần nhất</option>
                                        <option value="printed">Đã có ngày in</option>
                                        <option value="today">Đã in hôm nay</option>
                                    </select>
                                    <select value={specialSortOrder} onChange={(e) => setSpecialSortOrder(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-gray-50">
                                        <option value="desc">Mới nhất trước</option>
                                        <option value="asc">Cũ nhất trước</option>
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={missingCarrierFilter} onChange={(e) => setMissingCarrierFilter(e.target.checked)} className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                    <span className="text-sm font-medium text-gray-700">Chưa có Mã vận đơn</span>
                                </label>
                            </div>
                            <div className="px-5 py-4 border-t border-gray-200 flex justify-between gap-3">
                                <button onClick={handleClearSpecialFilters} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50">Xóa bộ lọc</button>
                                <button onClick={() => setShowFilterPopup(false)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800">Áp dụng</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notifications */}
                {copyMessage && (
                    <div className={`px-4 py-2 text-sm font-medium rounded-lg border flex items-center ${copyMessage.includes('') ? 'bg-green-50 text-green-700 border-green-200' : copyMessage.includes('Đang') ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {copyMessage}
                    </div>
                )}

                {/* Main Table */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        {(specialMode ? (!specialCache[specialTab] && specialLoading) : loading) ? (
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
                                        
                                        {specialMode && <th className="py-3 px-4 font-semibold whitespace-nowrap">Tình trạng kho</th>}
                                        {!specialMode && visibleCols.includes('aging') && <th className="py-3 px-4 font-semibold whitespace-nowrap">{activeTab === 'printable' ? 'Ngày tồn' : 'Kho / Thiếu'}</th>}
                                        {visibleCols.includes('creator') && <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Nhân viên</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedOrders.map(order => {
                                        const products = order.order_products || [];
                                        const rowCount = Math.max(1, products.length);
                                        const statusName = specialMode ? specialStatusName(order.status) : (statusDict[order.status] || LOCAL_STATUS_NAMES[String(order.status)] || `Mã ${order.status}`);
                                        const channelName = SALE_CHANNELS[order.sale_channel] || order.sale_channel || 'Khác';
                                        const isChecked = selectedOrders.includes(order.id);
                                        
                                        const channelColorClass = CHANNEL_COLORS[order.sale_channel] || 'bg-gray-100 text-gray-600 border-gray-200';
                                        const statusColorClass = STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600 border border-gray-200';

                                        const agingDays = order.printable_date ? Math.floor((new Date() - new Date(order.printable_date)) / (1000 * 60 * 60 * 24)) : 0;
                                        const isAgingOrder = activeTab === 'printable' && agingDays >= 2;

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

                                                    {/* Cột 2: Gộp ID */}
                                                    {index === 0 && (
                                                        <td rowSpan={rowCount} className="py-3 px-4 align-top border-r border-gray-100">
                                                            {specialMode ? (
                                                                <button className="font-bold text-blue-700 hover:underline mb-1 text-left" onClick={() => openOrderDetail(order)} title="Bấm để xem popup chi tiết đơn">
                                                                    {order.id}
                                                                </button>
                                                            ) : (
                                                                <div className="font-bold text-gray-800 cursor-pointer hover:text-blue-600 mb-1" onClick={() => handleSelectOne(order.id)}>
                                                                    {order.id}
                                                                </div>
                                                            )}

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
                                                            <div className="text-xs text-gray-400 mt-1">
                                                                {new Date(order.created_at).toLocaleString('vi-VN')}
                                                            </div>
                                                            
                                                            {/* Thông tin Ngày in cuối */}
                                                            {visibleCols.includes('printed_at') && (
                                                                <div className="text-xs text-gray-500 mt-1">
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

                                                    {/* Cột 8: Báo cáo đặc biệt luôn hiển thị tình trạng kho, báo cáo cũ giữ theo cột đã chọn */}
                                                    {specialMode && index === 0 && (
                                                        <td rowSpan={rowCount} className="py-3 px-4 align-top">
                                                            {getStockBadge(order)}
                                                        </td>
                                                    )}
                                                    {!specialMode && visibleCols.includes('aging') && (
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

                                                    {/* Cột 9 (Tùy chọn): Nhân viên */}
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

                    {specialMode && specialCache[specialTab]?.hasMore && (
                        <div className="flex justify-center py-3 border-t border-gray-100">
                            <button onClick={() => fetchSpecialTab(specialTab, { append: true })} disabled={specialLoading} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
                                <RefreshCw size={14} className={specialLoading ? 'animate-spin' : ''} />
                                {specialLoading ? 'Đang tải...' : 'Tải thêm đơn'}
                            </button>
                        </div>
                    )}

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

            {/* Popup chi tiết đơn - chỉ trong báo cáo đặc biệt */}
            {detailOrder && (() => {
                const base = detailData || detailOrder;
                const raw = extractRawDetail(detailData);
                const rawData = raw?.data || raw || null;
                const info = rawData?.info || null;
                const carrier = rawData?.carrier || null;
                const channel = rawData?.channel || null;
                const payment = rawData?.payment || null;
                const shipAddr = rawData?.shippingAddress || null;
                const rawProducts = rawData?.products || null;
                const statusName = specialStatusName(base.status);
                const channelName = SALE_CHANNELS[base.sale_channel] || base.sale_channel || 'Khác';
                const stockInfo = getStockInfo(detailOrder);
                const productsForPopup = rawProducts || (base.order_products || []).map(p => ({
                    name: p.product_name, code: p.product_code, quantity: p.quantity
                }));
                const totalQty = productsForPopup.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
                const totalAmount = rawProducts
                    ? rawProducts.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 0), 0)
                    : null;
                const totalDiscount = rawProducts
                    ? rawProducts.reduce((s, p) => s + (Number(p.discount) || 0), 0)
                    : null;
                const DetailRow = ({ label, value }) => (
                    <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100 last:border-0">
                        <span className="text-xs font-medium text-slate-500">{label}</span>
                        <span className="text-sm font-semibold text-slate-800 whitespace-pre-line break-words">{value}</span>
                    </div>
                );
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" onClick={() => setDetailOrder(null)}>
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-start bg-slate-50">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">Chi tiết đơn hàng #{detailOrder.id}</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">Trạng thái: {statusName} &nbsp;|&nbsp; Kênh: {channelName} &nbsp;|&nbsp; Tình trạng kho: {stockInfo.label}</p>
                                </div>
                                <button onClick={() => setDetailOrder(null)} className="text-slate-400 hover:text-slate-600 shrink-0"><XCircle size={22} /></button>
                            </div>
                            <div className="p-5 overflow-y-auto space-y-6">
                                {detailLoading && <p className="text-sm text-slate-500 font-medium flex items-center gap-2"><RefreshCw size={15} className="animate-spin" /> Đang tải đầy đủ chi tiết...</p>}

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Thông tin chung</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                        <DetailRow label="ID hệ thống" value={String(info?.id ?? base.id)} />
                                        <DetailRow label="ID đơn sàn" value={base.ecom_order_id ? String(base.ecom_order_id) : (channel?.ecomOrderId ? String(channel.ecomOrderId) : 'Chưa có')} />
                                        <DetailRow label="Trạng thái" value={statusName} />
                                        <DetailRow label="Kênh bán" value={channelName} />
                                        {channel?.trafficSource?.name && <DetailRow label="Nguồn khách" value={channel.trafficSource.name} />}
                                        <DetailRow label="Kho xuất" value={DEPOT_NAMES[String(base.depot_id)] || String(base.depot_id)} />
                                        <DetailRow label="Nhân viên tạo" value={info?.createdBy?.name || base.created_by_name || 'Hệ thống'} />
                                        <DetailRow label="Ngày tạo" value={info?.createdAt ? fmtUnix(info.createdAt) : fmtDateStr(base.created_at)} />
                                        <DetailRow label="Ngày cập nhật" value={info?.updatedAt ? fmtUnix(info.updatedAt) : fmtDateStr(base.updated_at)} />
                                        <DetailRow label="Ngày đóng gói" value={info?.packedAt ? fmtUnix(info.packedAt) : (base.packed_at ? fmtDateStr(base.packed_at) : 'Chưa có')} />
                                        <DetailRow label="Ngày in" value={base.printed_at ? fmtDateStr(base.printed_at) : 'Chưa in'} />
                                        <DetailRow label="Ngày đi" value={base.carrier_date ? fmtDateStr(base.carrier_date) : 'Chưa có'} />
                                        {info?.description && <DetailRow label="Mô tả đơn" value={stripHtml(info.description)} />}
                                        {(info?.privateDescription || base.private_description) && <DetailRow label="Ghi chú nội bộ" value={stripHtml(info?.privateDescription || base.private_description)} />}
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Vận chuyển</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                        <DetailRow label="Hãng vận chuyển" value={carrier?.name || base.carrier_name || 'Chưa có'} />
                                        <DetailRow label="Mã vận đơn" value={carrier?.carrierCode || base.carrier_code || 'Chưa có'} />
                                        {carrier?.service?.name && <DetailRow label="Dịch vụ" value={carrier.service.name} />}
                                        <DetailRow label="Phí ship" value={carrier ? fmtMoney(carrier.shipFee) : 'Chưa có'} />
                                        <DetailRow label="Phí COD" value={carrier ? fmtMoney(carrier.codFee) : 'Chưa có'} />
                                        <DetailRow label="Phí trả hàng" value={carrier ? fmtMoney(carrier.returnFee) : 'Chưa có'} />
                                        <DetailRow label="Phí khai giá" value={carrier ? fmtMoney(carrier.declaredFee) : 'Chưa có'} />
                                        <DetailRow label="Phí ship khách trả" value={carrier ? fmtMoney(carrier.customerShipFee) : 'Chưa có'} />
                                        <DetailRow label="Phí vượt cân" value={carrier ? fmtMoney(carrier.overWeightShipFee) : 'Chưa có'} />
                                        <DetailRow label="Khối lượng" value={carrier ? fmtWeight(carrier.weight) : 'Chưa có'} />
                                        <DetailRow label="Ngày gửi hãng" value={carrier?.sendCarrier?.date ? fmtDateOnly(carrier.sendCarrier.date) : 'Chưa có'} />
                                        <DetailRow label="Ngày giao dự kiến" value={carrier?.deliveryDate ? fmtDateOnly(carrier.deliveryDate) : 'Chưa có'} />
                                        {base.tracking_url && (
                                            <div className="py-2 sm:col-span-2">
                                                <a href={base.tracking_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-700 hover:underline">Tra cứu vận đơn trên Nhanh.vn</a>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {shipAddr && (
                                    <section>
                                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Khách hàng &amp; giao hàng</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                            <DetailRow label="Người nhận" value={shipAddr.name || 'Chưa có'} />
                                            <DetailRow label="Số điện thoại" value={shipAddr.mobile || 'Chưa có'} />
                                            <DetailRow label="Địa chỉ" value={shipAddr.address || 'Chưa có'} />
                                            <DetailRow label="Tỉnh / Huyện / Phường" value={`${shipAddr.cityId ?? 'Chưa có'} / ${shipAddr.districtId ?? 'Chưa có'} / ${shipAddr.wardId ?? 'Chưa có'}`} />
                                        </div>
                                    </section>
                                )}

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Sản phẩm ({totalQty} sản phẩm)</h4>
                                    {productsForPopup.length === 0 ? (
                                        <p className="text-sm text-slate-500 font-medium">Đơn này chưa có danh sách sản phẩm trong bảng orders.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-slate-500 border-b border-slate-200">
                                                        <th className="py-2 pr-3 font-semibold">Sản phẩm</th>
                                                        <th className="py-2 pr-3 font-semibold">Mã</th>
                                                        <th className="py-2 pr-3 font-semibold text-right">Đơn giá</th>
                                                        <th className="py-2 pr-3 font-semibold text-right">Chiết khấu</th>
                                                        <th className="py-2 pr-3 font-semibold text-center">Số lượng</th>
                                                        <th className="py-2 font-semibold text-center">Tồn kho</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {productsForPopup.map((p, idx) => (
                                                        <tr key={idx}>
                                                            <td className="py-2 pr-3 font-semibold text-slate-800">{p.name}</td>
                                                            <td className="py-2 pr-3 font-mono text-xs text-slate-500">{p.code}</td>
                                                            <td className="py-2 pr-3 text-right">{p.price !== undefined ? fmtMoney(p.price) : 'Chưa có'}</td>
                                                            <td className="py-2 pr-3 text-right">{p.discount !== undefined ? fmtMoney(p.discount) : 'Chưa có'}</td>
                                                            <td className="py-2 pr-3 text-center font-bold">{p.quantity} {p.unit?.name || 'chiếc'}</td>
                                                            <td className="py-2 text-center">{p.available !== undefined ? (Number(p.available) === 0 ? 'Hết hàng (0)' : String(p.available)) : 'Chưa có'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {totalAmount !== null && (
                                        <div className="mt-3 space-y-1 text-sm">
                                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Tổng tiền sản phẩm</span><span className="font-bold text-slate-800">{fmtMoney(totalAmount)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Tổng chiết khấu sản phẩm</span><span className="font-bold text-slate-800">{fmtMoney(totalDiscount)}</span></div>
                                        </div>
                                    )}
                                </section>

                                {payment && (
                                    <section>
                                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Thanh toán</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                            <DetailRow label="VAT" value={fmtMoney(payment.vat?.amount)} />
                                            <DetailRow label="Tiền cọc" value={fmtMoney(payment.deposit?.amount)} />
                                            <DetailRow label="Tiền chuyển khoản" value={fmtMoney(payment.transfer?.amount)} />
                                            <DetailRow label="Chiết khấu đơn" value={fmtMoney(payment.discount?.amount)} />
                                            <DetailRow label="Điểm đã dùng" value={`${fmtMoney(payment.usedPoints?.amount)} (${payment.usedPoints?.points ?? 'Chưa có'} điểm)`} />
                                        </div>
                                    </section>
                                )}

                                <div className="border-t border-slate-200 pt-3">
                                    <button onClick={() => setShowRawJson(v => !v)} className="text-sm font-bold text-slate-700 hover:text-slate-900">{showRawJson ? 'Ẩn JSON gốc' : 'Xem JSON gốc'}</button>
                                    {showRawJson && (
                                        <pre className="mt-2 bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(detailData || detailOrder, null, 2)}</pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

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
