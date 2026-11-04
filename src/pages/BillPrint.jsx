// Trang in bill tùy chỉnh: /in-bill?ids=1,2,3&template=a4|k80|location
// Mở từ các nút in sau khi gửi đơn. Mỗi đơn 1 trang bill, vẽ từ mẫu đã
// lưu trong Cài đặt in (mặc định nếu chưa lưu). Trang này nằm trong Layout
// nên vẫn yêu cầu đăng nhập như các trang khác.
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
    TEMPLATE_TYPES, DEFAULT_TEMPLATES, loadPrintSettings,
    buildBillData, renderBillHtml,
} from '../lib/billTemplates';

const parseRaw = (order) => {
    let raw = order?.raw_data;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }
    return raw?.data || raw || {};
};

export default function BillPrint() {
    const [params, setParams] = useSearchParams();
    const ids = (params.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
    const templateId = params.get('template') || 'a4';
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [bills, setBills] = useState([]);
    const [missing, setMissing] = useState([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true); setError(''); setBills([]); setMissing([]);
            try {
                if (ids.length === 0) { setError('Không có ID đơn nào để in.'); setLoading(false); return; }
                const { data: orders, error: oErr } = await supabase.from('orders').select('*').in('id', ids);
                if (oErr) throw oErr;
                const byId = new Map((orders || []).map(o => [String(o.id), o]));
                const found = ids.map(id => byId.get(id)).filter(Boolean);
                setMissing(ids.filter(id => !byId.has(id)));
                // Sản phẩm: ưu tiên bảng order_products, thiếu thì lấy từ raw_data.
                const { data: prods } = await supabase.from('order_products').select('*').in('order_id', found.map(o => o.id));
                const prodByOrder = new Map();
                (prods || []).forEach(p => {
                    const k = String(p.order_id);
                    if (!prodByOrder.has(k)) prodByOrder.set(k, []);
                    prodByOrder.get(k).push({ name: p.product_name, code: p.product_code, quantity: p.quantity, price: p.price, discount: p.discount });
                });
                // Vị trí kệ: khớp mã trước, tên sau (giống popup chi tiết).
                const allCodes = [...new Set((prods || []).map(p => String(p.product_code)).filter(Boolean))];
                const allNames = [...new Set((prods || []).map(p => p.product_name).filter(Boolean))];
                const locMap = {};
                const addLoc = (key, loc) => {
                    if (!loc) return;
                    if (!locMap[key]) locMap[key] = [];
                    if (!locMap[key].includes(loc)) locMap[key].push(loc);
                };
                if (allCodes.length) {
                    const { data: byCode } = await supabase.from('product_inventories').select('product_code, location_code').in('product_code', allCodes);
                    (byCode || []).forEach(r => addLoc(`code:${r.product_code}`, r.location_code));
                }
                if (allNames.length) {
                    const { data: byName } = await supabase.from('product_inventories').select('product_name, location_code').in('product_name', allNames);
                    (byName || []).forEach(r => addLoc(`name:${r.product_name}`, r.location_code));
                }
                const { sender, templates } = await loadPrintSettings();
                const template = templates[templateId] || templates.a4 || DEFAULT_TEMPLATES.a4;
                const rendered = [];
                for (const order of found) {
                    const raw = parseRaw(order);
                    let products = prodByOrder.get(String(order.id)) || [];
                    if (products.length === 0 && Array.isArray(raw.products)) {
                        products = raw.products.map(p => ({ name: p.name, code: p.productCode || p.code, quantity: p.quantity, price: p.price, discount: p.discount }));
                    }
                    const data = buildBillData(order, products, locMap, sender);
                    const html = await renderBillHtml(template.html, data);
                    rendered.push({ id: order.id, html });
                }
                if (!alive) return;
                setBills(rendered);
            } catch (e) {
                if (alive) setError(e.message || 'Không tải được đơn để in.');
            }
            if (alive) setLoading(false);
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.toString()]);

    const label = (TEMPLATE_TYPES.find(t => t.id === templateId)?.label) || 'Bill A4/A5';
    const switchTemplate = (t) => setParams({ ids: ids.join(','), template: t });

    return (
        <div className="bill-print-root min-h-screen bg-slate-100 p-4">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: #fff !important; }
                    .layout-root { display: block !important; height: auto !important; overflow: visible !important; }
                    .layout-main-col { overflow: visible !important; height: auto !important; }
                    .layout-page-wrap { padding: 0 !important; display: block !important; }
                    .bill-print-root { padding: 0 !important; background: #fff !important; min-height: 0 !important; }
                    .bill-page { box-shadow: none !important; margin: 0 !important; }
                }
                @page { ${templateId === 'k80' ? 'size: 80mm auto; margin: 0;' : templateId === 'location' ? 'size: A6; margin: 0;' : 'size: A4; margin: 0;'} }
                .bill-page { page-break-after: always; }
                .bill-page:last-child { page-break-after: auto; }
            `}</style>
            <div className="no-print max-w-[210mm] mx-auto flex flex-wrap items-center gap-2 mb-4">
                <span className="font-bold text-slate-800">{label} — {bills.length} đơn</span>
                <div className="flex gap-2 ml-2">
                    {TEMPLATE_TYPES.map(t => (
                        <button key={t.id} onClick={() => switchTemplate(t.id)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${templateId === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}>{t.label}</button>
                    ))}
                </div>
                <button onClick={() => window.print()} className="ml-auto px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2"><Printer size={15} /> In ngay</button>
            </div>
            {loading && <p className="no-print max-w-[210mm] mx-auto text-sm text-slate-500 font-medium flex items-center gap-2"><RefreshCw size={15} className="animate-spin" /> Đang vẽ bill...</p>}
            {error && <p className="no-print max-w-[210mm] mx-auto text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {missing.length > 0 && <p className="no-print max-w-[210mm] mx-auto text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">Không tìm thấy đơn: {missing.join(', ')}</p>}
            {!loading && !error && bills.length === 0 && <p className="no-print max-w-[210mm] mx-auto text-sm text-slate-500">Không có bill nào để in.</p>}
            <div>
                {bills.map(b => (
                    <div key={b.id}
                        className="bill-page bg-white mx-auto mb-4 shadow-sm"
                        style={templateId === 'k80' ? { width: '80mm', padding: '4mm' } : templateId === 'location' ? { width: '105mm', padding: '4mm' } : { width: '210mm', padding: '12mm' }}
                        dangerouslySetInnerHTML={{ __html: b.html }} />
                ))}
            </div>
        </div>
    );
}
