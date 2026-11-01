import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Printer, AlertTriangle, MapPin, Search, RefreshCw, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Giao diện điện thoại riêng, chỉ xem nhanh, không có thao tác.
// - Không copy, không xuất Excel, không in, không gửi hãng, không webhook,
//   không cài đặt cột, không bộ lọc phức tạp: mỗi tab chỉ có 1 ô tìm kiếm.
// - Thẻ đơn chỉ hiển thị ID, sản phẩm, trạng thái (kèm mã vận đơn nhỏ nếu có
//   và tình trạng kho, vì đó là thông tin cần khi đóng gói).
// - Các chức năng chỉ dùng trên máy tính và các mục chưa hoàn thiện đều
//   không đưa vào đây. Muốn dùng đủ chức năng thì mở bản web đầy đủ.
const LOCAL_STATUS_NAMES = {
    '40': 'Đã đóng gói', '42': 'Đang đóng gói', '43': 'Chờ thu gom',
    '54': 'Đơn mới', '55': 'Đang xác nhận', '56': 'Đã xác nhận', '57': 'Chờ xác nhận',
    '58': 'Hãng vận chuyển hủy đơn', '59': 'Đang chuyển', '60': 'Thành công', '61': 'Thất bại',
    '63': 'Khách hủy', '64': 'Hệ thống hủy', '68': 'Hết hàng',
    '71': 'Đang chuyển hoàn', '72': 'Đã chuyển hoàn', '73': 'Đổi kho xuất hàng', '74': 'Xác nhận hoàn'
};

const TABS = [
    { id: 'print', label: 'Đơn in', icon: Printer },
    { id: 'process', label: 'Cần xử lý', icon: AlertTriangle },
    { id: 'location', label: 'Vị trí', icon: MapPin },
    { id: 'search', label: 'Tìm đơn', icon: Search },
];

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

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
            setAuthLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
            setSession(s);
            setAuthLoading(false);
        });
        return () => subscription.unsubscribe();
    }, []);

    const fetchAllocation = async () => {
        setLoading(true);
        setError('');
        try {
            const { data: stData } = await supabase.from('order_statuses').select('id,name');
            const dict = {};
            stData?.forEach(s => dict[s.id] = s.name);
            setStatusDict(dict);
            const { data: alloc, error: allocErr } = await supabase.functions.invoke('wms-allocation');
            if (allocErr) throw allocErr;
            setData({
                printable: alloc?.printable || [],
                holding: alloc?.holding || [],
                outOfStock: alloc?.outOfStock || [],
            });
        } catch (err) {
            setError(err.message || 'Không tải được dữ liệu.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAllocation(); }, []);

    useEffect(() => {
        setSearch('');
        setVisibleCount(30);
    }, [tab]);

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
        if (data.printable.some(o => o.id === order.id)) return { key: 'printable', label: 'Đủ hàng', cls: 'bg-green-100 text-green-700' };
        if (data.holding.some(o => o.id === order.id)) return { key: 'holding', label: 'Tạm giữ', cls: 'bg-yellow-100 text-yellow-700' };
        return { key: 'outOfStock', label: 'Hết hàng', cls: 'bg-red-100 text-red-700' };
    };

    const printOrders = useMemo(() => data.printable.filter(o => matchesSearch(o, search)), [data, search]);
    const processOrders = useMemo(() => [...data.holding, ...data.outOfStock].filter(o => matchesSearch(o, search)), [data, search]);
    const allOrders = useMemo(() => [...data.printable, ...data.holding, ...data.outOfStock], [data]);
    const searchResults = useMemo(() => search.trim() ? allOrders.filter(o => matchesSearch(o, search)) : [], [allOrders, search]);

    const handleLocationSearch = async () => {
        if (!locQuery.trim()) return;
        setLocLoading(true);
        setLocSearched(true);
        try {
            const term = locQuery.trim();
            const { data: rows, error: locErr } = await supabase
                .from('product_inventories')
                .select('product_name, product_code, location_code')
                .or(`product_name.ilike.%${term}%,product_code.ilike.%${term}%`)
                .limit(50);
            if (locErr) throw locErr;
            setLocResults(rows || []);
        } catch (err) {
            setLocResults([]);
        } finally {
            setLocLoading(false);
        }
    };

    if (authLoading) {
        return <div className="min-h-dvh flex items-center justify-center text-slate-500 font-semibold">Đang kiểm tra đăng nhập...</div>;
    }
    if (!session) return <Navigate to="/login" replace />;

    const currentList = tab === 'print' ? printOrders : tab === 'process' ? processOrders : searchResults;
    const visibleList = currentList.slice(0, visibleCount);

    const OrderCard = ({ order }) => {
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
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${stock.cls}`}>{stock.label}</span>
                    {shortItem && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">Thiếu {shortItem.missing}, tồn {shortItem.remaining}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="mx-auto max-w-[480px] min-h-dvh bg-slate-100 font-sans" style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}>
            <header className="sticky top-0 z-40 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <div>
                    <div className="font-bold text-base leading-tight">Amelie Kho</div>
                    <div className="text-xs text-slate-300">Xem nhanh trên điện thoại</div>
                </div>
                <button onClick={fetchAllocation} disabled={loading} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50" aria-label="Làm mới">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            <main className="px-3 py-3 space-y-3">
                {tab === 'print' && (
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setTab('print')} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <div className="text-xl font-bold text-green-700">{data.printable.length}</div>
                            <div className="text-xs font-medium text-slate-500">Đủ hàng</div>
                        </button>
                        <button onClick={() => setTab('process')} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <div className="text-xl font-bold text-yellow-700">{data.holding.length}</div>
                            <div className="text-xs font-medium text-slate-500">Tạm giữ</div>
                        </button>
                        <button onClick={() => setTab('process')} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                            <div className="text-xl font-bold text-red-700">{data.outOfStock.length}</div>
                            <div className="text-xs font-medium text-slate-500">Hết hàng</div>
                        </button>
                    </div>
                )}

                {tab !== 'location' && (
                    <div className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setVisibleCount(30); }}
                            placeholder={tab === 'search' ? 'Tìm ID, mã sàn, mã vận đơn...' : 'Tìm đơn, sản phẩm...'}
                            className="w-full pl-10 pr-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white"
                        />
                        <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-medium text-red-700">
                        {error}
                        <button onClick={fetchAllocation} className="block mt-2 font-bold underline">Thử lại</button>
                    </div>
                )}

                {tab === 'location' && (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={locQuery}
                                    onChange={(e) => setLocQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleLocationSearch(); }}
                                    placeholder="Tìm tên hoặc mã sản phẩm..."
                                    className="w-full pl-10 pr-3 py-3 text-base border border-slate-300 rounded-xl outline-none focus:border-blue-500 bg-white"
                                />
                                <Package className="absolute left-3 top-3.5 text-slate-400" size={18} />
                            </div>
                            <button onClick={handleLocationSearch} disabled={locLoading} className="px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">Tìm</button>
                        </div>
                        {locLoading && <div className="text-center text-sm text-slate-500 font-medium py-6">Đang tìm...</div>}
                        {!locLoading && locSearched && locResults.length === 0 && (
                            <div className="text-center text-sm text-slate-500 py-6">Không tìm thấy sản phẩm nào.</div>
                        )}
                        {!locLoading && locResults.map((p, i) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-900 text-sm leading-tight">{p.product_name}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">{p.product_code}</div>
                                </div>
                                <span className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold ${p.location_code ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                                    {p.location_code || 'Chưa gán vị trí'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {tab !== 'location' && (
                    <>
                        {loading && <div className="text-center text-sm text-slate-500 font-medium py-10">Đang tải...</div>}
                        {!loading && tab === 'search' && !search.trim() && (
                            <div className="text-center text-sm text-slate-500 py-10">Nhập ID, mã sàn hoặc mã vận đơn để tìm đơn.</div>
                        )}
                        {!loading && !(tab === 'search' && !search.trim()) && visibleList.length === 0 && (
                            <div className="text-center text-sm text-slate-500 py-10">Không tìm thấy đơn nào.</div>
                        )}
                        {!loading && visibleList.map(order => <OrderCard key={order.id} order={order} />)}
                        {!loading && currentList.length > visibleCount && (
                            <button onClick={() => setVisibleCount(c => c + 30)} className="w-full py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700">
                                Tải thêm ({currentList.length - visibleCount} đơn còn lại)
                            </button>
                        )}
                    </>
                )}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="mx-auto max-w-[480px] grid grid-cols-4">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${tab === id ? 'text-slate-900' : 'text-slate-400'}`}
                        >
                            <Icon size={22} />
                            {label}
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
}
