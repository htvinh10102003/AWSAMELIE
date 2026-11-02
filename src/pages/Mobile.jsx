import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Printer, AlertTriangle, MapPin, Search, ScanLine, Settings, ClipboardList, RefreshCw, Package, Pencil, X, LogOut, Save, Lock, Bell, Palette, FileSpreadsheet, User } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { getUserRole, isAdminRole, isSuperAdminRole, roleLabel } from '../lib/roles';

// Giao diện điện thoại riêng, chỉ xem nhanh và thao tác gọn trên điện thoại.
// - Đơn in: thẻ đơn chỉ ID, sản phẩm, trạng thái (kèm mã vận đơn nhỏ nếu có
//   và tình trạng kho). Số lượng + ô tìm kiếm cố định ở đầu tab, kéo xuống
//   chỉ lướt phần danh sách đơn.
// - Vị trí: tra cứu theo tên/mã; admin trở lên bấm vào sản phẩm để cập nhật
//   vị trí, giống bản máy tính (Cập nhật sơ đồ kho): tên có dạng "Tên - S/M/L"
//   thì tick "size khác" sẽ cập nhật cả 3 size, còn không thì chỉ đúng sản phẩm đó.
// - Tìm đơn: KHÔNG load trước data, chỉ tìm khi người dùng nhập hoặc quét.
//   Người dùng chọn tìm theo Mã vận đơn (mặc định) hoặc ID đơn. Quét xong
//   lấy mã vận đơn đó tìm thẳng cột carrier_code trong bảng orders (toàn bộ
//   CSDL, không chỉ đơn có thể in). Kết quả gồm mã vận đơn/ID đơn, ngày tạo
//   đơn, sản phẩm, số lượng, trạng thái.
// - Đối soát: chỉ Tổng in, Tổng đóng, Tổng hủy, Tổng bàn giao trong ngày hôm
//   nay (đơn in trong ngày làm gốc, giống phiên đối soát bản máy tính), và
//   danh sách đơn cần bàn giao lại chỉ gồm đơn in trong ngày có trạng thái
//   Đang đóng gói (42), Đã xác nhận (56) hoặc Chờ xác nhận (57). Đơn Đã đóng
//   gói (40), Đang chuyển (59) và các trạng thái khác đã giao cho đơn vị vận
//   chuyển rồi nên không cần bàn giao lại.
// - Cài đặt: tài khoản (xem thông tin, đổi mật khẩu, đăng xuất) cho mọi người;
//   quét Google Sheet cho admin/owner; giao diện lễ hội cho owner/super_admin;
//   thông báo toàn hệ thống và khóa tính năng cho owner (đúng phân quyền bản máy tính).
const LOCAL_STATUS_NAMES = {
    '40': 'Đã đóng gói', '42': 'Đang đóng gói', '43': 'Chờ thu gom',
    '54': 'Đơn mới', '55': 'Đang xác nhận', '56': 'Đã xác nhận', '57': 'Chờ xác nhận',
    '58': 'Hãng vận chuyển hủy đơn', '59': 'Đang chuyển', '60': 'Thành công', '61': 'Thất bại',
    '63': 'Khách hủy', '64': 'Hệ thống hủy', '68': 'Hết hàng',
    '71': 'Đang chuyển hoàn', '72': 'Đã chuyển hoàn', '73': 'Đổi kho xuất hàng', '74': 'Xác nhận hoàn'
};
const CANCELED_STATUS = [58, 63, 64];
const CHANNEL_NAMES = {
    '1': 'Admin', '2': 'Website', '10': 'API', '20': 'Facebook', '21': 'Instagram',
    '41': 'Lazada', '42': 'Shopee', '43': 'Sendo', '45': 'Tiki', '48': 'Tiktok Shop',
    '49': 'Zalo OA', '50': 'Shopee chat', '51': 'Lazada chat', '52': 'Zalo cá nhân'
};
const SUPER_OWNER_EMAIL = 'contact.hotavinh@gmail.com';
const FEATURE_PARENTS = [
    { id: 'dashboard', name: 'Dashboard' }, { id: 'print_orders', name: 'Đơn in' },
    { id: 'packing', name: 'Đóng gói' }, { id: 'return_orders', name: 'Báo cáo đơn hoàn' },
    { id: 'inventory_check', name: 'Báo cáo kiểm kê' }, { id: 'standalone_doi_soat', name: 'Đối soát đơn cuối ngày' },
    { id: 'inventory_report', name: 'Báo cáo tồn kho' }, { id: 'complaints', name: 'Khiếu nại' },
    { id: 'standalone_khai_gia', name: 'Đơn không khai giá' }, { id: 'admin_sys', name: 'Quản trị Hệ thống' },
    { id: 'kpi', name: 'Quản lý KPI & Lỗi' }, { id: 'system_adjust', name: 'Cập nhật & Hiệu chỉnh' },
];
const THEME_DEFS = [
    { key: 'theme_national_day', field: 'isNationalDayEnabled', label: 'Quốc Khánh' },
    { key: 'theme_mid_autumn', field: 'isMidAutumnEnabled', label: 'Trung Thu' },
    { key: 'theme_christmas', field: 'isXmasEnabled', label: 'Giáng Sinh' },
    { key: 'theme_tet', field: 'isTetEnabled', label: 'Tết Nguyên Đán' },
];
const TABS = [
    { id: 'print', label: 'Đơn in', icon: Printer },
    { id: 'location', label: 'Vị trí', icon: MapPin },
    { id: 'search', label: 'Tìm đơn', icon: Search },
    { id: 'reconcile', label: 'Đối soát', icon: ClipboardList },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
];

// Đặt ngoài component chính để tránh remount làm mất focus khi gõ vào ô nhập trong Section.
const Section = ({ icon: Icon, title, children }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
        <div className="font-bold text-slate-900 text-sm flex items-center gap-2"><Icon size={16} className="text-slate-500" /> {title}</div>
        {children}
    </div>
);

const Toggle = ({ checked, onChange }) => (
    <button type="button" onClick={() => onChange(!checked)} className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors ${checked ? 'bg-green-500' : 'bg-slate-300'}`}>
        <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
);

export default function Mobile() {
    const [session, setSession] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [tab, setTab] = useState('print');
    const [data, setData] = useState({ printable: [], holding: [], outOfStock: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusDict, setStatusDict] = useState({});
    const [search, setSearch] = useState('');
    const [visibleCount, setVisibleCount] = useState(30);
    const [locQuery, setLocQuery] = useState('');
    const [locResults, setLocResults] = useState([]);
    const [locLoading, setLocLoading] = useState(false);
    const [locSearched, setLocSearched] = useState(false);
    const [locEdit, setLocEdit] = useState(null);
    const [locNew, setLocNew] = useState('');
    const [locAllSizes, setLocAllSizes] = useState(false);
    const [locSaving, setLocSaving] = useState(false);
    const [locMessage, setLocMessage] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);
    const html5QrcodeRef = useRef(null);
    const [reconData, setReconData] = useState([]);
    const [reconLoading, setReconLoading] = useState(false);
    const [reconError, setReconError] = useState('');
    const [reconVisible, setReconVisible] = useState(30);
    // Biên bản đối soát xem lại (chỉ xem, không tạo/sửa/chốt — biên bản
    // do PC tạo, mobile chỉ đọc nguyên dữ liệu từ reconciliation_sessions).
    const [bbSessions, setBbSessions] = useState([]);
    const [bbLoading, setBbLoading] = useState(false);
    const [bbError, setBbError] = useState('');
    const [bbExpandedId, setBbExpandedId] = useState(null);
    const [bbDetails, setBbDetails] = useState({});
    const [bbDetailLoading, setBbDetailLoading] = useState({});
    const [searchMode, setSearchMode] = useState('carrier');
    const [dbSearchResults, setDbSearchResults] = useState([]);
    const [dbSearching, setDbSearching] = useState(false);
    const [dbSearched, setDbSearched] = useState(false);
    const [dbSearchError, setDbSearchError] = useState('');
    const [pwCurrent, setPwCurrent] = useState('');
    const [pwNew, setPwNew] = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [pwMessage, setPwMessage] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [showPwForm, setShowPwForm] = useState(false);
    const [sheetDailyMsg, setSheetDailyMsg] = useState('');
    const [sheetPrintMsg, setSheetPrintMsg] = useState('');
    const [sheetDailyLoading, setSheetDailyLoading] = useState(false);
    const [sheetPrintLoading, setSheetPrintLoading] = useState(false);
    const [themes, setThemes] = useState({});
    const [themesMessage, setThemesMessage] = useState('');
    const [themesSaving, setThemesSaving] = useState(false);
    const [banner, setBanner] = useState({ enabled: false, type: 'info', content: '', speed: 15 });
    const [popupNotif, setPopupNotif] = useState({ enabled: false, type: 'info', title: '', content: '' });
    const [notifMessage, setNotifMessage] = useState('');
    const [notifSaving, setNotifSaving] = useState(false);
    const [locks, setLocks] = useState({});
    const [locksMessage, setLocksMessage] = useState('');
    const [locksSaving, setLocksSaving] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    const user = session?.user || null;
    const role = getUserRole(user);
    const isOwnerUser = user?.user_metadata?.is_owner === true || user?.email === SUPER_OWNER_EMAIL;
    const isAdminOrOwner = isOwnerUser || isAdminRole(role);
    const canEditSensitive = isOwnerUser || isSuperAdminRole(role);
    const canEditLocation = isAdminOrOwner;

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => { setSession(s); setAuthLoading(false); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setAuthLoading(false); });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
    }, []);

    const fetchAllocation = async () => {
        setLoading(true); setError('');
        try {
            const { data: stData } = await supabase.from('order_statuses').select('id,name');
            const dict = {}; stData?.forEach(s => dict[s.id] = s.name); setStatusDict(dict);
            const { data: alloc, error: allocErr } = await supabase.functions.invoke('wms-allocation');
            if (allocErr) throw allocErr;
            setData({ printable: alloc?.printable || [], holding: alloc?.holding || [], outOfStock: alloc?.outOfStock || [] });
        } catch (err) { setError(err.message || 'Không tải được dữ liệu.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAllocation(); }, []);

    useEffect(() => {
        setSearch(''); setVisibleCount(30); setReconVisible(30); setDbSearched(false); setDbSearchResults([]); setDbSearchError('');
        if (tab === 'reconcile') { fetchRecon(); fetchBbSessions(); }
        if (tab === 'settings' && !settingsLoaded) loadSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    useEffect(() => () => stopScanner(), []);

    const statusName = (code) => {
        if (String(code) === '57') return 'Chờ xác nhận';
        return statusDict[code] || LOCAL_STATUS_NAMES[String(code)] || String(code);
    };

    const matchesSearch = (order, q) => {
        if (!q.trim()) return true;
        const query = q.trim().toLowerCase();
        return String(order.id).toLowerCase().includes(query)
            || (order.ecom_order_id && String(order.ecom_order_id).toLowerCase().includes(query))
            || (order.carrier_code && String(order.carrier_code).toLowerCase().includes(query))
            || (order.order_products || []).some(p =>
                (p.product_name && p.product_name.toLowerCase().includes(query)) ||
                (p.product_code && p.product_code.toLowerCase().includes(query)));
    };

    const stockOf = (order) => {
        if (data.printable.some(o => o.id === order.id)) return { label: 'Đủ hàng', cls: 'bg-green-100 text-green-700' };
        if (data.holding.some(o => o.id === order.id)) return { label: 'Tạm giữ', cls: 'bg-yellow-100 text-yellow-700' };
        if (data.outOfStock.some(o => o.id === order.id)) return { label: 'Hết hàng', cls: 'bg-red-100 text-red-700' };
        return null;
    };

    const printOrders = useMemo(() => data.printable.filter(o => matchesSearch(o, search)), [data, search]);

    // Tìm đơn trực tiếp trong bảng orders, không qua dữ liệu phân bổ đã load
    // cho tab Đơn in, nên tìm được cả đơn ngoài nhóm đơn có thể in.
    // Tìm theo mã vận đơn chậm vì trước đây chỉ dùng ilike (quét toàn bảng,
    // cột carrier_code chưa có index). Nay thử khớp chính xác trước (.eq dùng
    // được index btree khi đã chạy file supabase/20261102_orders_carrier_code_index.sql),
    // không khớp mới thử khớp không phân biệt hoa/thường như cũ.
    const handleDbSearch = async (termOverride, modeOverride) => {
        const term = (termOverride !== undefined ? termOverride : search).trim();
        const mode = modeOverride || searchMode;
        if (!term) return;
        setDbSearching(true); setDbSearched(true); setDbSearchError('');
        try {
            const searchCols = 'id, carrier_code, created_at, status, order_products (product_code, product_name, quantity)';
            let rows = null;
            if (mode === 'carrier') {
                const exact = await supabase.from('orders').select(searchCols)
                    .eq('carrier_code', term).order('created_at', { ascending: false }).limit(20);
                if (exact.error) throw exact.error;
                rows = exact.data;
                if (!rows || rows.length === 0) {
                    const ci = await supabase.from('orders').select(searchCols)
                        .ilike('carrier_code', term).order('created_at', { ascending: false }).limit(20);
                    if (ci.error) throw ci.error;
                    rows = ci.data;
                }
            } else {
                const byId = await supabase.from('orders').select(searchCols)
                    .eq('id', term).order('created_at', { ascending: false }).limit(20);
                if (byId.error) throw byId.error;
                rows = byId.data;
            }
            setDbSearchResults(rows || []);
        } catch (err) {
            setDbSearchResults([]);
            setDbSearchError(err.message || 'Không tìm được đơn.');
        } finally { setDbSearching(false); }
    };

    // Popup chi tiết đơn cho kết quả tìm: lấy nguyên dòng orders + lịch sử.
    const [detailOrder, setDetailOrder] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailHistory, setDetailHistory] = useState([]);

    const parseOrderRaw = (order) => {
        if (!order) return null;
        for (const key of ['raw_data', 'raw', 'data', 'payload', 'nhanh_data', 'order_data']) {
            const v = order[key];
            if (!v) continue;
            try {
                const parsed = typeof v === 'string' ? JSON.parse(v) : v;
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) {}
        }
        return null;
    };

    const openOrderDetail = async (order) => {
        setDetailOrder(order); setDetailLoading(true); setDetailError(''); setDetailHistory([]);
        try {
            const { data, error } = await supabase.from('orders')
                .select('*, order_products (product_code, product_name, quantity)')
                .eq('id', order.id).single();
            if (error) throw error;
            setDetailOrder(data);
            const { data: hist } = await supabase.from('order_histories')
                .select('id, created_at, created_by_name, status_old, status_new')
                .eq('order_id', order.id).order('created_at', { ascending: false }).limit(20);
            setDetailHistory(hist || []);
        } catch (err) {
            setDetailError(err.message || 'Không tải được chi tiết đơn.');
        } finally { setDetailLoading(false); }
    };

    const closeOrderDetail = () => { setDetailOrder(null); setDetailError(''); setDetailHistory([]); };

    const formatOrderDate = (value) => {
        if (!value) return '';
        try {
            return new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return String(value); }
    };

    const handleLocationSearch = async () => {
        if (!locQuery.trim()) return;
        setLocLoading(true); setLocSearched(true); setLocMessage('');
        try {
            const term = locQuery.trim();
            const { data: rows, error: locErr } = await supabase
                .from('product_inventories')
                .select('product_id, product_name, product_code, location_code')
                .or(`product_name.ilike.%${term}%,product_code.ilike.%${term}%`)
                .limit(50);
            if (locErr) throw locErr;
            setLocResults(rows || []);
        } catch (err) { setLocResults([]); }
        finally { setLocLoading(false); }
    };

    const saveLocEdit = async (e) => {
        e.preventDefault();
        if (!locEdit) return;
        setLocSaving(true); setLocMessage('');
        const newLoc = locNew.trim();
        try {
            let query = supabase.from('product_inventories').update({ location_code: newLoc });
            let updated = null;
            if (locAllSizes) {
                const match = locEdit.product_name.match(/^(.*?)\s*-\s*([SML])$/i);
                if (match) {
                    const baseName = match[1];
                    const targetNames = [`${baseName} - S`, `${baseName} - M`, `${baseName} - L`];
                    const { data, error } = await query.in('product_name', targetNames).select('product_name');
                    if (error) throw error; updated = data;
                } else {
                    const { data, error } = await query.eq('product_id', locEdit.product_id).select('product_name');
                    if (error) throw error; updated = data;
                }
            } else {
                const { data, error } = await query.eq('product_id', locEdit.product_id).select('product_name');
                if (error) throw error; updated = data;
            }
            if (!updated || updated.length === 0) throw new Error('Database từ chối ghi dữ liệu.');
            setLocMessage(`Đã lưu vị trí "${newLoc}" cho ${updated.length} sản phẩm: ${updated.map(p => p.product_name).join(', ')}.`);
            setLocResults(prev => prev.map(p => {
                if (updated.some(u => u.product_name === p.product_name)) return { ...p, location_code: newLoc };
                return p;
            }));
        } catch (err) { setLocMessage('Lỗi: ' + err.message); }
        finally { setLocSaving(false); }
    };

    // Mã quét được chính là mã vận đơn, dùng nguyên văn để tìm cột
    // carrier_code, không cắt thành dãy số (cắt số sẽ biến mã NVS... thành
    // ID đơn và tìm sai cột).
    const extractCarrierCode = (text) => {
        const t = (text || '').trim();
        if (!t) return '';
        if (/^https?:\/\//i.test(t)) {
            try {
                const url = new URL(t);
                const code = url.searchParams.get('code') || url.searchParams.get('carrier_code') || url.searchParams.get('tracking');
                if (code) return code;
                const parts = url.pathname.split('/').filter(Boolean);
                if (parts.length) return parts[parts.length - 1];
            } catch (e) {}
        }
        return t;
    };

    const stopScanner = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (streamRef.current) { streamRef.current.getTracks().forEach(tr => tr.stop()); streamRef.current = null; }
        if (videoRef.current) videoRef.current.srcObject = null;
        if (html5QrcodeRef.current) {
            const inst = html5QrcodeRef.current;
            html5QrcodeRef.current = null;
            try { if (inst.isScanning) inst.stop().catch(() => {}); } catch (e) {}
        }
    };

    const startScanner = () => {
        setScanError(''); setScanning(true);
    };

    // Chạy sau khi modal camera đã render xong thì videoRef mới có phần tử để gắn luồng hình.
    useEffect(() => {
        if (!scanning) return;
        let cancelled = false;
        // Dự phòng cho iPhone: Safari iOS không có BarcodeDetector nên dùng
        // html5-qrcode (đã có sẵn trong app, các trang desktop đang dùng).
        // Máy có BarcodeDetector (Android) vẫn đi đường native bên dưới.
        if (!window.BarcodeDetector) {
            const timer = setTimeout(() => {
                if (cancelled) return;
                const html5QrCode = new Html5Qrcode('mobile-scan-reader');
                html5QrcodeRef.current = html5QrCode;
                let handled = false;
                html5QrCode.start(
                    { facingMode: 'environment' },
                    {
                        fps: 25,
                        qrbox: { width: 300, height: 100 },
                        formatsToSupport: [
                            Html5QrcodeSupportedFormats.QR_CODE,
                            Html5QrcodeSupportedFormats.CODE_128,
                            Html5QrcodeSupportedFormats.CODE_39,
                            Html5QrcodeSupportedFormats.EAN_13,
                            Html5QrcodeSupportedFormats.EAN_8,
                            Html5QrcodeSupportedFormats.UPC_A,
                            Html5QrcodeSupportedFormats.CODE_93,
                        ],
                        aspectRatio: 1.0,
                        // Xin camera 720p (ideal, không bắt buộc) để mã nhỏ
                        // nét hơn; mặc định thư viện chỉ lấy độ phân giải thấp.
                        videoConstraints: {
                            facingMode: 'environment',
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                        },
                    },
                    (decodedText) => {
                        if (handled || cancelled) return;
                        handled = true;
                        const q = extractCarrierCode(decodedText);
                        stopScanner();
                        setSearch(q); setSearchMode('carrier'); setScanning(false);
                        handleDbSearch(q, 'carrier');
                    },
                    () => {}
                ).catch(() => {
                    if (!cancelled) setScanError('Thiết bị không có camera hoặc trình duyệt chặn camera.');
                });
            }, 150);
            return () => { cancelled = true; clearTimeout(timer); stopScanner(); };
        }
        (async () => {
            try {
                if (!window.BarcodeDetector) throw new Error('Trình duyệt này chưa hỗ trợ quét trực tiếp, hãy nhập tay.');
                if (!navigator.mediaDevices?.getUserMedia) throw new Error('Thiết bị không có camera hoặc trình duyệt chặn camera.');
                let formats = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'code_93'];
                try {
                    const supported = await window.BarcodeDetector.getSupportedFormats();
                    if (supported?.length) formats = formats.filter(f => supported.includes(f));
                } catch (e) {}
                const detector = new window.BarcodeDetector({ formats });
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
                const loop = async () => {
                    if (cancelled) return;
                    if (!videoRef.current || videoRef.current.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return; }
                    try {
                        const codes = await detector.detect(videoRef.current);
                        if (codes?.length) {
                            const q = extractCarrierCode(codes[0].rawValue);
                            setSearch(q); setSearchMode('carrier'); setScanning(false);
                            handleDbSearch(q, 'carrier');
                            return;
                        }
                    } catch (e) {}
                    rafRef.current = requestAnimationFrame(loop);
                };
                rafRef.current = requestAnimationFrame(loop);
            } catch (err) {
                if (!cancelled) setScanError(err.message || 'Không mở được camera.');
            }
        })();
        return () => { cancelled = true; stopScanner(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanning]);

    const fetchRecon = async () => {
        setReconLoading(true); setReconError('');
        try {
            const start = new Date(); start.setHours(0, 0, 0, 0);
            const end = new Date(); end.setHours(23, 59, 59, 999);
            const { data: rows, error: reconErr } = await supabase
                .from('orders')
                .select('id, created_at, carrier_code, status, printed_at, packed_at, carrier_date, sale_channel, order_products (product_code, product_name, quantity)')
                .gte('printed_at', start.toISOString())
                .lte('printed_at', end.toISOString())
                .order('printed_at', { ascending: false })
                .range(0, 999);
            if (reconErr) throw reconErr;
            setReconData(rows || []);
        } catch (err) { setReconError(err.message || 'Không tải được đối soát.'); }
        finally { setReconLoading(false); }
    };

    const reconTotals = useMemo(() => {
        const totalPrint = reconData.length;
        const totalPacked = reconData.filter(o => o.packed_at).length;
        const totalCanceled = reconData.filter(o => CANCELED_STATUS.includes(Number(o.status))).length;
        const totalHanded = reconData.filter(o => o.carrier_date).length;
        const needHandover = reconData.filter(o => [42, 56, 57].includes(Number(o.status)));
        return { totalPrint, totalPacked, totalCanceled, totalHanded, needHandover };
    }, [reconData]);

    // Danh sách biên bản mới nhất (mặc định 30 biên bản, mới nhất trước).
    const fetchBbSessions = async () => {
        setBbLoading(true); setBbError('');
        try {
            const { data, error } = await supabase
                .from('reconciliation_sessions')
                .select('id, session_name, audit_date, status, created_at, completed_at, total_printed, total_expected, total_canceled, total_scanned, total_missing, total_surplus')
                .order('audit_date', { ascending: false })
                .order('created_at', { ascending: false })
                .range(0, 29);
            if (error) throw error;
            setBbSessions(data || []);
        } catch (err) { setBbError(err.message || 'Không tải được biên bản.'); }
        finally { setBbLoading(false); }
    };

    // Chi tiết 1 biên bản: danh sách đơn thiếu + đơn thừa. Các mảng trong
    // bảng có thể chứa ID hoặc object có id (giống bản PC), nên chuẩn hóa
    // về ID rồi mới kéo thông tin đơn theo đợt 200 ID.
    const fetchBbDetail = async (session) => {
        if (bbDetails[session.id] || bbDetailLoading[session.id]) return;
        setBbDetailLoading(prev => ({ ...prev, [session.id]: true }));
        try {
            const { data, error } = await supabase
                .from('reconciliation_sessions')
                .select('scanned_codes, surplus_orders, expected_correct, expected_canceled, missing_orders')
                .eq('id', session.id)
                .single();
            if (error) throw error;
            const toIds = (arr) => (arr || []).map(item => (typeof item === 'object' && item !== null ? item.id : item)).filter(v => v !== undefined && v !== null && v !== '');
            const missingIds = toIds(data.missing_orders);
            const surplusIds = toIds(data.surplus_orders);
            const allIds = Array.from(new Set([...missingIds.map(String), ...surplusIds.map(String)]));
            const ordersMap = {};
            for (let i = 0; i < allIds.length; i += 200) {
                const chunk = allIds.slice(i, i + 200);
                const { data: rows, error: ordersError } = await supabase
                    .from('orders')
                    .select('id, carrier_code, status, sale_channel')
                    .in('id', chunk);
                if (ordersError) throw ordersError;
                (rows || []).forEach(o => { ordersMap[String(o.id)] = o; });
            }
            const resolve = (ids, unknownStatus) => ids.map(id => ordersMap[String(id)] || { id, carrier_code: 'Không rõ', status: unknownStatus });
            setBbDetails(prev => ({ ...prev, [session.id]: { missing: resolve(missingIds, null), surplus: resolve(surplusIds, 'Mã vạch lạ hoắc') } }));
        } catch (err) {
            setBbDetails(prev => ({ ...prev, [session.id]: { error: err.message || 'Không tải được chi tiết biên bản.' } }));
        } finally {
            setBbDetailLoading(prev => ({ ...prev, [session.id]: false }));
        }
    };

    const toggleBbSession = (session) => {
        if (bbExpandedId === session.id) { setBbExpandedId(null); return; }
        setBbExpandedId(session.id);
        fetchBbDetail(session);
    };

    const fmtAuditDate = (d) => {
        if (!d) return '';
        const parts = String(d).split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(d);
    };

    const loadSettings = async () => {
        setSettingsLoaded(true);
        try {
            if (canEditSensitive) {
                const { data } = await supabase.from('system_configs').select('key, value').in('key', THEME_DEFS.map(t => t.key));
                const map = {};
                data?.forEach(row => { try { map[row.key] = JSON.parse(row.value); } catch (e) {} });
                const initial = {};
                THEME_DEFS.forEach(t => { initial[t.key] = !!map[t.key]?.[t.field]; });
                setThemes(initial);
            }
            if (isOwnerUser) {
                const { data } = await supabase.from('system_configs').select('key, value').in('key', ['global_banner', 'global_notification']);
                data?.forEach(row => {
                    try {
                        const parsed = JSON.parse(row.value);
                        if (row.key === 'global_banner') setBanner({ enabled: !!parsed.enabled, type: parsed.type || 'info', content: parsed.content || '', speed: parsed.speed ?? 15 });
                        if (row.key === 'global_notification') setPopupNotif({ enabled: !!parsed.enabled, type: parsed.type || 'info', title: parsed.title || '', content: parsed.content || '' });
                    } catch (e) {}
                });
                const { data: lockRows } = await supabase.from('system_configs').select('key, value').ilike('key', 'feature_lock_%');
                const initialLocks = {};
                FEATURE_PARENTS.forEach(p => {
                    const row = lockRows?.find(r => r.key === `feature_lock_${p.id}`);
                    let parsed = { isLocked: false, message: 'Tính năng đang bảo trì.', subs: {} };
                    if (row?.value) { try { parsed = JSON.parse(row.value); } catch (e) {} }
                    initialLocks[p.id] = !!parsed.isLocked;
                });
                setLocks(initialLocks);
            }
        } catch (e) {}
    };

    const saveThemes = async () => {
        setThemesSaving(true); setThemesMessage('');
        try {
            const rows = THEME_DEFS.map(t => {
                const obj = {};
                obj[t.field] = themes[t.key] ? true : false;
                // Chỉ bật 1 theme, tắt 3 cái còn lại (đúng bản máy tính)
                return { key: t.key, value: JSON.stringify(obj) };
            });
            const { error } = await supabase.from('system_configs').upsert(rows, { onConflict: 'key' });
            if (error) throw error;
            setThemesMessage('Đã lưu giao diện lễ hội.');
        } catch (err) { setThemesMessage('Lỗi: ' + err.message); }
        finally { setThemesSaving(false); }
    };

    const toggleTheme = (key) => {
        setThemes(prev => {
            const next = {};
            THEME_DEFS.forEach(t => { next[t.key] = t.key === key ? !prev[key] : false; });
            return next;
        });
    };

    const saveBanner = async () => {
        setNotifSaving(true); setNotifMessage('');
        try {
            const { error } = await supabase.from('system_configs').upsert([{ key: 'global_banner', value: JSON.stringify(banner) }], { onConflict: 'key' });
            if (error) throw error;
            setNotifMessage('Đã lưu dải thông báo chạy ngang.');
        } catch (err) { setNotifMessage('Lỗi: ' + err.message); }
        finally { setNotifSaving(false); }
    };

    const savePopupNotif = async () => {
        setNotifSaving(true); setNotifMessage('');
        try {
            const payload = { ...popupNotif, id: Date.now() };
            const { error } = await supabase.from('system_configs').upsert([{ key: 'global_notification', value: JSON.stringify(payload) }], { onConflict: 'key' });
            if (error) throw error;
            setPopupNotif(payload);
            setNotifMessage('Đã lưu và phát thông báo popup toàn hệ thống.');
        } catch (err) { setNotifMessage('Lỗi: ' + err.message); }
        finally { setNotifSaving(false); }
    };

    const saveLocks = async () => {
        setLocksSaving(true); setLocksMessage('');
        try {
            const rows = FEATURE_PARENTS.map(p => ({
                key: `feature_lock_${p.id}`,
                value: JSON.stringify({ isLocked: !!locks[p.id], message: 'Tính năng đang bảo trì.', subs: {} }),
                description: `Cấu hình khóa tính năng ${p.id}`,
            }));
            const { error } = await supabase.from('system_configs').upsert(rows, { onConflict: 'key' });
            if (error) throw error;
            setLocksMessage('Đã lưu khóa tính năng.');
        } catch (err) { setLocksMessage('Lỗi: ' + err.message); }
        finally { setLocksSaving(false); }
    };

    const handleSheetScan = async (type) => {
        const isDaily = type === 'daily';
        const setLoadingFn = isDaily ? setSheetDailyLoading : setSheetPrintLoading;
        const setMsg = isDaily ? setSheetDailyMsg : setSheetPrintMsg;
        setLoadingFn(true); setMsg('');
        try {
            const { data: { session: s } } = await supabase.auth.getSession();
            const headers = { 'Content-Type': 'application/json' };
            if (s?.access_token) headers['Authorization'] = `Bearer ${s.access_token}`;
            const projectUrl = import.meta.env.VITE_SUPABASE_URL || supabase.supabaseUrl;
            const res = await fetch(`${projectUrl}/functions/v1/sync-sheets`, { method: 'POST', headers, body: JSON.stringify({ type }) });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.error || 'Lỗi server');
            const summary = result.debug?.[isDaily ? 'daily_sheet' : 'print_sheet'] || {};
            if (summary.error) setMsg('Thất bại: ' + summary.error);
            else if (summary.skipped) setMsg(summary.reason || 'Chưa cấu hình sheet này.');
            else {
                let msg = `Đã quét xong: ${summary.total_rows_parsed ?? 0} dòng, khớp ${summary.matched ?? 0} đơn, cập nhật ${summary.final_unique_updated ?? 0} đơn.`;
                if (!isDaily && Array.isArray(summary.missing)) msg += ` Thiếu ${summary.missing.length} mã (xem chi tiết trên bản máy tính).`;
                setMsg(msg);
            }
        } catch (err) { setMsg('Lỗi kết nối: ' + err.message); }
        setLoadingFn(false);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwMessage('');
        if (pwNew.length < 6) { setPwMessage('Mật khẩu mới phải có ít nhất 6 ký tự.'); return; }
        if (pwNew !== pwConfirm) { setPwMessage('Mật khẩu mới nhập lại không khớp.'); return; }
        setPwSaving(true);
        try {
            const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: pwCurrent });
            if (verifyError) throw new Error('Mật khẩu hiện tại không chính xác!');
            const { error } = await supabase.auth.updateUser({ password: pwNew });
            if (error) throw error;
            setPwMessage('Đã đổi mật khẩu thành công.');
            setPwCurrent(''); setPwNew(''); setPwConfirm(''); setShowPwForm(false);
        } catch (err) { setPwMessage('Lỗi: ' + err.message); }
        finally { setPwSaving(false); }
    };

    const navigate = useNavigate();
    const handleLogout = async () => {
        // Đăng xuất kiểu cũ chỉ trông chờ vào Navigate có điều kiện khi session
        // đổi thành null, nên nếu signOut kẹt mạng thì màn hình cứ đứng yên.
        // Bản này: chờ signOut tối đa 3 giây rồi chuyển thẳng sang /login,
        // giống cách Layout bản máy tính làm (signOut xong navigate).
        try {
            await Promise.race([
                supabase.auth.signOut(),
                new Promise(resolve => setTimeout(resolve, 3000)),
            ]);
        } catch (e) {}
        setSession(null);
        navigate('/login', { replace: true, state: { from: '/mobile' } });
    };

    if (authLoading) {
        return <div className="min-h-dvh flex items-center justify-center text-slate-500 font-semibold">Đang kiểm tra đăng nhập...</div>;
    }
    if (!session) return <Navigate to="/login" replace state={{ from: '/mobile' }} />;

    const currentList = printOrders;
    const visibleList = currentList.slice(0, visibleCount);
    const reconVisibleList = reconTotals.needHandover.slice(0, reconVisible);

    const OrderCard = ({ order, showStock = true, showChannel = false }) => {
        const stock = stockOf(order);
        const products = order.order_products || [];
        const shortItem = [...(data.holding || []), ...(data.outOfStock || [])]
            .find(o => o.id === order.id)?.debug_shortItems?.[0];
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-slate-900 text-base leading-tight">{order.id}</div>
                    {order.carrier_code && (
                        <span className="shrink-0 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">{order.carrier_code}</span>
                    )}
                </div>
                <div className="mt-2 space-y-1">
                    {products.length === 0 && <div className="text-sm text-slate-400">Chưa có sản phẩm</div>}
                    {products.map((p, i) => (
                        <div key={i} className="flex justify-between gap-2 text-sm">
                            <span className="text-slate-800 leading-tight">{p.product_name}</span>
                            <span className="shrink-0 font-bold text-slate-900">x{p.quantity}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">{statusName(order.status)}</span>
                    {showChannel && order.sale_channel && <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700">{CHANNEL_NAMES[String(order.sale_channel)] || `Kênh ${order.sale_channel}`}</span>}
                    {showStock && stock && <span className={`px-2 py-0.5 rounded text-xs font-bold ${stock.cls}`}>{stock.label}</span>}
                    {showStock && shortItem && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">Thiếu {shortItem.missing}, tồn {shortItem.remaining}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="mx-auto max-w-[480px] min-h-dvh bg-slate-100 font-sans" style={{ paddingBottom: 'calc(76px + env(safe-area-inset-bottom))' }}>
            <div className="sticky top-0 z-40">
                <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                    <div>
                        <div className="font-bold text-base leading-tight">WMS</div>
                        <div className="text-xs text-slate-300">Xem nhanh trên điện thoại</div>
                    </div>
                    <button onClick={tab === 'reconcile' ? () => { fetchRecon(); fetchBbSessions(); } : fetchAllocation} disabled={loading || reconLoading} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50" aria-label="Làm mới">
                        <RefreshCw size={18} className={(loading || reconLoading) ? 'animate-spin' : ''} />
                    </button>
                </header>
                {tab === 'print' && (
                    <div className="bg-slate-100 px-3 pt-2 pb-2 space-y-2 border-b border-slate-200">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white rounded-xl border border-slate-200 p-2.5 text-center">
                                <div className="text-lg font-bold text-green-700">{data.printable.length}</div>
                                <div className="text-xs font-medium text-slate-500">Đủ hàng</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-2.5 text-center">
                                <div className="text-lg font-bold text-yellow-700">{data.holding.length}</div>
                                <div className="text-xs font-medium text-slate-500">Tạm giữ</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-2.5 text-center">
                                <div className="text-lg font-bold text-red-700">{data.outOfStock.length}</div>
                                <div className="text-xs font-medium text-slate-500">Hết hàng</div>
                            </div>
                        </div>
                        <div className="relative">
                            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(30); }} placeholder="Tìm đơn, sản phẩm..." className="w-full pl-10 pr-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" />
                            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                        </div>
                    </div>
                )}
            </div>

            <main className="px-3 py-3 space-y-3">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-medium text-red-700">
                        {error}
                        <button onClick={fetchAllocation} className="block mt-2 font-bold underline">Thử lại</button>
                    </div>
                )}

                {tab === 'print' && (
                    <>
                        {loading && <div className="text-center text-sm text-slate-500 font-medium py-10">Đang tải...</div>}
                        {!loading && visibleList.length === 0 && <div className="text-center text-sm text-slate-500 py-10">Không tìm thấy đơn nào.</div>}
                        {!loading && visibleList.map(order => <OrderCard key={order.id} order={order} />)}
                        {!loading && currentList.length > visibleCount && (
                            <button onClick={() => setVisibleCount(c => c + 30)} className="w-full py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700">
                                Tải thêm ({currentList.length - visibleCount} đơn còn lại)
                            </button>
                        )}
                    </>
                )}

                {tab === 'location' && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input type="text" value={locQuery} onChange={(e) => setLocQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleLocationSearch(); }} placeholder="Tìm tên hoặc mã sản phẩm..." className="w-full pl-10 pr-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" />
                                <Package className="absolute left-3 top-3.5 text-slate-400" size={18} />
                            </div>
                            <button onClick={handleLocationSearch} disabled={locLoading} className="px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Tìm</button>
                        </div>
                        {locLoading && <div className="text-center text-sm text-slate-500 font-medium py-6">Đang tìm...</div>}
                        {!locLoading && locSearched && locResults.length === 0 && <div className="text-center text-sm text-slate-500 py-6">Không tìm thấy sản phẩm nào.</div>}
                        {!locLoading && locResults.map((p, i) => (
                            <button key={i} type="button" disabled={!canEditLocation} onClick={() => { setLocEdit(p); setLocNew(p.location_code || ''); setLocAllSizes(false); setLocMessage(''); }} className="w-full bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 text-left">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-900 text-sm leading-tight">{p.product_name}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">{p.product_code}</div>
                                </div>
                                <span className="flex items-center gap-1.5 shrink-0">
                                    {canEditLocation && <Pencil size={14} className="text-slate-400" />}
                                    <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${p.location_code ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                                        {p.location_code || 'Chưa gán vị trí'}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {tab === 'search' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 bg-white border border-slate-300 rounded-xl p-1">
                            <button onClick={() => { setSearchMode('carrier'); setDbSearched(false); setDbSearchResults([]); }} className={`py-2.5 rounded-lg text-sm font-bold ${searchMode === 'carrier' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Mã vận đơn</button>
                            <button onClick={() => { setSearchMode('id'); setDbSearched(false); setDbSearchResults([]); }} className={`py-2.5 rounded-lg text-sm font-bold ${searchMode === 'id' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>ID đơn</button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleDbSearch(); }} className="space-y-2">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchMode === 'carrier' ? 'Nhập mã vận đơn...' : 'Nhập ID đơn...'} className="w-full pl-10 pr-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" />
                                    <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                </div>
                                <button type="button" onClick={startScanner} className="px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-1.5"><ScanLine size={18} /> Quét</button>
                            </div>
                            <button type="submit" disabled={dbSearching || !search.trim()} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Tìm đơn</button>
                        </form>
                        {dbSearching && <div className="text-center text-sm text-slate-500 font-medium py-10">Đang tìm...</div>}
                        {!dbSearching && !dbSearched && <div className="text-center text-sm text-slate-500 py-10">Nhập {searchMode === 'carrier' ? 'mã vận đơn' : 'ID đơn'} rồi bấm Tìm đơn, hoặc bấm Quét để quét mã trên đơn.</div>}
                        {!dbSearching && dbSearchError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-medium text-red-700">{dbSearchError}</div>}
                        {!dbSearching && dbSearched && !dbSearchError && dbSearchResults.length === 0 && <div className="text-center text-sm text-slate-500 py-10">Không tìm thấy đơn nào.</div>}
                        {!dbSearching && dbSearchResults.map(order => (
                            <div key={order.id} onClick={() => openOrderDetail(order)} className="bg-white rounded-xl border border-slate-200 p-3 cursor-pointer">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="font-bold text-slate-900 text-base leading-tight">{order.id}</div>
                                    {order.carrier_code && (
                                        <span className="shrink-0 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">{order.carrier_code}</span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-500 mt-1">Ngày tạo: {formatOrderDate(order.created_at)}</div>
                                <div className="mt-2 space-y-1">
                                    {(order.order_products || []).length === 0 && <div className="text-sm text-slate-400">Chưa có sản phẩm</div>}
                                    {(order.order_products || []).map((p, i) => (
                                        <div key={i} className="flex justify-between gap-2 text-sm">
                                            <span className="text-slate-800 leading-tight">{p.product_name}</span>
                                            <span className="shrink-0 font-bold text-slate-900">x{p.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">{statusName(order.status)}</span>
                                    <span className="text-xs font-bold text-blue-700">Xem chi tiết</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'reconcile' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-bold text-slate-900">{reconTotals.totalPrint}</div><div className="text-xs font-medium text-slate-500">Tổng in</div></div>
                            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-bold text-slate-900">{reconTotals.totalPacked}</div><div className="text-xs font-medium text-slate-500">Tổng đóng</div></div>
                            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-bold text-red-700">{reconTotals.totalCanceled}</div><div className="text-xs font-medium text-slate-500">Tổng hủy</div></div>
                            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-bold text-green-700">{reconTotals.totalHanded}</div><div className="text-xs font-medium text-slate-500">Tổng bàn giao</div></div>
                        </div>
                        {reconError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-medium text-red-700">{reconError}</div>}
                        <div className="font-bold text-slate-900 text-sm">Cần bàn giao lại ({reconTotals.needHandover.length})</div>
                        {reconLoading && <div className="text-center text-sm text-slate-500 font-medium py-10">Đang tải...</div>}
                        {!reconLoading && reconVisibleList.length === 0 && <div className="text-center text-sm text-slate-500 py-6">Tất cả đơn in hôm nay đã được bàn giao.</div>}
                        {!reconLoading && reconVisibleList.map(order => <OrderCard key={order.id} order={order} showStock={false} showChannel />)}
                        {!reconLoading && reconTotals.needHandover.length > reconVisible && (
                            <button onClick={() => setReconVisible(c => c + 30)} className="w-full py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700">
                                Tải thêm ({reconTotals.needHandover.length - reconVisible} đơn còn lại)
                            </button>
                        )}
                        <div className="pt-2">
                            <div className="font-bold text-slate-900 text-sm">Biên bản đối soát (từ PC)</div>
                            <div className="text-xs text-slate-500 mt-0.5">Chỉ xem lại, không tạo hay chốt trên điện thoại. Hiển thị 30 biên bản gần nhất.</div>
                            {bbLoading && <div className="text-center text-sm text-slate-500 font-medium py-6">Đang tải biên bản...</div>}
                            {bbError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-medium text-red-700 mt-2">{bbError}</div>}
                            {!bbLoading && !bbError && bbSessions.length === 0 && <div className="text-center text-sm text-slate-500 py-6">Chưa có biên bản nào.</div>}
                            {!bbLoading && bbSessions.map(session => {
                                const expanded = bbExpandedId === session.id;
                                const detail = bbDetails[session.id];
                                const isCompleted = session.status === 'completed';
                                return (
                                    <div key={session.id} className="bg-white rounded-xl border border-slate-200 mt-2 overflow-hidden">
                                        <button onClick={() => toggleBbSession(session)} className="w-full text-left p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-sm text-slate-900 break-words">{session.session_name || `Biên bản ngày ${fmtAuditDate(session.audit_date)}`}</span>
                                                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{isCompleted ? 'Đã chốt' : 'Chưa chốt'}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">Ngày kiểm kê: {fmtAuditDate(session.audit_date)}{session.completed_at ? ` · Chốt: ${new Date(session.completed_at).toLocaleString('vi-VN')}` : ''}</div>
                                            <div className="text-xs text-slate-600 mt-1">In {session.total_printed ?? 0} · Kỳ vọng {session.total_expected ?? 0} · Quét {session.total_scanned ?? 0} · Hủy {session.total_canceled ?? 0} · <span className="text-red-700 font-bold">Thiếu {session.total_missing ?? 0}</span> · <span className="text-amber-700 font-bold">Thừa {session.total_surplus ?? 0}</span></div>
                                            <div className="text-xs font-bold text-blue-700 mt-1">{expanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}</div>
                                        </button>
                                        {expanded && (
                                            <div className="border-t border-slate-200 p-3 space-y-3">
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div className="bg-slate-50 rounded-lg p-2"><div className="text-base font-bold text-slate-900">{session.total_printed ?? 0}</div><div className="text-xs text-slate-500">Tổng in</div></div>
                                                    <div className="bg-slate-50 rounded-lg p-2"><div className="text-base font-bold text-slate-900">{session.total_expected ?? 0}</div><div className="text-xs text-slate-500">Kỳ vọng</div></div>
                                                    <div className="bg-slate-50 rounded-lg p-2"><div className="text-base font-bold text-slate-900">{session.total_scanned ?? 0}</div><div className="text-xs text-slate-500">Đã quét</div></div>
                                                    <div className="bg-slate-50 rounded-lg p-2"><div className="text-base font-bold text-slate-900">{session.total_canceled ?? 0}</div><div className="text-xs text-slate-500">Đã hủy</div></div>
                                                    <div className="bg-red-50 rounded-lg p-2"><div className="text-base font-bold text-red-700">{session.total_missing ?? 0}</div><div className="text-xs text-slate-500">Thiếu</div></div>
                                                    <div className="bg-amber-50 rounded-lg p-2"><div className="text-base font-bold text-amber-700">{session.total_surplus ?? 0}</div><div className="text-xs text-slate-500">Thừa</div></div>
                                                </div>
                                                {bbDetailLoading[session.id] && <div className="text-center text-sm text-slate-500 py-4">Đang tải chi tiết...</div>}
                                                {detail?.error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-medium text-red-700">{detail.error}</div>}
                                                {detail && !detail.error && (
                                                    <>
                                                        <div>
                                                            <div className="font-bold text-sm text-slate-900">Đơn thiếu ({detail.missing.length})</div>
                                                            {detail.missing.length === 0 && <div className="text-sm text-slate-500 mt-1">Không có đơn thiếu.</div>}
                                                            {detail.missing.map(o => (
                                                                <div key={`miss-${o.id}`} className="flex justify-between gap-2 py-1.5 border-b border-slate-100 text-sm">
                                                                    <span className="flex items-center gap-1.5"><span className="font-medium text-slate-900">Đơn #{o.id}</span>{o.sale_channel && <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700">{CHANNEL_NAMES[String(o.sale_channel)] || `Kênh ${o.sale_channel}`}</span>}</span>
                                                                    <span className="text-slate-600 break-all">{o.carrier_code || 'Chưa có mã'}</span>
                                                                    <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 h-fit">{o.status ? statusName(o.status) : 'Không rõ'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-slate-900">Đơn thừa ({detail.surplus.length})</div>
                                                            {detail.surplus.length === 0 && <div className="text-sm text-slate-500 mt-1">Không có đơn thừa.</div>}
                                                            {detail.surplus.map(o => (
                                                                <div key={`surp-${o.id}`} className="flex justify-between gap-2 py-1.5 border-b border-slate-100 text-sm">
                                                                    <span className="flex items-center gap-1.5"><span className="font-medium text-slate-900">Đơn #{o.id}</span>{o.sale_channel && <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700">{CHANNEL_NAMES[String(o.sale_channel)] || `Kênh ${o.sale_channel}`}</span>}</span>
                                                                    <span className="text-slate-600 break-all">{o.carrier_code || 'Chưa có mã'}</span>
                                                                    <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 h-fit">{o.status ? statusName(o.status) : 'Không rõ'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {tab === 'settings' && (
                    <div className="space-y-3">
                        <Section icon={User} title="Tài khoản">
                            <div className="text-sm"><span className="text-slate-500">Email: </span><span className="font-bold text-slate-900 break-all">{user.email}</span></div>
                            <div className="text-sm"><span className="text-slate-500">Vai trò: </span><span className="font-bold text-slate-900">{roleLabel(role)}{isOwnerUser ? ' (Owner)' : ''}</span></div>
                            <button onClick={() => setShowPwForm(v => !v)} className="w-full py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 flex items-center justify-center gap-2"><Lock size={16} /> Đổi mật khẩu</button>
                            {showPwForm && (
                                <form onSubmit={handleChangePassword} className="space-y-2">
                                    <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="Mật khẩu hiện tại" className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" required />
                                    <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Mật khẩu mới (từ 6 ký tự)" className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" required />
                                    <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" required />
                                    <button type="submit" disabled={pwSaving} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Lưu mật khẩu mới</button>
                                </form>
                            )}
                            {pwMessage && <div className={`text-sm font-medium ${pwMessage.startsWith('Đã') ? 'text-green-700' : 'text-red-700'}`}>{pwMessage}</div>}
                            <button onClick={handleLogout} className="w-full py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 flex items-center justify-center gap-2"><LogOut size={16} /> Đăng xuất</button>
                        </Section>

                        {isAdminOrOwner && (
                            <Section icon={FileSpreadsheet} title="Quét Google Sheet">
                                <button onClick={() => handleSheetScan('daily')} disabled={sheetDailyLoading} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Quét đơn đi</button>
                                {sheetDailyMsg && <div className="text-sm font-medium text-slate-700">{sheetDailyMsg}</div>}
                                <button onClick={() => handleSheetScan('print')} disabled={sheetPrintLoading} className="w-full py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 disabled:opacity-50">Quét đơn in</button>
                                {sheetPrintMsg && <div className="text-sm font-medium text-slate-700">{sheetPrintMsg}</div>}
                            </Section>
                        )}

                        {canEditSensitive && (
                            <Section icon={Palette} title="Giao diện lễ hội (chỉ chọn 1)">
                                {THEME_DEFS.map(t => (
                                    <div key={t.key} className="flex items-center justify-between gap-2 py-1">
                                        <span className="text-sm font-medium text-slate-800">{t.label}</span>
                                        <Toggle checked={!!themes[t.key]} onChange={() => toggleTheme(t.key)} />
                                    </div>
                                ))}
                                {themesMessage && <div className="text-sm font-medium text-slate-700">{themesMessage}</div>}
                                <button onClick={saveThemes} disabled={themesSaving} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"><Save size={16} /> Lưu giao diện</button>
                            </Section>
                        )}

                        {isOwnerUser && (
                            <>
                                <Section icon={Bell} title="Dải thông báo chạy ngang">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium text-slate-800">Bật dải chữ chạy</span>
                                        <Toggle checked={banner.enabled} onChange={(c) => setBanner({ ...banner, enabled: c })} />
                                    </div>
                                    <select value={banner.type} onChange={(e) => setBanner({ ...banner, type: e.target.value })} className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none bg-white">
                                        <option value="info">Thông tin chung</option>
                                        <option value="celebrate">Khen thưởng & Chúc mừng</option>
                                        <option value="alert">Báo động khẩn</option>
                                        <option value="warning">Cảnh báo</option>
                                    </select>
                                    <input type="text" value={banner.content} onChange={(e) => setBanner({ ...banner, content: e.target.value })} placeholder="Nội dung chữ chạy" className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-500 shrink-0">Tốc độ (giây)</span>
                                        <input type="number" min={5} max={60} value={banner.speed} onChange={(e) => setBanner({ ...banner, speed: Number(e.target.value) })} className="flex-1 px-3 py-3 text-base border border-slate-300 rounded-xl outline-none bg-white" />
                                    </div>
                                    <button onClick={saveBanner} disabled={notifSaving} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Lưu dải thông báo</button>
                                </Section>

                                <Section icon={Bell} title="Thông báo popup toàn hệ thống">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium text-slate-800">Bật thông báo</span>
                                        <Toggle checked={popupNotif.enabled} onChange={(c) => setPopupNotif({ ...popupNotif, enabled: c })} />
                                    </div>
                                    <select value={popupNotif.type} onChange={(e) => setPopupNotif({ ...popupNotif, type: e.target.value })} className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none bg-white">
                                        <option value="info">Thông báo chung</option>
                                        <option value="update">Cập nhật tính năng</option>
                                        <option value="celebrate">Sự kiện / Chúc mừng</option>
                                    </select>
                                    <input type="text" value={popupNotif.title} onChange={(e) => setPopupNotif({ ...popupNotif, title: e.target.value })} placeholder="Tiêu đề" className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" />
                                    <textarea rows={3} value={popupNotif.content} onChange={(e) => setPopupNotif({ ...popupNotif, content: e.target.value })} placeholder="Nội dung chi tiết" className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white resize-none" />
                                    <button onClick={savePopupNotif} disabled={notifSaving} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Phát thông báo</button>
                                    {notifMessage && <div className="text-sm font-medium text-slate-700">{notifMessage}</div>}
                                </Section>

                                <Section icon={Lock} title="Khóa tính năng">
                                    {FEATURE_PARENTS.map(p => (
                                        <div key={p.id} className="flex items-center justify-between gap-2 py-1">
                                            <span className="text-sm font-medium text-slate-800">{p.name}</span>
                                            <Toggle checked={!!locks[p.id]} onChange={(c) => setLocks(prev => ({ ...prev, [p.id]: c }))} />
                                        </div>
                                    ))}
                                    {locksMessage && <div className="text-sm font-medium text-slate-700">{locksMessage}</div>}
                                    <button onClick={saveLocks} disabled={locksSaving} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"><Save size={16} /> Lưu khóa tính năng</button>
                                </Section>
                            </>
                        )}
                    </div>
                )}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="mx-auto max-w-[480px] grid grid-cols-5">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${tab === id ? 'text-slate-900' : 'text-slate-400'}`}>
                            <Icon size={22} />
                            {label}
                        </button>
                    ))}
                </div>
            </nav>

            {locEdit && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setLocEdit(null)}>
                    <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-slate-900 text-sm leading-tight pr-2">{locEdit.product_name}</div>
                            <button onClick={() => setLocEdit(null)} className="p-1 text-slate-400"><X size={20} /></button>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{locEdit.product_code}</div>
                        <form onSubmit={saveLocEdit} className="space-y-3">
                            <input type="text" value={locNew} onChange={(e) => setLocNew(e.target.value)} placeholder="Nhập mã vị trí, ví dụ A1-01" className="w-full px-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white" />
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                                <input type="checkbox" checked={locAllSizes} onChange={(e) => setLocAllSizes(e.target.checked)} className="w-4 h-4" />
                                Áp dụng cho các size khác (S/M/L)
                            </label>
                            {locMessage && <div className="text-sm font-medium text-slate-700">{locMessage}</div>}
                            <button type="submit" disabled={locSaving} className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Lưu vị trí</button>
                        </form>
                    </div>
                </div>
            )}

            {scanning && (
                <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-4 p-4">
                    <div className="text-white font-bold text-sm">Đưa barcode/QR trên đơn vào khung hình</div>
                    {window.BarcodeDetector ? (
                        <video ref={videoRef} playsInline muted className="w-full max-w-[480px] rounded-xl bg-black" />
                    ) : (
                        <div id="mobile-scan-reader" className="w-full max-w-[480px] rounded-xl overflow-hidden bg-black" />
                    )}
                    {scanError && <div className="text-red-300 text-sm font-medium text-center">{scanError}</div>}
                    <button onClick={() => { stopScanner(); setScanning(false); }} className="px-6 py-3 bg-white text-slate-900 rounded-xl text-sm font-bold">Đóng</button>
                </div>
            )}

            {detailOrder && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={closeOrderDetail}>
                    <div className="w-full max-w-[480px] bg-white rounded-t-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-slate-900 text-base leading-tight">Đơn #{detailOrder.id}</div>
                            <button onClick={closeOrderDetail} className="p-1 text-slate-400"><X size={20} /></button>
                        </div>
                        {detailLoading && <div className="text-center text-sm text-slate-500 py-6">Đang tải chi tiết...</div>}
                        {detailError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-medium text-red-700">{detailError}</div>}
                        {!detailLoading && (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">{statusName(detailOrder.status)}</span>
                                    {detailOrder.sale_channel && <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700">{CHANNEL_NAMES[String(detailOrder.sale_channel)] || `Kênh ${detailOrder.sale_channel}`}</span>}
                                </div>
                                <div className="text-sm space-y-1">
                                    <div><span className="text-slate-500">Mã vận đơn: </span><span className="font-bold text-slate-900 break-all">{detailOrder.carrier_code || 'Chưa có'}</span></div>
                                    {detailOrder.carrier_name && <div><span className="text-slate-500">Hãng vận chuyển: </span><span className="font-bold text-slate-900">{detailOrder.carrier_name}</span></div>}
                                    {detailOrder.ecom_order_id && <div><span className="text-slate-500">Mã sàn: </span><span className="font-bold text-slate-900 break-all">{detailOrder.ecom_order_id}</span></div>}
                                    {detailOrder.created_by_name && <div><span className="text-slate-500">Người tạo: </span><span className="font-bold text-slate-900">{detailOrder.created_by_name}</span></div>}
                                    <div><span className="text-slate-500">Ngày tạo: </span><span className="font-bold text-slate-900">{formatOrderDate(detailOrder.created_at)}</span></div>
                                    <div><span className="text-slate-500">Ngày in: </span><span className="font-bold text-slate-900">{detailOrder.printed_at ? formatOrderDate(detailOrder.printed_at) : '—'}</span></div>
                                    <div><span className="text-slate-500">Ngày đóng: </span><span className="font-bold text-slate-900">{detailOrder.packed_at ? formatOrderDate(detailOrder.packed_at) : '—'}</span></div>
                                    <div><span className="text-slate-500">Ngày bàn giao: </span><span className="font-bold text-slate-900">{detailOrder.carrier_date ? formatOrderDate(detailOrder.carrier_date) : '—'}</span></div>
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-900">Sản phẩm</div>
                                    {(detailOrder.order_products || []).length === 0 && <div className="text-sm text-slate-400 mt-1">Chưa có sản phẩm</div>}
                                    {(detailOrder.order_products || []).map((p, i) => (
                                        <div key={i} className="flex justify-between gap-2 text-sm py-1 border-b border-slate-100">
                                            <span className="text-slate-800 leading-tight">{p.product_name}{p.product_code ? <span className="text-slate-400"> ({p.product_code})</span> : null}</span>
                                            <span className="shrink-0 font-bold text-slate-900">x{p.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                                {(() => {
                                    const raw = parseOrderRaw(detailOrder);
                                    const ship = raw?.shippingAddress;
                                    if (!ship) return null;
                                    return (
                                        <div>
                                            <div className="font-bold text-sm text-slate-900">Khách hàng</div>
                                            <div className="text-sm space-y-1 mt-1">
                                                {ship.name && <div><span className="text-slate-500">Tên: </span><span className="font-bold text-slate-900">{ship.name}</span></div>}
                                                {ship.mobile && <div><span className="text-slate-500">SĐT: </span><span className="font-bold text-slate-900">{ship.mobile}</span></div>}
                                                {ship.address && <div><span className="text-slate-500">Địa chỉ: </span><span className="font-bold text-slate-900">{ship.address}</span></div>}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {(detailOrder.description || detailOrder.private_description) && (
                                    <div>
                                        <div className="font-bold text-sm text-slate-900">Ghi chú</div>
                                        {detailOrder.description && <div className="text-sm text-slate-800 mt-1">{detailOrder.description}</div>}
                                        {detailOrder.private_description && <div className="text-sm text-slate-500 mt-1">Nội bộ: {detailOrder.private_description}</div>}
                                    </div>
                                )}
                                <div>
                                    <div className="font-bold text-sm text-slate-900">Lịch sử đơn hàng</div>
                                    {detailHistory.length === 0 && <div className="text-sm text-slate-400 mt-1">Chưa có lịch sử.</div>}
                                    {detailHistory.map(h => (
                                        <div key={h.id} className="text-sm py-1 border-b border-slate-100">
                                            <span className="text-slate-500">{formatOrderDate(h.created_at)} · </span>
                                            <span className="text-slate-800">{h.status_old ? statusName(h.status_old) : 'Tạo đơn'} → {h.status_new ? statusName(h.status_new) : '—'}</span>
                                            {h.created_by_name && <span className="text-slate-500"> ({h.created_by_name})</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
