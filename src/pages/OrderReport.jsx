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

// Ô tìm kiếm debounce dùng chung cho báo cáo đặc biệt.
const useDebouncedValue = (value, delay) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
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

// Tên hành động trong lịch sử Nhanh (order step, theo tài liệu Nhanh.vn).
const NHANH_STEP_NAMES = {
    1: 'Tạo đơn hàng', 2: 'Xác nhận', 3: 'In đơn hàng', 4: 'Vận chuyển',
    6: 'Sửa đơn hàng', 7: 'Đổi trạng thái', 8: 'Gửi đơn sang HVC',
    9: 'Cập nhật tiền chuyển khoản', 10: 'Đổi kho hàng',
    11: 'Thêm đơn hàng vào biên bản', 12: 'Xóa đơn hàng khỏi biên bản',
    13: 'HVC cập nhật trạng thái', 14: 'Đổi hãng vận chuyển',
    15: 'Báo hãng vận chuyển hủy', 16: 'HVC trả về mã code',
    17: 'Xóa đơn hàng', 18: 'Trả về trạng thái và khối lượng',
    19: 'Thêm nội dung đơn hàng', 20: 'API cập nhật đơn hàng',
    21: 'HVC đã nhận hàng', 22: 'Gộp đơn hàng', 23: 'Gộp đơn hàng (lỗi)',
    25: 'Gửi đơn sang HVC (lỗi)', 26: 'Thay đổi mã vận đơn HVC',
    27: 'Lấy trạng thái từ HVC', 28: 'Đổi trạng thái từ biên bản bàn giao',
    29: 'Chuyển từ Tour sang biên bản', 30: 'Lỗi hủy đơn HVC',
    31: 'Lỗi lấy lịch trình từ HVC', 32: 'Vượt cân', 33: 'Đối soát lỗi',
    34: 'Import đơn hàng', 35: 'Import trạng thái đơn hàng',
    36: 'Đang đối soát', 37: 'Đã đối soát', 38: 'Tạo hóa đơn bán lẻ',
    39: 'Chuyển đơn hàng sang bán sỉ', 40: 'Đơn hàng chuyển kho',
    41: 'Copy đơn hàng', 42: 'Đóng gói', 43: 'Cập nhật nhân viên đóng gói',
    44: 'Tạo đơn giao hàng một phần', 45: 'Xóa đơn hàng khỏi tour',
    46: 'Tạo link thanh toán', 47: 'Tạo phiếu xuất kho',
    48: 'Tạo phiếu nhập kho', 49: 'Xóa phiếu xuất kho',
    50: 'Xóa phiếu nhập kho', 51: 'Gửi thông tin sang Vpage',
    52: 'Hủy ghép nối giao dịch chuyển khoản', 53: 'Nhập hoàn kho',
    54: 'Tách đơn hàng', 55: 'Gửi hàng đa điểm', 56: 'Sửa COD',
    57: 'Cập nhật nhân viên bán hàng', 58: 'Tạo hóa đơn điện tử',
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
    // Owner được nhận diện giống Admin / maintenance: user_metadata.is_owner
    // hoặc email super owner. Chỉ owner thấy nút miss mã vận đơn và nút
    // chuyển sang báo cáo đặc biệt (super_admin cũng không thấy).
    const [isOwner, setIsOwner] = useState(false);
    // Trạng thái được chọn ở Admin > Cấu hình Lọc & Ưu tiên Đơn In.
    const [printAllowedStatuses, setPrintAllowedStatuses] = useState(PRINT_ALLOWED_DEFAULT);

    // --- Báo cáo đặc biệt (chỉ owner; mặc định bật với owner, nút gạt
    // chuyển sang báo cáo cũ) ---
    const [specialMode, setSpecialMode] = useState(false);
    const [specialTab, setSpecialTab] = useState('all'); // all | confirm | print | transit
    // Phân trang thật phía server: tổng số load đúng bằng count query,
    // dữ liệu chỉ tải đúng 20 đơn của trang đang mở, bấm sang trang nào
    // mới tải trang đó (không còn lazyload 1000 đơn + Tải thêm nữa).
    const [specialPage, setSpecialPage] = useState(1);
    const [specialTotal, setSpecialTotal] = useState(0);
    const [specialPageOrders, setSpecialPageOrders] = useState([]);
    const [specialCounts, setSpecialCounts] = useState({});
    const [specialMissingTotal, setSpecialMissingTotal] = useState(null);
    const [specialReloadToken, setSpecialReloadToken] = useState(0);
    const [missingUpdateTotal, setMissingUpdateTotal] = useState(0);
    const specialFilterSigRef = useRef(null);
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
    // Lịch sử đơn trong popup: lấy từ bảng order_histories, xếp cũ trước
    // để đọc thành luồng hành trình của đơn.
    const [detailHistory, setDetailHistory] = useState([]);
    const [detailHistoryLoading, setDetailHistoryLoading] = useState(false);
    // Nút Thao tác ở góc popup: menu gọi API v3 của Nhanh.vn qua edge
    // function nhanh-order-actions (chỉ owner). Panel nào đang mở thì
    // detailAction giữ tên panel đó, đóng panel thì về null.
    const [showDetailActionMenu, setShowDetailActionMenu] = useState(false);
    const [detailAction, setDetailAction] = useState(null); // edit | send | cancel
    const [detailActionLoading, setDetailActionLoading] = useState(false);
    const [detailActionMsg, setDetailActionMsg] = useState('');
    const [detailSendDone, setDetailSendDone] = useState(false);
    const [editDescription, setEditDescription] = useState('');
    const [editPrivateDescription, setEditPrivateDescription] = useState('');
    const [editStatus, setEditStatus] = useState('');
    const [cancelReason, setCancelReason] = useState('');
    // Lịch sử Nhanh.vn trong popup: mặc định ẩn, bấm mới tải về hiển thị.
    const [nhanhHistory, setNhanhHistory] = useState([]);
    const [nhanhHistorySource, setNhanhHistorySource] = useState('all');
    const [nhanhHistoryLoading, setNhanhHistoryLoading] = useState(false);
    const [nhanhHistoryLoaded, setNhanhHistoryLoaded] = useState(false);
    const [nhanhHistoryMsg, setNhanhHistoryMsg] = useState('');
    // Bộ lọc nhãn ở báo cáo đặc biệt: nhãn chỉ có cho đơn mới đồng bộ
    // sau khi chạy migration + sync-nhanh mới (đơn cũ bỏ qua).
    const [selectedTags, setSelectedTags] = useState([]);
    const [nhanhTagOptions, setNhanhTagOptions] = useState([]);
    const [nhanhTagOptionsLoaded, setNhanhTagOptionsLoaded] = useState(false);
    // Popup list sau khi bấm in: khổ A thì list mã vận đơn, khổ K80 thì
    // list ID đơn. Hiện ở mọi chỗ có thao tác in (toolbar, popup chi
    // tiết, panel sau khi gửi, modal kết quả gửi).
    const [printList, setPrintList] = useState(null); // { size, items: [{id, carrier_code}] }
    const [printCopied, setPrintCopied] = useState(false);
    // Gửi / hủy hàng loạt từ nút Thao tác trên thanh công cụ.
    const [bulkSendResult, setBulkSendResult] = useState(null);
    const [showBulkSendModal, setShowBulkSendModal] = useState(false);
    const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
    const [cancelReasonBulk, setCancelReasonBulk] = useState('');
    const [bulkCancelRunning, setBulkCancelRunning] = useState(false);
    const [bulkCancelResult, setBulkCancelResult] = useState(null);
    
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

    // Ô tìm kiếm gõ là đổi state ngay, nhưng query server của báo cáo đặc
    // biệt chỉ chạy sau khi ngừng gõ 400ms để khỏi bắn query theo từng phím.
    const debouncedSearchId = useDebouncedValue(searchId, 400);
    const debouncedSearchProduct = useDebouncedValue(searchProduct, 400);
    const debouncedSearchNote = useDebouncedValue(searchNote, 400);
    
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
                const owner = authData?.user?.user_metadata?.is_owner === true || email === 'contact.hotavinh@gmail.com';
                setIsOwner(owner);
                // Owner mở trang là thấy ngay báo cáo đặc biệt, không cần bấm sang.
                if (owner) setSpecialMode(true);

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
    // --- Báo cáo đặc biệt: phân trang thật phía server ---
    // Tổng số đơn load đúng bằng count query (không còn … hay 1000+),
    // còn dữ liệu đơn chỉ tải đúng 20 đơn của trang đang mở, bấm sang
    // trang nào mới tải trang đó. Bộ lọc dùng chung với báo cáo cũ được
    // đẩy xuống query server để tổng số và các trang khớp nhau.
    const SPECIAL_PAGE_SIZE = 20;
    const SPECIAL_COLUMNS = 'id, created_at, updated_at, packed_at, status, carrier_name, carrier_code, carrier_date, printed_at, sale_channel, ecom_order_id, created_by_name, depot_id, description, private_description, traffic_source, tracking_url, is_declared_fee, order_products (product_code, product_name, quantity)';

    // Escape cho ilike: \ % _ là ký tự đặc biệt; dấu phẩy thì PostgREST
    // không biểu diễn được trong or() nên bỏ đi khỏi mẫu tìm.
    const escapeLike = (s) => String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '');
    const toNumberList = (arr) => arr.map(v => Number(v)).filter(n => !Number.isNaN(n));
    // Điều kiện "chưa có mã thật": chưa có mã, hoặc GHN mà mã bắt đầu NVN.
    const NOT_REAL_CARRIER_OR = 'carrier_code.is.null,carrier_code.eq.,and(carrier_name.ilike.%GHN%,carrier_code.ilike.NVN%),and(carrier_name.ilike.%GIAOHANGNHANH%,carrier_code.ilike.NVN%),and(carrier_name.ilike.%GIAO HÀNG NHANH%,carrier_code.ilike.NVN%)';
    // Điều kiện "có mã thật": mã khác rỗng và không thuộc trường hợp GHN + NVN.
    const REAL_CARRIER_OR = 'and(carrier_name.not.ilike.%GHN%,carrier_name.not.ilike.%GIAOHANGNHANH%,carrier_name.not.ilike.%GIAO HÀNG NHANH%),carrier_code.not.ilike.NVN%,carrier_name.is.null';

    // Áp bộ lọc dùng chung + lọc của tab lên một query orders. Dùng chung
    // cho cả count query, query lấy trang và query lấy id khi tìm theo
    // sản phẩm, để tổng số và dữ liệu luôn khớp nhau.
    const applySpecialFilters = (query, { tabId, missingOnly }) => {
        let q = query
            .gte('created_at', `${specialStartDate}T00:00:00.000Z`)
            .lte('created_at', `${specialEndDate}T23:59:59.999Z`);
        // Lọc của tab (Tất cả / Xác nhận / In và đóng gói / Đang chuyển),
        // chạy phía server theo đúng định nghĩa cũ của từng tab.
        if (tabId === 'confirm') {
            q = q.in('status', SPECIAL_CONFIRM_STATUSES.map(Number));
            q = q.or(NOT_REAL_CARRIER_OR);
        } else if (tabId === 'print') {
            q = q.in('status', SPECIAL_PRINT_STATUSES.map(Number));
            if (missingOnly) q = q.or(NOT_REAL_CARRIER_OR);
            else q = q.neq('carrier_code', '').or(REAL_CARRIER_OR);
        } else if (tabId === 'transit') {
            q = q.in('status', SPECIAL_TRANSIT_STATUSES.map(Number));
        }
        // Bộ lọc dùng chung với báo cáo cũ.
        const idTerm = debouncedSearchId.trim();
        if (idTerm) {
            const term = escapeLike(idTerm);
            // Cột id là số nên không tìm chứa được phía server: nhập đủ ID
            // thì khớp chính xác, còn mã sàn / mã vận đơn vẫn tìm chứa.
            if (/^\d+$/.test(idTerm)) q = q.or(`id.eq.${idTerm},ecom_order_id.ilike.%${term}%,carrier_code.ilike.%${term}%`);
            else q = q.or(`ecom_order_id.ilike.%${term}%,carrier_code.ilike.%${term}%`);
        }
        const noteTerm = debouncedSearchNote.trim();
        if (noteTerm) {
            const term = escapeLike(noteTerm);
            q = q.or(`description.ilike.%${term}%,private_description.ilike.%${term}%`);
        }
        if (selectedStatus.length) {
            const nums = toNumberList(selectedStatus);
            q = q.in('status', nums.length ? nums : selectedStatus);
        }
        if (selectedCarrier.length) q = q.in('carrier_name', selectedCarrier);
        if (selectedChannel.length) {
            const nums = toNumberList(selectedChannel);
            q = q.in('sale_channel', nums.length ? nums : selectedChannel);
        }
        if (selectedCreator.length) q = q.in('created_by_name', selectedCreator);
        if (selectedDepot.length) {
            const nums = toNumberList(selectedDepot);
            q = q.in('depot_id', nums.length ? nums : selectedDepot);
        }
        if (printedFilter === 'not_printed') q = q.is('printed_at', null);
        else if (printedFilter === 'printed') q = q.not('printed_at', 'is', null);
        else if (printedFilter === 'today') {
            const s = new Date(); s.setHours(0, 0, 0, 0);
            const e = new Date(); e.setHours(23, 59, 59, 999);
            q = q.gte('printed_at', s.toISOString()).lte('printed_at', e.toISOString());
        }
        if (missingCarrierFilter) q = q.or(NOT_REAL_CARRIER_OR);
        return q;
    };

    const fetchSpecialData = async (page) => {
        setSpecialLoading(true);
        setSpecialError('');
        try {
            const asc = specialSortOrder === 'asc';
            const orderBy = (q) => q.order('created_at', { ascending: asc }).order('id', { ascending: asc });
            if (selectedTags.length > 0) {
                // Đường lọc theo nhãn: nhãn chỉ có trong bảng order_tags
                // cho đơn mới đồng bộ. Kéo id đơn gắn nhãn đã chọn theo
                // từng đợt 1000 rồi khử trùng; nếu đồng thời tìm theo sản
                // phẩm thì giao với tập id tìm theo sản phẩm, sau đó kéo
                // trường phục vụ lọc tab cho các id đó rồi tính tổng số +
                // trang như đường tìm theo sản phẩm.
                const tagIdSet = new Set();
                let tagOffset = 0;
                for (let chunk = 0; chunk < 50; chunk++) {
                    const { data: rows, error } = await supabase.from('order_tags')
                        .select('order_id')
                        .in('tag_id', selectedTags)
                        .range(tagOffset, tagOffset + 999);
                    if (error) throw error;
                    const list = rows || [];
                    list.forEach(r => tagIdSet.add(String(r.order_id)));
                    if (list.length < 1000) break;
                    tagOffset += 1000;
                }
                let candidateIds = [...tagIdSet];
                if (debouncedSearchProduct.trim()) {
                    const pq = escapeLike(debouncedSearchProduct.trim());
                    const productIdSet = new Set();
                    let offset = 0;
                    for (let chunk = 0; chunk < 50; chunk++) {
                        let q = supabase.from('orders')
                            .select('id, order_products!inner(product_name, product_code)');
                        q = applySpecialFilters(q, { tabId: null, missingOnly: false });
                        q = q.or(`product_name.ilike.%${pq}%,product_code.ilike.%${pq}%`, { foreignTable: 'order_products' });
                        q = q.range(offset, offset + 999);
                        const { data: rows, error } = await q;
                        if (error) throw error;
                        const list = rows || [];
                        list.forEach(r => productIdSet.add(String(r.id)));
                        if (list.length < 1000) break;
                        offset += 1000;
                    }
                    candidateIds = candidateIds.filter(id => productIdSet.has(id));
                }
                const fieldRows = [];
                const fieldSeen = new Set();
                for (let i = 0; i < candidateIds.length; i += 1000) {
                    const chunkIds = candidateIds.slice(i, i + 1000);
                    let q = supabase.from('orders')
                        .select('id, status, carrier_name, carrier_code, created_at');
                    q = applySpecialFilters(q, { tabId: null, missingOnly: false });
                    q = orderBy(q).in('id', chunkIds);
                    const { data: rows, error } = await q;
                    if (error) throw error;
                    (rows || []).forEach(r => { if (!fieldSeen.has(r.id)) { fieldSeen.add(r.id); fieldRows.push(r); } });
                }
                // Kéo theo từng đợt nên phải sắp lại theo thứ tự đã chọn.
                fieldRows.sort((a, b) => {
                    const da = new Date(a.created_at).getTime(), db = new Date(b.created_at).getTime();
                    if (da !== db) return asc ? da - db : db - da;
                    return asc ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id);
                });
                const isConfirmTag = (o) => SPECIAL_CONFIRM_STATUSES.includes(String(o.status)) && !hasRealCarrier(o);
                const isPrintTag = (o) => SPECIAL_PRINT_STATUSES.includes(String(o.status)) && hasRealCarrier(o);
                const isTransitTag = (o) => SPECIAL_TRANSIT_STATUSES.includes(String(o.status));
                const isMissingTag = (o) => SPECIAL_PRINT_STATUSES.includes(String(o.status)) && !hasRealCarrier(o);
                const countsTag = {
                    all: fieldRows.length,
                    confirm: fieldRows.filter(isConfirmTag).length,
                    print: fieldRows.filter(isPrintTag).length,
                    transit: fieldRows.filter(isTransitTag).length,
                };
                const missingTotalTag = fieldRows.filter(isMissingTag).length;
                const viewListTag = specialOnlyMissingPrint
                    ? fieldRows.filter(isMissingTag)
                    : fieldRows.filter(o => specialTab === 'all' ? true : specialTab === 'confirm' ? isConfirmTag(o) : specialTab === 'print' ? isPrintTag(o) : isTransitTag(o));
                const totalTag = viewListTag.length;
                const totalPagesTag = Math.max(1, Math.ceil(totalTag / SPECIAL_PAGE_SIZE));
                const effectivePageTag = totalTag > 0 ? Math.min(page, totalPagesTag) : 1;
                if (effectivePageTag !== page) setSpecialPage(effectivePageTag);
                const pageIdsTag = viewListTag.slice((effectivePageTag - 1) * SPECIAL_PAGE_SIZE, effectivePageTag * SPECIAL_PAGE_SIZE).map(o => o.id);
                let rowsTag = [];
                if (pageIdsTag.length) {
                    const { data: full, error } = await supabase.from('orders').select(SPECIAL_COLUMNS).in('id', pageIdsTag);
                    if (error) throw error;
                    const byId = new Map((full || []).map(o => [o.id, o]));
                    rowsTag = pageIdsTag.map(id => byId.get(id)).filter(Boolean);
                }
                setSpecialCounts(countsTag);
                setSpecialMissingTotal(missingTotalTag);
                setSpecialTotal(totalTag);
                setSpecialPageOrders(rowsTag);
                return;
            }
            if (debouncedSearchProduct.trim()) {
                // Đường tìm theo sản phẩm: phải nối bảng order_products nên
                // không đếm bằng count query được (join làm trùng đơn).
                // Kéo id + trường phục vụ lọc tab theo từng đợt 1000 rồi
                // khử trùng, từ đó tính đúng tổng số các tab và lấy 20 id
                // của trang đang mở, sau đó mới kéo đủ dữ liệu 20 đơn đó.
                const pq = escapeLike(debouncedSearchProduct.trim());
                const matched = [];
                const seen = new Set();
                let offset = 0;
                for (let chunk = 0; chunk < 50; chunk++) {
                    let q = supabase.from('orders')
                        .select('id, status, carrier_name, carrier_code, order_products!inner(product_name, product_code)');
                    q = applySpecialFilters(q, { tabId: null, missingOnly: false });
                    q = q.or(`product_name.ilike.%${pq}%,product_code.ilike.%${pq}%`, { foreignTable: 'order_products' });
                    q = orderBy(q).range(offset, offset + 999);
                    const { data: rows, error } = await q;
                    if (error) throw error;
                    const list = rows || [];
                    list.forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); matched.push(r); } });
                    if (list.length < 1000) break;
                    offset += 1000;
                }
                const isConfirm = (o) => SPECIAL_CONFIRM_STATUSES.includes(String(o.status)) && !hasRealCarrier(o);
                const isPrint = (o) => SPECIAL_PRINT_STATUSES.includes(String(o.status)) && hasRealCarrier(o);
                const isTransit = (o) => SPECIAL_TRANSIT_STATUSES.includes(String(o.status));
                const isMissing = (o) => SPECIAL_PRINT_STATUSES.includes(String(o.status)) && !hasRealCarrier(o);
                const counts = {
                    all: matched.length,
                    confirm: matched.filter(isConfirm).length,
                    print: matched.filter(isPrint).length,
                    transit: matched.filter(isTransit).length,
                };
                const missingTotal = matched.filter(isMissing).length;
                const viewList = specialOnlyMissingPrint
                    ? matched.filter(isMissing)
                    : matched.filter(o => specialTab === 'all' ? true : specialTab === 'confirm' ? isConfirm(o) : specialTab === 'print' ? isPrint(o) : isTransit(o));
                const total = viewList.length;
                const totalPages = Math.max(1, Math.ceil(total / SPECIAL_PAGE_SIZE));
                const effectivePage = total > 0 ? Math.min(page, totalPages) : 1;
                if (effectivePage !== page) setSpecialPage(effectivePage);
                const pageIds = viewList.slice((effectivePage - 1) * SPECIAL_PAGE_SIZE, effectivePage * SPECIAL_PAGE_SIZE).map(o => o.id);
                let rows = [];
                if (pageIds.length) {
                    const { data: full, error } = await supabase.from('orders').select(SPECIAL_COLUMNS).in('id', pageIds);
                    if (error) throw error;
                    const byId = new Map((full || []).map(o => [o.id, o]));
                    rows = pageIds.map(id => byId.get(id)).filter(Boolean);
                }
                setSpecialCounts(counts);
                setSpecialMissingTotal(missingTotal);
                setSpecialTotal(total);
                setSpecialPageOrders(rows);
                return;
            }
            // Đường thường: 4 count query cho 4 tab (chạy song song) +
            // 1 query lấy đúng 20 đơn của trang. Khi ở tab print thì đếm
            // thêm số đơn thiếu mã để hiện ở tick lọc.
            const countFor = async (tabId, missingOnly) => {
                let q = supabase.from('orders').select('id', { count: 'exact', head: true });
                q = applySpecialFilters(q, { tabId, missingOnly });
                const { count, error } = await q;
                if (error) throw error;
                return count || 0;
            };
            const [cAll, cConfirm, cPrint, cTransit] = await Promise.all([
                countFor('all', false), countFor('confirm', false), countFor('print', false), countFor('transit', false),
            ]);
            const counts = { all: cAll, confirm: cConfirm, print: cPrint, transit: cTransit };
            const missingTotal = specialTab === 'print' ? await countFor('print', true) : null;
            const total = specialOnlyMissingPrint ? (missingTotal || 0) : counts[specialTab];
            const totalPages = Math.max(1, Math.ceil(total / SPECIAL_PAGE_SIZE));
            const effectivePage = total > 0 ? Math.min(page, totalPages) : 1;
            if (effectivePage !== page) setSpecialPage(effectivePage);
            let rows = [];
            if (total > 0) {
                let q = supabase.from('orders').select(SPECIAL_COLUMNS);
                q = applySpecialFilters(q, { tabId: specialTab, missingOnly: specialOnlyMissingPrint });
                q = orderBy(q).range((effectivePage - 1) * SPECIAL_PAGE_SIZE, effectivePage * SPECIAL_PAGE_SIZE - 1);
                const { data, error } = await q;
                if (error) throw error;
                rows = data || [];
            }
            setSpecialCounts(counts);
            setSpecialMissingTotal(missingTotal);
            setSpecialTotal(total);
            setSpecialPageOrders(rows);
        } catch (err) {
            console.error('Lỗi tải báo cáo đặc biệt:', err);
            setSpecialError(err.message || 'Không tải được đơn từ bảng orders.');
        } finally {
            setSpecialLoading(false);
        }
    };

    // Đổi tab / ngày / bộ lọc / sắp xếp thì quay về trang 1 rồi mới tải,
    // để khỏi tải nhầm trang cũ với bộ lọc mới.
    const specialFilterSig = [specialTab, specialStartDate, specialEndDate, debouncedSearchId, debouncedSearchProduct, debouncedSearchNote, selectedStatus.join(','), selectedCarrier.join(','), selectedChannel.join(','), selectedCreator.join(','), selectedDepot.join(','), selectedTags.join(','), printedFilter, missingCarrierFilter ? '1' : '0', specialSortOrder, specialOnlyMissingPrint ? '1' : '0'].join('|');
    useEffect(() => {
        if (!specialMode) return;
        if (specialFilterSigRef.current !== specialFilterSig) {
            specialFilterSigRef.current = specialFilterSig;
            if (specialPage !== 1) { setSpecialPage(1); return; }
        }
        fetchSpecialData(specialPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [specialMode, specialTab, specialStartDate, specialEndDate, debouncedSearchId, debouncedSearchProduct, debouncedSearchNote, selectedStatus, selectedCarrier, selectedChannel, selectedCreator, selectedDepot, selectedTags, printedFilter, missingCarrierFilter, specialSortOrder, specialOnlyMissingPrint, specialPage, specialReloadToken]);

    // Đổi trang thì bỏ chọn cũ để nút Copy / Xuất chỉ tính trên trang mới.
    useEffect(() => {
        if (specialMode) setSelectedOrders([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [specialPage]);

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
        setDetailHistory([]);
        setDetailHistoryLoading(true);
        setShowDetailActionMenu(false);
        setDetailAction(null);
        setDetailActionMsg('');
        setDetailSendDone(false);
        setNhanhHistory([]);
        setNhanhHistoryLoaded(false);
        setNhanhHistoryMsg('');
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
        try {
            const { data: history, error: historyError } = await supabase
                .from('order_histories')
                .select('id, created_at, created_by_name, status_old, status_new, order_id')
                .eq('order_id', order.id)
                .order('created_at', { ascending: true })
                .limit(200);
            if (!historyError && history) setDetailHistory(history);
        } catch (err) {
            console.error('Lỗi tải lịch sử đơn:', err);
        } finally {
            setDetailHistoryLoading(false);
        }
    };

    // --- Thao tác Nhanh.vn (qua edge function nhanh-order-actions,
    // chỉ owner) ---
    const callNhanhActionRaw = async (action, body = {}) => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nhanh-order-actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
            body: JSON.stringify({ action, ...body }),
        });
        return res.json();
    };
    const callNhanhOrderAction = async (action, body = {}) => {
        if (!detailOrder) return { success: false, message: 'Chưa mở đơn hàng nào.' };
        return callNhanhActionRaw(action, { orderId: detailOrder.id, ...body });
    };
    // Vá lại dòng đơn đang hiển thị trong popup sau khi Nhanh nhận thao
    // tác (bảng orders trong Supabase chỉ đồng bộ lại ở lần kéo đơn sau,
    // nên popup tự cập nhật trước để owner thấy kết quả ngay).
    const patchDetailRow = (patch) => {
        setDetailOrder(prev => prev ? { ...prev, ...patch } : prev);
        setDetailData(prev => prev ? { ...prev, ...patch } : prev);
    };
    const openDetailAction = (kind) => {
        setShowDetailActionMenu(false);
        setDetailActionMsg('');
        if (kind === 'edit' && detailOrder) {
            setEditDescription(stripHtml(detailOrder.description || ''));
            setEditPrivateDescription(stripHtml(detailOrder.private_description || ''));
            setEditStatus('');
        }
        if (kind === 'cancel') setCancelReason('');
        if (kind === 'send') setDetailSendDone(false);
        setDetailAction(kind);
    };
    const handleSaveEdit = async () => {
        const body = {};
        if (editDescription !== stripHtml(detailOrder?.description || '')) body.description = editDescription;
        if (editPrivateDescription !== stripHtml(detailOrder?.private_description || '')) body.privateDescription = editPrivateDescription;
        if (editStatus) body.status = Number(editStatus);
        if (Object.keys(body).length === 0) {
            setDetailActionMsg('Chưa thay đổi thông tin nào.');
            return;
        }
        setDetailActionLoading(true);
        setDetailActionMsg('');
        try {
            const result = await callNhanhOrderAction('edit', body);
            if (result.success) {
                const patch = {};
                if (body.description !== undefined) patch.description = body.description;
                if (body.privateDescription !== undefined) patch.private_description = body.privateDescription;
                if (body.status !== undefined) patch.status = body.status;
                patchDetailRow(patch);
                setSpecialReloadToken(t => t + 1);
                setDetailActionMsg('Đã lưu thay đổi lên Nhanh.vn.');
            } else setDetailActionMsg(result.message || 'Nhanh.vn từ chối lưu thay đổi.');
        } catch (err) {
            setDetailActionMsg(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setDetailActionLoading(false);
        }
    };
    // Gửi 1 đơn trong popup: kết quả nằm ở results[0].
    const handleSendShip = async () => {
        setDetailActionLoading(true);
        setDetailActionMsg('');
        try {
            const result = await callNhanhOrderAction('send');
            const first = result.results?.[0];
            if (first?.ok) {
                if (first.carrierCode) patchDetailRow({ carrier_code: first.carrierCode });
                setSpecialReloadToken(t => t + 1);
                setDetailSendDone(true);
                setDetailActionMsg(first.existed
                    ? `Đơn đã gửi từ trước, mã vận đơn cũ: ${first.carrierCode || 'không rõ'}.`
                    : (first.carrierCode ? `Đã gửi sang hãng, mã vận đơn: ${first.carrierCode}.` : 'Đã gửi đơn sang hãng vận chuyển.'));
            } else setDetailActionMsg(first?.message || result.message || 'Nhanh.vn từ chối gửi đơn.');
        } catch (err) {
            setDetailActionMsg(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setDetailActionLoading(false);
        }
    };
    // Hủy 1 đơn trong popup.
    const handleCancelShip = async () => {
        setDetailActionLoading(true);
        setDetailActionMsg('');
        try {
            const result = await callNhanhOrderAction('cancel', cancelReason ? { cancelReason } : {});
            const first = result.results?.[0];
            if (first?.ok) {
                if (first.status) patchDetailRow({ status: first.status });
                setSpecialReloadToken(t => t + 1);
                setDetailActionMsg(first.statusName ? `Đã hủy đơn trên Nhanh: ${first.statusName}.` : 'Đã hủy đơn trên Nhanh.');
            } else setDetailActionMsg(first?.message || result.message || 'Nhanh.vn từ chối hủy đơn.');
        } catch (err) {
            setDetailActionMsg(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setDetailActionLoading(false);
        }
    };
    // Lịch sử Nhanh.vn trong popup: mặc định ẩn, bấm mới tải.
    const handleLoadNhanhHistory = async () => {
        setNhanhHistoryLoading(true);
        setNhanhHistoryMsg('');
        try {
            const result = await callNhanhOrderAction('history');
            if (result.success) {
                setNhanhHistory(result.data || []);
                setNhanhHistoryLoaded(true);
            } else setNhanhHistoryMsg(result.message || 'Không tải được lịch sử từ Nhanh.');
        } catch (err) {
            setNhanhHistoryMsg(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setNhanhHistoryLoading(false);
        }
    };
    // Danh sách nhãn cho bộ lọc: tải 1 lần khi mở báo cáo đặc biệt.
    useEffect(() => {
        if (!specialMode || nhanhTagOptionsLoaded) return;
        setNhanhTagOptionsLoaded(true);
        callNhanhActionRaw('tags').then(result => {
            if (result.success) setNhanhTagOptions((result.data || []).map(t => ({ value: String(t.id), label: t.name })));
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [specialMode]);
    // Gửi hàng loạt từ nút Thao tác trên thanh công cụ: chỉ gửi đơn
    // kênh Admin, đơn Shopee/TikTok và các kênh khác trong list đã tick
    // đều bỏ qua mặc định và được báo rõ trong popup kết quả.
    const handleBulkSend = async () => {
        if (selectedOrders.length === 0) return;
        const adminIds = selectedOrders.filter(id => {
            const row = effectiveFiltered.find(o => String(o.id) === String(id));
            return row && isAdminChannel(row);
        });
        const skippedIds = selectedOrders.filter(id => !adminIds.some(a => String(a) === String(id)));
        setShowActionMenu(false);
        if (adminIds.length === 0) {
            setCopyMessage('Các đơn đã chọn không có đơn kênh Admin nên không gửi được đơn nào (đơn Shopee/TikTok được bỏ qua).');
            setTimeout(() => setCopyMessage(''), 5000);
            return;
        }
        setSendingOrder(true);
        try {
            const result = await callNhanhActionRaw('send', { orderIds: adminIds });
            setBulkSendResult({ ...result, skippedIds });
            setShowBulkSendModal(true);
            if (result.okCount > 0) setSpecialReloadToken(t => t + 1);
        } catch (err) {
            setCopyMessage(`Lỗi hệ thống: ${err.message}`);
            setTimeout(() => setCopyMessage(''), 5000);
        } finally {
            setSendingOrder(false);
        }
    };
    // Hủy hàng loạt: tick bao nhiêu hủy bấy nhiêu, 1 lý do chung.
    const handleBulkCancel = async () => {
        if (selectedOrders.length === 0) return;
        setBulkCancelRunning(true);
        try {
            const result = await callNhanhActionRaw('cancel', { orderIds: selectedOrders, cancelReason: cancelReasonBulk || undefined });
            setBulkCancelResult(result);
            if (result.okCount > 0) {
                setSpecialReloadToken(t => t + 1);
                setSelectedOrders([]);
            }
        } catch (err) {
            setBulkCancelResult({ success: false, results: [], message: `Lỗi hệ thống: ${err.message}` });
        } finally {
            setBulkCancelRunning(false);
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

    // Tên trạng thái ngắn chỉ dùng trong báo cáo đặc biệt: 57 là Chờ xác nhận.
    const specialStatusName = (code) => String(code) === '57' ? 'Chờ xác nhận' : (statusDict[code] || LOCAL_STATUS_NAMES[String(code)] || String(code));
    // Số trên tab là số đếm đúng từ server (chưa đếm xong thì …).
    const specialTabCount = (tabId) => {
        const v = specialCounts[tabId];
        return v === undefined || v === null ? null : String(v);
    };
    // Cửa sổ số trang cho pager của báo cáo đặc biệt: trang hiện tại ±2,
    // kèm trang đầu / cuối, chèn … ở khoảng trống.
    const specialPageWindow = () => {
        const total = Math.max(1, Math.ceil(specialTotal / SPECIAL_PAGE_SIZE));
        const pages = new Set([1, total]);
        for (let p = specialPage - 2; p <= specialPage + 2; p++) if (p >= 1 && p <= total) pages.add(p);
        const sorted = [...pages].sort((a, b) => a - b);
        const out = [];
        sorted.forEach((p, i) => { if (i > 0 && p - sorted[i - 1] > 1) out.push('…'); out.push(p); });
        return out;
    };

    // Danh sách hiển thị / thao tác: báo cáo đặc biệt chỉ dùng 20 đơn của
    // trang đang mở, báo cáo cũ dùng filteredOrders. Các nút Copy / Xuất
    // Excel / Thao tác ở dưới đều dùng chung các biến này nên ở chế độ
    // đặc biệt chúng chỉ tính trên trang đang xem, không phải toàn bộ.
    const effectiveFiltered = specialMode ? specialPageOrders : filteredOrders;
    const targetOrdersAction = selectedOrders.length > 0
        ? effectiveFiltered.filter(o => selectedOrders.includes(o.id))
        : effectiveFiltered;

    const copyTargetCount = targetOrdersAction.length;
    const ecomOrdersCount = targetOrdersAction.filter(o => ['42', '48'].includes(String(o.sale_channel)) && o.ecom_order_id).length;
    const carrierOrdersCount = targetOrdersAction.filter(o => specialMode ? hasRealCarrier(o) : o.carrier_code).length;

    const totalOrdersCount = specialMode ? specialTotal : effectiveFiltered.length;
    const totalPages = specialMode ? (Math.ceil(specialTotal / SPECIAL_PAGE_SIZE) || 1) : (Math.ceil(totalOrdersCount / pageSize) || 1);
    const paginatedOrders = specialMode ? specialPageOrders : effectiveFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Tùy chọn lọc cho báo cáo đặc biệt: trạng thái lấy đủ từ bảng
    // order_statuses, kênh lấy đủ từ SALE_CHANNELS, còn hãng / nhân viên /
    // kho lấy từ báo cáo cũ cộng thêm giá trị gặp trên trang đang mở
    // (trước đây lấy từ cache đơn đặc biệt, nay không còn cache nữa).
    const specialStatusOptions = Object.keys(statusDict).sort((a, b) => Number(a) - Number(b)).map(code => ({
        value: String(code),
        label: specialStatusName(code)
    }));
    const specialCarrierOptions = [...new Set([...carrierOptions, ...specialPageOrders.map(o => o.carrier_name).filter(Boolean)])];
    const specialChannelOptions = Object.entries(SALE_CHANNELS).map(([ch, name]) => ({
        value: String(ch),
        label: name
    }));
    const specialCreatorOptions = (() => {
        const m = new Map();
        creatorOptions.forEach(o => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label; if (v) m.set(String(v), l); });
        specialPageOrders.forEach(o => { if (o.created_by_name) m.set(String(o.created_by_name), o.created_by_name); });
        return [...m.entries()].map(([value, label]) => ({ value, label }));
    })();
    const specialDepotOptions = (() => {
        const m = new Map();
        depotOptions.forEach(o => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label; if (v) m.set(String(v), l); });
        specialPageOrders.forEach(o => { if (o.depot_id !== null && o.depot_id !== undefined) m.set(String(o.depot_id), DEPOT_NAMES[o.depot_id] || `Kho ${o.depot_id}`); });
        return [...m.entries()].map(([value, label]) => ({ value, label }));
    })();
    const activeFilterCount = (searchProduct ? 1 : 0) + (searchNote ? 1 : 0) + selectedStatus.length + selectedCarrier.length + selectedChannel.length + selectedCreator.length + selectedDepot.length + selectedTags.length + (printedFilter ? 1 : 0) + (missingCarrierFilter ? 1 : 0);
    const handleClearSpecialFilters = () => {
        setSearchProduct('');
        setSearchNote('');
        setSelectedStatus([]);
        setSelectedCarrier([]);
        setSelectedChannel([]);
        setSelectedCreator([]);
        setSelectedDepot([]);
        setSelectedTags([]);
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

    // Kéo toàn bộ id đơn thiếu mã thật theo đúng bộ lọc đang mở. Chỉ gọi
    // khi bấm nút cập nhật webhook (nút ít dùng nên không load trước khi
    // mở trang, bấm mới load rồi mới chạy).
    const fetchSpecialMissingIds = async () => {
        const ids = [];
        const seen = new Set();
        let offset = 0;
        for (let chunk = 0; chunk < 50; chunk++) {
            let q;
            if (debouncedSearchProduct.trim()) {
                const pq = escapeLike(debouncedSearchProduct.trim());
                q = supabase.from('orders').select('id, order_products!inner(product_name, product_code)');
                q = applySpecialFilters(q, { tabId: 'print', missingOnly: true });
                q = q.or(`product_name.ilike.%${pq}%,product_code.ilike.%${pq}%`, { foreignTable: 'order_products' });
            } else {
                q = supabase.from('orders').select('id');
                q = applySpecialFilters(q, { tabId: 'print', missingOnly: true });
            }
            q = q.range(offset, offset + 999);
            const { data: rows, error } = await q;
            if (error) throw error;
            const list = rows || [];
            list.forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); ids.push(r.id); } });
            if (list.length < 1000) break;
            offset += 1000;
        }
        return ids;
    };

    // Cập nhật webhook cho toàn bộ đơn Đang/Đã đóng gói chưa có mã thật
    // ở tab In và đóng gói (khi tick lọc thiếu mã): bấm mới load danh
    // sách rồi mới chạy, không load trước.
    const handleUpdateMissingPrintWebhooks = async () => {
        setIsUpdatingMissingCarrier(true);
        setMissingCarrierProgress(0);
        setMissingUpdateTotal(0);
        try {
            setCopyMessage('Đang tải danh sách đơn đóng gói chưa có mã vận đơn thực...');
            const orderIds = await fetchSpecialMissingIds();
            if (orderIds.length === 0) {
                setCopyMessage('Không có đơn Đang/Đã đóng gói nào chưa có mã vận đơn thực.');
                setTimeout(() => setCopyMessage(''), 3000);
                return;
            }
            setMissingUpdateTotal(orderIds.length);
            setCopyMessage(`Đang cập nhật lại webhook cho ${orderIds.length} đơn đóng gói chưa có mã vận đơn thực...`);
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
            setSpecialReloadToken(t => t + 1);
            await fetchAllocation(statusDict);
            setCopyMessage(`Đã cập nhật lại webhook cho ${orderIds.length} đơn đóng gói chưa có mã vận đơn thực.`);
            setTimeout(() => setCopyMessage(''), 5000);
        } catch (err) {
            console.error('Lỗi cập nhật webhook đơn thiếu mã:', err);
            setCopyMessage(`Không tải được danh sách đơn thiếu mã: ${err.message}`);
            setTimeout(() => setCopyMessage(''), 5000);
        } finally {
            setIsUpdatingMissingCarrier(false);
        }
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

    // Đơn kênh Admin mới được gửi sang hãng (mã kênh 1 trong
    // SALE_CHANNELS); đơn Shopee (42) / Tiktok Shop (48) và các kênh
    // khác đều bỏ qua khi gửi.
    const isAdminChannel = (order) => String(order?.sale_channel) === '1';
    // Mở trang in của Nhanh cho đúng các đơn truyền vào (mẫu từ báo cáo
    // cũ), rồi popup list các đơn vừa in: khổ A thì list mã vận đơn,
    // khổ K80 thì list ID đơn. Dùng chung cho: in đơn đã tick, in 1 đơn
    // trong popup, và in các đơn vừa gửi xong.
    const openNhanhPrint = (printItems, printSize) => {
        if (!businessId) { alert("️ Chưa cấu hình Business ID!"); return; }
        if (!printItems || printItems.length === 0) return;
        const orderIds = printItems.map(item => typeof item === 'object' ? item.id : item);
        const idString = orderIds.join(',');
        let printUrl = "";
        if (orderIds.length === 1) {
            printUrl = `https://nhanh.vn/order/manage/pickup?storeId=${businessId}&businessId=${businessId}&ids=${idString}&emptyLayout=true&printDialogMode=manual&format=print${printSize === 'K80' ? '&typePrint=k80' : ''}`;
        } else {
            printUrl = `https://nhanh.vn/order/manage/pickup?ids=${idString}&storeId=${businessId}&format=print&printDialogMode=manual&noclose=1${printSize === 'K80' ? '&typePrint=k80' : ''}`;
        }
        window.open(printUrl, '_blank');
        setPrintList({
            size: printSize,
            items: printItems.map(item => typeof item === 'object'
                ? { id: item.id, carrier_code: item.carrier_code || '' }
                : { id: item, carrier_code: '' }),
        });
        setPrintCopied(false);
    };
    const executePrint = (printSize) => {
        // Lấy mã vận đơn từ dòng đơn đang hiển thị (trang hiện tại ở
        // báo cáo đặc biệt, toàn bộ list đã lọc ở báo cáo cũ).
        const items = selectedOrders.map(id => {
            const row = effectiveFiltered.find(o => String(o.id) === String(id));
            return { id, carrier_code: row?.carrier_code || '' };
        });
        openNhanhPrint(items, printSize);
        setShowActionMenu(false);
    };
    const handleCopyPrintList = async () => {
        if (!printList) return;
        const lines = printList.items.map(item => printList.size === 'K80'
            ? String(item.id)
            : (item.carrier_code ? item.carrier_code : `#${item.id}`));
        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setPrintCopied(true);
            setTimeout(() => setPrintCopied(false), 2000);
        } catch (err) {
            setCopyMessage('Không sao chép được, vui lòng copy tay từ bảng list.');
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
                            <div
                                className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm"
                                title="Chỉ Owner thấy nút gạt này. Bật để xem báo cáo đặc biệt, tắt để quay về báo cáo cũ."
                            >
                                <span className={`text-sm font-bold ${!specialMode ? 'text-slate-900' : 'text-slate-400'}`}>Báo cáo cũ</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={specialMode}
                                    onClick={handleToggleSpecialMode}
                                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${specialMode ? 'bg-slate-900' : 'bg-slate-300'}`}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${specialMode ? 'left-6' : 'left-0.5'}`} />
                                </button>
                                <span className={`text-sm font-bold ${specialMode ? 'text-slate-900' : 'text-slate-400'}`}>Báo cáo đặc biệt</span>
                            </div>
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
                                    <input type="date" value={specialStartDate} onChange={(e) => setSpecialStartDate(e.target.value)} className="px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
                                </label>
                                <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                                    Đến
                                    <input type="date" value={specialEndDate} onChange={(e) => setSpecialEndDate(e.target.value)} className="px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500" />
                                </label>
                                <button onClick={() => setSpecialReloadToken(t => t + 1)} disabled={specialLoading} className="px-2 py-1 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
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
                                <span className="text-sm font-bold text-amber-800">Chỉ hiển thị đơn Đang/Đã đóng gói chưa có mã vận đơn thực ({specialMissingTotal === null || specialMissingTotal === undefined ? '…' : specialMissingTotal})</span>
                            </label>
                        )}
                        {specialTab === 'print' && specialOnlyMissingPrint && (specialMissingTotal || 0) > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
                                <p className="text-sm font-medium text-slate-700">{specialMissingTotal} đơn đóng gói chưa có mã vận đơn thực.</p>
                                <button onClick={handleUpdateMissingPrintWebhooks} disabled={isUpdatingMissingCarrier} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                    <RefreshCw size={15} className={isUpdatingMissingCarrier ? 'animate-spin' : ''} />
                                    {isUpdatingMissingCarrier ? `Đang cập nhật (${missingCarrierProgress}/${missingUpdateTotal})...` : 'Cập nhật webhook cho tất cả đơn thiếu mã'}
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
                                            <button onClick={handleBulkSend} className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"><Send size={15} /> Gửi đơn sang hãng</button>
                                            <button onClick={() => { setShowActionMenu(false); setBulkCancelResult(null); setCancelReasonBulk(''); setShowBulkCancelModal(true); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><XCircle size={15} /> Hủy đơn</button>

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
                                    {specialMode && <MultiSelect options={nhanhTagOptions} selected={selectedTags} onChange={setSelectedTags} placeholder="Nhãn đơn" />}
                                </div>
                                {specialMode && nhanhTagOptions.length === 0 && (
                                    <p className="text-xs text-slate-500">Chưa có nhãn nào: nhãn chỉ có cho đơn mới đồng bộ sau khi chạy migration + sync-nhanh mới.</p>
                                )}
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
                        {(specialMode ? (specialPageOrders.length === 0 && specialLoading) : loading) ? (
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

                    {/* Pagination: báo cáo đặc biệt cố định 20 đơn / trang,
                        bấm sang trang nào mới tải trang đó từ server. */}
                    {((specialMode && totalOrdersCount > 0) || (!specialMode && !loading && totalOrdersCount > 0)) && (
                        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-600">
                                    Đang xem <span className="font-semibold text-gray-900">{specialMode ? (specialTotal === 0 ? 0 : (specialPage - 1) * SPECIAL_PAGE_SIZE + 1) : (currentPage - 1) * pageSize + 1}</span> - <span className="font-semibold text-gray-900">{specialMode ? Math.min(specialPage * SPECIAL_PAGE_SIZE, totalOrdersCount) : Math.min(currentPage * pageSize, totalOrdersCount)}</span> / <span className="font-semibold text-gray-900">{totalOrdersCount}</span> đơn
                                </span>
                                <div className="border-l border-gray-300 pl-4">
                                    {specialMode ? (
                                        <span className="text-sm text-gray-600">20 dòng / trang</span>
                                    ) : (
                                        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500">
                                            <option value={20}>20 dòng / trang</option>
                                            <option value={50}>50 dòng / trang</option>
                                            <option value={100}>100 dòng / trang</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                            {specialMode ? (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setSpecialPage(1)} disabled={specialPage === 1 || specialLoading} className="px-2 py-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-sm font-bold">«</button>
                                    <button onClick={() => setSpecialPage(p => Math.max(1, p - 1))} disabled={specialPage === 1 || specialLoading} className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft size={18} /></button>
                                    {specialPageWindow().map((p, i) => p === '…' ? (
                                        <span key={`gap-${i}`} className="px-1 text-sm text-gray-400">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setSpecialPage(p)} disabled={specialLoading} className={`min-w-8 px-2 py-1.5 rounded text-sm font-bold transition-colors disabled:opacity-50 ${p === specialPage ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>{p}</button>
                                    ))}
                                    <button onClick={() => setSpecialPage(p => Math.min(totalPages, p + 1))} disabled={specialPage === totalPages || specialLoading} className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight size={18} /></button>
                                    <button onClick={() => setSpecialPage(totalPages)} disabled={specialPage === totalPages || specialLoading} className="px-2 py-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-sm font-bold">»</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft size={18} /></button>
                                    <div className="flex items-center px-2 text-sm">
                                        Trang <span className="font-semibold text-gray-900 mx-1">{currentPage}</span> / {totalPages}
                                    </div>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight size={18} /></button>
                                </div>
                            )}
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
                                <div className="flex items-center gap-2 shrink-0 relative">
                                    <button onClick={() => setShowDetailActionMenu(v => !v)} className="px-3 py-1.5 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">Thao tác</button>
                                    {showDetailActionMenu && (
                                        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1" onClick={(e) => e.stopPropagation()}>
                                            {isAdminChannel(detailOrder) && (
                                                <button onClick={() => openDetailAction('send')} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Gửi đơn</button>
                                            )}
                                            <button onClick={() => openDetailAction('edit')} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Sửa đơn</button>
                                            <button onClick={() => { setShowDetailActionMenu(false); openNhanhPrint([{ id: detailOrder.id, carrier_code: detailOrder.carrier_code || '' }], 'A4'); }} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">In đơn</button>
                                            <button onClick={() => openDetailAction('cancel')} className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Hủy đơn</button>
                                        </div>
                                    )}
                                    <button onClick={() => setDetailOrder(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={22} /></button>
                                </div>
                            </div>
                            {detailAction && (
                                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-slate-800">
                                            {detailAction === 'edit' && 'Sửa đơn trên Nhanh'}
                                            {detailAction === 'send' && 'Gửi đơn sang hãng vận chuyển'}
                                            {detailAction === 'cancel' && 'Hủy đơn trên Nhanh'}
                                        </h4>
                                        <button onClick={() => setDetailAction(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">Đóng</button>
                                    </div>
                                    {detailAction === 'edit' && (
                                        <div className="space-y-2">
                                            <label className="block text-xs font-bold text-slate-600">Ghi chú đơn</label>
                                            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                                            <label className="block text-xs font-bold text-slate-600">Ghi chú nội bộ</label>
                                            <textarea value={editPrivateDescription} onChange={(e) => setEditPrivateDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                                            <label className="block text-xs font-bold text-slate-600">Trạng thái</label>
                                            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500">
                                                <option value="">Giữ nguyên trạng thái</option>
                                                <option value="56">Đã xác nhận</option>
                                                <option value="60">Thành công</option>
                                                <option value="63">Khách hủy</option>
                                                <option value="64">Hệ thống hủy</option>
                                            </select>
                                            <p className="text-xs text-slate-500">Nhanh.vn không cho sửa đơn đã gửi sang hãng, đơn Thành công hoặc đơn đã hoàn — trường hợp đó sẽ báo lỗi từ Nhanh.</p>
                                            <button onClick={handleSaveEdit} disabled={detailActionLoading} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                                                {detailActionLoading && <RefreshCw size={14} className="animate-spin" />} Lưu thay đổi
                                            </button>
                                        </div>
                                    )}
                                    {detailAction === 'send' && (
                                        <div className="space-y-2">
                                            {hasRealCarrier(detailOrder) && <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Đơn đã có mã vận đơn {detailOrder.carrier_code}, Nhanh sẽ trả lại mã cũ nếu đơn đã gửi rồi.</p>}
                                            <p className="text-sm text-slate-600">Gửi đơn này sang hãng vận chuyển để lấy mã vận đơn trên Nhanh.</p>
                                            <button onClick={handleSendShip} disabled={detailActionLoading} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                                                {detailActionLoading && <RefreshCw size={14} className="animate-spin" />} Xác nhận gửi sang hãng
                                            </button>
                                            {detailSendDone && (
                                                <div className="flex gap-2 pt-1">
                                                    <button onClick={() => openNhanhPrint([{ id: detailOrder.id, carrier_code: detailOrder.carrier_code || '' }], 'A4')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"><Printer size={15} /> In đơn hàng (A4/A5)</button>
                                                    <button onClick={() => openNhanhPrint([{ id: detailOrder.id, carrier_code: detailOrder.carrier_code || '' }], 'K80')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"><Printer size={15} /> In khổ K80</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {detailAction === 'cancel' && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Hủy đơn trên Nhanh sẽ đổi trạng thái đơn và gọi hủy sang hãng nếu đơn đã gửi. Hành động này không hoàn tác được từ đây.</p>
                                            <label className="block text-xs font-bold text-slate-600">Lý do hủy (không bắt buộc)</label>
                                            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="VD: Khách hàng yêu cầu hủy" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                                            <button onClick={handleCancelShip} disabled={detailActionLoading} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                                                {detailActionLoading && <RefreshCw size={14} className="animate-spin" />} Xác nhận hủy đơn
                                            </button>
                                        </div>
                                    )}
                                    {detailActionMsg && <p className="text-sm font-medium text-slate-700">{detailActionMsg}</p>}
                                </div>
                            )}
                            <div className="p-5 overflow-y-auto space-y-6">
                                {detailLoading && <p className="text-sm text-slate-500 font-medium flex items-center gap-2"><RefreshCw size={15} className="animate-spin" /> Đang tải đầy đủ chi tiết...</p>}

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Thông tin đơn</h4>
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
                                        {payment && <DetailRow label="VAT" value={fmtMoney(payment.vat?.amount)} />}
                                        {payment && <DetailRow label="Tiền cọc" value={fmtMoney(payment.deposit?.amount)} />}
                                        {payment && <DetailRow label="Tiền chuyển khoản" value={fmtMoney(payment.transfer?.amount)} />}
                                        {payment && <DetailRow label="Chiết khấu đơn" value={fmtMoney(payment.discount?.amount)} />}
                                        {payment && <DetailRow label="Điểm đã dùng" value={`${fmtMoney(payment.usedPoints?.amount)} (${payment.usedPoints?.points ?? 'Chưa có'} điểm)`} />}
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Thông tin khách hàng</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                        <DetailRow label="Người nhận" value={shipAddr?.name || 'Chưa có'} />
                                        <DetailRow label="Số điện thoại" value={shipAddr?.mobile || 'Chưa có'} />
                                        <DetailRow label="Địa chỉ" value={shipAddr?.address || 'Chưa có'} />
                                        <DetailRow label="Tỉnh / Huyện / Phường" value={shipAddr ? `${shipAddr.cityId ?? 'Chưa có'} / ${shipAddr.districtId ?? 'Chưa có'} / ${shipAddr.wardId ?? 'Chưa có'}` : 'Chưa có'} />
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Cước, vận chuyển &amp; mã vận đơn</h4>
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

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Thông tin sản phẩm ({totalQty} sản phẩm)</h4>
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

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Lịch sử đơn hàng</h4>
                                    {detailHistoryLoading ? (
                                        <p className="text-sm text-slate-500 font-medium flex items-center gap-2"><RefreshCw size={15} className="animate-spin" /> Đang tải lịch sử...</p>
                                    ) : detailHistory.length === 0 ? (
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium mb-4">Chưa có lịch sử trong bảng order_histories, chỉ có mốc tạo đơn:</p>
                                            <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
                                                <li className="pl-5 relative">
                                                    <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow" />
                                                    <p className="text-xs font-medium text-slate-500">{fmtDateStr(base.created_at)}</p>
                                                    <p className="text-sm font-semibold text-slate-800">Tạo đơn: {statusName}</p>
                                                    <p className="text-xs text-slate-500">Bởi: {base.created_by_name || 'Hệ thống'}</p>
                                                </li>
                                            </ol>
                                        </div>
                                    ) : (
                                        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
                                            {detailHistory.map(h => {
                                                const fromName = h.status_old !== null && h.status_old !== undefined ? specialStatusName(String(h.status_old)) : null;
                                                const toName = h.status_new !== null && h.status_new !== undefined ? specialStatusName(String(h.status_new)) : null;
                                                const text = fromName && toName
                                                    ? `${fromName} → ${toName}`
                                                    : toName
                                                        ? (fromName ? `Chuyển sang: ${toName}` : `Tạo đơn: ${toName}`)
                                                        : 'Cập nhật đơn';
                                                return (
                                                    <li key={h.id} className="pl-5 relative">
                                                        <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow" />
                                                        <p className="text-xs font-medium text-slate-500">{fmtDateStr(h.created_at)}</p>
                                                        <p className="text-sm font-semibold text-slate-800">{text}</p>
                                                        <p className="text-xs text-slate-500">Bởi: {h.created_by_name || 'Hệ thống'}</p>
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                    )}
                                </section>

                                <section>
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 border-b border-slate-200 pb-2">Lịch sử Nhanh.vn</h4>
                                    {!nhanhHistoryLoaded ? (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-500">Lịch sử này lấy trực tiếp từ Nhanh.vn, không tự tải khi mở popup.</p>
                                            <button onClick={handleLoadNhanhHistory} disabled={nhanhHistoryLoading} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                                                {nhanhHistoryLoading && <RefreshCw size={14} className="animate-spin" />} Tải lịch sử Nhanh
                                            </button>
                                            {nhanhHistoryMsg && <p className="text-sm font-medium text-slate-700">{nhanhHistoryMsg}</p>}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {['all', 'Nhanh', 'Hãng vận chuyển'].map(src => (
                                                    <button key={src} onClick={() => setNhanhHistorySource(src)} className={`px-3 py-1 rounded-full text-xs font-bold ${nhanhHistorySource === src ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600'}`}>
                                                        {src === 'all' ? 'Tất cả' : src}
                                                    </button>
                                                ))}
                                                <button onClick={handleLoadNhanhHistory} disabled={nhanhHistoryLoading} className="px-3 py-1 rounded-full text-xs font-bold bg-white border border-slate-300 text-slate-600 flex items-center gap-1">
                                                    <RefreshCw size={12} className={nhanhHistoryLoading ? 'animate-spin' : ''} /> Tải lại
                                                </button>
                                            </div>
                                            {nhanhHistoryMsg && <p className="text-sm font-medium text-slate-700">{nhanhHistoryMsg}</p>}
                                            {nhanhHistory.filter(l => nhanhHistorySource === 'all' || l.source === nhanhHistorySource).length === 0 && (
                                                <p className="text-sm text-slate-500">Không có lịch sử nào từ Nhanh cho đơn này.</p>
                                            )}
                                            <div className="max-h-64 overflow-y-auto space-y-1.5">
                                                {nhanhHistory.filter(l => nhanhHistorySource === 'all' || l.source === nhanhHistorySource).map(l => (
                                                    <div key={l.logId} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                                        <div className="flex justify-between gap-3">
                                                            <span className="font-bold text-slate-800">{NHANH_STEP_NAMES[l.step] || `Hành động ${l.step}`}</span>
                                                            <span className="text-xs text-slate-400 shrink-0">{fmtUnix(l.createdAt)} · {l.source}</span>
                                                        </div>
                                                        <p className="text-slate-500 text-xs mt-0.5">
                                                            {l.status?.old !== null && l.status?.old !== undefined ? `${specialStatusName(l.status.old)} → ` : ''}{l.status?.new !== null && l.status?.new !== undefined ? specialStatusName(l.status.new) : 'Không đổi trạng thái'}
                                                            {l.createdBy ? ` · ${l.createdBy}` : ''}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>

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

            {/* Kết quả gửi hàng loạt: kèm nút in các đơn vừa gửi xong */}
            {showBulkSendModal && bulkSendResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" onClick={() => setShowBulkSendModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Kết quả gửi đơn sang hãng</h3>
                            <button onClick={() => setShowBulkSendModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-3">
                            <p className="text-sm font-medium text-slate-700">
                                Thành công <span className="font-bold text-green-700">{bulkSendResult.okCount || 0}</span> đơn
                                {(bulkSendResult.failCount || 0) > 0 && (<> · Thất bại <span className="font-bold text-red-600">{bulkSendResult.failCount}</span> đơn</>)}
                                {(bulkSendResult.skippedIds || []).length > 0 && (<> · Bỏ qua <span className="font-bold text-amber-700">{bulkSendResult.skippedIds.length}</span> đơn không phải kênh Admin</>)}.
                            </p>
                            {(bulkSendResult.skippedIds || []).length > 0 && (
                                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    Bỏ qua vì không phải kênh Admin (đơn Shopee/TikTok và các kênh khác): {bulkSendResult.skippedIds.join(', ')}
                                </p>
                            )}
                            {(bulkSendResult.results || []).filter(r => r.ok).length > 0 && (
                                <div className="space-y-1">
                                    {(bulkSendResult.results || []).filter(r => r.ok).map(r => (
                                        <p key={r.id} className="text-sm text-slate-600">Đơn #{r.id}: mã vận đơn <span className="font-bold text-slate-800">{r.carrierCode || 'không rõ'}</span>{r.existed ? ' (đã gửi từ trước)' : ''}</p>
                                    ))}
                                </div>
                            )}
                            {(bulkSendResult.results || []).filter(r => !r.ok).length > 0 && (
                                <div className="space-y-1 border-t border-slate-200 pt-2">
                                    {(bulkSendResult.results || []).filter(r => !r.ok).map(r => (
                                        <p key={r.id} className="text-sm text-red-600">Đơn #{r.id}: {r.message}</p>
                                    ))}
                                </div>
                            )}
                            {(bulkSendResult.results || []).filter(r => r.ok).length > 0 && (
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => openNhanhPrint((bulkSendResult.results || []).filter(r => r.ok).map(r => ({ id: r.id, carrier_code: r.carrierCode || '' })), 'A4')} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2"><Printer size={15} /> In đơn hàng (A4/A5)</button>
                                    <button onClick={() => openNhanhPrint((bulkSendResult.results || []).filter(r => r.ok).map(r => ({ id: r.id, carrier_code: r.carrierCode || '' })), 'K80')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"><Printer size={15} /> In khổ K80</button>
                                </div>
                            )}
                            <p className="text-xs text-slate-500">Mã vận đơn sẽ hiện trong bảng sau khi hệ thống đồng bộ đơn từ Nhanh về.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Hủy hàng loạt: nhập 1 lý do chung rồi xác nhận */}
            {showBulkCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" onClick={() => !bulkCancelRunning && setShowBulkCancelModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Hủy {selectedOrders.length} đơn đã chọn</h3>
                            <button onClick={() => !bulkCancelRunning && setShowBulkCancelModal(false)} disabled={bulkCancelRunning} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-3">
                            {!bulkCancelResult ? (
                                <>
                                    <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Hủy trên Nhanh sẽ đổi trạng thái các đơn này và gọi hủy sang hãng nếu đơn đã gửi. Hành động này không hoàn tác được từ đây.</p>
                                    <label className="block text-xs font-bold text-slate-600">Lý do hủy chung (không bắt buộc)</label>
                                    <input value={cancelReasonBulk} onChange={(e) => setCancelReasonBulk(e.target.value)} placeholder="VD: Khách hàng yêu cầu hủy" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" />
                                    <button onClick={handleBulkCancel} disabled={bulkCancelRunning} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                                        {bulkCancelRunning && <RefreshCw size={14} className="animate-spin" />} Xác nhận hủy {selectedOrders.length} đơn
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-medium text-slate-700">
                                        Đã hủy <span className="font-bold text-green-700">{bulkCancelResult.okCount || 0}</span> đơn
                                        {(bulkCancelResult.failCount || 0) > 0 && (<> · Thất bại <span className="font-bold text-red-600">{bulkCancelResult.failCount}</span> đơn</>)}.
                                    </p>
                                    {(bulkCancelResult.results || []).filter(r => !r.ok).length > 0 && (
                                        <div className="space-y-1">
                                            {(bulkCancelResult.results || []).filter(r => !r.ok).map(r => (
                                                <p key={r.id} className="text-sm text-red-600">Đơn #{r.id}: {r.message}</p>
                                            ))}
                                        </div>
                                    )}
                                    {bulkCancelResult.message && <p className="text-sm text-red-600">{bulkCancelResult.message}</p>}
                                    <button onClick={() => setShowBulkCancelModal(false)} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">Đóng</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* List các đơn vừa in: khổ A thì mã vận đơn, khổ K80 thì ID đơn */}
            {printList && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" onClick={() => setPrintList(null)}>
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">
                                {printList.size === 'K80'
                                    ? `List ID đơn vừa in (khổ K80) — ${printList.items.length} đơn`
                                    : `List mã vận đơn vừa in (khổ A4/A5) — ${printList.items.length} đơn`}
                            </h3>
                            <button onClick={() => setPrintList(null)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-1.5">
                            {printList.items.map(item => (
                                <p key={item.id} className="text-sm text-slate-700 border-b border-slate-100 pb-1.5">
                                    {printList.size === 'K80' ? (
                                        <span className="font-bold text-slate-900">{item.id}</span>
                                    ) : item.carrier_code ? (
                                        <><span className="font-bold text-slate-900">{item.carrier_code}</span><span className="text-slate-400 text-xs"> · Đơn #{item.id}</span></>
                                    ) : (
                                        <><span className="text-slate-500">Đơn #{item.id} — chưa có mã vận đơn</span></>
                                    )}
                                </p>
                            ))}
                        </div>
                        <div className="px-5 py-4 border-t border-gray-200 flex gap-2">
                            <button onClick={handleCopyPrintList} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">{printCopied ? 'Đã sao chép' : 'Sao chép list'}</button>
                            <button onClick={() => setPrintList(null)} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

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
