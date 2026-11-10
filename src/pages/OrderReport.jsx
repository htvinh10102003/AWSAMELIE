import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logOrderPrint } from '../lib/presence';
import { useFeatureLocks, isSubLocked } from '../components/FeatureGuard';
import { Search, CheckCircle, AlertTriangle, XCircle, RefreshCw, MessageSquare, Lock, User, ChevronDown, Printer, ChevronLeft, ChevronRight, Copy, Send, Settings2, PackageSearch, Pencil, Save, Download } from 'lucide-react';

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
    '48': 'bg-black text-white border-slate-900 shadow-sm',
    '49': 'bg-blue-100 text-blue-700 border-blue-200',
    '50': 'bg-red-100 text-red-700 border-red-200',
    '51': 'bg-orange-100 text-orange-700 border-orange-200',
    '52': 'bg-green-100 text-green-700 border-green-200'
};

// Màu badge trạng thái theo mã Nhanh.vn (bảng màu Vinh chốt 2026-11-03).
// Khách/HVC/Hệ thống hủy: đen nhạt; Đang chuyển: xanh lá đậm;
// Đang chuyển hoàn (71): vàng nhạt; Xác nhận hoàn (74): cam nhạt; Đã chuyển hoàn (72): cam đậm;
// Đã đóng gói: slate; Đang đóng gói: xám; Chờ thu gom: hồng;
// Đơn mới: xanh dương; Thành công: xanh lá; Thất bại: tím.
const STATUS_COLORS = {
    '40': 'bg-slate-700 text-white shadow-sm',
    '42': 'bg-slate-500 text-white shadow-sm',
    '43': 'bg-pink-500 text-white shadow-sm',
    '54': 'bg-blue-600 text-white shadow-sm',
    '55': 'bg-sky-500 text-white shadow-sm',
    '56': 'bg-cyan-600 text-white shadow-sm',
    '57': 'bg-amber-100 text-amber-800 border border-amber-300',
    '58': 'bg-zinc-700 text-white shadow-sm',
    '59': 'bg-green-800 text-white shadow-sm',
    '60': 'bg-green-500 text-white shadow-sm',
    '61': 'bg-purple-600 text-white shadow-sm',
    '63': 'bg-zinc-700 text-white shadow-sm',
    '64': 'bg-zinc-700 text-white shadow-sm',
    '68': 'bg-red-100 text-red-700 border border-red-200',
    '71': 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    '72': 'bg-orange-500 text-white shadow-sm',
    '73': 'bg-slate-200 text-slate-700 border border-slate-300',
    '74': 'bg-orange-100 text-orange-800 border border-orange-200',
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

// Thứ tự trạng thái trong dropdown Sửa đơn: theo luồng xử lý đơn.
const EDIT_STATUS_ORDER = ['54', '55', '57', '56', '42', '40', '43', '59', '60', '61', '71', '74', '72', '68', '73', '58', '63', '64'];

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

// Đơn sàn đã có mã vận đơn thật (để in mã đơn sàn / phiếu gửi sàn):
// kênh Shopee (42) / TikTok Shop (48) / Lazada (41) + mã vận đơn thật.
// Hàm thuần (module-level) để test Node trích xuất được.
const isPrintableEcomOrder = (order) => {
    if (!['42', '48', '41'].includes(String(order?.sale_channel))) return false;
    return hasRealCarrier(order);
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
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white hover:bg-slate-50 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 transition-all text-left flex items-center justify-between shadow-sm">
                <span className={`truncate mr-2 ${selected.length === 0 ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>{selected.length === 0 ? placeholder : `Đã chọn ${selected.length}`}</span>
                <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
                        <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded border-slate-300 text-slate-700 focus:ring-slate-500" />
                        <span className="text-sm font-medium">Chọn tất cả</span>
                    </label>
                    {options.map(opt => {
                        const val = getValue(opt);
                        const label = getLabel(opt);
                        return (
                            <label key={val} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors">
                                <input type="checkbox" checked={selected.includes(val)} onChange={() => toggleOption(val)} className="rounded border-slate-300 text-slate-700 focus:ring-slate-500" />
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
    // Khóa cấp con trong trang (manager: print_orders) — đọc cùng key
    // feature_lock_print_orders, owner bypass.
    const printLocks = useFeatureLocks('print_orders');
    const printSubLocked = (id) => !printLocks.isOwner && isSubLocked(printLocks.subs, id);
    // Trạng thái được chọn ở Admin > Cấu hình Lọc & Ưu tiên Đơn In.
    const [printAllowedStatuses, setPrintAllowedStatuses] = useState(PRINT_ALLOWED_DEFAULT);

    // --- Báo cáo đặc biệt (chỉ owner; mặc định bật với owner, nút gạt
    // chuyển sang báo cáo cũ) ---
    const [specialMode, setSpecialMode] = useState(false);
    const [specialTab, setSpecialTab] = useState('all'); // all | confirm | print | transit
    // Phân trang thật phía server: tổng số load đúng bằng count query,
    // dữ liệu chỉ tải đúng số đơn của trang đang mở (theo số dòng đã
    // chọn), bấm sang trang nào
    // mới tải trang đó (không còn lazyload 1000 đơn + Tải thêm nữa).
    const [specialPage, setSpecialPage] = useState(1);
    const [specialPageSize, setSpecialPageSize] = useState(20);
    const [specialTotal, setSpecialTotal] = useState(0);
    const [specialPageOrders, setSpecialPageOrders] = useState([]);
    const [specialCounts, setSpecialCounts] = useState({});
    const [specialMissingTotal, setSpecialMissingTotal] = useState(null);
    const [specialReloadToken, setSpecialReloadToken] = useState(0);
    // Toàn bộ đơn khớp bộ lọc hiện tại (chỉ id + trường phục vụ copy):
    // đường tìm theo nhãn / tồn kho / khách / sản phẩm đã có sẵn danh
    // sách đầy đủ trong bộ nhớ nên lưu luôn; đường thường thì null và
    // chỉ tải lười khi bấm Copy (xem fetchNormalBranchCopyRows).
    const [specialAllCopyRows, setSpecialAllCopyRows] = useState(null);
    // Tập ID đơn đã xóa trên Nhanh (bảng deleted_orders): tải 1 lần khi
    // vào báo cáo đặc biệt. Bảng chưa có (chưa chạy migration) thì coi
    // như tập rỗng, không làm hỏng trang; lần vào sau sẽ thử tải lại.
    const [deletedOrderIds, setDeletedOrderIds] = useState(new Set());
    const [deletedIdsLoaded, setDeletedIdsLoaded] = useState(false);
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
    // Vị trí kho của từng sản phẩm trong popup (map: code:<mã> / name:<tên>
    // -> danh sách location_code, 1 sản phẩm có thể ở nhiều vị trí).
    const [productLocations, setProductLocations] = useState({});
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
    // Bảng chọn khổ in của popup chi tiết: mở từ nút "In đơn" trong menu
    // Thao tác, tự đóng khi popup chi tiết đóng hoặc khi mở panel thao tác.
    const [showDetailPrintChooser, setShowDetailPrintChooser] = useState(false);
    useEffect(() => {
        if (!detailOrder || detailAction) setShowDetailPrintChooser(false);
    }, [detailOrder, detailAction]);
    // Đơn mà popup thao tác đang nhắm tới: từ popup chi tiết thì là
    // detailOrder, từ bút chì trên dòng bảng thì là đơn của dòng đó.
    // Tách riêng để sửa nhanh không cần mở popup chi tiết trước.
    const [actionOrder, setActionOrder] = useState(null);
    const [detailActionLoading, setDetailActionLoading] = useState(false);
    const [detailActionMsg, setDetailActionMsg] = useState('');
    const [detailSendDone, setDetailSendDone] = useState(false);
    const [editDescription, setEditDescription] = useState('');
    const [editPrivateDescription, setEditPrivateDescription] = useState('');
    const [editStatus, setEditStatus] = useState('');
    // Ngày Nhanh yêu cầu khi đổi sang Thành công (60) / Đã hoàn (72),
    // gửi qua carrier.deliveryDate (yyyy-mm-dd).
    const [editDate, setEditDate] = useState('');
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
    // Bộ lọc tồn kho ở báo cáo đặc biệt, theo đúng nhóm của
    // wms-allocation đang hiển thị ở cột Tình trạng kho: Đủ hàng =
    // printable, Giữ hàng = holding (cột hiện "Tạm giữ"), Thiếu hàng =
    // outOfStock (cột hiện "Hết hàng"). Đơn nào không nằm trong
    // allocation (trạng thái ngoài 54/55/56/42/40, hoặc chưa phân bổ)
    // thì không khớp nhóm nào.
    const [selectedStock, setSelectedStock] = useState([]);
    const [specialAgingFilter, setSpecialAgingFilter] = useState(false);
    const STOCK_FILTER_OPTIONS = [
        { value: 'printable', label: 'Đủ hàng' },
        { value: 'holding', label: 'Giữ hàng' },
        { value: 'outOfStock', label: 'Thiếu hàng' },
    ];
    const [nhanhTagOptions, setNhanhTagOptions] = useState([]);
    const [nhanhTagOptionsLoaded, setNhanhTagOptionsLoaded] = useState(false);
    // Popup list sau khi bấm in: khổ A thì list mã vận đơn, khổ K80 thì
    // list ID đơn. Hiện ở mọi chỗ có thao tác in (toolbar, popup chi
    // tiết, panel sau khi gửi, modal kết quả gửi).
    const [printList, setPrintList] = useState(null); // { size, items: [{id, carrier_code}] }
    const [printCopied, setPrintCopied] = useState(false);
    // Lịch sử gửi sang hãng: 5 lần gần nhất, chỉ owner xem (để gửi xong
    // lỡ load lại trang vẫn mở ra check lại được).
    const [sendHistory, setSendHistory] = useState([]);
    const [sendHistoryLoading, setSendHistoryLoading] = useState(false);
    const [showSendHistoryModal, setShowSendHistoryModal] = useState(false);
    // Gửi / hủy hàng loạt từ nút Thao tác trên thanh công cụ.
    const [bulkSendResult, setBulkSendResult] = useState(null);
    const [showBulkSendModal, setShowBulkSendModal] = useState(false);
    // Gửi đơn sàn (Shopee/TikTok/Lazada) trong popup chi tiết.
    const [ecomPickupType, setEcomPickupType] = useState(1); // 1: hãng tới lấy, 2: gửi tại bưu cục
    const [ecomSending, setEcomSending] = useState(false);
    const [ecomMsg, setEcomMsg] = useState('');
    const [ecomTracking, setEcomTracking] = useState('');
    const [ecomLabelUrl, setEcomLabelUrl] = useState('');
    // Gửi đơn sàn hàng loạt từ nút Thao tác.
    const [showBulkEcomModal, setShowBulkEcomModal] = useState(false);
    const [bulkEcomPickupType, setBulkEcomPickupType] = useState(1);
    const [bulkEcomRunning, setBulkEcomRunning] = useState(false);
    const [bulkEcomResult, setBulkEcomResult] = useState(null);
    const [showBulkEcomResultModal, setShowBulkEcomResultModal] = useState(false);
    // Tiến trình gửi đơn sàn hàng loạt (gửi tuần tự từng đơn): done/total
    // + đơn đang gửi, và kết quả từng đơn append ngay khi xong.
    const [bulkEcomProgress, setBulkEcomProgress] = useState({ done: 0, total: 0, currentId: null });
    const [bulkEcomLiveResults, setBulkEcomLiveResults] = useState([]);
    const bulkEcomStopRef = useRef(false);
    // Gộp nhiều nhãn PDF sàn thành 1 file.
    const [mergingLabels, setMergingLabels] = useState(false);
    const [mergeLabelsMsg, setMergeLabelsMsg] = useState('');
    // In mã đơn sàn hàng loạt từ nút Thao tác: lấy nhãn PDF sàn của các
    // đơn sàn đã có mã vận đơn thật (không gửi lại, chỉ lấy nhãn qua
    // ecom/getprintlabel rồi gộp 1 file để in).
    const [showPrintLabelsModal, setShowPrintLabelsModal] = useState(false);
    const [printLabelsRunning, setPrintLabelsRunning] = useState(false);
    const [printLabelsResult, setPrintLabelsResult] = useState(null);
    // Tiến trình lấy nhãn hàng loạt (lấy tuần tự từng đơn): done/total
    // + đơn đang lấy, và kết quả từng đơn append ngay khi xong.
    const [printLabelsProgress, setPrintLabelsProgress] = useState({ done: 0, total: 0, currentId: null });
    const [printLabelsLiveResults, setPrintLabelsLiveResults] = useState([]);
    const printLabelsStopRef = useRef(false);
    // Đơn nào đang kéo lại nhãn (key = orderId) để disable đúng nút đó.
    const [relabelLoadingIds, setRelabelLoadingIds] = useState({});
    // Đồng bộ đơn đã xóa từ Nhanh (owner, trong khu vực báo cáo đặc biệt).
    const [syncDeletedLoading, setSyncDeletedLoading] = useState(false);
    const [syncDeletedMsg, setSyncDeletedMsg] = useState('');
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
    const [searchCustomer, setSearchCustomer] = useState('');
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
    const debouncedSearchCustomer = useDebouncedValue(searchCustomer, 400);
    
    // Action State
    const [isUpdatingWebhooks, setIsUpdatingWebhooks] = useState(false);
    const [updatingSelected, setUpdatingSelected] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [isUpdatingMissingCarrier, setIsUpdatingMissingCarrier] = useState(false);
    const [missingCarrierProgress, setMissingCarrierProgress] = useState(0);
    const [copyMessage, setCopyMessage] = useState('');
    const [copyLoading, setCopyLoading] = useState(false);
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
    // còn dữ liệu đơn chỉ tải đúng số đơn của trang đang mở (theo số
    // dòng đã chọn), bấm sang
    // trang nào mới tải trang đó. Bộ lọc dùng chung với báo cáo cũ được
    // đẩy xuống query server để tổng số và các trang khớp nhau.
    // Số dòng / trang do người dùng chọn (20 / 50 / 100 / 200), xem
    // specialPageSize ở trên.
    // Giới hạn số id đơn đã xóa đưa vào query .in() / .not() để URL
    // PostgREST không quá dài; vượt quá thì tab Đơn đã xóa / việc loại
    // đơn đã xóa khỏi các tab khác sẽ không đầy đủ.
    const DELETED_IDS_CAP = 1000;
    const SPECIAL_COLUMNS = 'id, created_at, updated_at, packed_at, status, carrier_name, carrier_code, carrier_date, printed_at, sale_channel, ecom_order_id, created_by_name, depot_id, description, private_description, traffic_source, tracking_url, is_declared_fee, order_products (product_code, product_name, quantity)';

    // Escape cho ilike: \ % _ là ký tự đặc biệt; dấu phẩy thì PostgREST
    // không biểu diễn được trong or() nên bỏ đi khỏi mẫu tìm.
    const escapeLike = (s) => String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '');
    // Tên + SĐT khách nằm trong raw_data (địa chỉ giao hàng của Nhanh),
    // không có cột riêng trong bảng orders: raw_data.data.shippingAddress
    // (dạng webhook) hoặc raw_data.shippingAddress (dạng đơn trực tiếp).
    const getShippingAddress = (order) => {
        let raw = order?.raw_data;
        if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return null; } }
        return raw?.data?.shippingAddress || raw?.shippingAddress || order?.shippingAddress || null;
    };
    const customerMatches = (order, term) => {
        const t = String(term || '').trim().toLowerCase();
        if (!t) return true;
        const addr = getShippingAddress(order);
        const name = String(addr?.name || order?.customer_name || '').toLowerCase();
        if (name && name.includes(t)) return true;
        const mobile = String(addr?.mobile || order?.customer_mobile || '');
        if (mobile.toLowerCase().includes(t)) return true;
        const digits = t.replace(/\D/g, '');
        if (digits.length >= 3) {
            const mobileDigits = mobile.replace(/\D/g, '');
            if (mobileDigits) {
                const variants = [digits];
                if (digits.startsWith('0')) variants.push('84' + digits.slice(1));
                if (digits.startsWith('84')) variants.push('0' + digits.slice(2));
                if (variants.some(v => mobileDigits.includes(v))) return true;
            }
        }
        return false;
    };
    // Tìm theo tên khách / SĐT ở báo cáo đặc biệt: phân trang thật phía
    // server nên không lọc các dòng của trang đang mở được — phải kéo id
    // khớp trước qua đường JSON của raw_data (giống đường tìm theo sản
    // phẩm), rồi mới tính tổng số + lấy trang từ tập id đó. Chỉ khớp
    // được đơn nào có raw_data mang shippingAddress; đơn đồng bộ chỉ
    // qua order/list mà không có raw_data thì không tìm thấy bằng cách này.
    const fetchCustomerOrderIds = async (term) => {
        const raw = String(term || '').trim();
        if (!raw) return [];
        const nameTerm = escapeLike(raw);
        const digits = raw.replace(/\D/g, '');
        const mobileTerms = new Set();
        if (digits.length >= 3) {
            mobileTerms.add(digits);
            if (digits.startsWith('0')) mobileTerms.add('84' + digits.slice(1));
            if (digits.startsWith('84')) mobileTerms.add('0' + digits.slice(2));
        }
        const orParts = [
            `raw_data->data->shippingAddress->>name.ilike.%${nameTerm}%`,
            `raw_data->shippingAddress->>name.ilike.%${nameTerm}%`,
            `raw_data->data->shippingAddress->>mobile.ilike.%${nameTerm}%`,
            `raw_data->shippingAddress->>mobile.ilike.%${nameTerm}%`,
        ];
        mobileTerms.forEach(d => {
            const e = escapeLike(d);
            orParts.push(`raw_data->data->shippingAddress->>mobile.ilike.%${e}%`, `raw_data->shippingAddress->>mobile.ilike.%${e}%`);
        });
        const ids = new Set();
        let offset = 0;
        for (let chunk = 0; chunk < 50; chunk++) {
            let q = supabase.from('orders').select('id')
                .gte('created_at', `${specialStartDate}T00:00:00.000Z`)
                .lte('created_at', `${specialEndDate}T23:59:59.999Z`)
                .or(orParts.join(','))
                .range(offset, offset + 999);
            const { data: rows, error } = await q;
            if (error) throw error;
            const list = rows || [];
            list.forEach(r => ids.add(String(r.id)));
            if (list.length < 1000) break;
            offset += 1000;
        }
        return [...ids];
    };
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
        // Đơn đã xóa: tab 'Đơn đã xóa' chỉ lấy đơn trong deleted_orders;
        // các tab khác loại đơn đã xóa ra (tab 'Tất cả' vì thế sẽ giảm
        // sau khi loại). tabId null là đường lọc theo id (nhãn / tồn kho
        // / khách / sản phẩm): không loại ở server mà lọc ở client sau,
        // để tab 'Đơn đã xóa' vẫn đếm được trong các đường đó.
        const deletedIds = [...deletedOrderIds].slice(0, DELETED_IDS_CAP).map(v => Number(v)).filter(n => !Number.isNaN(n));
        if (tabId === 'deleted') {
            if (deletedIds.length > 0) q = q.in('id', deletedIds);
            else q = q.eq('id', -1); // tập rỗng: không khớp đơn nào, khỏi lỗi .in([])
        } else if (tabId !== null && deletedOrderIds.size > 0 && deletedIds.length > 0) {
            q = q.not('id', 'in', `(${deletedIds.join(',')})`);
        }
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
            if (selectedTags.length > 0 || selectedStock.length > 0 || specialAgingFilter || debouncedSearchCustomer.trim()) {
                // Đường lọc theo id: nhãn và/hoặc tồn kho và/hoặc tên
                // khách / SĐT. Nhãn chỉ có trong bảng order_tags cho đơn
                // mới đồng bộ; tồn kho lấy từ wms-allocation đã tải (cùng
                // nguồn với cột Tình trạng kho); khách lấy qua raw_data.
                // Kéo id theo từng nguồn rồi giao nhau; nếu đồng thời tìm
                // theo sản phẩm thì giao tiếp với tập id tìm theo sản
                // phẩm, sau đó kéo trường phục vụ lọc tab cho các id đó
                // rồi tính tổng số + trang như đường tìm theo sản phẩm.
                let candidateIds = null;
                if (debouncedSearchCustomer.trim()) {
                    candidateIds = await fetchCustomerOrderIds(debouncedSearchCustomer);
                }
                if (selectedTags.length > 0) {
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
                    candidateIds = candidateIds === null ? [...tagIdSet] : candidateIds.filter(id => tagIdSet.has(id));
                }
                if (selectedStock.length > 0) {
                    const stockIds = new Set();
                    allocationStockById.forEach((stock, id) => {
                        if (selectedStock.includes(stock.group)) stockIds.add(String(id));
                    });
                    candidateIds = candidateIds === null ? [...stockIds] : candidateIds.filter(id => stockIds.has(id));
                }
                if (specialAgingFilter) {
                    // Đơn tồn >= 2 ngày: chỉ đơn đang ở nhóm đủ hàng
                    // (printable) của wms-allocation, tính đúng công thức
                    // như lọc báo cáo cũ (số ngày = floor((nay - ngày đủ
                    // hàng) / 86400000); thiếu ngày tính là 0 nên bị loại).
                    const agingIdSet = new Set();
                    (data.printable || []).forEach(o => {
                        const days = o.printable_date
                            ? Math.floor((new Date() - new Date(o.printable_date)) / (1000 * 60 * 60 * 24))
                            : 0;
                        if (days >= 2) agingIdSet.add(String(o.id));
                    });
                    candidateIds = candidateIds === null ? [...agingIdSet] : candidateIds.filter(id => agingIdSet.has(id));
                }
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
                        .select('id, status, carrier_name, carrier_code, created_at, sale_channel, ecom_order_id');
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
                // Đơn đã xóa loại khỏi các tab thường, chỉ hiện ở tab 'Đơn đã xóa'.
                const isDeletedTag = (o) => deletedOrderIds.has(String(o.id));
                const fieldRowsVisible = fieldRows.filter(o => !isDeletedTag(o));
                const countsTag = {
                    all: fieldRowsVisible.length,
                    confirm: fieldRowsVisible.filter(isConfirmTag).length,
                    print: fieldRowsVisible.filter(isPrintTag).length,
                    transit: fieldRowsVisible.filter(isTransitTag).length,
                    deleted: fieldRows.filter(isDeletedTag).length,
                };
                const missingTotalTag = fieldRowsVisible.filter(isMissingTag).length;
                const viewListTag = specialTab === 'deleted'
                    ? fieldRows.filter(isDeletedTag)
                    : specialOnlyMissingPrint
                    ? fieldRowsVisible.filter(isMissingTag)
                    : fieldRowsVisible.filter(o => specialTab === 'all' ? true : specialTab === 'confirm' ? isConfirmTag(o) : specialTab === 'print' ? isPrintTag(o) : isTransitTag(o));
                // Lưu toàn bộ danh sách khớp bộ lọc (không chỉ trang đang
                // mở) để nút Copy dùng khi không tick đơn nào.
                setSpecialAllCopyRows(viewListTag.map(o => ({ id: o.id, sale_channel: o.sale_channel, ecom_order_id: o.ecom_order_id, carrier_code: o.carrier_code, carrier_name: o.carrier_name })));
                const totalTag = viewListTag.length;
                const totalPagesTag = Math.max(1, Math.ceil(totalTag / specialPageSize));
                const effectivePageTag = totalTag > 0 ? Math.min(page, totalPagesTag) : 1;
                if (effectivePageTag !== page) setSpecialPage(effectivePageTag);
                const pageIdsTag = viewListTag.slice((effectivePageTag - 1) * specialPageSize, effectivePageTag * specialPageSize).map(o => o.id);
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
                // khử trùng, từ đó tính đúng tổng số các tab và lấy id
                // của trang đang mở (theo số dòng đã chọn), sau đó mới kéo
                // đủ dữ liệu các đơn đó.
                const pq = escapeLike(debouncedSearchProduct.trim());
                const matched = [];
                const seen = new Set();
                let offset = 0;
                for (let chunk = 0; chunk < 50; chunk++) {
                    let q = supabase.from('orders')
                        .select('id, status, carrier_name, carrier_code, sale_channel, ecom_order_id, order_products!inner(product_name, product_code)');
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
                // Đơn đã xóa loại khỏi các tab thường, chỉ hiện ở tab 'Đơn đã xóa'.
                const isDeleted = (o) => deletedOrderIds.has(String(o.id));
                const matchedVisible = matched.filter(o => !isDeleted(o));
                const counts = {
                    all: matchedVisible.length,
                    confirm: matchedVisible.filter(isConfirm).length,
                    print: matchedVisible.filter(isPrint).length,
                    transit: matchedVisible.filter(isTransit).length,
                    deleted: matched.filter(isDeleted).length,
                };
                const missingTotal = matchedVisible.filter(isMissing).length;
                const viewList = specialTab === 'deleted'
                    ? matched.filter(isDeleted)
                    : specialOnlyMissingPrint
                    ? matchedVisible.filter(isMissing)
                    : matchedVisible.filter(o => specialTab === 'all' ? true : specialTab === 'confirm' ? isConfirm(o) : specialTab === 'print' ? isPrint(o) : isTransit(o));
                // Lưu toàn bộ danh sách khớp bộ lọc (không chỉ trang đang
                // mở) để nút Copy dùng khi không tick đơn nào.
                setSpecialAllCopyRows(viewList.map(o => ({ id: o.id, sale_channel: o.sale_channel, ecom_order_id: o.ecom_order_id, carrier_code: o.carrier_code, carrier_name: o.carrier_name })));
                const total = viewList.length;
                const totalPages = Math.max(1, Math.ceil(total / specialPageSize));
                const effectivePage = total > 0 ? Math.min(page, totalPages) : 1;
                if (effectivePage !== page) setSpecialPage(effectivePage);
                const pageIds = viewList.slice((effectivePage - 1) * specialPageSize, effectivePage * specialPageSize).map(o => o.id);
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
            // 1 query lấy đúng số đơn của trang (theo số dòng đã chọn).
            // Khi ở tab print thì đếm
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
            // Số tab 'Đơn đã xóa' chỉ cần khi đang xem tab đó (badge của
            // tab lấy thẳng cỡ tập deletedOrderIds, xem specialTabCount).
            const cDeleted = specialTab === 'deleted' ? await countFor('deleted', false) : 0;
            const counts = { all: cAll, confirm: cConfirm, print: cPrint, transit: cTransit, deleted: cDeleted };
            const missingTotal = specialTab === 'print' ? await countFor('print', true) : null;
            const total = specialOnlyMissingPrint ? (missingTotal || 0) : counts[specialTab];
            const totalPages = Math.max(1, Math.ceil(total / specialPageSize));
            const effectivePage = total > 0 ? Math.min(page, totalPages) : 1;
            if (effectivePage !== page) setSpecialPage(effectivePage);
            let rows = [];
            if (total > 0) {
                let q = supabase.from('orders').select(SPECIAL_COLUMNS);
                q = applySpecialFilters(q, { tabId: specialTab, missingOnly: specialOnlyMissingPrint });
                q = orderBy(q).range((effectivePage - 1) * specialPageSize, effectivePage * specialPageSize - 1);
                const { data, error } = await q;
                if (error) throw error;
                rows = data || [];
            }
            setSpecialCounts(counts);
            setSpecialMissingTotal(missingTotal);
            setSpecialTotal(total);
            setSpecialPageOrders(rows);
            // Đường thường không giữ danh sách đầy đủ trong bộ nhớ — nút
            // Copy sẽ tải lười toàn bộ id theo bộ lọc khi bấm (xem
            // fetchNormalBranchCopyRows trong executeCopy).
            setSpecialAllCopyRows(null);
        } catch (err) {
            console.error('Lỗi tải báo cáo đặc biệt:', err);
            setSpecialError(err.message || 'Không tải được đơn từ bảng orders.');
        } finally {
            setSpecialLoading(false);
        }
    };

    // Đổi tab / ngày / bộ lọc / sắp xếp thì quay về trang 1 rồi mới tải,
    // để khỏi tải nhầm trang cũ với bộ lọc mới.
    const specialFilterSig = [specialTab, specialStartDate, specialEndDate, debouncedSearchId, debouncedSearchProduct, debouncedSearchNote, debouncedSearchCustomer, selectedStatus.join(','), selectedCarrier.join(','), selectedChannel.join(','), selectedCreator.join(','), selectedDepot.join(','), selectedTags.join(','), selectedStock.join(','), printedFilter, missingCarrierFilter ? '1' : '0', specialSortOrder, specialOnlyMissingPrint ? '1' : '0', specialAgingFilter ? '1' : '0', deletedOrderIds.size, specialPageSize].join('|');
    useEffect(() => {
        if (!specialMode) return;
        if (specialFilterSigRef.current !== specialFilterSig) {
            specialFilterSigRef.current = specialFilterSig;
            if (specialPage !== 1) { setSpecialPage(1); return; }
        }
        fetchSpecialData(specialPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [specialMode, specialTab, specialStartDate, specialEndDate, debouncedSearchId, debouncedSearchProduct, debouncedSearchNote, debouncedSearchCustomer, selectedStatus, selectedCarrier, selectedChannel, selectedCreator, selectedDepot, selectedTags, selectedStock, printedFilter, missingCarrierFilter, specialSortOrder, specialOnlyMissingPrint, specialAgingFilter, specialPage, specialPageSize, specialReloadToken, deletedOrderIds, data]);

    // Đổi trang / đổi số dòng trên trang thì bỏ chọn cũ (các đơn đã tick
    // chỉ thuộc trang cũ; nút Xuất vẫn tính trên trang mới, còn nút Copy
    // khi không tick thì tính trên toàn bộ bộ lọc).
    useEffect(() => {
        if (specialMode) setSelectedOrders([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [specialPage, specialPageSize]);

    const handleToggleSpecialMode = () => {
        const next = !specialMode;
        setSpecialMode(next);
        setSelectedOrders([]);
        setCurrentPage(1);
        setSpecialTab('all');
        setSpecialOnlyMissingPrint(false);
        setDetailOrder(null);
        setDetailAction(null);
        setActionOrder(null);
    };

    const openOrderDetail = async (order) => {
        setDetailOrder(order);
        setDetailData(null);
        setDetailLoading(true);
        setProductLocations({});
        setShowRawJson(false);
        setDetailHistory([]);
        setDetailHistoryLoading(true);
        setShowDetailActionMenu(false);
        setDetailAction(null);
        setActionOrder(null);
        setDetailActionMsg('');
        setDetailSendDone(false);
        setEcomPickupType(1);
        setEcomSending(false);
        setEcomMsg('');
        setEcomTracking('');
        setEcomLabelUrl('');
        setNhanhHistory([]);
        setNhanhHistoryLoaded(false);
        setNhanhHistoryMsg('');
        try {
            // Lấy toàn bộ cột của đơn trong bảng orders. Nếu bảng có cột
            // chứa JSON gốc của Nhanh (ví dụ raw_data / data / payload),
            // select('*') sẽ lấy được nó và popup sẽ dùng nó làm nguồn chính.
            // Nếu không có cột đó, popup dùng các trường đã làm phẳng.
            const { data: full, error } = await supabase.from('orders').select('*, order_products(product_code, product_name, quantity)').eq('id', order.id).single();
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
        // Lấy vị trí kho cho các sản phẩm trong đơn (hiện dưới mỗi SP
        // trong popup). Khớp mã kho trước (product_code trong kho lấy
        // từ chính mã Nhanh), không khớp thì khớp tên chính xác.
        try {
            const rowProds = order.order_products || [];
            if (rowProds.length > 0) {
                const codes = [...new Set(rowProds.map(p => p.product_code).filter(Boolean).map(String))];
                const names = [...new Set(rowProds.map(p => p.product_name).filter(Boolean))];
                const locMap = {};
                const addLoc = (key, loc) => {
                    if (!loc) return;
                    if (!locMap[key]) locMap[key] = [];
                    if (!locMap[key].includes(loc)) locMap[key].push(loc);
                };
                if (codes.length > 0) {
                    const { data: byCode } = await supabase.from('product_inventories').select('product_code, location_code').in('product_code', codes);
                    (byCode || []).forEach(r => addLoc(`code:${r.product_code}`, r.location_code));
                }
                if (names.length > 0) {
                    const { data: byName } = await supabase.from('product_inventories').select('product_name, location_code').in('product_name', names);
                    (byName || []).forEach(r => addLoc(`name:${r.product_name}`, r.location_code));
                }
                setProductLocations(locMap);
            }
        } catch (err) {
            console.error('Lỗi tải vị trí sản phẩm:', err);
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
    const callNhanhOrderAction = async (action, body = {}, orderIdOverride) => {
        const orderId = orderIdOverride || actionOrder?.id || detailOrder?.id;
        if (!orderId) return { success: false, message: 'Chưa chọn đơn hàng nào.' };
        return callNhanhActionRaw(action, { orderId, ...body });
    };
    // Vá lại dòng đơn đang hiển thị trong popup sau khi Nhanh nhận thao
    // tác (bảng orders trong Supabase chỉ đồng bộ lại ở lần kéo đơn sau,
    // nên popup tự cập nhật trước để owner thấy kết quả ngay).
    const patchDetailRow = (patch) => {
        setDetailOrder(prev => prev ? { ...prev, ...patch } : prev);
        setDetailData(prev => prev ? { ...prev, ...patch } : prev);
    };
    // Vá 1 đơn ở mọi nơi đang hiển thị nó (dòng bảng đặc biệt, các nhóm
    // của báo cáo cũ, popup chi tiết). Không gọi lại reload từ bảng
    // orders sau khi sửa trên Nhanh, vì bảng đó chỉ đổi ở lần đồng bộ
    // Nhanh sau — reload ngay sẽ lật lại giá trị cũ vừa sửa.
    const patchOrderEverywhere = (id, patch) => {
        const sid = String(id);
        setSpecialPageOrders(prev => prev.map(o => String(o.id) === sid ? { ...o, ...patch } : o));
        setData(prev => {
            const patchList = (list) => (list || []).map(o => String(o.id) === sid ? { ...o, ...patch } : o);
            return { ...prev, printable: patchList(prev.printable), holding: patchList(prev.holding), outOfStock: patchList(prev.outOfStock) };
        });
        setDetailOrder(prev => prev && String(prev.id) === sid ? { ...prev, ...patch } : prev);
        setDetailData(prev => prev && String(prev.id) === sid ? { ...prev, ...patch } : prev);
    };
    const openDetailAction = (kind) => {
        if (!detailOrder) return;
        setShowDetailActionMenu(false);
        setDetailActionMsg('');
        if (kind === 'edit') {
            setEditDescription(stripHtml(detailOrder.description || ''));
            setEditPrivateDescription(stripHtml(detailOrder.private_description || ''));
        }
        if (kind === 'status') {
            setEditStatus('');
            setEditDate('');
        }
        if (kind === 'cancel') setCancelReason('');
        if (kind === 'send') setDetailSendDone(false);
        setActionOrder(detailOrder);
        setDetailAction(kind);
    };
    // Sửa nhanh từ dòng bảng, không cần mở popup chi tiết: mở cùng
    // popup thao tác nhưng nhắm thẳng vào đơn của dòng đó.
    const openQuickAction = (kind, order) => {
        if (!order) return;
        setDetailActionMsg('');
        if (kind === 'edit') {
            setEditDescription(stripHtml(order.description || ''));
            setEditPrivateDescription(stripHtml(order.private_description || ''));
        }
        if (kind === 'status') {
            setEditStatus('');
            setEditDate('');
        }
        setActionOrder(order);
        setDetailAction(kind);
    };
    const closeActionModal = () => {
        if (detailActionLoading) return;
        setDetailAction(null);
        setActionOrder(null);
    };
    const handleSaveEdit = async () => {
        if (!actionOrder) { setDetailActionMsg('Chưa chọn đơn hàng nào.'); return; }
        const body = {};
        if (editDescription !== stripHtml(actionOrder?.description || '')) body.description = editDescription;
        if (editPrivateDescription !== stripHtml(actionOrder?.private_description || '')) body.privateDescription = editPrivateDescription;
        if (Object.keys(body).length === 0) {
            setDetailActionMsg('Chưa thay đổi thông tin nào.');
            return;
        }
        setDetailActionLoading(true);
        setDetailActionMsg('');
        try {
            const result = await callNhanhOrderAction('edit', body, actionOrder.id);
            if (result.success) {
                const patch = {};
                if (body.description !== undefined) patch.description = body.description;
                if (body.privateDescription !== undefined) patch.private_description = body.privateDescription;
                patchOrderEverywhere(actionOrder.id, patch);
                setDetailActionMsg('Đã lưu thay đổi lên Nhanh.vn.');
            } else setDetailActionMsg(result.message || 'Nhanh.vn từ chối lưu thay đổi.');
        } catch (err) {
            setDetailActionMsg(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setDetailActionLoading(false);
        }
    };
    // Đổi trạng thái riêng (tách khỏi Sửa đơn): chỉ gửi status (+ ngày
    // khi sang 60/72, Nhanh yêu cầu ngày cho 2 trạng thái này).
    const handleSaveStatus = async () => {
        if (!actionOrder) { setDetailActionMsg('Chưa chọn đơn hàng nào.'); return; }
        if (!editStatus) {
            setDetailActionMsg('Chọn 1 trạng thái trong danh sách.');
            return;
        }
        if ((editStatus === '60' || editStatus === '72') && !editDate) {
            setDetailActionMsg(`Chọn ${editStatus === '60' ? 'ngày giao thành công' : 'ngày hoàn hàng'} vì Nhanh yêu cầu ngày khi đổi sang trạng thái này.`);
            return;
        }
        const body = { status: Number(editStatus) };
        if (editStatus === '60' || editStatus === '72') body.deliveryDate = editDate;
        setDetailActionLoading(true);
        setDetailActionMsg('');
        try {
            const result = await callNhanhOrderAction('edit', body, actionOrder.id);
            if (result.success) {
                patchOrderEverywhere(actionOrder.id, { status: body.status });
                setDetailActionMsg('Đã đổi trạng thái trên Nhanh.vn.');
            } else setDetailActionMsg(result.message || 'Nhanh.vn từ chối đổi trạng thái.');
        } catch (err) {
            setDetailActionMsg(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setDetailActionLoading(false);
        }
    };
    // Gửi 1 đơn trong popup: kết quả nằm ở results[0].
    const handleSendShip = async () => {
        if (!actionOrder) { setDetailActionMsg('Chưa chọn đơn hàng nào.'); return; }
        setDetailActionLoading(true);
        setDetailActionMsg('');
        try {
            const result = await callNhanhOrderAction('send', { source: 'popup' }, actionOrder.id);
            const first = result.results?.[0];
            if (first?.ok) {
                if (first.carrierCode) patchOrderEverywhere(actionOrder.id, { carrier_code: first.carrierCode });
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
    // Gửi 1 đơn sàn trong popup chi tiết: ecom/readytoship rồi lấy URL
    // nhãn PDF. Đơn vẫn tính thành công nếu lấy nhãn lỗi (đã có mã vận
    // đơn), chỉ báo lại để owner in nhãn sau. Không chạm luồng gửi kênh
    // Admin (handleSendShip) bên trên.
    const handleSendEcom = async () => {
        if (!detailOrder) return;
        setEcomSending(true);
        setEcomMsg('');
        setEcomTracking('');
        setEcomLabelUrl('');
        try {
            const result = await callNhanhActionRaw('ecomReadyToShip', { orderIds: [detailOrder.id], orderPickupType: ecomPickupType, source: 'detail' });
            const first = result.results?.[0];
            if (first?.ok) {
                if (first.trackingNumber) patchOrderEverywhere(detailOrder.id, { carrier_code: first.trackingNumber });
                setEcomTracking(first.trackingNumber || '');
                if (first.labelUrl) setEcomLabelUrl(first.labelUrl);
                let msg = first.existed
                    ? `Đơn đã gửi sàn từ trước, mã vận đơn: ${first.trackingNumber || 'không rõ'}.`
                    : `Đã gửi đơn sàn, mã vận đơn: ${first.trackingNumber || 'không rõ'}.`;
                if (!first.labelUrl) msg += first.labelError ? ` Không lấy được nhãn PDF: ${first.labelError}` : ' Không lấy được nhãn PDF của đơn này.';
                setEcomMsg(msg);
            } else setEcomMsg(first?.error || result.message || 'Nhanh.vn từ chối gửi đơn sàn.');
        } catch (err) {
            setEcomMsg(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setEcomSending(false);
        }
    };
    // Hủy 1 đơn trong popup.
    const handleCancelShip = async () => {
        if (!actionOrder) { setDetailActionMsg('Chưa chọn đơn hàng nào.'); return; }
        setDetailActionLoading(true);
        setDetailActionMsg('');
        try {
            const result = await callNhanhOrderAction('cancel', cancelReason ? { cancelReason } : {}, actionOrder.id);
            const first = result.results?.[0];
            if (first?.ok) {
                if (first.status) patchOrderEverywhere(actionOrder.id, { status: first.status });
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
    // Tải tập ID đơn đã xóa (bảng deleted_orders, phân trang 1000/trang).
    // Bảng chưa có (chưa chạy migration) thì bắt lỗi và coi như tập rỗng,
    // không làm hỏng trang.
    const loadDeletedOrderIds = async () => {
        try {
            const ids = new Set();
            let offset = 0;
            for (let chunk = 0; chunk < 50; chunk++) {
                const { data: rows, error } = await supabase.from('deleted_orders').select('order_id').range(offset, offset + 999);
                if (error) throw error;
                const list = rows || [];
                list.forEach(r => { if (r.order_id !== null && r.order_id !== undefined) ids.add(String(r.order_id)); });
                if (list.length < 1000) break;
                offset += 1000;
            }
            setDeletedOrderIds(ids);
            setDeletedIdsLoaded(true);
        } catch (err) {
            console.error('Không tải được deleted_orders (có thể chưa chạy migration):', err);
            setDeletedOrderIds(new Set());
        }
    };
    // Vào báo cáo đặc biệt lần đầu thì tải tập đơn đã xóa; tải lỗi (chưa
    // có bảng) thì lần vào sau thử lại.
    useEffect(() => {
        if (!specialMode || deletedIdsLoaded) return;
        loadDeletedOrderIds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [specialMode]);
    // Đồng bộ đơn đã xóa từ Nhanh về bảng deleted_orders (owner), rồi tải
    // lại tập id và làm mới danh sách.
    const handleSyncDeleted = async () => {
        setSyncDeletedLoading(true);
        setSyncDeletedMsg('');
        try {
            const result = await callNhanhActionRaw('syncDeleted');
            if (result.success) {
                await loadDeletedOrderIds();
                setSpecialReloadToken(t => t + 1);
                setSyncDeletedMsg(`Đã đồng bộ ${result.synced || 0} đơn đã xóa từ Nhanh.vn (${result.pages || 0} trang).`);
                setTimeout(() => setSyncDeletedMsg(''), 10000);
            } else setSyncDeletedMsg(result.message || 'Không đồng bộ được đơn đã xóa.');
        } catch (err) {
            setSyncDeletedMsg(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setSyncDeletedLoading(false);
        }
    };
    // Tải lại lịch sử gửi (tách riêng để nút "Kéo lại nhãn" trong lịch
    // sử dùng lại được sau khi edge đã vá labelUrl vào send_history).
    const loadSendHistory = async () => {
        setSendHistoryLoading(true);
        try {
            const result = await callNhanhActionRaw('sendHistory');
            if (result.success) setSendHistory(result.data || []);
            else setCopyMessage(result.message || 'Không tải được lịch sử gửi.');
        } catch (err) {
            setCopyMessage(`Lỗi hệ thống: ${err.message}`);
        } finally {
            setSendHistoryLoading(false);
            setTimeout(() => setCopyMessage(''), 5000);
        }
    };
    const handleOpenSendHistory = async () => {
        setShowSendHistoryModal(true);
        await loadSendHistory();
    };
    // Gộp nhiều nhãn PDF sàn thành 1 file PDF rồi MỞ TRONG TAB MỚI để
    // in (giống nút "In phiếu" từng đơn), không tải về máy. Edge trả về
    // BINARY PDF (không phải JSON) nên gọi bằng raw fetch, không dùng
    // callNhanhActionRaw. Mở tab trắng ngay lúc bấm (đồng bộ) để trình
    // duyệt không chặn popup, rồi mới fetch và trỏ tab sang blob URL;
    // nếu tab bị chặn thì dự phòng bằng cách tải file về máy.
    const downloadMergedLabels = async (labelUrls) => {
        const urls = (labelUrls || []).filter(Boolean);
        if (urls.length === 0) return;
        const printTab = window.open('', '_blank');
        setMergingLabels(true);
        setMergeLabelsMsg('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nhanh-order-actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
                body: JSON.stringify({ action: 'ecomMergeLabels', labelUrls: urls }),
            });
            if (!res.ok) {
                let msg = 'Không gộp được phiếu gửi.';
                try { const j = await res.json(); if (j?.message) msg = j.message; } catch (e) { /* giữ msg mặc định */ }
                throw new Error(msg);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            if (printTab) {
                printTab.location.href = url;
                // Thu hồi blob URL sau 5 phút; tab đã tải xong vào bộ nhớ.
                setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
            } else {
                // Tab bị trình duyệt chặn: dự phòng tải file về máy.
                // Tên file theo giờ VN cộng tay UTC+7, không dùng Intl
                // với timezone.
                const now = new Date(Date.now() + 7 * 3600 * 1000);
                const pad2 = (n) => String(n).padStart(2, '0');
                const fname = `phieu-gui-san-${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}-${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}.pdf`;
                const a = document.createElement('a');
                a.href = url;
                a.download = fname;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            // Gộp lỗi thì đóng tab trắng vừa mở (nếu có) để khỏi để tab trống.
            if (printTab) { try { printTab.close(); } catch (e) { /* bỏ qua */ } }
            const msg = err.message || 'Không gộp được phiếu gửi.';
            setMergeLabelsMsg(msg);
            setCopyMessage(msg);
            setTimeout(() => setCopyMessage(''), 5000);
            throw err;
        } finally {
            setMergingLabels(false);
        }
    };
    // Lấy lại URL nhãn PDF của 1 đơn sàn đã gửi xong (edge tự vá
    // labelUrl vào dòng send_history gần nhất chứa đơn đó).
    const fetchEcomLabel = async (orderId) => {
        const result = await callNhanhActionRaw('ecomGetLabel', { orderId });
        if (result?.success && result.labelUrl) return result.labelUrl;
        throw new Error(result?.message || 'Không lấy được nhãn PDF của đơn này.');
    };
    // Lấy nhãn PDF sàn cho 1 đơn, thử lại 1 lần sau 2s nếu lỗi (nhãn Nhanh
    // đôi khi chưa sẵn ngay sau khi gửi — lỗi RACE đã gặp ở
    // ecomReadyToShip). Chỉ dùng cho luồng in mã đơn sàn hàng loạt; nút
    // "Kéo lại nhãn" từng đơn vẫn gọi fetchEcomLabel 1 lần như cũ.
    const fetchEcomLabelWithRetry = async (orderId) => {
        try {
            return await fetchEcomLabel(orderId);
        } catch (err) {
            await new Promise((r) => setTimeout(r, 2000));
            return await fetchEcomLabel(orderId);
        }
    };
    // Kéo lại nhãn cho 1 đơn trong modal kết quả bulk: vá labelUrl vào
    // cả bulkEcomLiveResults lẫn bulkEcomResult để hiện nút In phiếu;
    // lỗi thì ghi labelError vào đúng dòng đó để hiện câu lỗi.
    const handleRelabelBulk = async (orderId) => {
        const sid = String(orderId);
        setRelabelLoadingIds(prev => ({ ...prev, [sid]: true }));
        try {
            const labelUrl = await fetchEcomLabel(orderId);
            const patchOk = (list) => (list || []).map(r => String(r.orderId) === sid ? { ...r, labelUrl, labelError: '' } : r);
            setBulkEcomLiveResults(prev => patchOk(prev));
            setBulkEcomResult(prev => prev ? { ...prev, results: patchOk(prev.results) } : prev);
        } catch (err) {
            const msg = err.message || 'Không lấy được nhãn PDF của đơn này.';
            const patchErr = (list) => (list || []).map(r => String(r.orderId) === sid ? { ...r, labelError: msg } : r);
            setBulkEcomLiveResults(prev => patchErr(prev));
            setBulkEcomResult(prev => prev ? { ...prev, results: patchErr(prev.results) } : prev);
        } finally {
            setRelabelLoadingIds(prev => ({ ...prev, [sid]: false }));
        }
    };
    // Kéo lại nhãn cho 1 đơn trong modal in mã đơn sàn: vá labelUrl vào
    // cả printLabelsLiveResults lẫn printLabelsResult để hiện nút In phiếu;
    // lỗi thì ghi labelError vào đúng dòng đó để hiện câu lỗi.
    const handleRelabelPrintLabels = async (orderId) => {
        const sid = String(orderId);
        setRelabelLoadingIds(prev => ({ ...prev, [sid]: true }));
        try {
            const labelUrl = await fetchEcomLabel(orderId);
            const patchOk = (list) => (list || []).map(r => String(r.orderId) === sid ? { ...r, labelUrl, labelError: '' } : r);
            setPrintLabelsLiveResults(prev => patchOk(prev));
            setPrintLabelsResult(prev => prev ? { ...prev, results: patchOk(prev.results) } : prev);
        } catch (err) {
            const msg = err.message || 'Không lấy được nhãn PDF của đơn này.';
            const patchErr = (list) => (list || []).map(r => String(r.orderId) === sid ? { ...r, labelError: msg } : r);
            setPrintLabelsLiveResults(prev => patchErr(prev));
            setPrintLabelsResult(prev => prev ? { ...prev, results: patchErr(prev.results) } : prev);
        } finally {
            setRelabelLoadingIds(prev => ({ ...prev, [sid]: false }));
        }
    };
    // Kéo lại nhãn cho 1 đơn trong lịch sử: thành công thì tải lại danh
    // sách lịch sử (edge đã vá labelUrl vào send_history); lỗi thì ghi
    // labelError vào đúng dòng đó để hiện câu lỗi.
    const handleRelabelHistory = async (orderId) => {
        const sid = String(orderId);
        setRelabelLoadingIds(prev => ({ ...prev, [sid]: true }));
        try {
            const labelUrl = await fetchEcomLabel(orderId);
            setSendHistory(prev => prev.map(entry => ({
                ...entry,
                items: (entry.items || []).map(it => String(it.orderId) === sid ? { ...it, labelUrl, labelError: '' } : it),
            })));
            await loadSendHistory();
        } catch (err) {
            const msg = err.message || 'Không lấy được nhãn PDF của đơn này.';
            setSendHistory(prev => prev.map(entry => ({
                ...entry,
                items: (entry.items || []).map(it => String(it.orderId) === sid ? { ...it, labelError: msg } : it),
            })));
        } finally {
            setRelabelLoadingIds(prev => ({ ...prev, [sid]: false }));
        }
    };
    // Kéo lại nhãn cho đơn sàn trong popup chi tiết: thành công thì
    // setEcomLabelUrl để hiện nút In phiếu; lỗi thì hiện câu lỗi vào
    // ecomMsg.
    const handleRelabelDetail = async () => {
        if (!detailOrder) return;
        const sid = String(detailOrder.id);
        setRelabelLoadingIds(prev => ({ ...prev, [sid]: true }));
        try {
            const labelUrl = await fetchEcomLabel(detailOrder.id);
            setEcomLabelUrl(labelUrl);
            setEcomMsg('Đã lấy lại được nhãn PDF của đơn này, bấm In phiếu gửi để in.');
        } catch (err) {
            setEcomMsg(err.message || 'Không lấy được nhãn PDF của đơn này.');
        } finally {
            setRelabelLoadingIds(prev => ({ ...prev, [sid]: false }));
        }
    };
    // 1 dòng kết quả đơn sàn, dùng chung cho modal kết quả bulk và mục
    // ecom trong lịch sử: "Đơn #id: mã vận đơn ... · [In phiếu] /
    // [Kéo lại nhãn] / câu lỗi". trackingNumber null vẫn tính là đã
    // gửi xong (chỉ hiện 'chưa có'), không phụ thuộc vào nó.
    const renderEcomResultRow = (r, onRelabel) => {
        const oid = r.orderId ?? r.id;
        const loading = !!relabelLoadingIds[String(oid)];
        if (!r.ok) {
            return (
                <p key={oid} className="text-sm text-red-600">Đơn #{oid}: {r.error || r.labelError || r.message || 'Gửi thất bại.'}</p>
            );
        }
        return (
            <p key={oid} className="text-sm text-slate-600">Đơn #{oid}: mã vận đơn <span className="font-mono font-bold text-slate-800">{r.trackingNumber || 'chưa có'}</span>{r.existed ? ' (đã gửi từ trước)' : ''}{r.labelUrl ? (<> · <button onClick={() => window.open(r.labelUrl, '_blank')} className="font-bold text-blue-700 hover:underline">In phiếu</button></>) : (<> · <span className="text-slate-400">không lấy được nhãn</span> · <button onClick={() => onRelabel?.(oid)} disabled={loading} className="font-bold text-blue-700 hover:underline disabled:opacity-50">{loading ? 'Đang lấy nhãn...' : 'Kéo lại nhãn'}</button></>)}{r.labelError ? (<span className="text-red-600"> · {r.labelError}</span>) : null}</p>
        );
    };
    // Lịch sử gửi: dòng gọn cho 1 đơn sàn — chỉ ID + nút in lại (hoặc
    // kéo lại nhãn khi chưa lấy được nhãn). Đơn gửi lỗi chỉ hiện ID mờ,
    // không kèm lỗi (chi tiết lỗi đã hiện ở popup kết quả lúc gửi).
    const renderEcomHistoryRow = (r, onRelabel) => {
        const oid = r.orderId ?? r.id;
        const loading = !!relabelLoadingIds[String(oid)];
        if (!r.ok) {
            return (
                <div key={oid} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-sm font-mono text-slate-400">#{oid}</span>
                    <span className="text-xs text-slate-400">gửi lỗi</span>
                </div>
            );
        }
        return (
            <div key={oid} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-sm font-mono font-bold text-slate-800">#{oid}</span>
                {r.labelUrl ? (
                    <button onClick={() => window.open(r.labelUrl, '_blank')} className="px-2.5 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1 shrink-0"><Printer size={12} /> In lại</button>
                ) : (
                    <button onClick={() => onRelabel?.(oid)} disabled={loading} className="px-2.5 py-1 bg-white border border-slate-300 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 shrink-0"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {loading ? 'Đang lấy nhãn...' : 'Kéo lại nhãn'}</button>
                )}
            </div>
        );
    };
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
            const result = await callNhanhActionRaw('send', { orderIds: adminIds, skippedIds, source: 'toolbar' });
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
    // Gửi đơn sàn hàng loạt từ nút Thao tác: chỉ gửi đơn sàn trong list
    // đã tick, các đơn khác bỏ qua và báo rõ trong popup kết quả (giống
    // gửi sang hãng). Mã vận đơn vá thẳng vào bảng hiển thị qua
    // patchOrderEverywhere, không bump specialReloadToken để khỏi tải lại
    // từ bảng orders và lật lại mã cũ (bảng chỉ đổi ở lần đồng bộ sau).
    const openBulkEcom = () => {
        if (selectedMarketplaceIds.length === 0) return;
        setBulkEcomResult(null);
        setBulkEcomLiveResults([]);
        setBulkEcomProgress({ done: 0, total: 0, currentId: null });
        bulkEcomStopRef.current = false;
        setMergeLabelsMsg('');
        setBulkEcomPickupType(1);
        setShowActionMenu(false);
        setShowBulkEcomModal(true);
    };
    // Gửi đơn sàn hàng loạt: gọi ecomReadyToShip TUẦN TỰ từng đơn (1
    // đơn/cuộc gọi, edge tự ghi 1 dòng send_history riêng cho mỗi đơn).
    // Modal kết quả mở ngay khi bắt đầu gửi; sau mỗi đơn xong thì cập
    // nhật tiến trình + append kết quả đơn đó vào bulkEcomLiveResults để
    // hiện ngay trong modal. Nút Dừng chỉ dừng sau khi đơn hiện tại
    // xong, giữ lại kết quả đã xong và hiện tổng kết như bình thường.
    const handleBulkEcom = async () => {
        if (selectedMarketplaceIds.length === 0 || bulkEcomRunning) return;
        const ids = [...selectedMarketplaceIds];
        const skippedIds = selectedOrders.filter(id => !selectedMarketplaceIds.some(a => String(a) === String(id)));
        setShowBulkEcomModal(false);
        bulkEcomStopRef.current = false;
        setBulkEcomLiveResults([]);
        setBulkEcomResult({ success: true, results: [], okCount: 0, failCount: 0, skippedIds });
        setBulkEcomProgress({ done: 0, total: ids.length, currentId: ids[0] ?? null });
        setMergeLabelsMsg('');
        setBulkEcomRunning(true);
        setShowBulkEcomResultModal(true);
        const live = [];
        try {
            for (let i = 0; i < ids.length; i++) {
                if (bulkEcomStopRef.current) break;
                const orderId = ids[i];
                setBulkEcomProgress({ done: i, total: ids.length, currentId: orderId });
                let one;
                try {
                    const result = await callNhanhActionRaw('ecomReadyToShip', { orderIds: [orderId], orderPickupType: bulkEcomPickupType, source: 'toolbar' });
                    one = result.results?.[0] || { orderId, ok: false, error: result.message || 'Nhanh.vn từ chối gửi đơn sàn.' };
                    one = { ...one, orderId: one.orderId ?? orderId };
                } catch (err) {
                    one = { orderId, ok: false, error: `Lỗi hệ thống: ${err.message}` };
                }
                if (one.ok && one.trackingNumber) patchOrderEverywhere(one.orderId, { carrier_code: one.trackingNumber });
                live.push(one);
                setBulkEcomLiveResults([...live]);
                setBulkEcomProgress({ done: i + 1, total: ids.length, currentId: ids[i + 1] ?? null });
            }
        } finally {
            const stopped = bulkEcomStopRef.current;
            const okCount = live.filter(r => r.ok).length;
            const failCount = live.filter(r => !r.ok).length;
            setBulkEcomResult({
                success: failCount === 0,
                results: live,
                okCount,
                failCount,
                skippedIds,
                stopped,
                message: stopped ? `Đã dừng theo yêu cầu sau ${live.length}/${ids.length} đơn.` : undefined,
            });
            setBulkEcomRunning(false);
            setBulkEcomProgress(prev => ({ ...prev, currentId: null }));
        }
    };
    // In mã đơn sàn hàng loạt: lấy nhãn PDF sàn (ecom/getprintlabel)
    // TUẦN TỰ từng đơn sàn đã có mã vận đơn thật — KHÔNG gửi lại đơn.
    // Modal kết quả mở ngay khi bắt đầu; sau mỗi đơn xong thì cập nhật
    // tiến trình + append kết quả đơn đó vào printLabelsLiveResults để
    // hiện ngay trong modal. Nút Dừng chỉ dừng sau khi đơn hiện tại
    // xong, giữ lại kết quả đã xong và hiện tổng kết như bình thường.
    // Xong thì bấm "In tất cả phiếu (1 file PDF)" để gộp + mở tab in.
    const handlePrintLabels = async () => {
        if (selectedPrintableEcomIds.length === 0 || printLabelsRunning) return;
        const ids = [...selectedPrintableEcomIds];
        const skippedIds = selectedOrders.filter(id => !selectedPrintableEcomIds.some(a => String(a) === String(id)));
        setShowActionMenu(false);
        printLabelsStopRef.current = false;
        setPrintLabelsLiveResults([]);
        setPrintLabelsResult({ success: true, results: [], okCount: 0, failCount: 0, skippedIds });
        setPrintLabelsProgress({ done: 0, total: ids.length, currentId: ids[0] ?? null });
        setMergeLabelsMsg('');
        setPrintLabelsRunning(true);
        setShowPrintLabelsModal(true);
        const live = [];
        try {
            for (let i = 0; i < ids.length; i++) {
                if (printLabelsStopRef.current) break;
                const orderId = ids[i];
                setPrintLabelsProgress({ done: i, total: ids.length, currentId: orderId });
                let one;
                try {
                    const labelUrl = await fetchEcomLabelWithRetry(orderId);
                    const row = effectiveFiltered.find(o => String(o.id) === String(orderId));
                    one = { orderId, ok: true, labelUrl, trackingNumber: row?.carrier_code || '' };
                } catch (err) {
                    one = { orderId, ok: false, error: err.message || 'Không lấy được nhãn PDF của đơn này.' };
                }
                live.push(one);
                setPrintLabelsLiveResults([...live]);
                setPrintLabelsProgress({ done: i + 1, total: ids.length, currentId: ids[i + 1] ?? null });
            }
        } finally {
            const stopped = printLabelsStopRef.current;
            const okCount = live.filter(r => r.ok).length;
            const failCount = live.filter(r => !r.ok).length;
            setPrintLabelsResult({
                success: failCount === 0,
                results: live,
                okCount,
                failCount,
                skippedIds,
                stopped,
                message: stopped ? `Đã dừng theo yêu cầu sau ${live.length}/${ids.length} đơn.` : undefined,
            });
            setPrintLabelsRunning(false);
            setPrintLabelsProgress(prev => ({ ...prev, currentId: null }));
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

            if (searchCustomer) {
                // Báo cáo cũ lọc trên dữ liệu đã tải: chỉ khớp được đơn
                // nào có raw_data (hoặc trường khách) trong dòng đó.
                if (!customerMatches(order, searchCustomer)) return false;
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
            : 'bg-slate-100 text-slate-600 border-slate-200';
        return (
            <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${cls}`}>
                {info.label}
                {info.detail ? <span className="block font-medium text-slate-600">{info.detail}</span> : null}
            </span>
        );
    };

    // Tên trạng thái ngắn chỉ dùng trong báo cáo đặc biệt: 57 là Chờ xác nhận.
    const specialStatusName = (code) => String(code) === '57' ? 'Chờ xác nhận' : (statusDict[code] || LOCAL_STATUS_NAMES[String(code)] || String(code));
    // Số trên tab là số đếm đúng từ server (chưa đếm xong thì …).
    // Riêng tab 'Đơn đã xóa' lấy thẳng cỡ tập đã tải (không cần đếm
    // lại, tập này chính là nguồn của tab).
    const specialTabCount = (tabId) => {
        if (tabId === 'deleted') return String(deletedOrderIds.size);
        const v = specialCounts[tabId];
        return v === undefined || v === null ? null : String(v);
    };
    // Cửa sổ số trang cho pager của báo cáo đặc biệt: trang hiện tại ±2,
    // kèm trang đầu / cuối, chèn … ở khoảng trống.
    const specialPageWindow = () => {
        const total = Math.max(1, Math.ceil(specialTotal / specialPageSize));
        const pages = new Set([1, total]);
        for (let p = specialPage - 2; p <= specialPage + 2; p++) if (p >= 1 && p <= total) pages.add(p);
        const sorted = [...pages].sort((a, b) => a - b);
        const out = [];
        sorted.forEach((p, i) => { if (i > 0 && p - sorted[i - 1] > 1) out.push('…'); out.push(p); });
        return out;
    };

    // Danh sách hiển thị / thao tác: báo cáo đặc biệt chỉ dùng các đơn của
    // trang đang mở (theo số dòng đã chọn), báo cáo cũ dùng filteredOrders.
    // Nút Xuất Excel / Thao tác dùng chung các biến này nên ở chế độ đặc
    // biệt chúng chỉ tính trên trang đang xem, không phải toàn bộ. Riêng
    // nút Copy: không tick đơn nào thì copy hết đơn khớp bộ lọc hiện tại
    // (xem executeCopy + specialAllCopyRows), tick rồi thì chỉ copy các
    // đơn đã tick.
    const effectiveFiltered = specialMode ? specialPageOrders : filteredOrders;
    const targetOrdersAction = selectedOrders.length > 0
        ? effectiveFiltered.filter(o => selectedOrders.includes(o.id))
        : effectiveFiltered;

    // Số lượng hiển thị trên nút Copy: không tick đơn nào ở báo cáo đặc
    // biệt thì đếm trên toàn bộ bộ lọc (specialTotal), không chỉ trang
    // đang mở; tick rồi thì đếm đúng các đơn đã tick.
    const copyTargetCount = (specialMode && selectedOrders.length === 0) ? specialTotal : targetOrdersAction.length;
    // Nguồn đếm cho 2 mục còn lại trong menu Copy: dùng danh sách đầy đủ
    // đã lưu sẵn khi có (đường tìm theo nhãn / tồn kho / khách / sản
    // phẩm); đường thường chưa tải thì đếm tạm trên trang đang mở, số
    // thật sẽ hiện ở thông báo sau khi copy xong.
    const copyCountSource = (specialMode && selectedOrders.length === 0 && specialAllCopyRows) ? specialAllCopyRows : targetOrdersAction;
    const ecomOrdersCount = copyCountSource.filter(o => ['42', '48'].includes(String(o.sale_channel)) && o.ecom_order_id).length;
    const carrierOrdersCount = copyCountSource.filter(o => specialMode ? hasRealCarrier(o) : o.carrier_code).length;
    // Khi không tick đơn nào ở báo cáo đặc biệt, 2 mục ID đơn sàn / Mã
    // vận đơn luôn bấm được (số trên nhãn chỉ là ước lượng từ trang đang
    // mở ở đường thường; bấm vào sẽ tải đủ rồi báo nếu thật sự không có).
    const copyEcomDisabled = copyLoading || (!(specialMode && selectedOrders.length === 0) && ecomOrdersCount === 0);
    const copyCarrierDisabled = copyLoading || (!(specialMode && selectedOrders.length === 0) && carrierOrdersCount === 0);

    const totalOrdersCount = specialMode ? specialTotal : effectiveFiltered.length;
    const totalPages = specialMode ? (Math.ceil(specialTotal / specialPageSize) || 1) : (Math.ceil(totalOrdersCount / pageSize) || 1);
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
    const activeFilterCount = (searchProduct ? 1 : 0) + (searchNote ? 1 : 0) + (searchCustomer ? 1 : 0) + selectedStatus.length + selectedCarrier.length + selectedChannel.length + selectedCreator.length + selectedDepot.length + selectedTags.length + selectedStock.length + (printedFilter ? 1 : 0) + (missingCarrierFilter ? 1 : 0) + (specialAgingFilter ? 1 : 0);
    const handleClearSpecialFilters = () => {
        setSearchProduct('');
        setSearchNote('');
        setSearchCustomer('');
        setSelectedStatus([]);
        setSelectedCarrier([]);
        setSelectedChannel([]);
        setSelectedCreator([]);
        setSelectedDepot([]);
        setSelectedTags([]);
        setSelectedStock([]);
        setSpecialAgingFilter(false);
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

    // Chạy đa luồng: chia thành các cục 5 đơn, các cục chạy song song
    // (cùng mẫu với handleUpdateMissingCarrierWebhooks); mỗi cục vẫn
    // gọi tuần tự từng đơn + delay nhẹ để không gọi quá dày.
    const handleAutoUpdateWebhooks = async () => {
        setIsUpdatingWebhooks(true);
        setUpdateProgress(0);
        const orderIds = missedWebhookOrders.map(o => o.id);
        const chunks = chunkArray(orderIds, 5);
        let completed = 0;
        const processChunk = async (chunk) => {
            for (let i = 0; i < chunk.length; i++) {
                const orderId = chunk[i];
                try {
                    await fetch(`https://nhanh.vn/auto/posevent/orderupdate?id=${orderId}&businessId=176023`, { method: 'GET', mode: 'no-cors' });
                } catch (err) { console.error(`Lỗi kích hoạt webhook đơn ${orderId}:`, err); }
                completed += 1;
                setUpdateProgress(completed);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        };
        await Promise.all(chunks.map(chunk => processChunk(chunk)));
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

    // Đường thường của báo cáo đặc biệt: tải lười toàn bộ id khớp bộ lọc
    // hiện tại (chỉ 5 cột phục vụ copy), từng đợt 1000, tối đa 50 đợt.
    // Dùng đúng applySpecialFilters như đường tải trang nên tập id khớp
    // với tổng số đang hiện; thứ tự xếp như bảng (created_at + id).
    const fetchNormalBranchCopyRows = async () => {
        const asc = specialSortOrder === 'asc';
        const orderBy = (q) => q.order('created_at', { ascending: asc }).order('id', { ascending: asc });
        const rows = [];
        let offset = 0;
        for (let chunk = 0; chunk < 50; chunk++) {
            let q = supabase.from('orders').select('id, sale_channel, ecom_order_id, carrier_code, carrier_name');
            q = applySpecialFilters(q, { tabId: specialTab, missingOnly: specialOnlyMissingPrint });
            q = orderBy(q).range(offset, offset + 999);
            const { data, error } = await q;
            if (error) throw error;
            const list = data || [];
            rows.push(...list);
            if (list.length < 1000) break;
            offset += 1000;
        }
        return rows;
    };

    const executeCopy = async (type) => {
        // Nguồn copy: tick đơn nào thì copy đúng các đơn đó; không tick
        // đơn nào thì ở báo cáo đặc biệt copy HẾT đơn khớp bộ lọc hiện
        // tại (không chỉ trang đang mở), còn báo cáo cũ thì copy hết đơn
        // đã lọc (filteredOrders vốn đã là toàn bộ).
        let sourceRows = targetOrdersAction;
        if (selectedOrders.length === 0 && specialMode) {
            setCopyLoading(true);
            setCopyMessage('Đang tải toàn bộ ID theo bộ lọc hiện tại...');
            try {
                sourceRows = specialAllCopyRows ?? await fetchNormalBranchCopyRows();
            } catch (err) {
                setCopyMessage(`Không tải được danh sách: ${err.message}`);
                setTimeout(() => setCopyMessage(''), 5000);
                setCopyLoading(false);
                setShowCopyMenu(false);
                return;
            } finally {
                setCopyLoading(false);
            }
        }
        if (sourceRows.length === 0) return;
        
        let textToCopy = '';
        let count = 0;

        if (type === 'system') {
            textToCopy = sourceRows.map(order => order.id).join('\n');
            count = sourceRows.length;
        } else if (type === 'ecom') {
            const validOrders = sourceRows.filter(o => ['42', '48'].includes(String(o.sale_channel)) && o.ecom_order_id);
            textToCopy = validOrders.map(o => o.ecom_order_id).join('\n');
            count = validOrders.length;
        } else if (type === 'carrier') {
            // Báo cáo đặc biệt: GHN mã NVN coi như chưa có mã nên không copy.
            const validOrders = sourceRows.filter(o => specialMode ? hasRealCarrier(o) : o.carrier_code);
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
    // Đơn sàn mới gửi được qua ecom/readytoship: Shopee (42), Tiktok
    // Shop (48), Lazada (41). Đơn kênh Admin gửi bằng sendcarrier riêng.
    const isMarketplaceChannel = (order) => ['42', '48', '41'].includes(String(order?.sale_channel));
    // Đơn sàn trong list đã tick (để gửi đơn sàn hàng loạt).
    const selectedMarketplaceIds = selectedOrders.filter(id => {
        const row = effectiveFiltered.find(o => String(o.id) === String(id));
        return row && isMarketplaceChannel(row);
    });
    // Đơn sàn đã có mã vận đơn thật trong list đã tick (để in mã đơn sàn /
    // phiếu gửi sàn hàng loạt). Đơn không phải đơn sàn hoặc chưa có mã thật
    // thì bỏ qua (không chặn nút, chỉ in những đơn đủ điều kiện).
    const selectedPrintableEcomIds = selectedOrders.filter(id => {
        const row = effectiveFiltered.find(o => String(o.id) === String(id));
        return row && isPrintableEcomOrder(row);
    });
    // Kết quả hiển thị trong modal kết quả gửi sàn: lúc đang chạy thì
    // lấy từ bulkEcomLiveResults (append từng đơn khi xong), lúc xong
    // thì lấy từ bulkEcomResult (đã gồm toàn bộ kết quả đã xong).
    const bulkEcomDisplayResults = bulkEcomLiveResults.length > 0 ? bulkEcomLiveResults : (bulkEcomResult?.results || []);
    const bulkEcomDisplayOkCount = bulkEcomRunning
        ? bulkEcomLiveResults.filter(r => r.ok).length
        : (bulkEcomResult?.okCount ?? bulkEcomLiveResults.filter(r => r.ok).length);
    const bulkEcomDisplayFailCount = bulkEcomRunning
        ? bulkEcomLiveResults.filter(r => !r.ok).length
        : (bulkEcomResult?.failCount ?? bulkEcomLiveResults.filter(r => !r.ok).length);
    const bulkEcomDisplayLabelUrls = bulkEcomDisplayResults.filter(r => r.ok && r.labelUrl).map(r => r.labelUrl);
    // Kết quả hiển thị trong modal in mã đơn sàn: lúc đang chạy thì lấy từ
    // printLabelsLiveResults (append từng đơn khi xong), lúc xong thì lấy
    // từ printLabelsResult (đã gồm toàn bộ kết quả đã xong).
    const printLabelsDisplayResults = printLabelsLiveResults.length > 0 ? printLabelsLiveResults : (printLabelsResult?.results || []);
    const printLabelsDisplayOkCount = printLabelsRunning
        ? printLabelsLiveResults.filter(r => r.ok).length
        : (printLabelsResult?.okCount ?? printLabelsLiveResults.filter(r => r.ok).length);
    const printLabelsDisplayFailCount = printLabelsRunning
        ? printLabelsLiveResults.filter(r => !r.ok).length
        : (printLabelsResult?.failCount ?? printLabelsLiveResults.filter(r => !r.ok).length);
    const printLabelsDisplayLabelUrls = printLabelsDisplayResults.filter(r => r.ok && r.labelUrl).map(r => r.labelUrl);
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
        // Ghi log in don (best-effort, khong anh huong viec in).
        logOrderPrint(orderIds, printSize);
        setPrintList({
            size: printSize,
            items: printItems.map(item => typeof item === 'object'
                ? { id: item.id, carrier_code: item.carrier_code || '' }
                : { id: item, carrier_code: '' }),
        });
        setPrintCopied(false);
    };
    // In bill tùy chỉnh: mở trang /in-bill vẽ theo mẫu đã lưu trong Cài
    // đặt in (A4/A5, K80 hoặc Có vị trí). Khác openNhanhPrint ở chỗ mẫu
    // này do mình vẽ, không mở trang in của web Nhanh.
    const openBillPrint = (printItems, template) => {
        const ids = (printItems || []).map(item => typeof item === 'object' ? item.id : item).filter(Boolean);
        if (ids.length === 0) return;
        window.open(`/in-bill?ids=${ids.join(',')}&template=${template}`, '_blank');
        logOrderPrint(ids, `bill-${template}`);
    };
    const BillPrintButtons = ({ items, small, onDone }) => (
        <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className={`${small ? 'text-xs' : 'text-sm'} font-medium text-slate-500`}>In bill tùy chỉnh:</span>
            <button onClick={() => { openBillPrint(items, 'a4'); onDone?.(); }} className={`${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} bg-white border border-slate-300 font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2`}><Printer size={small ? 13 : 15} /> Bill A4/A5</button>
            <button onClick={() => { openBillPrint(items, 'k80'); onDone?.(); }} className={`${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} bg-white border border-slate-300 font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2`}><Printer size={small ? 13 : 15} /> Bill K80</button>
            <button onClick={() => { openBillPrint(items, 'location'); onDone?.(); }} className={`${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} bg-white border border-slate-300 font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2`}><Printer size={small ? 13 : 15} /> Bill có vị trí</button>
        </div>
    );
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
        if (!dateStr) return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium border border-green-200">Hôm nay</span>;
        const diffTime = new Date() - new Date(dateStr);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium border border-green-200">Mới</span>;
        else if (diffDays <= 2) return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium border border-amber-200">{diffDays} ngày</span>;
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold border border-red-300 shadow-sm animate-pulse">{diffDays} ngày</span>;
    };

    // Tieu de bang gop vao cum loc: cot tinh theo trong so, % tu dong chuan hoa theo cot dang hien
    const headerCols = [
        { id: 'check', label: null, w: 3, show: true },
        { id: 'info', label: 'Thông tin Đơn', w: 13, show: true },
        { id: 'carrier', label: 'Vận chuyển', w: 11, show: visibleCols.includes('carrier') },
        { id: 'source', label: 'Kênh & Nguồn', w: 11, show: visibleCols.includes('source') },
        { id: 'notes', label: 'Ghi chú', w: 12, show: visibleCols.includes('notes') },
        { id: 'product', label: 'Sản phẩm', w: 20, show: true },
        { id: 'qty', label: 'Số lượng', w: 7, show: true },
        { id: 'stock', label: 'Tình trạng kho / Ngày tồn', w: 11, show: specialMode },
        { id: 'aging', label: activeTab === 'printable' ? 'Ngày tồn' : 'Kho / Thiếu', w: 11, show: !specialMode && visibleCols.includes('aging') },
        { id: 'creator', label: 'Nhân viên', w: 12, show: visibleCols.includes('creator') },
    ].filter(c => c.show);
    const headerTotalW = headerCols.reduce((sum, c) => sum + c.w, 0);
    const headerGridCols = headerCols.map(c => `${(c.w / headerTotalW * 100).toFixed(2)}%`).join(' ');

    return (
        <div className="min-h-screen px-2 py-4 md:px-3 md:py-6 font-sans">
            <div className="max-w-[1400px] mx-auto space-y-6">
                
                {/* Header Area */}
                <div className={`sticky top-0 z-30 flex flex-wrap justify-between items-center gap-4 rounded-2xl px-6 py-6 bg-slate-900 border border-slate-900 shadow-md`}>
                    <div>
                        <h2 className={`text-2xl font-bold tracking-tight text-white`}>Quản lý kho & Đơn hàng</h2>
                        <p className={`text-sm mt-1 text-slate-300`}>Phân bổ tự động dựa trên tồn kho thực tế</p>
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
                                className={`flex items-center gap-2 border rounded-xl px-3 py-2 bg-white/10 border-white/20`}
                                title="Chỉ Owner thấy nút gạt này. Bật để xem báo cáo đặc biệt, tắt để quay về báo cáo cũ."
                            >
                                <span className={`text-sm font-bold ${specialMode ? 'text-slate-400' : 'text-white'}`}>Báo cáo cũ</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={specialMode}
                                    onClick={handleToggleSpecialMode}
                                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${specialMode ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${specialMode ? 'left-6' : 'left-0.5'}`} />
                                </button>
                                <span className={`text-sm font-bold ${specialMode ? 'text-white' : 'text-slate-400'}`}>Báo cáo đặc biệt</span>
                            </div>
                        )}
                        <button
                            onClick={() => fetchAllocation(statusDict)}
                            disabled={loading || isUpdatingMissingCarrier}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold focus:ring-2 transition-all flex items-center gap-2 disabled:opacity-50 bg-emerald-600 border border-emerald-700 text-white hover:bg-emerald-700 focus:ring-emerald-300 shadow-sm`}
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                            Làm mới dữ liệu
                        </button>
                    </div>
                </div>

                {/* Báo cáo đặc biệt: 4 tab làm việc, gộp đủ / tạm giữ / hết hàng */}
                {specialMode && (
                    <div className={`sticky top-[106px] z-30 border border-slate-200 rounded-2xl p-3 space-y-3 bg-white shadow-sm`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-bold tracking-tight text-slate-900">Báo cáo đặc biệt</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                                    Từ
                                    <input type="date" value={specialStartDate} onChange={(e) => setSpecialStartDate(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-slate-700" />
                                </label>
                                <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                                    Đến
                                    <input type="date" value={specialEndDate} onChange={(e) => setSpecialEndDate(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-slate-700" />
                                </label>
                                <button onClick={() => setSpecialReloadToken(t => t + 1)} disabled={specialLoading} className={`px-3 py-2 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-sm`}>
                                    <RefreshCw size={14} className={specialLoading ? 'animate-spin' : ''} /> Tải lại
                                </button>
                                {isOwner && (
                                    <button onClick={handleSyncDeleted} disabled={syncDeletedLoading} className="px-3 py-2 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 bg-slate-700 hover:bg-slate-800 shadow-sm">
                                        <RefreshCw size={14} className={syncDeletedLoading ? 'animate-spin' : ''} /> {syncDeletedLoading ? 'Đang đồng bộ...' : 'Đồng bộ đơn đã xóa'}
                                    </button>
                                )}
                            </div>
                        </div>
                        {specialError && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm font-medium">Không tải được đơn trực tiếp từ bảng orders: {specialError}. Báo cáo cũ vẫn dùng được khi tắt chế độ này.</div>
                        )}
                        {syncDeletedMsg && (
                            <div className="p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm font-medium">{syncDeletedMsg}</div>
                        )}
                        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                            {[
                                { id: 'all', label: 'Tất cả' },
                                { id: 'confirm', label: 'Xác nhận' },
                                { id: 'print', label: 'In và đóng gói' },
                                { id: 'transit', label: 'Đang chuyển' },
                                { id: 'deleted', label: 'Đơn đã xóa' },
                            ].filter(tab => tab.id !== 'deleted' || !printSubLocked('don_da_xoa')).map(tab => {
                                const count = specialTabCount(tab.id);
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setSpecialTab(tab.id); setSpecialOnlyMissingPrint(false); }}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${specialTab === tab.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
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
                    <div onClick={() => setActiveTab('printable')} className={`cursor-pointer p-6 rounded-2xl border bg-emerald-50/60 flex items-center gap-4 transition-all ${activeTab === 'printable' ? 'ring-2 ring-emerald-600 border-emerald-600 shadow-md' : 'border-emerald-200 hover:border-emerald-400 shadow-sm'}`}>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-600 text-white shadow-sm shrink-0">
                            <CheckCircle size={26} />
                        </div>
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-slate-900">{data.printable?.length || 0}</div>
                            <div className="text-sm text-slate-700 font-bold">Đủ hàng (Có thể in)</div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('holding')} className={`cursor-pointer p-5 rounded-2xl border bg-white flex items-center gap-4 transition-all ${activeTab === 'holding' ? 'ring-2 ring-amber-500 border-transparent shadow-md' : 'border-slate-200 hover:border-amber-300 shadow-sm'}`}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-amber-100 text-amber-700 shrink-0">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-800">{data.holding?.length || 0}</div>
                            <div className="text-sm text-slate-500 font-medium">Tạm giữ (Thiếu 1 phần)</div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('outOfStock')} className={`cursor-pointer p-5 rounded-2xl border bg-white flex items-center gap-4 transition-all ${activeTab === 'outOfStock' ? 'ring-2 ring-red-500 border-transparent shadow-md' : 'border-slate-200 hover:border-red-300 shadow-sm'}`}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-100 text-red-600 shrink-0">
                            <XCircle size={24} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-800">{data.outOfStock?.length || 0}</div>
                            <div className="text-sm text-slate-500 font-medium">Hết hàng</div>
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
                <div className={`border border-slate-200 rounded-2xl p-5 space-y-4 sticky z-30 ${specialMode ? 'top-[248px]' : 'top-[106px]'} bg-white shadow-sm`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3 flex-1">
                            {/* Search Inputs */}
                            <div className="relative min-w-[240px]">
                                <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Tìm ID, Mã Sàn, Mã Vận Đơn..." className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 bg-white transition-colors" />
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            </div>
                            {specialMode ? (
                                <button onClick={() => setShowFilterPopup(true)} className="px-4 py-2.5 bg-emerald-600 border border-emerald-600 rounded-xl text-sm font-bold text-white hover:bg-emerald-700 flex items-center gap-2 shadow-sm">
                                    Bộ lọc
                                    {activeFilterCount > 0 && <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-white/20 text-white">{activeFilterCount}</span>}
                                </button>
                            ) : (
                                <>
                                    <div className="relative min-w-[200px]">
                                        <input type="text" value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} placeholder="Tìm tên/mã SP..." className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 bg-white transition-colors" />
                                        <PackageSearch className="absolute left-3 top-2.5 text-slate-400" size={16} />
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
                                    disabled={copyTargetCount === 0 || copyLoading} 
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${copyTargetCount > 0 && !copyLoading ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}
                                >
                                    <Copy size={15} /> {copyLoading ? 'Đang tải...' : `Copy (${copyTargetCount})`} <ChevronDown size={14} />
                                </button>
                                
                                {showCopyMenu && copyTargetCount > 0 && (
                                    <div className="absolute right-0 top-full pt-2 w-[270px] z-50">
                                        <div className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden py-1">
                                            <button 
                                                onClick={() => executeCopy('system')} 
                                                disabled={copyLoading}
                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between ${copyLoading ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50'}`}
                                            >
                                                <span className="font-medium">ID Hệ thống</span>
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">{copyTargetCount}</span>
                                            </button>
                                            <button 
                                                onClick={() => executeCopy('ecom')} 
                                                disabled={copyEcomDisabled}
                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between border-t border-slate-100 ${!copyEcomDisabled ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                                            >
                                                <span className="font-medium">ID Đơn sàn (Shopee/TikTok)</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${!copyEcomDisabled ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-400'}`}>
                                                    {ecomOrdersCount}
                                                </span>
                                            </button>
                                            <button 
                                                onClick={() => executeCopy('carrier')} 
                                                disabled={copyCarrierDisabled}
                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between border-t border-slate-100 ${!copyCarrierDisabled ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed'}`}
                                            >
                                                <span className="font-medium">Mã Vận đơn</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${!copyCarrierDisabled ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>
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
                                className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-sm ${targetOrdersAction.length > 0 ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}
                            >
                                {isExporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />} 
                                Xuất Excel
                            </button>

                            {/* Column Settings */}
                            <div className="relative" ref={colSettingsRef}>
                                <button onClick={() => setShowColSettings(!showColSettings)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-slate-100 transition-all shadow-sm">
                                    <Settings2 size={18} />
                                </button>
                                {showColSettings && (
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 flex flex-col">
                                        <div className="px-4 py-2 border-b border-slate-100 font-semibold text-sm text-slate-700">Hiển thị cột</div>
                                        <div className="max-h-[300px] overflow-y-auto p-2">
                                            {OPTIONAL_COLUMNS.map(col => (
                                                <label key={col.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={visibleCols.includes(col.id)} 
                                                        onChange={() => handleToggleColumn(col.id)}
                                                        className="w-4 h-4 text-slate-700 border-slate-300 rounded focus:ring-slate-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{col.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="px-3 pt-2 pb-1 border-t border-slate-100">
                                            <button 
                                                onClick={handleSaveColumnConfig}
                                                disabled={isSavingCols}
                                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                                            >
                                                {isSavingCols ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                                Lưu cấu hình
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Lịch sử gửi sang hãng: chỉ owner, để gửi xong lỡ load lại trang vẫn mở ra check lại được */}
                            {isOwner && (
                                <button onClick={handleOpenSendHistory} className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">
                                    <Send size={15} /> Lịch sử gửi
                                </button>
                            )}

                            {/* Actions Dropdown */}
                            <div className="relative" onMouseLeave={() => setShowActionMenu(false)}>
                                <button onClick={() => setShowActionMenu(!showActionMenu)} disabled={selectedOrders.length === 0 || sendingOrder || updatingSelected} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${selectedOrders.length > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}>
                                    {sendingOrder || updatingSelected ? <RefreshCw size={16} className="animate-spin" /> : "Thao tác"} ({selectedOrders.length}) <ChevronDown size={14} />
                                </button>
                                {showActionMenu && selectedOrders.length > 0 && (
                                    <div className="absolute right-0 top-full pt-2 w-56 z-50">
                                        <div className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden py-1">
                                            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase bg-slate-50">In Ấn</div>
                                            <button onClick={() => executePrint('A4')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Printer size={15} /> In khổ A4/A5</button>
                                            <button onClick={() => executePrint('K80')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Printer size={15} /> In khổ K80</button>
                                            
                                            <div className="px-3 py-1.5 mt-1 text-xs font-semibold text-slate-400 uppercase bg-slate-50 border-t border-slate-100">Vận Chuyển</div>
                                            <button onClick={handleBulkSend} className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"><Send size={15} /> Gửi đơn sang hãng</button>
                                            {!printSubLocked('gui_don_san') && (<button onClick={openBulkEcom} disabled={selectedMarketplaceIds.length === 0} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${selectedMarketplaceIds.length > 0 ? 'text-amber-700 hover:bg-amber-50' : 'text-slate-400 cursor-not-allowed'}`}><Send size={15} /> Gửi đơn sàn{selectedMarketplaceIds.length > 0 ? ` (${selectedMarketplaceIds.length})` : ''}</button>)}
                                            {!printSubLocked('gui_don_san') && (<button onClick={handlePrintLabels} disabled={selectedPrintableEcomIds.length === 0 || printLabelsRunning} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${selectedPrintableEcomIds.length > 0 ? 'text-amber-700 hover:bg-amber-50' : 'text-slate-400 cursor-not-allowed'}`}><Printer size={15} /> In mã đơn sàn{selectedPrintableEcomIds.length > 0 ? ` (${selectedPrintableEcomIds.length})` : ''}</button>)}
                                            <button onClick={() => { setShowActionMenu(false); setBulkCancelResult(null); setCancelReasonBulk(''); setShowBulkCancelModal(true); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><XCircle size={15} /> Hủy đơn</button>

                                            <div className="px-3 py-1.5 mt-1 text-xs font-semibold text-slate-400 uppercase bg-slate-50 border-t border-slate-100">Hệ Thống</div>
                                            <button onClick={handleUpdateSelectedWebhooks} className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"><RefreshCw size={15} /> Cập nhật lại Webhook</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {!specialMode && (<div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3">
                        <input type="text" value={searchNote} onChange={(e) => setSearchNote(e.target.value)} placeholder="Lọc nội dung ghi chú..." className="w-[240px] px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-500 bg-white hover:bg-white" />
                        <input type="text" value={searchCustomer} onChange={(e) => setSearchCustomer(e.target.value)} placeholder="Tìm tên khách / SĐT..." className="w-[240px] px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-500 bg-white hover:bg-white" />
                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-[160px] px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-500 bg-white">
                            <option value="">Sắp xếp mặc định</option>
                            <option value="asc">Cũ nhất trước</option>
                            <option value="desc">Mới nhất trước</option>
                        </select>
                        <select value={printedFilter} onChange={(e) => setPrintedFilter(e.target.value)} className="w-[180px] px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-500 bg-white">
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
                                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                            />
                            <span className="text-sm font-medium text-slate-700">Chưa có Mã vận đơn</span>
                        </label>
                        {!specialMode && activeTab === 'printable' && (
                            <label className="flex items-center gap-2 cursor-pointer ml-2">
                                <input type="checkbox" checked={agingFilter} onChange={(e) => setAgingFilter(e.target.checked)} className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500" />
                                <span className="text-sm font-medium text-slate-700">Chỉ đơn tồn &gt;= 2 ngày</span>
                            </label>
                        )}
                    </div>)}
                {/* Tieu de bang gop vao cum loc: dinh cung thanh loc, cot theo dung % cua colgroup */}
                <div className={`-mx-5 -mb-5 grid rounded-b-2xl overflow-hidden bg-slate-900 text-slate-100`} style={{ gridTemplateColumns: headerGridCols }}>
                    {headerCols.map(col => (
                        <div key={col.id} className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider min-w-0 overflow-hidden flex items-center ${col.id === 'check' ? 'justify-center' : ''} ${col.id === 'stock' || col.id === 'aging' ? '' : 'whitespace-nowrap'}`}>
                            {col.id === 'check' ? (
                                <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 rounded border-slate-400 cursor-pointer" />
                            ) : (
                                <span className={col.id === 'qty' || col.id === 'creator' ? 'text-center w-full' : ''}>{col.label}</span>
                            )}
                        </div>
                    ))}
                </div>
                </div>

                {/* Popup bộ lọc báo cáo đặc biệt */}
                {specialMode && showFilterPopup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setShowFilterPopup(false)}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                                <h3 className="font-bold text-white">Bộ lọc</h3>
                                <button onClick={() => setShowFilterPopup(false)} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                            </div>
                            <div className="p-5 overflow-y-auto space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input type="text" value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} placeholder="Tìm tên/mã SP..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-slate-700" />
                                    <input type="text" value={searchNote} onChange={(e) => setSearchNote(e.target.value)} placeholder="Lọc nội dung ghi chú..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-slate-700" />
                                    <input type="text" value={searchCustomer} onChange={(e) => setSearchCustomer(e.target.value)} placeholder="Tìm tên khách / SĐT..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-slate-700 sm:col-span-2" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <MultiSelect options={effectiveStatusOptions} selected={selectedStatus} onChange={setSelectedStatus} placeholder="Trạng thái" />
                                    <MultiSelect options={effectiveCarrierOptions} selected={selectedCarrier} onChange={setSelectedCarrier} placeholder="Hãng VC" />
                                    <MultiSelect options={effectiveChannelOptions} selected={selectedChannel} onChange={setSelectedChannel} placeholder="Kênh bán" />
                                    <MultiSelect options={effectiveDepotOptions} selected={selectedDepot} onChange={setSelectedDepot} placeholder="Kho hàng" />
                                    <MultiSelect options={effectiveCreatorOptions} selected={selectedCreator} onChange={setSelectedCreator} placeholder="Nhân viên" />
                                    {specialMode && <MultiSelect options={nhanhTagOptions} selected={selectedTags} onChange={setSelectedTags} placeholder="Nhãn đơn" />}
                                    {specialMode && <MultiSelect options={STOCK_FILTER_OPTIONS} selected={selectedStock} onChange={setSelectedStock} placeholder="Tình trạng kho" />}
                                </div>
                                {specialMode && nhanhTagOptions.length === 0 && (
                                    <p className="text-xs text-slate-500">Chưa có nhãn nào: nhãn chỉ có cho đơn mới đồng bộ sau khi chạy migration + sync-nhanh mới.</p>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <select value={printedFilter} onChange={(e) => setPrintedFilter(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-slate-700 bg-slate-50">
                                        <option value="">Lọc theo Trạng thái in</option>
                                        <option value="not_printed">Chưa có ngày in gần nhất</option>
                                        <option value="printed">Đã có ngày in</option>
                                        <option value="today">Đã in hôm nay</option>
                                    </select>
                                    <select value={specialSortOrder} onChange={(e) => setSpecialSortOrder(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-slate-700 bg-slate-50">
                                        <option value="desc">Mới nhất trước</option>
                                        <option value="asc">Cũ nhất trước</option>
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={missingCarrierFilter} onChange={(e) => setMissingCarrierFilter(e.target.checked)} className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500" />
                                    <span className="text-sm font-medium text-slate-700">Chưa có Mã vận đơn</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={specialAgingFilter} onChange={(e) => setSpecialAgingFilter(e.target.checked)} className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500" />
                                    <span className="text-sm font-medium text-slate-700">Chỉ đơn tồn &gt;= 2 ngày (đơn đủ hàng)</span>
                                </label>
                            </div>
                            <div className="px-5 py-4 border-t border-slate-200 flex justify-between gap-3">
                                <button onClick={handleClearSpecialFilters} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">Xóa bộ lọc</button>
                                <button onClick={() => setShowFilterPopup(false)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Áp dụng</button>
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
                <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col`}>
                    <div className="overflow-x-auto">
                        {(specialMode ? (specialPageOrders.length === 0 && specialLoading) : loading) ? (
                            <div className="p-16 text-center text-slate-400 font-medium text-sm flex flex-col items-center gap-3">
                                <RefreshCw className="animate-spin text-blue-500" size={24} /> Đang tải dữ liệu...
                            </div>
                        ) : paginatedOrders.length === 0 ? (
                            <div className="p-16 text-center text-slate-400 text-sm">Không tìm thấy đơn hàng nào phù hợp.</div>
                        ) : (
                            <table className="w-full text-sm text-left border-collapse table-fixed"><colgroup>{headerCols.map(col => (<col key={col.id} style={{ width: `${(col.w / headerTotalW * 100).toFixed(2)}%` }} />))}</colgroup>
                                
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedOrders.map(order => {
                                        const products = order.order_products || [];
                                        const rowCount = Math.max(1, products.length);
                                        // Đơn đã xóa: pill trạng thái hiện "Đơn đã xóa" thay cho trạng thái Nhanh.
                                        const isDeletedOrder = deletedOrderIds.has(String(order.id));
                                        const statusName = isDeletedOrder ? 'Đơn đã xóa' : (specialMode ? specialStatusName(order.status) : (statusDict[order.status] || LOCAL_STATUS_NAMES[String(order.status)] || `Mã ${order.status}`));
                                        const channelName = SALE_CHANNELS[order.sale_channel] || order.sale_channel || 'Khác';
                                        const isChecked = selectedOrders.includes(order.id);
                                        
                                        const channelColorClass = CHANNEL_COLORS[order.sale_channel] || 'bg-slate-100 text-slate-600 border-slate-200';
                                        const statusColorClass = isDeletedOrder ? 'bg-slate-200 text-slate-700 border border-slate-300' : (STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-600 border border-slate-200');

                                        const agingDays = order.printable_date ? Math.floor((new Date() - new Date(order.printable_date)) / (1000 * 60 * 60 * 24)) : 0;
                                        const isAgingOrder = activeTab === 'printable' && agingDays >= 2;

                                        // Đơn không có sản phẩm vẫn phải hiện 1 dòng (báo "Thiếu
                                        // sản phẩm") — trước đây products.map trên mảng rỗng
                                        // không vẽ dòng nào nên đơn "biến mất" khỏi bảng dù
                                        // tổng số + phân trang vẫn đếm nó.
                                        const rowsToRender = products.length > 0 ? products : [null];
                                        return rowsToRender.map((prod, index) => {
                                            const shortItem = prod ? data.holding?.concat(data.outOfStock)?.find(o => o.id === order.id)?.debug_shortItems?.find(i => i.name === prod.product_name) : undefined;

                                            return (
                                                <tr key={`${order.id}-${index}`} 
                                                    className={`${isChecked ? 'bg-emerald-50' : isAgingOrder ? 'bg-red-50/40' : 'hover:bg-slate-50'} transition-colors`}
                                                >
                                                    {/* Cột 1: Checkbox */}
                                                    {index === 0 && (
                                                        <td rowSpan={rowCount} className="py-4 px-5 align-top border-r border-slate-100 text-center">
                                                            <input type="checkbox" checked={isChecked} onChange={() => handleSelectOne(order.id)} className="w-4 h-4 mt-1 text-slate-700 rounded border-slate-300 focus:ring-slate-500 cursor-pointer" />
                                                        </td>
                                                    )}

                                                    {/* Cột 2: Gộp ID */}
                                                    {index === 0 && (
                                                        <td rowSpan={rowCount} className="py-4 px-5 align-top border-r border-slate-100">
                                                            {specialMode ? (
                                                                <button className="font-mono font-bold text-base text-blue-700 hover:underline mb-1 text-left" onClick={() => openOrderDetail(order)} title="Bấm để xem popup chi tiết đơn">
                                                                    {order.id}
                                                                </button>
                                                            ) : (
                                                                <div className="font-mono font-bold text-base text-slate-900 cursor-pointer hover:text-blue-600 mb-1" onClick={() => handleSelectOne(order.id)}>
                                                                    {order.id}
                                                                </div>
                                                            )}

                                                            {order.ecom_order_id && (
                                                                <div className="text-xs mb-0.5 flex items-center gap-1.5">
                                                                    <span className="font-medium bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded shadow-sm border border-pink-200">Sàn</span>
                                                                    <span className="font-mono text-pink-600 font-semibold">{order.ecom_order_id}</span>
                                                                </div>
                                                            )}
                                                            {order.carrier_code && (
                                                                <div className="text-xs mb-1 flex items-center gap-1.5">
                                                                    <span className="font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shadow-sm border border-purple-200">MVD</span>
                                                                    <span className="font-mono text-purple-600 font-semibold">{order.carrier_code}</span>
                                                                </div>
                                                            )}
                                                            <div className="text-xs text-slate-400 mt-1">
                                                                {new Date(order.created_at).toLocaleString('vi-VN')}
                                                            </div>
                                                            
                                                            {/* Thông tin Ngày in cuối */}
                                                            {visibleCols.includes('printed_at') && (
                                                                <div className="text-xs text-slate-500 mt-1">
                                                                    Ngày in cuối: <span className="font-medium text-slate-700">{order.printed_at ? new Date(order.printed_at).toLocaleDateString('vi-VN') : 'Chưa in'}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Cột 3 (Tùy chọn): Vận chuyển */}
                                                    {index === 0 && visibleCols.includes('carrier') && (
                                                        <td rowSpan={rowCount} className="py-4 px-5 align-top border-r border-slate-100">
                                                            <div className="font-semibold text-slate-700 text-sm mb-1.5">{order.carrier_name || 'Chưa phân bổ'}</div>
                                                            <div className="group flex items-center gap-1">
                                                                <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusColorClass}`}>
                                                                    {statusName}
                                                                </div>
                                                                {isOwner && (
                                                                    <button title="Đổi trạng thái nhanh" onClick={(e) => { e.stopPropagation(); openQuickAction('status', order); }} className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition shrink-0"><Pencil size={13} /></button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* Cột 4 (Tùy chọn): Kênh & Nguồn */}
                                                    {index === 0 && visibleCols.includes('source') && (
                                                        <td rowSpan={rowCount} className="py-4 px-5 align-top border-r border-slate-100">
                                                            <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-1.5 ${channelColorClass}`}>
                                                                {channelName}
                                                            </div>
                                                            {order.traffic_source && (
                                                                <div className="text-xs text-slate-500 truncate max-w-[120px]" title={order.traffic_source}>
                                                                    Nguồn: {order.traffic_source}
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Cột 5 (Tùy chọn): Ghi chú */}
                                                    {index === 0 && visibleCols.includes('notes') && (
                                                        <td rowSpan={rowCount} className="py-4 px-5 align-top border-r border-slate-100">
                                                            <div className="group space-y-1.5 text-xs">
                                                                {order.description && (
                                                                    <div className="flex gap-1.5 text-slate-700">
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
                                                                    <span className="text-slate-400 italic">Không có</span>
                                                                )}
                                                                {isOwner && (
                                                                    <button onClick={(e) => { e.stopPropagation(); openQuickAction('edit', order); }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"><Pencil size={12} /> Sửa ghi chú</button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* Cột 6: Sản phẩm */}
                                                    <td className="py-3.5 px-5 align-top">
                                                        {prod ? (
                                                            <>
                                                                <div className="font-medium text-slate-800 text-sm leading-tight mb-1">{prod.product_name}</div>
                                                                <div className="text-xs text-slate-500 font-mono">{prod.product_code}</div>
                                                            </>
                                                        ) : (
                                                            <div className="font-medium text-red-600 text-sm leading-tight">Thiếu sản phẩm</div>
                                                        )}
                                                    </td>

                                                    {/* Cột 7: Số lượng */}
                                                    <td className="py-3.5 px-5 align-top text-center font-bold text-slate-900">
                                                        {prod ? prod.quantity : '—'}
                                                    </td>

                                                    {/* Cột 8: Báo cáo đặc biệt luôn hiển thị tình trạng kho, báo cáo cũ giữ theo cột đã chọn */}
                                                    {specialMode && index === 0 && (
                                                        <td rowSpan={rowCount} className="py-4 px-5 align-top">
                                                            {getStockBadge(order)}
                                                            {/* Chỉ đơn đủ hàng mới có ngày tồn, lấy từ dòng allocation
                                                                (cùng giá trị printable_date như báo cáo cũ); không có
                                                                ngày thì chỉ hiện badge kho, không đoán "Hôm nay". */}
                                                            {getStockInfo(order).key === 'printable' && (() => {
                                                                const agingDate = allocationStockById.get(order.id)?.order?.printable_date;
                                                                return agingDate ? <div className="mt-1.5">{renderAgingBadge(agingDate)}</div> : null;
                                                            })()}
                                                        </td>
                                                    )}
                                                    {!specialMode && visibleCols.includes('aging') && (
                                                        <td className="py-3.5 px-5 align-top">
                                                            {activeTab === 'printable' ? (
                                                                renderAgingBadge(order.printable_date)
                                                            ) : shortItem ? (
                                                                <div className="bg-red-50 text-red-600 rounded px-2 py-1 text-xs font-medium border border-red-100">
                                                                    <div className="flex items-center gap-1 mb-0.5"><XCircle size={12} /> Thiếu {shortItem.missing}</div>
                                                                    <span className="text-slate-500">Tồn: {shortItem.remaining}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-green-600 text-xs font-medium flex items-center gap-1 bg-green-50 rounded px-2 py-1 border border-green-100">
                                                                    <CheckCircle size={12} /> Giữ hàng
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    {/* Cột 9 (Tùy chọn): Nhân viên */}
                                                    {index === 0 && visibleCols.includes('creator') && (
                                                        <td rowSpan={rowCount} className="py-4 px-5 align-top text-center border-l border-slate-100">
                                                            <div className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-50 px-1.5 py-1 rounded text-xs">
                                                                <User size={13} className="text-slate-400 shrink-0" /> 
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

                    {/* Pagination: báo cáo đặc biệt tải đúng số dòng đã chọn
                        / trang, bấm sang trang nào mới tải trang đó từ server. */}
                    {((specialMode && totalOrdersCount > 0) || (!specialMode && !loading && totalOrdersCount > 0)) && (
                        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-slate-600">
                                    Đang xem <span className="font-semibold text-slate-900">{specialMode ? (specialTotal === 0 ? 0 : (specialPage - 1) * specialPageSize + 1) : (currentPage - 1) * pageSize + 1}</span> - <span className="font-semibold text-slate-900">{specialMode ? Math.min(specialPage * specialPageSize, totalOrdersCount) : Math.min(currentPage * pageSize, totalOrdersCount)}</span> / <span className="font-semibold text-slate-900">{totalOrdersCount}</span> đơn
                                </span>
                                <div className="border-l border-slate-300 pl-4">
                                    {specialMode ? (
                                        <select value={specialPageSize} onChange={(e) => setSpecialPageSize(Number(e.target.value))} className="px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-slate-500">
                                            <option value={20}>20 dòng / trang</option>
                                            <option value={50}>50 dòng / trang</option>
                                            <option value={100}>100 dòng / trang</option>
                                            <option value={200}>200 dòng / trang</option>
                                        </select>
                                    ) : (
                                        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-slate-500">
                                            <option value={20}>20 dòng / trang</option>
                                            <option value={50}>50 dòng / trang</option>
                                            <option value={100}>100 dòng / trang</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                            {specialMode ? (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setSpecialPage(1)} disabled={specialPage === 1 || specialLoading} className="px-2 py-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-sm font-bold">«</button>
                                    <button onClick={() => setSpecialPage(p => Math.max(1, p - 1))} disabled={specialPage === 1 || specialLoading} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft size={18} /></button>
                                    {specialPageWindow().map((p, i) => p === '…' ? (
                                        <span key={`gap-${i}`} className="px-1 text-sm text-slate-400">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setSpecialPage(p)} disabled={specialLoading} className={`min-w-8 px-2 py-1.5 rounded text-sm font-bold transition-colors disabled:opacity-50 ${p === specialPage ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}>{p}</button>
                                    ))}
                                    <button onClick={() => setSpecialPage(p => Math.min(totalPages, p + 1))} disabled={specialPage === totalPages || specialLoading} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight size={18} /></button>
                                    <button onClick={() => setSpecialPage(totalPages)} disabled={specialPage === totalPages || specialLoading} className="px-2 py-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-sm font-bold">»</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft size={18} /></button>
                                    <div className="flex items-center px-2 text-sm">
                                        Trang <span className="font-semibold text-slate-900 mx-1">{currentPage}</span> / {totalPages}
                                    </div>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight size={18} /></button>
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
                // Đơn đã xóa: pill trạng thái hiện "Đơn đã xóa" thay cho trạng thái Nhanh.
                const isDetailDeleted = deletedOrderIds.has(String(base.id));
                const detailRealStatusName = specialStatusName(base.status);
                const statusName = isDetailDeleted ? 'Đơn đã xóa' : detailRealStatusName;
                const channelName = SALE_CHANNELS[base.sale_channel] || base.sale_channel || 'Khác';
                const productsForPopup = rawProducts || (base.order_products || []).map(p => ({
                    name: p.product_name, code: p.product_code, quantity: p.quantity
                }));
                const totalAmount = rawProducts
                    ? rawProducts.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 0), 0)
                    : null;
                const totalDiscount = rawProducts
                    ? rawProducts.reduce((s, p) => s + (Number(p.discount) || 0), 0)
                    : null;
                // Vị trí kho của 1 sản phẩm trong popup: khớp mã kho trước,
                // không có thì khớp tên (đã tải trong openOrderDetail).
                const prodLocation = (p) => (p.code ? productLocations[`code:${p.code}`] : null) || (p.name ? productLocations[`name:${p.name}`] : null);
                const DetailRow = ({ label, value }) => (
                    <div className="flex flex-col gap-0.5 py-2.5 border-b border-slate-100 last:border-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
                        <span className={`text-sm font-semibold text-slate-800 whitespace-pre-line break-words ${(label === 'Mã vận đơn' || label === 'ID đơn sàn') ? 'font-mono' : ''}`}>{value}</span>
                    </div>
                );
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setDetailOrder(null)}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                            <div className="px-6 py-5 border-b border-slate-900 flex justify-between items-start bg-slate-900">
                                <div>
                                    <h3 className="font-bold text-xl tracking-tight text-white">Chi tiết đơn hàng #{detailOrder.id}</h3>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isDetailDeleted ? 'bg-slate-200 text-slate-700 border border-slate-300' : (STATUS_COLORS[base.status] || 'bg-slate-100 text-slate-600 border border-slate-200')}`}>{statusName}</span>
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${CHANNEL_COLORS[base.sale_channel] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{channelName}</span>
                                        {getStockBadge(detailOrder)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 relative">
                                    <button onClick={() => setShowDetailActionMenu(v => !v)} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700">Thao tác</button>
                                    {showDetailActionMenu && (
                                        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1" onClick={(e) => e.stopPropagation()}>
                                            {isAdminChannel(detailOrder) && (
                                                <button onClick={() => openDetailAction('send')} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Gửi đơn</button>
                                            )}
                                            <button onClick={() => openDetailAction('edit')} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Sửa đơn</button>
                                            <button onClick={() => openDetailAction('status')} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Đổi trạng thái</button>
                                            <button onClick={() => { setShowDetailActionMenu(false); setShowDetailPrintChooser(true); }} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">In đơn</button>
                                            <button onClick={() => openDetailAction('cancel')} className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Hủy đơn</button>
                                        </div>
                                    )}
                                    <button onClick={() => setDetailOrder(null)} className="text-slate-300 hover:text-white"><XCircle size={22} /></button>
                                </div>
                            </div>
                            {showDetailPrintChooser && detailOrder && (
                                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setShowDetailPrintChooser(false)}>
                                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                                            <h3 className="font-bold text-white">Chọn khổ in — #{detailOrder.id}</h3>
                                            <button onClick={() => setShowDetailPrintChooser(false)} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            <div>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">In qua Nhanh.vn</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => { setShowDetailPrintChooser(false); openNhanhPrint([{ id: detailOrder.id, carrier_code: detailOrder.carrier_code || '' }], 'A4'); }} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2"><Printer size={15} /> Khổ A4/A5</button>
                                                    <button onClick={() => { setShowDetailPrintChooser(false); openNhanhPrint([{ id: detailOrder.id, carrier_code: detailOrder.carrier_code || '' }], 'K80'); }} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"><Printer size={15} /> Khổ K80</button>
                                                </div>
                                            </div>
                                            <BillPrintButtons items={[{ id: detailOrder.id, carrier_code: detailOrder.carrier_code || '' }]} onDone={() => setShowDetailPrintChooser(false)} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="p-5 overflow-y-auto">
                                {detailLoading && <p className="text-sm text-slate-500 font-medium flex items-center gap-2 mb-4"><RefreshCw size={15} className="animate-spin" /> Đang tải đầy đủ chi tiết...</p>}

                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
                                    {/* Cột trái: khách hàng, sản phẩm, vận chuyển */}
                                    <div className="space-y-5 min-w-0">
                                        <section className="border border-slate-200 rounded-2xl overflow-hidden">
                                            <h4 className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-base font-bold text-slate-900">Khách hàng</h4>
                                            <div className="px-4 py-3">
                                                <p className="font-bold text-slate-900">{shipAddr?.name || 'Chưa có'}</p>
                                                {shipAddr?.mobile && <p className="text-sm text-slate-600 mt-0.5">{shipAddr.mobile}</p>}
                                                <p className="text-sm text-slate-600 mt-0.5">{shipAddr?.address || 'Chưa có địa chỉ'}</p>
                                                {shipAddr && (
                                                    <p className="text-xs text-slate-500 mt-1">Tỉnh / Huyện / Phường: {shipAddr.cityId ?? 'Chưa có'} / {shipAddr.districtId ?? 'Chưa có'} / {shipAddr.wardId ?? 'Chưa có'}</p>
                                                )}
                                                {(info?.description || info?.privateDescription || base.private_description) && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                                        {info?.description && <p className="text-sm text-slate-700"><span className="font-bold">Ghi chú đơn: </span>{stripHtml(info.description)}</p>}
                                                        {(info?.privateDescription || base.private_description) && <p className="text-sm text-slate-700"><span className="font-bold">Ghi chú nội bộ: </span>{stripHtml(info?.privateDescription || base.private_description)}</p>}
                                                    </div>
                                                )}
                                            </div>
                                        </section>

                                        <section className="border border-slate-200 rounded-2xl overflow-hidden">
                                            <h4 className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-base font-bold text-slate-900">Sản phẩm</h4>
                                            {productsForPopup.length === 0 ? (
                                                <p className="px-4 py-3 text-sm text-slate-500 font-medium">Đơn này chưa có danh sách sản phẩm trong bảng orders.</p>
                                            ) : (
                                                <>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="text-left text-slate-500 border-b border-slate-200">
                                                                    <th className="py-2 px-4 font-semibold">#</th>
                                                                    <th className="py-2 pr-3 font-semibold">Sản phẩm</th>
                                                                    <th className="py-2 pr-3 font-semibold text-center">SL</th>
                                                                    <th className="py-2 pr-3 font-semibold text-right">Giá bán</th>
                                                                    <th className="py-2 px-4 font-semibold text-right">Tổng</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {productsForPopup.map((p, idx) => {
                                                                    const lineTotal = (Number(p.price) || 0) * (Number(p.quantity) || 0) - (Number(p.discount) || 0);
                                                                    return (
                                                                        <tr key={idx}>
                                                                            <td className="py-2 px-4 text-slate-400">{idx + 1}</td>
                                                                            <td className="py-2 pr-3">
                                                                                <div className="font-semibold text-slate-800">{p.name}</div>
                                                                                <div className="font-mono text-xs text-slate-500">{p.code}</div>
                                                                                {prodLocation(p) && <div className="text-xs text-slate-500">Vị trí: {prodLocation(p).join(', ')}</div>}
                                                                                {p.available !== undefined && <div className="text-xs text-slate-400">Tồn: {Number(p.available) === 0 ? 'Hết hàng (0)' : p.available}</div>}
                                                                            </td>
                                                                            <td className="py-2 pr-3 text-center font-bold">{p.quantity} {p.unit?.name || 'chiếc'}</td>
                                                                            <td className="py-2 pr-3 text-right">
                                                                                {p.price !== undefined ? fmtMoney(p.price) : 'Chưa có'}
                                                                                {p.discount ? <div className="text-xs text-red-500">- {fmtMoney(p.discount)}</div> : null}
                                                                            </td>
                                                                            <td className="py-2 px-4 text-right font-bold text-slate-800">{p.price !== undefined ? fmtMoney(lineTotal) : 'Chưa có'}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    {totalAmount !== null && (
                                                        <div className="px-4 py-3 border-t border-slate-200 space-y-1 text-sm">
                                                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Tổng tiền sản phẩm</span><span className="font-bold text-slate-800">{fmtMoney(totalAmount)}</span></div>
                                                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Tổng chiết khấu sản phẩm</span><span className="font-bold text-slate-800">{fmtMoney(totalDiscount)}</span></div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </section>

                                        <section className="border border-slate-200 rounded-2xl overflow-hidden">
                                            <h4 className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-base font-bold text-slate-900">{carrier?.name || base.carrier_name || 'Vận chuyển'}</h4>
                                            <div className="px-4 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                                <DetailRow label="Mã vận đơn" value={carrier?.carrierCode || base.carrier_code || 'Chưa có'} />
                                                {carrier?.service?.name && <DetailRow label="Dịch vụ" value={carrier.service.name} />}
                                                <DetailRow label="Phí vận chuyển" value={carrier ? fmtMoney(carrier.shipFee) : 'Chưa có'} />
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

                                        {isMarketplaceChannel(base) && !printSubLocked('gui_don_san') && (
                                            <section className="border border-slate-200 rounded-2xl overflow-hidden">
                                                <h4 className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-base font-bold text-slate-900">Gửi đơn sàn</h4>
                                                <div className="px-4 py-3 space-y-3">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="ecom-pickup" checked={ecomPickupType === 1} onChange={() => setEcomPickupType(1)} className="w-4 h-4 text-slate-700 border-slate-300 focus:ring-slate-500" />
                                                        <span className="text-sm font-medium text-slate-700">Báo ship đến lấy hàng</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="ecom-pickup" checked={ecomPickupType === 2} onChange={() => setEcomPickupType(2)} className="w-4 h-4 text-slate-700 border-slate-300 focus:ring-slate-500" />
                                                        <span className="text-sm font-medium text-slate-700">Gửi tại bưu cục</span>
                                                    </label>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button onClick={handleSendEcom} disabled={ecomSending} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                                            {ecomSending && <RefreshCw size={14} className="animate-spin" />} Gửi đơn sàn
                                                        </button>
                                                        {ecomLabelUrl && (
                                                            <button onClick={() => window.open(ecomLabelUrl, '_blank')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"><Printer size={15} /> In phiếu gửi (PDF)</button>
                                                        )}
                                                        {!ecomLabelUrl && !ecomSending && (ecomTracking || (ecomMsg && ecomMsg.includes('Đã gửi'))) && (
                                                            <button onClick={handleRelabelDetail} disabled={!!relabelLoadingIds[String(detailOrder.id)]} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2">
                                                                {relabelLoadingIds[String(detailOrder.id)] && <RefreshCw size={14} className="animate-spin" />} Kéo lại nhãn
                                                            </button>
                                                        )}
                                                    </div>
                                                    {ecomTracking && (
                                                        <p className="text-sm text-slate-700">Mã vận đơn: <span className="font-mono font-bold text-slate-900">{ecomTracking}</span></p>
                                                    )}
                                                    {ecomMsg && (
                                                        <p className="text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{ecomMsg}</p>
                                                    )}
                                                </div>
                                            </section>
                                        )}
                                    </div>

                                    {/* Cột phải: thanh toán, thông tin, lịch trình */}
                                    <div className="space-y-5 min-w-0">
                                        {(payment || carrier) && (
                                            <section className="border border-slate-200 rounded-2xl overflow-hidden">
                                                <h4 className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-base font-bold text-slate-900">Thanh toán</h4>
                                                <div className="px-4 py-2 text-sm">
                                                    {carrier?.customerShipFee !== undefined && <div className="flex justify-between py-1"><span className="text-slate-500">Phí ship báo khách</span><span className="font-bold text-slate-800">{fmtMoney(carrier.customerShipFee)}</span></div>}
                                                    {payment && <div className="flex justify-between py-1"><span className="text-slate-500">Chiết khấu</span><span className="font-bold text-red-500">{Number(payment.discount?.amount) ? `- ${fmtMoney(payment.discount?.amount)}` : fmtMoney(payment.discount?.amount)}</span></div>}
                                                    {payment && <div className="flex justify-between py-1"><span className="text-slate-500">Chuyển khoản</span><span className="font-bold text-slate-800">{fmtMoney(payment.transfer?.amount)}</span></div>}
                                                    {totalAmount !== null && <div className="flex justify-between py-1"><span className="text-slate-500">Thu người nhận</span><span className="font-bold text-slate-800">{fmtMoney(totalAmount - (totalDiscount || 0))}</span></div>}
                                                    {carrier?.shipFee !== undefined && <div className="flex justify-between py-1"><span className="text-slate-500">Thu người gửi</span><span className="font-bold text-red-500">{Number(carrier.shipFee) ? `- ${fmtMoney(carrier.shipFee)}` : fmtMoney(carrier.shipFee)}</span></div>}
                                                    {payment && <div className="flex justify-between py-1"><span className="text-slate-500">VAT</span><span className="font-bold text-slate-800">{fmtMoney(payment.vat?.amount)}</span></div>}
                                                    {payment && <div className="flex justify-between py-1"><span className="text-slate-500">Tiền cọc</span><span className="font-bold text-slate-800">{fmtMoney(payment.deposit?.amount)}</span></div>}
                                                    {payment && <div className="flex justify-between py-1"><span className="text-slate-500">Điểm đã dùng</span><span className="font-bold text-slate-800">{fmtMoney(payment.usedPoints?.amount)} ({payment.usedPoints?.points ?? 'Chưa có'} điểm)</span></div>}
                                                </div>
                                            </section>
                                        )}

                                        <section className="border border-slate-200 rounded-2xl overflow-hidden">
                                            <h4 className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-base font-bold text-slate-900">Thông tin</h4>
                                            <div className="px-4 py-2">
                                                <DetailRow label="ID đơn sàn" value={base.ecom_order_id ? String(base.ecom_order_id) : (channel?.ecomOrderId ? String(channel.ecomOrderId) : 'Chưa có')} />
                                                <DetailRow label="Kênh bán" value={channelName} />
                                                {(channel?.trafficSource?.name || base.traffic_source) && <DetailRow label="Nguồn khách" value={channel?.trafficSource?.name || base.traffic_source} />}
                                                <DetailRow label="Kho xuất" value={base.depot_id ? (DEPOT_NAMES[String(base.depot_id)] || String(base.depot_id)) : 'Chưa có'} />
                                                <DetailRow label="Nhân viên tạo" value={info?.createdBy?.name || base.created_by_name || 'Hệ thống'} />
                                                <DetailRow label="Ngày tạo" value={info?.createdAt ? fmtUnix(info.createdAt) : fmtDateStr(base.created_at)} />
                                                <DetailRow label="Ngày cập nhật" value={info?.updatedAt ? fmtUnix(info.updatedAt) : fmtDateStr(base.updated_at)} />
                                                <DetailRow label="Ngày đóng gói" value={info?.packedAt ? fmtUnix(info.packedAt) : (base.packed_at ? fmtDateStr(base.packed_at) : 'Chưa có')} />
                                                <DetailRow label="Ngày in" value={base.printed_at ? fmtDateStr(base.printed_at) : 'Chưa in'} />
                                                <DetailRow label="Ngày đi" value={base.carrier_date ? fmtDateStr(base.carrier_date) : 'Chưa có'} />
                                                <div className="flex flex-col gap-0.5 py-2">
                                                    <span className="text-xs font-medium text-slate-500">Tình trạng kho</span>
                                                    <span>{getStockBadge(detailOrder)}</span>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="border border-slate-200 rounded-2xl overflow-hidden">
                                            <h4 className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-base font-bold text-slate-900">Lịch trình</h4>
                                            <div className="px-4 py-3">
                                                {detailHistoryLoading ? (
                                                    <p className="text-sm text-slate-500 font-medium flex items-center gap-2"><RefreshCw size={15} className="animate-spin" /> Đang tải lịch sử...</p>
                                                ) : detailHistory.length === 0 ? (
                                                    <div>
                                                        <p className="text-sm text-slate-500 font-medium mb-4">Chưa có lịch sử trong bảng order_histories, chỉ có mốc tạo đơn:</p>
                                                        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
                                                            <li className="pl-5 relative">
                                                                <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow" />
                                                                <p className="text-xs font-medium text-slate-500">{fmtDateStr(base.created_at)}</p>
                                                                <p className="text-sm font-semibold text-slate-800">Tạo đơn: {detailRealStatusName}</p>
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
                                            </div>
                                        </section>

                                        <section className="border border-slate-200 rounded-2xl overflow-hidden">
                                            <h4 className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-base font-bold text-slate-900">Lịch sử Nhanh.vn</h4>
                                            <div className="px-4 py-3">
                                                {!nhanhHistoryLoaded ? (
                                                    <div className="space-y-2">
                                                        <p className="text-sm text-slate-500">Lịch sử này lấy trực tiếp từ Nhanh.vn, không tự tải khi mở popup.</p>
                                                        <button onClick={handleLoadNhanhHistory} disabled={nhanhHistoryLoading} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
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
                                            </div>
                                        </section>
                                    </div>
                                </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setShowBulkSendModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <h3 className="font-bold text-white">Kết quả gửi đơn sang hãng</h3>
                            <button onClick={() => setShowBulkSendModal(false)} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
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
                                        <p key={r.id} className="text-sm text-slate-600">Đơn #{r.id}: mã vận đơn <span className="font-mono font-bold text-slate-800">{r.carrierCode || 'không rõ'}</span>{r.existed ? ' (đã gửi từ trước)' : ''}</p>
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
                                <>
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => openNhanhPrint((bulkSendResult.results || []).filter(r => r.ok).map(r => ({ id: r.id, carrier_code: r.carrierCode || '' })), 'A4')} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2"><Printer size={15} /> In đơn hàng (A4/A5)</button>
                                    <button onClick={() => openNhanhPrint((bulkSendResult.results || []).filter(r => r.ok).map(r => ({ id: r.id, carrier_code: r.carrierCode || '' })), 'K80')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"><Printer size={15} /> In khổ K80</button>
                                </div>
                                <BillPrintButtons items={(bulkSendResult.results || []).filter(r => r.ok).map(r => ({ id: r.id, carrier_code: r.carrierCode || '' }))} />
                                </>
                            )}
                            <button onClick={() => { setShowBulkSendModal(false); handleOpenSendHistory(); }} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 self-start">Xem lịch sử gửi</button>
                            <p className="text-xs text-slate-500">Mã vận đơn sẽ hiện trong bảng sau khi hệ thống đồng bộ đơn từ Nhanh về.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Gửi đơn sàn hàng loạt: chọn hình thức lấy hàng rồi xác nhận */}
            {showBulkEcomModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => !bulkEcomRunning && setShowBulkEcomModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <h3 className="font-bold text-white">Gửi {selectedMarketplaceIds.length} đơn sàn</h3>
                            <button onClick={() => !bulkEcomRunning && setShowBulkEcomModal(false)} disabled={bulkEcomRunning} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-3">
                            <p className="text-sm font-medium text-slate-700">Chỉ gửi các đơn sàn (Shopee/TikTok/Lazada) đã tick.{(selectedOrders.length - selectedMarketplaceIds.length) > 0 && (<> Bỏ qua <span className="font-bold text-amber-700">{selectedOrders.length - selectedMarketplaceIds.length}</span> đơn không phải đơn sàn: {selectedOrders.filter(id => !selectedMarketplaceIds.some(a => String(a) === String(id))).join(', ')}.</>)}</p>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="bulk-ecom-pickup" checked={bulkEcomPickupType === 1} onChange={() => setBulkEcomPickupType(1)} className="w-4 h-4 text-slate-700 border-slate-300 focus:ring-slate-500" />
                                <span className="text-sm font-medium text-slate-700">Báo ship đến lấy hàng</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="bulk-ecom-pickup" checked={bulkEcomPickupType === 2} onChange={() => setBulkEcomPickupType(2)} className="w-4 h-4 text-slate-700 border-slate-300 focus:ring-slate-500" />
                                <span className="text-sm font-medium text-slate-700">Gửi tại bưu cục</span>
                            </label>
                            <button onClick={handleBulkEcom} disabled={bulkEcomRunning} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                {bulkEcomRunning && <RefreshCw size={14} className="animate-spin" />} Xác nhận gửi {selectedMarketplaceIds.length} đơn sàn
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Kết quả gửi đơn sàn hàng loạt: mã vận đơn + link in phiếu từng đơn */}
            {showBulkEcomResultModal && bulkEcomResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setShowBulkEcomResultModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <h3 className="font-bold text-white">Kết quả gửi đơn sàn</h3>
                            <button onClick={() => setShowBulkEcomResultModal(false)} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-3">
                            {bulkEcomRunning && (
                                <div className="space-y-2">
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-600 transition-all" style={{ width: `${bulkEcomProgress.total > 0 ? Math.round((bulkEcomProgress.done / bulkEcomProgress.total) * 100) : 0}%` }} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">Đang gửi {bulkEcomProgress.done}/{bulkEcomProgress.total}{bulkEcomProgress.currentId ? ` — đơn #${bulkEcomProgress.currentId}...` : '...'}</p>
                                    <button onClick={() => { bulkEcomStopRef.current = true; }} className="px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-bold rounded-lg hover:bg-red-50">Dừng</button>
                                </div>
                            )}
                            <p className="text-sm font-medium text-slate-700">
                                Thành công <span className="font-bold text-green-700">{bulkEcomDisplayOkCount}</span> đơn
                                {bulkEcomDisplayFailCount > 0 && (<> · Thất bại <span className="font-bold text-red-600">{bulkEcomDisplayFailCount}</span> đơn</>)}
                                {(bulkEcomResult?.skippedIds || []).length > 0 && (<> · Bỏ qua <span className="font-bold text-amber-700">{(bulkEcomResult?.skippedIds || []).length}</span> đơn không phải đơn sàn</>)}.
                            </p>
                            {(bulkEcomResult?.skippedIds || []).length > 0 && (
                                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    Bỏ qua vì không phải đơn sàn (Shopee/TikTok/Lazada): {(bulkEcomResult?.skippedIds || []).join(', ')}
                                </p>
                            )}
                            {bulkEcomDisplayResults.filter(r => r.ok).length > 0 && (
                                <div className="space-y-1">
                                    {bulkEcomDisplayResults.filter(r => r.ok).map(r => renderEcomResultRow(r, handleRelabelBulk))}
                                </div>
                            )}
                            {bulkEcomDisplayResults.filter(r => !r.ok).length > 0 && (
                                <div className="space-y-1 border-t border-slate-200 pt-2">
                                    {bulkEcomDisplayResults.filter(r => !r.ok).map(r => renderEcomResultRow(r, handleRelabelBulk))}
                                </div>
                            )}
                            {bulkEcomResult?.message && <p className="text-sm text-red-600">{bulkEcomResult.message}</p>}
                            {bulkEcomDisplayLabelUrls.length >= 2 && (
                                <button onClick={() => downloadMergedLabels(bulkEcomDisplayLabelUrls).catch(() => {})} disabled={mergingLabels} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                    {mergingLabels && <RefreshCw size={14} className="animate-spin" />} In tất cả phiếu (1 file PDF)
                                </button>
                            )}
                            {mergeLabelsMsg && <p className="text-sm text-red-600">{mergeLabelsMsg}</p>}
                            <p className="text-xs text-slate-500">Mã vận đơn đã cập nhật ngay trong bảng; nhãn PDF mở trong tab mới.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* In mã đơn sàn hàng loạt: lấy nhãn PDF sàn của các đơn sàn
                đã có mã vận đơn thật rồi gộp 1 file để in (không gửi lại).
                Đóng modal bị chặn trong lúc đang lấy để khỏi mất tiến trình;
                bấm Dừng thì dừng sau đơn hiện tại, giữ kết quả đã xong. */}
            {showPrintLabelsModal && printLabelsResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => !printLabelsRunning && setShowPrintLabelsModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <h3 className="font-bold text-white">In mã đơn sàn</h3>
                            <button onClick={() => !printLabelsRunning && setShowPrintLabelsModal(false)} disabled={printLabelsRunning} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-3">
                            {printLabelsRunning && (
                                <div className="space-y-2">
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-600 transition-all" style={{ width: `${printLabelsProgress.total > 0 ? Math.round((printLabelsProgress.done / printLabelsProgress.total) * 100) : 0}%` }} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">Đang lấy nhãn {printLabelsProgress.done}/{printLabelsProgress.total}{printLabelsProgress.currentId ? ` — đơn #${printLabelsProgress.currentId}...` : '...'}</p>
                                    <button onClick={() => { printLabelsStopRef.current = true; }} className="px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-bold rounded-lg hover:bg-red-50">Dừng</button>
                                </div>
                            )}
                            <p className="text-sm font-medium text-slate-700">
                                Lấy được <span className="font-bold text-green-700">{printLabelsDisplayOkCount}</span>/{printLabelsProgress.total} nhãn
                                {printLabelsDisplayFailCount > 0 && (<> · Thất bại <span className="font-bold text-red-600">{printLabelsDisplayFailCount}</span> đơn</>)}
                                {(printLabelsResult?.skippedIds || []).length > 0 && (<> · Bỏ qua <span className="font-bold text-amber-700">{(printLabelsResult?.skippedIds || []).length}</span> đơn</>)}.
                            </p>
                            {(printLabelsResult?.skippedIds || []).length > 0 && (
                                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    Bỏ qua vì không phải đơn sàn (Shopee/TikTok/Lazada) hoặc chưa có mã vận đơn thật: {(printLabelsResult?.skippedIds || []).join(', ')}
                                </p>
                            )}
                            {printLabelsDisplayResults.filter(r => r.ok).length > 0 && (
                                <div className="space-y-1">
                                    {printLabelsDisplayResults.filter(r => r.ok).map(r => renderEcomResultRow(r, handleRelabelPrintLabels))}
                                </div>
                            )}
                            {printLabelsDisplayResults.filter(r => !r.ok).length > 0 && (
                                <div className="space-y-1 border-t border-slate-200 pt-2">
                                    {printLabelsDisplayResults.filter(r => !r.ok).map(r => renderEcomResultRow(r, handleRelabelPrintLabels))}
                                </div>
                            )}
                            {printLabelsResult?.message && <p className="text-sm text-red-600">{printLabelsResult.message}</p>}
                            {printLabelsDisplayLabelUrls.length >= 1 && (
                                <button onClick={() => downloadMergedLabels(printLabelsDisplayLabelUrls).catch(() => {})} disabled={mergingLabels} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                    {mergingLabels && <RefreshCw size={14} className="animate-spin" />} In tất cả phiếu (1 file PDF)
                                </button>
                            )}
                            {mergeLabelsMsg && <p className="text-sm text-red-600">{mergeLabelsMsg}</p>}
                            <p className="text-xs text-slate-500">Nhãn PDF lấy qua API Nhanh (ecom/getprintlabel), không gửi lại đơn; gộp thành 1 file rồi mở trong tab mới để in.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Hủy hàng loạt: nhập 1 lý do chung rồi xác nhận */}
            {showBulkCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => !bulkCancelRunning && setShowBulkCancelModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <h3 className="font-bold text-white">Hủy {selectedOrders.length} đơn đã chọn</h3>
                            <button onClick={() => !bulkCancelRunning && setShowBulkCancelModal(false)} disabled={bulkCancelRunning} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-3">
                            {!bulkCancelResult ? (
                                <>
                                    <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Hủy trên Nhanh sẽ đổi trạng thái các đơn này và gọi hủy sang hãng nếu đơn đã gửi. Hành động này không hoàn tác được từ đây.</p>
                                    <label className="block text-xs font-bold text-slate-600">Lý do hủy chung (không bắt buộc)</label>
                                    <input value={cancelReasonBulk} onChange={(e) => setCancelReasonBulk(e.target.value)} placeholder="VD: Khách hàng yêu cầu hủy" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-700" />
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
                                    <button onClick={() => setShowBulkCancelModal(false)} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50">Đóng</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Lịch sử gửi sang hãng: 5 lần gần nhất, mỗi mục có nút in lại */}
            {showSendHistoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setShowSendHistoryModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <h3 className="font-bold text-white">Lịch sử gửi sang hãng (5 lần gần nhất)</h3>
                            <button onClick={() => setShowSendHistoryModal(false)} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4">
                            {sendHistoryLoading && <p className="text-sm text-slate-500 font-medium flex items-center gap-2"><RefreshCw size={15} className="animate-spin" /> Đang tải lịch sử...</p>}
                            {!sendHistoryLoading && sendHistory.length === 0 && (
                                <p className="text-sm text-slate-500">Chưa có lần gửi nào được lưu.</p>
                            )}
                            {sendHistory.map(entry => {
                                const items = Array.isArray(entry.items) ? entry.items : [];
                                const okItems = items.filter(it => it.ok);
                                // Mục đơn sàn: nhận diện theo item (it.orderId !== undefined),
                                // không theo source — cả gửi 1 đơn (source 'detail') lẫn
                                // gửi bulk (source 'toolbar') đều là đơn sàn nếu item là ecom.
                                const isEcomEntry = items.some(it => it.orderId !== undefined);
                                const ecomLabelUrls = items.filter(it => it.ok && it.labelUrl).map(it => it.labelUrl);
                                return (
                                    <div key={entry.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                                        <div className="flex justify-between gap-3">
                                            <span className="text-sm font-bold text-slate-800">{fmtDateStr(entry.created_at)}</span>
                                            <span className="text-xs text-slate-400 shrink-0">{isEcomEntry ? 'Đơn sàn' : entry.source === 'popup' ? 'Popup chi tiết' : entry.source === 'toolbar' ? 'Thanh công cụ' : (entry.source || '')}</span>
                                        </div>
                                        {/* Lịch sử gọn: chỉ list ID đơn + nút in lại. Đơn gửi lỗi
                                            chỉ hiện ID mờ, không kèm lỗi. */}
                                        {isEcomEntry ? (
                                            <div className="space-y-0.5">
                                                {items.map(it => renderEcomHistoryRow(it, (oid) => handleRelabelHistory(oid)))}
                                            </div>
                                        ) : (
                                            <p className="text-sm font-mono break-words leading-relaxed">
                                                {items.map((it, i) => (
                                                    <span key={it.id} className={it.ok ? 'font-bold text-slate-800' : 'text-slate-400'}>
                                                        #{it.id}{i < items.length - 1 ? ', ' : ''}
                                                    </span>
                                                ))}
                                            </p>
                                        )}
                                        {!isEcomEntry && (
                                            <>
                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        disabled={okItems.length === 0}
                                                        onClick={() => openNhanhPrint(okItems.map(it => ({ id: it.id, carrier_code: it.carrierCode || '' })), 'A4')}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                                                    ><Printer size={13} /> In lại (A4/A5)</button>
                                                    <button
                                                        disabled={okItems.length === 0}
                                                        onClick={() => openNhanhPrint(okItems.map(it => ({ id: it.id, carrier_code: it.carrierCode || '' })), 'K80')}
                                                        className="px-3 py-1.5 bg-white border border-slate-300 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1"
                                                    ><Printer size={13} /> In lại (K80)</button>
                                                </div>
                                                {okItems.length > 0 && <BillPrintButtons small items={okItems.map(it => ({ id: it.id, carrier_code: it.carrierCode || '' }))} />}
                                            </>
                                        )}
                                        {isEcomEntry && ecomLabelUrls.length >= 2 && (
                                            <div className="flex gap-2 pt-1">
                                                <button onClick={() => downloadMergedLabels(ecomLabelUrls).catch(() => {})} disabled={mergingLabels} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                                                    {mergingLabels && <RefreshCw size={13} className="animate-spin" />} In tất cả phiếu (1 file PDF)
                                                </button>
                                            </div>
                                        )}
                                        {isEcomEntry && mergeLabelsMsg && <p className="text-xs text-red-600">{mergeLabelsMsg}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Popup thao tác Nhanh.vn: dùng chung cho menu Thao tác
                trong popup chi tiết và bút chì sửa nhanh trên dòng bảng.
                Nổi lên trên popup chi tiết (z-[60]) thay vì chèn panel
                trong popup như trước. */}
            {detailAction && actionOrder && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50" onClick={closeActionModal}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <div>
                                <h3 className="font-bold text-white">
                                    {detailAction === 'edit' && 'Sửa ghi chú đơn'}
                                    {detailAction === 'status' && 'Đổi trạng thái đơn'}
                                    {detailAction === 'send' && 'Gửi đơn sang hãng vận chuyển'}
                                    {detailAction === 'cancel' && 'Hủy đơn trên Nhanh'}
                                </h3>
                                <p className="text-xs text-slate-300 mt-1">Đơn #{actionOrder.id} · Trạng thái hiện tại: <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[actionOrder.status] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{LOCAL_STATUS_NAMES[String(actionOrder.status)] || actionOrder.status}</span></p>
                            </div>
                            <button onClick={closeActionModal} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-3">
                            {detailAction === 'edit' && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-600">Ghi chú đơn</label>
                                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-700" />
                                    <label className="block text-xs font-bold text-slate-600">Ghi chú nội bộ</label>
                                    <textarea value={editPrivateDescription} onChange={(e) => setEditPrivateDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-700" />
                                    <p className="text-xs text-slate-500">Nhanh.vn không cho sửa đơn đã gửi sang hãng, đơn Thành công hoặc đơn đã hoàn — trường hợp đó sẽ báo lỗi từ Nhanh.</p>
                                    <button onClick={handleSaveEdit} disabled={detailActionLoading} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                        {detailActionLoading && <RefreshCw size={14} className="animate-spin" />} Lưu thay đổi
                                    </button>
                                </div>
                            )}
                            {detailAction === 'status' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {EDIT_STATUS_ORDER.map(code => {
                                            const selected = editStatus === code;
                                            return (
                                                <button key={code} onClick={() => {
                                                    setEditStatus(code);
                                                    if ((code === '60' || code === '72') && !editDate) {
                                                        const d = new Date();
                                                        setEditDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                                                    }
                                                }} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition ${selected ? 'border-slate-900 bg-slate-100 text-slate-900 ring-1 ring-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}>
                                                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium shrink-0 ${STATUS_COLORS[code] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{LOCAL_STATUS_NAMES[code]}</span>
                                                    <span className="text-xs text-slate-400">{code}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {(editStatus === '60' || editStatus === '72') && (
                                        <>
                                            <label className="block text-xs font-bold text-slate-600">{editStatus === '60' ? 'Ngày giao thành công' : 'Ngày hoàn hàng'} (Nhanh yêu cầu)</label>
                                            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-700" />
                                        </>
                                    )}
                                    <p className="text-xs text-slate-500">Một số trạng thái do hãng tự cập nhật (Chờ thu gom, Đang chuyển...) Nhanh có thể từ chối nếu đổi tay.</p>
                                    <button onClick={handleSaveStatus} disabled={detailActionLoading} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                        {detailActionLoading && <RefreshCw size={14} className="animate-spin" />} Lưu trạng thái
                                    </button>
                                </div>
                            )}
                            {detailAction === 'send' && (
                                <div className="space-y-2">
                                    {hasRealCarrier(actionOrder) && <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Đơn đã có mã vận đơn {actionOrder.carrier_code}, Nhanh sẽ trả lại mã cũ nếu đơn đã gửi rồi.</p>}
                                    <p className="text-sm text-slate-600">Gửi đơn này sang hãng vận chuyển để lấy mã vận đơn trên Nhanh.</p>
                                    <button onClick={handleSendShip} disabled={detailActionLoading} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                        {detailActionLoading && <RefreshCw size={14} className="animate-spin" />} Xác nhận gửi sang hãng
                                    </button>
                                    {detailSendDone && (
                                        <div className="space-y-2 pt-1">
                                        <div className="flex gap-2">
                                            <button onClick={() => openNhanhPrint([{ id: actionOrder.id, carrier_code: actionOrder.carrier_code || '' }], 'A4')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"><Printer size={15} /> In đơn hàng (A4/A5)</button>
                                            <button onClick={() => openNhanhPrint([{ id: actionOrder.id, carrier_code: actionOrder.carrier_code || '' }], 'K80')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"><Printer size={15} /> In khổ K80</button>
                                        </div>
                                        <BillPrintButtons items={[{ id: actionOrder.id, carrier_code: actionOrder.carrier_code || '' }]} />
                                        </div>
                                    )}
                                </div>
                            )}
                            {detailAction === 'cancel' && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Hủy đơn trên Nhanh sẽ đổi trạng thái đơn và gọi hủy sang hãng nếu đơn đã gửi. Hành động này không hoàn tác được từ đây.</p>
                                    <label className="block text-xs font-bold text-slate-600">Lý do hủy (không bắt buộc)</label>
                                    <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="VD: Khách hàng yêu cầu hủy" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-700" />
                                    <button onClick={handleCancelShip} disabled={detailActionLoading} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                                        {detailActionLoading && <RefreshCw size={14} className="animate-spin" />} Xác nhận hủy đơn
                                    </button>
                                </div>
                            )}
                            {detailActionMsg && <p className="text-sm font-medium text-slate-700">{detailActionMsg}</p>}
                        </div>
                        <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
                            <button onClick={closeActionModal} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* List các đơn vừa in: khổ A thì mã vận đơn, khổ K80 thì ID đơn */}
            {printList && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setPrintList(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <h3 className="font-bold text-white">
                                {printList.size === 'K80'
                                    ? `List ID đơn vừa in (khổ K80) — ${printList.items.length} đơn`
                                    : `List mã vận đơn vừa in (khổ A4/A5) — ${printList.items.length} đơn`}
                            </h3>
                            <button onClick={() => setPrintList(null)} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-1.5">
                            {printList.items.map(item => (
                                <p key={item.id} className="text-sm text-slate-700 border-b border-slate-100 pb-1.5">
                                    {printList.size === 'K80' ? (
                                        <span className="font-mono font-bold text-slate-900">{item.id}</span>
                                    ) : item.carrier_code ? (
                                        <><span className="font-mono font-bold text-slate-900">{item.carrier_code}</span><span className="text-slate-400 text-xs"> · Đơn #{item.id}</span></>
                                    ) : (
                                        <><span className="text-slate-500">Đơn #{item.id} — chưa có mã vận đơn</span></>
                                    )}
                                </p>
                            ))}
                        </div>
                        <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
                            <button onClick={handleCopyPrintList} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">{printCopied ? 'Đã sao chép' : 'Sao chép list'}</button>
                            <button onClick={() => setPrintList(null)} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Missed Webhook Modal */}
            {showMissedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center bg-slate-900">
                            <h3 className="font-bold text-white">Cảnh báo Đơn hàng lỗi (Miss Webhook)</h3>
                            <button onClick={() => !isUpdatingWebhooks && setShowMissedModal(false)} disabled={isUpdatingWebhooks} className="text-slate-300 hover:text-white"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex flex-col gap-3">
                                <div className="text-sm font-medium">Hệ thống ghi nhận <strong className="text-red-600 text-base">{missedWebhookOrders.length}</strong> đơn hàng chưa tải được danh sách sản phẩm.</div>
                                <button
                                    onClick={handleAutoUpdateWebhooks}
                                    disabled={isUpdatingWebhooks}
                                    className="self-start flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
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
