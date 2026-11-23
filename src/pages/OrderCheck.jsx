import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { parseIdList, sortRowsByPastedOrder } from '../lib/idListSearch';
import { Search, Download, X, Loader2, PackageSearch } from 'lucide-react';

// Trang Check đơn: dán danh sách ID đơn / mã vận đơn (tối đa 50/lần),
// tra toàn bộ thông tin từng đơn: sản phẩm, số lượng, giá tiền, trạng
// thái, người tạo, kênh bán; xuất Excel 1 dòng/sản phẩm.
const MAX_CHECK = 50;

const SALE_CHANNELS = {
    '1': 'Admin', '2': 'Website', '10': 'API', '20': 'Facebook', '21': 'Instagram',
    '41': 'Lazada', '42': 'Shopee', '43': 'Sendo', '45': 'Tiki', '48': 'Tiktok Shop',
    '49': 'Zalo OA', '50': 'Shopee chat', '51': 'Lazada chat', '52': 'Zalo cá nhân'
};

const fmtMoney = (v) => {
    if (v === null || v === undefined || v === '') return 'Chưa có';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return `${n.toLocaleString('vi-VN')} đ`;
};

const fmtDateTime = (s) => {
    if (!s) return 'Chưa có';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString('vi-VN');
};

// raw_data có thể là chuỗi JSON hoặc object, có thể lồng trong .data.
const parseRawData = (order) => {
    let raw = order?.raw_data;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }
    return raw?.data || raw || {};
};

// Ghép sản phẩm của 1 đơn: ưu tiên bảng order_products; giá lấy từ bảng
// nếu > 0, nếu không thì lấy từ raw_data của Nhanh (đơn về qua webhook
// chưa có giá trong bảng do lỗi cột price trước đây). Nếu bảng không có
// dòng nào thì dùng hẳn sản phẩm trong raw_data.
export const resolveOrderProducts = (order) => {
    const raw = parseRawData(order);
    const rawProducts = Array.isArray(raw?.products) ? raw.products : [];
    const rawPriceByCode = new Map();
    const rawPriceById = new Map();
    rawProducts.forEach((p) => {
        const code = String(p.code || p.productCode || '').toUpperCase();
        const id = p.id != null ? String(p.id) : '';
        const price = Number(p.price || 0);
        if (code && !rawPriceByCode.has(code)) rawPriceByCode.set(code, price);
        if (id && !rawPriceById.has(id)) rawPriceById.set(id, price);
    });
    const rows = Array.isArray(order?.order_products) ? order.order_products : [];
    if (rows.length > 0) {
        return rows.map((p) => {
            const price = Number(p.price || 0);
            const fallback = rawPriceByCode.get(String(p.product_code || '').toUpperCase())
                ?? (p.product_id != null ? rawPriceById.get(String(p.product_id)) : undefined)
                ?? 0;
            return {
                code: p.product_code || '',
                name: p.product_name || '',
                quantity: Number(p.quantity || 0),
                price: price > 0 ? price : fallback,
            };
        });
    }
    return rawProducts.map((p) => ({
        code: String(p.code || p.productCode || ''),
        name: p.name || p.productName || '',
        quantity: Number(p.quantity || 0),
        price: Number(p.price || 0),
    }));
};

// Kiểu tra của trang Check đơn: tra theo đúng 1 cột, không gộp chung
// nhiều cột (tra gộp bằng OR vừa chậm vừa dễ timeout khi tra nhiều).
// 'id': ID đơn Nhanh; 'carrier': mã vận đơn; 'ecom': mã đơn sàn.
export const SEARCH_TYPES = [
    { id: 'id', label: 'ID đơn' },
    { id: 'carrier', label: 'Mã vận đơn' },
    { id: 'ecom', label: 'Mã đơn sàn' },
];

export const buildCheckQuery = (list, searchType) => {
    if (searchType === 'carrier') return { column: 'carrier_code', values: list.map((c) => c.upper) };
    if (searchType === 'ecom') return { column: 'ecom_order_id', values: list.map((c) => c.raw) };
    return { column: 'id', values: list.map((c) => c.raw) };
};

export default function OrderCheck() {
    const [input, setInput] = useState('');
    const [searchType, setSearchType] = useState('id');
    const [results, setResults] = useState([]);
    const [notFound, setNotFound] = useState([]);
    const [searchedCount, setSearchedCount] = useState(0);
    const [overLimit, setOverLimit] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);
    const [exportMsg, setExportMsg] = useState('');
    const [statusDict, setStatusDict] = useState({});

    useEffect(() => {
        supabase.from('order_statuses').select('id,name').then(({ data }) => {
            const dict = {};
            data?.forEach((s) => { dict[s.id] = s.name; });
            setStatusDict(dict);
        });
    }, []);

    const handleClear = () => {
        setInput('');
        setResults([]);
        setNotFound([]);
        setSearchedCount(0);
        setOverLimit(0);
        setError('');
        setExportMsg('');
    };

    const handleCheck = async () => {
        const { list, total } = parseIdList(input, MAX_CHECK);
        if (list.length === 0) {
            setError('Dán ít nhất 1 mã để tra cứu.');
            return;
        }
        setError('');
        setExportMsg('');
        setLoading(true);
        setResults([]);
        setNotFound([]);
        try {
            // Tra theo đúng 1 cột đã chọn (không OR gộp nhiều cột) để
            // tránh timeout khi tra nhiều mã cùng lúc.
            const { column, values } = buildCheckQuery(list, searchType);
            const matched = [];
            const seen = new Set();
            for (let i = 0; i < values.length; i += 50) {
                const { data: rows, error: qErr } = await supabase.from('orders')
                    .select('*, order_products(product_code, product_name, quantity, price)')
                    .in(column, values.slice(i, i + 50))
                    .range(0, 999);
                if (qErr) throw qErr;
                (rows || []).forEach((r) => { if (!seen.has(String(r.id))) { seen.add(String(r.id)); matched.push(r); } });
            }
            const ordered = sortRowsByPastedOrder(matched, list);
            const foundKeys = new Set();
            ordered.forEach((o) => {
                foundKeys.add(String(o.id).toUpperCase());
                if (o.carrier_code) foundKeys.add(String(o.carrier_code).toUpperCase());
                if (o.ecom_order_id) foundKeys.add(String(o.ecom_order_id).toUpperCase());
            });
            setNotFound(list.filter((c) => !foundKeys.has(c.upper)).map((c) => c.raw));
            setSearchedCount(list.length);
            setOverLimit(total > list.length ? total - list.length : 0);
            setResults(ordered.map((o) => {
                const products = resolveOrderProducts(o);
                const totalAmount = products.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 0), 0);
                return { order: o, products, totalAmount };
            }));
        } catch (e) {
            setError(e.message || 'Không tra cứu được, thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (results.length === 0) return;
        setExporting(true);
        setExportMsg(`Đang xuất file Excel cho ${results.length} đơn hàng...`);
        try {
            const XLSX = await import('xlsx');
            const rowData = [];
            results.forEach(({ order, products }) => {
                const baseRow = {
                    'ID Đơn': order.id,
                    'Mã vận đơn': order.carrier_code || '',
                    'Trạng thái': statusDict[order.status] || `Mã ${order.status}`,
                    'Người tạo': order.created_by_name || 'Hệ thống',
                    'Kênh bán': SALE_CHANNELS[order.sale_channel] || order.sale_channel || '',
                    'Ngày tạo': order.created_at ? fmtDateTime(order.created_at) : '',
                };
                if (products.length === 0) {
                    rowData.push({ ...baseRow, 'Tên sản phẩm': 'Không có dữ liệu SP', 'Mã sản phẩm': '', 'Số lượng': 0, 'Giá tiền': 0, 'Thành tiền': 0 });
                } else {
                    products.forEach((p) => {
                        rowData.push({
                            ...baseRow,
                            'Tên sản phẩm': p.name || '',
                            'Mã sản phẩm': p.code || '',
                            'Số lượng': p.quantity || 0,
                            'Giá tiền': p.price || 0,
                            'Thành tiền': (Number(p.price) || 0) * (Number(p.quantity) || 0),
                        });
                    });
                }
            });
            const worksheet = XLSX.utils.json_to_sheet(rowData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'CheckDon');
            XLSX.writeFile(workbook, `Check_don_${new Date().getTime()}.xlsx`);
            setExportMsg('Đã xuất file Excel thành công.');
        } catch (e) {
            setExportMsg(`Lỗi xuất Excel: ${e.message || 'không rõ nguyên nhân'}`);
        } finally {
            setExporting(false);
            setTimeout(() => setExportMsg(''), 4000);
        }
    };

    const foundCount = results.length;

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Check đơn</h1>
                <p className="text-sm text-slate-500 font-medium mt-1">Chọn kiểu tra rồi dán danh sách mã để tra cứu nhanh sản phẩm, giá tiền, trạng thái, người tạo và kênh bán.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">Tra bằng:</span>
                    {SEARCH_TYPES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setSearchType(t.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${searchType === t.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={6}
                    placeholder={searchType === 'carrier'
                        ? 'Dán danh sách mã vận đơn — mỗi dòng 1 mã\nSPXVN069746907116B\nSPXVN061934296048'
                        : searchType === 'ecom'
                            ? 'Dán danh sách mã đơn sàn — mỗi dòng 1 mã (đơn Shopee / TikTok / Lazada)'
                            : 'Dán danh sách ID đơn — mỗi dòng 1 mã\n80808080\n82828228'}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 bg-white transition-colors resize-y font-mono"
                />
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleCheck}
                        disabled={loading || !input.trim()}
                        className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        {loading ? 'Đang tra cứu...' : 'Tra cứu'}
                    </button>
                    <button
                        onClick={handleClear}
                        className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 flex items-center gap-2"
                    >
                        <X size={15} /> Xóa
                    </button>
                    <span className="text-xs text-slate-400 font-medium">Tối đa {MAX_CHECK} đơn/lần — mỗi dòng 1 mã, tra theo {searchType === 'carrier' ? 'mã vận đơn' : searchType === 'ecom' ? 'mã đơn sàn' : 'ID đơn'}.</span>
                </div>
                {error && (
                    <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}
                {searchedCount > 0 && !loading && (
                    <div className="text-sm leading-6">
                        <p className="font-bold text-slate-800">
                            Tìm thấy {foundCount}/{searchedCount} đơn
                            {overLimit > 0 ? ` — chỉ tra ${MAX_CHECK} mã đầu, còn ${overLimit} mã chưa tra` : ''}
                        </p>
                        {notFound.length > 0 && (
                            <p className="font-medium text-red-600">
                                Không tìm thấy {notFound.length} mã: {notFound.slice(0, 20).join(', ')}{notFound.length > 20 ? ` … +${notFound.length - 20} mã` : ''}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {results.length > 0 && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-base font-bold text-slate-900">Kết quả tra cứu ({results.length} đơn)</h2>
                        <button
                            onClick={handleExportExcel}
                            disabled={exporting}
                            className="px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
                        </button>
                    </div>
                    {exportMsg && (
                        <p className="text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{exportMsg}</p>
                    )}
                    {results.map(({ order, products, totalAmount }) => (
                        <div key={String(order.id)} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                                <span>
                                    <span className="text-slate-500 font-medium">ID đơn: </span>
                                    <span className="font-mono font-bold text-slate-900">#{order.id}</span>
                                </span>
                                <span>
                                    <span className="text-slate-500 font-medium">Mã vận đơn: </span>
                                    <span className="font-mono font-bold text-slate-900">{order.carrier_code || 'Chưa có'}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-200 text-slate-700">
                                    {statusDict[order.status] || `Mã ${order.status}`}
                                </span>
                                <span>
                                    <span className="text-slate-500 font-medium">Kênh bán: </span>
                                    <span className="font-bold text-slate-800">{SALE_CHANNELS[order.sale_channel] || order.sale_channel || 'Khác'}</span>
                                </span>
                                <span>
                                    <span className="text-slate-500 font-medium">Người tạo: </span>
                                    <span className="font-bold text-slate-800">{order.created_by_name || 'Hệ thống'}</span>
                                </span>
                                <span>
                                    <span className="text-slate-500 font-medium">Ngày tạo: </span>
                                    <span className="font-bold text-slate-800">{fmtDateTime(order.created_at)}</span>
                                </span>
                            </div>
                            {products.length === 0 ? (
                                <p className="px-5 py-4 text-sm font-medium text-red-600">Không có dữ liệu sản phẩm cho đơn này.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                                            <th className="px-5 py-2 font-bold">Sản phẩm</th>
                                            <th className="px-3 py-2 font-bold text-right w-20">SL</th>
                                            <th className="px-3 py-2 font-bold text-right w-32">Giá tiền</th>
                                            <th className="px-5 py-2 font-bold text-right w-36">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((p, idx) => (
                                            <tr key={`${p.code}-${idx}`} className="border-b border-slate-100 last:border-0">
                                                <td className="px-5 py-2">
                                                    <div className="font-bold text-slate-800">{p.name || 'Không rõ tên'}</div>
                                                    <div className="font-mono text-xs text-slate-500">{p.code}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-slate-800">{p.quantity}</td>
                                                <td className="px-3 py-2 text-right text-slate-700">{fmtMoney(p.price)}</td>
                                                <td className="px-5 py-2 text-right font-bold text-slate-900">{fmtMoney((Number(p.price) || 0) * (Number(p.quantity) || 0))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50">
                                            <td colSpan={3} className="px-5 py-2 text-right font-bold text-slate-700">Tổng tiền đơn</td>
                                            <td className="px-5 py-2 text-right font-bold text-slate-900">{fmtMoney(totalAmount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {searchedCount > 0 && results.length === 0 && !loading && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
                    <PackageSearch size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Không tìm thấy đơn nào khớp với danh sách đã dán.</p>
                </div>
            )}
        </div>
    );
}
