// Engine mẫu bill tùy chỉnh (dùng chung cho trang Cài đặt in và trang in).
// Một mẫu bill lưu dạng { mode: 'builder' | 'code', blocks: [...], html: '' }.
// Lúc in luôn vẽ từ trường html; tab kéo-thả sinh html từ blocks, tab dán
// code lưu thẳng html và chuyển mode sang 'code'.
// Quy ước placeholder kiểu Nhanh: __TEN_SP__...; dòng <tr> nào chứa
// placeholder sản phẩm sẽ lặp lại theo từng sản phẩm của đơn.
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { supabase } from './supabase';

// ---------- Định dạng ----------
// KHÔNG dùng Intl timeZone ở app này (một số trình duyệt của Vinh báo
// 'Invalid time zone specified' và trắng trang): ngày VN tính bằng UTC+7 tay.
export const vnDate = (iso) => {
    if (!iso) return '';
    const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};
export const fmtVND = (n) => {
    if (n === null || n === undefined || n === '') return '';
    const v = Number(n);
    if (Number.isNaN(v)) return '';
    return `${Math.round(v).toLocaleString('vi-VN')} đ`;
};
export const fmtVNDOrEmpty = (n) => {
    if (!Number(n)) return '';
    return fmtVND(n);
};
export const fmtWeight = (w) => {
    if (w === null || w === undefined || w === '') return '';
    const v = Number(w);
    if (Number.isNaN(v)) return '';
    return v >= 1000 ? `${(v / 1000).toLocaleString('vi-VN')} kg` : `${v} g`;
};
export const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ---------- Placeholder ----------
// group: order | sender | recipient | product | money | code
export const PLACEHOLDERS = [
    { key: 'ID_DON_HANG', label: 'ID đơn hàng', group: 'order', hint: 'ID đơn trong hệ thống' },
    { key: 'MA_VAN_DON', label: 'Mã vận đơn', group: 'order', hint: 'Mã vận đơn của hãng' },
    { key: 'TEN_HANG_VC', label: 'Tên hãng vận chuyển', group: 'order', hint: 'Tên hãng của đơn' },
    { key: 'NGAY_DAT_HANG', label: 'Ngày đặt hàng', group: 'order', hint: 'Ngày tạo đơn, giờ VN' },
    { key: 'TEN_DOANH_NGHIEP', label: 'Tên doanh nghiệp', group: 'sender', hint: 'Lấy từ thông tin người gửi trong Cài đặt in' },
    { key: 'LOGO_DOANH_NGHIEP', label: 'Logo doanh nghiệp', group: 'sender', hint: 'Ảnh logo theo link trong Cài đặt in, không nhập thì trống' },
    { key: 'TEN_NGUOI_GUI', label: 'Tên người gửi', group: 'sender', hint: 'Từ Cài đặt in' },
    { key: 'SDT_NGUOI_GUI', label: 'SĐT người gửi', group: 'sender', hint: 'Từ Cài đặt in' },
    { key: 'DIA_CHI_NGUOI_GUI', label: 'Địa chỉ người gửi', group: 'sender', hint: 'Từ Cài đặt in' },
    { key: 'QUAN_HUYEN_NGUOI_GUI', label: 'Quận/huyện người gửi', group: 'sender', hint: 'Từ Cài đặt in' },
    { key: 'TEN_NGUOI_NHAN', label: 'Tên người nhận', group: 'recipient', hint: 'Từ địa chỉ giao hàng của đơn' },
    { key: 'SDT_NGUOI_NHAN', label: 'SĐT người nhận', group: 'recipient', hint: 'Từ địa chỉ giao hàng của đơn' },
    { key: 'DIA_CHI_NGUOI_NHAN', label: 'Địa chỉ người nhận', group: 'recipient', hint: 'Từ địa chỉ giao hàng của đơn' },
    { key: 'PHUONG_QUAN_TINH_NGUOI_NHAN', label: 'Phường/quận/tỉnh người nhận', group: 'recipient', hint: 'Đơn chỉ lưu mã số tỉnh/huyện/xã nên mục này thường để trống, không bịa tên' },
    { key: 'MA_VACH_DON_HANG', label: 'Mã vạch đơn hàng', group: 'code', hint: 'Ảnh barcode Code128 của mã vận đơn' },
    { key: 'MA_QR_DON_HANG', label: 'Mã QR đơn hàng', group: 'code', hint: 'Ảnh QR của mã vận đơn' },
    { key: 'MA_VACH_ID_DON_HANG', label: 'Mã vạch ID đơn hàng', group: 'code', hint: 'Ảnh barcode Code128 của ID đơn hàng' },
    { key: 'TEN_SP', label: 'Tên sản phẩm', group: 'product', hint: 'Chỉ lặp trong dòng bảng sản phẩm, ngoài bảng lấy sản phẩm đầu tiên' },
    { key: 'SO_LUONG_SP', label: 'Số lượng sản phẩm', group: 'product', hint: 'Số lượng của dòng sản phẩm đó' },
    { key: 'GIA_SP', label: 'Giá sản phẩm', group: 'product', hint: 'Đơn giá của dòng sản phẩm đó' },
    { key: 'THANH_TIEN_SP', label: 'Thành tiền sản phẩm', group: 'product', hint: 'Giá x số lượng trừ chiết khấu dòng' },
    { key: 'VI_TRI_SP', label: 'Vị trí kệ sản phẩm', group: 'product', hint: 'Vị trí trong kho (product_inventories), khớp mã trước tên sau, không có thì trống' },
    { key: 'TONG_TIEN', label: 'Tổng thu', group: 'money', hint: 'Tổng tiền đơn: tổng các dòng trừ chiết khấu' },
    { key: 'TONG_GT_DON_HANG', label: 'Tổng giá trị đơn hàng', group: 'money', hint: 'Bằng tổng thu ở trên' },
    { key: 'PHI_THU_CUA_KHACH', label: 'Phí ship báo khách', group: 'money', hint: 'Phí ship khách trả (dữ liệu hãng), không có thì trống' },
    { key: 'TIEN_CHIET_KHAU', label: 'Tiền chiết khấu', group: 'money', hint: 'Tổng chiết khấu các dòng, không có thì trống' },
    { key: 'PHI_VAN_CHUYEN', label: 'Phí vận chuyển', group: 'money', hint: 'Phí hãng thu người gửi, không có thì trống' },
    { key: 'KHOI_LUONG', label: 'Khối lượng', group: 'money', hint: 'Cân nặng hãng ghi nhận, không có thì trống' },
    { key: 'MO_TA', label: 'Ghi chú đơn', group: 'order', hint: 'Ghi chú đơn (không lấy ghi chú nội bộ)' },
];
export const PRODUCT_KEYS = ['TEN_SP', 'SO_LUONG_SP', 'GIA_SP', 'THANH_TIEN_SP', 'VI_TRI_SP'];
export const PLACEHOLDER_GROUPS = [
    { id: 'order', label: 'Đơn hàng' },
    { id: 'sender', label: 'Người gửi' },
    { id: 'recipient', label: 'Người nhận' },
    { id: 'product', label: 'Sản phẩm' },
    { id: 'money', label: 'Tiền' },
    { id: 'code', label: 'Mã vạch / QR' },
];

// ---------- Vệ sinh HTML mẫu ----------
// Mẫu chỉ do owner/super_admin sửa và chỉ chạy trên trình duyệt của chính
// người bấm in, nhưng vẫn lược bỏ script và handler để tránh vô tình dán
// phải code lạ từ mẫu Nhanh copy về.
export const sanitizeBillHtml = (html) => String(html || '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""');

// ---------- Dữ liệu bill ----------
// order: dòng orders (kèm raw_data); products: [{name, code, quantity, price, discount}];
// locMap: { 'code:<mã>': [vị trí], 'name:<tên>': [vị trí] }; sender: {name, phone, address, district, logoUrl}
export const buildBillData = (order, products, locMap, sender) => {
    let raw = order?.raw_data;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }
    const data = raw?.data || raw || {};
    const ship = data.shippingAddress || {};
    const carrier = data.carrier || {};
    const payment = data.payment || {};
    const list = (products || []).map(p => {
        const price = Number(p.price) || 0;
        const qty = Number(p.quantity) || 0;
        const discount = Number(p.discount) || 0;
        const loc = (p.code ? locMap?.[`code:${p.code}`] : null)
            || (p.name ? locMap?.[`name:${p.name}`] : null) || [];
        return {
            TEN_SP: p.name || '', SO_LUONG_SP: String(qty), GIA_SP: fmtVND(price),
            THANH_TIEN_SP: fmtVND(price * qty - discount),
            VI_TRI_SP: loc.join(', '),
        };
    });
    const totalGoods = (products || []).reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 0), 0);
    let totalDiscount = (products || []).reduce((s, p) => s + (Number(p.discount) || 0), 0);
    if (!totalDiscount && Number(payment.discount?.amount)) totalDiscount = Number(payment.discount.amount);
    const total = totalGoods - totalDiscount;
    return {
        order, products: list,
        scalars: {
            ID_DON_HANG: String(order?.id ?? ''),
            MA_VAN_DON: String(order?.carrier_code || ''),
            TEN_HANG_VC: String(order?.carrier_name || carrier?.name || ''),
            NGAY_DAT_HANG: vnDate(order?.created_at),
            TEN_DOANH_NGHIEP: sender?.name || '',
            LOGO_DOANH_NGHIEP: sender?.logoUrl
                ? `<img src="${escapeHtml(sender.logoUrl)}" alt="" style="max-height:60px;max-width:220px;" />` : '',
            TEN_NGUOI_GUI: sender?.name || '',
            SDT_NGUOI_GUI: sender?.phone || '',
            DIA_CHI_NGUOI_GUI: sender?.address || '',
            QUAN_HUYEN_NGUOI_GUI: sender?.district || '',
            TEN_NGUOI_NHAN: ship.name || '',
            SDT_NGUOI_NHAN: ship.mobile || '',
            DIA_CHI_NGUOI_NHAN: ship.address || '',
            PHUONG_QUAN_TINH_NGUOI_NHAN: '',
            TONG_TIEN: fmtVND(total),
            TONG_GT_DON_HANG: fmtVND(total),
            PHI_THU_CUA_KHACH: fmtVNDOrEmpty(carrier.customerShipFee),
            TIEN_CHIET_KHAU: fmtVNDOrEmpty(totalDiscount),
            PHI_VAN_CHUYEN: fmtVNDOrEmpty(carrier.shipFee),
            KHOI_LUONG: fmtWeight(carrier.weight),
            MO_TA: order?.description || '',
        },
    };
};

// ---------- Vẽ bill ----------
// Trả về Promise<string> vì QR vẽ bất đồng bộ. Barcode vẽ đồng bộ bằng SVG.
const barcodeSvg = (code) => {
    if (!code) return '';
    try {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svg, String(code), { format: 'CODE128', width: 2, height: 56, displayValue: false, margin: 0 });
        return svg.outerHTML;
    } catch { return ''; }
};
const qrImg = async (code, size = 140) => {
    if (!code) return '';
    try {
        const url = await QRCode.toDataURL(String(code), { width: 220, margin: 1 });
        return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;" />`;
    } catch { return ''; }
};
export const renderBillHtml = async (templateHtml, billData) => {
    let html = sanitizeBillHtml(templateHtml);
    const { scalars, products } = billData;
    // 1. Lặp dòng sản phẩm: <tr> nào chứa placeholder sản phẩm thì nhân
    // bản theo từng sản phẩm; đơn không có sản phẩm thì để 1 dòng trống.
    const productRowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    html = html.replace(productRowRe, (row) => {
        if (!PRODUCT_KEYS.some(k => row.includes(`__${k}__`))) return row;
        if (!products || products.length === 0) {
            let blank = row;
            PRODUCT_KEYS.forEach(k => { blank = blank.split(`__${k}__`).join(''); });
            return blank;
        }
        return products.map(p => {
            let r = row;
            PRODUCT_KEYS.forEach(k => { r = r.split(`__${k}__`).join(escapeHtml(p[k] ?? '')); });
            return r;
        }).join('');
    });
    // 2. Barcode / QR (ảnh) trước khi thay text thường.
    const carrierCode = scalars.MA_VAN_DON;
    html = html.split('__MA_VACH_DON_HANG__').join(barcodeSvg(carrierCode));
    html = html.split('__MA_QR_DON_HANG__').join(await qrImg(carrierCode));
    html = html.split('__MA_VACH_ID_DON_HANG__').join(barcodeSvg(scalars.ID_DON_HANG));
    // 3. Placeholder text còn lại (sản phẩm ngoài bảng lấy sản phẩm đầu).
    const first = (products && products[0]) || {};
    const all = { ...scalars };
    PRODUCT_KEYS.forEach(k => { if (!(k in all)) all[k] = first[k] ?? ''; });
    Object.entries(all).forEach(([k, v]) => {
        const safe = (k === 'LOGO_DOANH_NGHIEP') ? String(v ?? '') : escapeHtml(v ?? '');
        html = html.split(`__${k}__`).join(safe);
    });
    return html;
};

// ---------- Khối kéo-thả ----------
// Builder xếp khối theo chiều dọc (đúng cấu trúc bill: đầu -> người gửi
// -> sản phẩm -> tiền). Kéo thả đổi thứ tự, không kéo tự do 2 chiều.
export const BLOCK_TYPES = [
    { type: 'heading', label: 'Tiêu đề lớn' },
    { type: 'business', label: 'Tên doanh nghiệp' },
    { type: 'logo', label: 'Logo doanh nghiệp' },
    { type: 'barcode', label: 'Mã vạch đơn hàng' },
    { type: 'barcode-id', label: 'Mã vạch ID đơn' },
    { type: 'qr', label: 'Mã QR đơn hàng' },
    { type: 'text', label: 'Dòng chữ (kèm placeholder)' },
    { type: 'sender', label: 'Khối người gửi' },
    { type: 'recipient', label: 'Khối người nhận' },
    { type: 'products', label: 'Bảng sản phẩm' },
    { type: 'totals', label: 'Khối tiền' },
    { type: 'divider', label: 'Đường kẻ' },
    { type: 'spacer', label: 'Khoảng trống' },
];
let blockSeq = 0;
export const newBlock = (type) => {
    blockSeq += 1;
    const base = { id: `b${Date.now()}_${blockSeq}`, type, fontSize: 14, align: 'left', bold: false };
    if (type === 'heading') return { ...base, text: 'ĐƠN NGOẠI SÀN', fontSize: 20, align: 'center', bold: true };
    if (type === 'text') return { ...base, text: '' };
    if (type === 'barcode') return { ...base, align: 'center' };
    if (type === 'barcode-id') return { ...base, align: 'center' };
    if (type === 'qr') return { ...base, align: 'center', size: 140 };
    if (type === 'logo') return { ...base, align: 'center' };
    if (type === 'business') return { ...base, fontSize: 16, align: 'center', bold: true };
    if (type === 'sender') return { ...base };
    if (type === 'recipient') return { ...base };
    if (type === 'products') return { ...base, columns: ['name', 'qty', 'price', 'location'], showHeader: true };
    if (type === 'totals') return { ...base };
    if (type === 'spacer') return { ...base, height: 16 };
    return base;
};
const styleOf = (b) => `font-size:${b.fontSize || 14}px;text-align:${b.align || 'left'};${b.bold ? 'font-weight:bold;' : ''}`;
const PRODUCT_COLS = {
    name: { label: 'HÀNG HÓA', ph: '__TEN_SP__' },
    qty: { label: 'SL', ph: '__SO_LUONG_SP__' },
    price: { label: 'Giá', ph: '__GIA_SP__' },
    location: { label: 'Vị trí', ph: '__VI_TRI_SP__' },
};
export const blocksToHtml = (blocks) => (blocks || []).map(b => {
    switch (b.type) {
        case 'heading':
        case 'text':
            return `<div style="${styleOf(b)}">${escapeHtml(b.text || '')}</div>`;
        case 'business':
            return `<div style="${styleOf(b)}">__TEN_DOANH_NGHIEP__</div>`;
        case 'logo':
            return `<div style="text-align:${b.align || 'center'};">__LOGO_DOANH_NGHIEP__</div>`;
        case 'barcode':
            return `<div style="text-align:${b.align || 'center'};">__MA_VACH_DON_HANG__</div>`;
        case 'barcode-id':
            return `<div style="text-align:${b.align || 'center'};">__MA_VACH_ID_DON_HANG__</div>`;
        case 'qr':
            return `<div style="text-align:${b.align || 'center'};">__MA_QR_DON_HANG__</div>`;
        case 'sender':
            return `<div style="${styleOf(b)}"><strong>Người gửi:</strong> __TEN_NGUOI_GUI__ - __SDT_NGUOI_GUI__ - __DIA_CHI_NGUOI_GUI__ - __QUAN_HUYEN_NGUOI_GUI__</div>`;
        case 'recipient':
            return `<div style="${styleOf(b)}"><strong>Người nhận:</strong> __TEN_NGUOI_NHAN__ - __SDT_NGUOI_NHAN__ - __DIA_CHI_NGUOI_NHAN__</div>`;
        case 'products': {
            const cols = (b.columns && b.columns.length ? b.columns : ['name', 'qty', 'price']).filter(c => PRODUCT_COLS[c]);
            const head = b.showHeader ? `<tr>${cols.map(c => `<td><strong>${PRODUCT_COLS[c].label}</strong></td>`).join('')}</tr>` : '';
            const row = `<tr>${cols.map(c => `<td>${PRODUCT_COLS[c].ph}</td>`).join('')}</tr>`;
            return `<table style="border-collapse:collapse;width:100%;font-size:${b.fontSize || 14}px;">${head}${row}</table>`;
        }
        case 'totals':
            return `<div style="${styleOf(b)}"><strong>Tổng thu:</strong> __TONG_TIEN__</div>`
                + `<div style="${styleOf(b)}"><strong>Phí ship báo khách:</strong> __PHI_THU_CUA_KHACH__</div>`
                + `<div style="${styleOf(b)}"><strong>Chiết khấu:</strong> __TIEN_CHIET_KHAU__</div>`
                + `<div style="${styleOf(b)}"><strong>Tổng tiền:</strong> __TONG_GT_DON_HANG__</div>`
                + `<div style="${styleOf(b)}"><strong>Ghi chú:</strong> __MO_TA__</div>`;
        case 'divider':
            return `<hr style="border:none;border-top:1px dashed #999;margin:8px 0;" />`;
        case 'spacer':
            return `<div style="height:${b.height || 16}px;"></div>`;
        default:
            return '';
    }
}).join('\n');

// ---------- Mẫu mặc định ----------
const mkBlocks = (specs) => specs.map(([type, patch]) => ({ ...newBlock(type), ...(patch || {}) }));
export const TEMPLATE_TYPES = [
    { id: 'a4', label: 'Bill A4/A5', configKey: 'print_template_a4' },
    { id: 'k80', label: 'Bill K80', configKey: 'print_template_k80' },
    { id: 'location', label: 'Bill có vị trí', configKey: 'print_template_location' },
];
const defaultA4 = mkBlocks([
    ['business', {}], ['barcode', {}],
    ['sender', {}], ['recipient', {}],
    ['products', { columns: ['name', 'qty', 'price'] }],
    ['totals', {}],
]);
const defaultK80 = mkBlocks([
    ['business', { fontSize: 14 }], ['barcode', {}],
    ['recipient', { fontSize: 12 }],
    ['products', { fontSize: 12, columns: ['name', 'qty', 'price'] }],
    ['totals', { fontSize: 12 }],
]);
const defaultLocation = mkBlocks([
    ['heading', { text: 'ĐƠN NGOẠI SÀN' }],
    ['text', { text: 'ID đơn hàng: __ID_DON_HANG__ | Mã vận đơn: __MA_VAN_DON__ | Hãng: __TEN_HANG_VC__', fontSize: 13, align: 'center' }],
    ['barcode', {}],
    ['barcode-id', {}],
    ['sender', {}], ['recipient', {}],
    ['products', { columns: ['name', 'qty', 'location'] }],
    ['qr', {}],
    ['text', { text: 'Ngày đặt hàng: __NGAY_DAT_HANG__ | Khối lượng: __KHOI_LUONG__', fontSize: 13 }],
    ['totals', {}],
]);
export const DEFAULT_TEMPLATES = {
    a4: { mode: 'builder', blocks: defaultA4, html: blocksToHtml(defaultA4) },
    k80: { mode: 'builder', blocks: defaultK80, html: blocksToHtml(defaultK80) },
    location: { mode: 'builder', blocks: defaultLocation, html: blocksToHtml(defaultLocation) },
};
export const DEFAULT_SENDER = { name: 'Amelie', phone: '0363101697', address: 'Số 20 Ngõ 126 Mễ Trì Hạ, Phường Mễ Trì', district: 'Quận Từ Liêm, Hà Nội', logoUrl: '' };

// ---------- Lưu / tải cài đặt in ----------
const parseStored = (value, fallback) => {
    if (!value) return fallback;
    try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return fallback; }
};
export const loadPrintSettings = async () => {
    const { data } = await supabase.from('system_configs')
        .select('key, value').in('key', ['print_sender', 'print_template_a4', 'print_template_k80', 'print_template_location']);
    const map = {};
    (data || []).forEach(r => { map[r.key] = r.value; });
    const sender = { ...DEFAULT_SENDER, ...parseStored(map.print_sender, {}) };
    const templates = {};
    TEMPLATE_TYPES.forEach(t => {
        const stored = parseStored(map[t.configKey], null);
        if (stored && typeof stored.html === 'string') {
            templates[t.id] = {
                mode: stored.mode === 'code' ? 'code' : 'builder',
                blocks: Array.isArray(stored.blocks) ? stored.blocks : DEFAULT_TEMPLATES[t.id].blocks,
                html: stored.html,
            };
        } else {
            templates[t.id] = DEFAULT_TEMPLATES[t.id];
        }
    });
    return { sender, templates };
};
export const savePrintSender = async (sender) => {
    const { error } = await supabase.from('system_configs')
        .upsert({ key: 'print_sender', value: JSON.stringify(sender) }, { onConflict: 'key' });
    if (error) throw error;
};
export const savePrintTemplate = async (typeId, template) => {
    const type = TEMPLATE_TYPES.find(t => t.id === typeId);
    if (!type) throw new Error('Loại bill không hợp lệ');
    const clean = { mode: template.mode, blocks: template.blocks || [], html: sanitizeBillHtml(template.html || '') };
    const { error } = await supabase.from('system_configs')
        .upsert({ key: type.configKey, value: JSON.stringify(clean) }, { onConflict: 'key' });
    if (error) throw error;
    return clean;
};

// ---------- Dữ liệu mẫu cho xem trước ----------
export const SAMPLE_BILL_DATA = (() => {
    const order = {
        id: '877359683', carrier_code: 'SPXVN06190082845B', carrier_name: 'SPX',
        created_at: new Date().toISOString(), description: 'Cho xem, không thử hàng',
        raw_data: { data: {
            shippingAddress: { name: 'Triệu Mẫn', mobile: '0966782555', address: 'Số 20 Ngõ 126 Mễ Trì Hạ, Phường Mễ Trì, Quận Từ Liêm, Hà Nội' },
            carrier: { customerShipFee: 30000, shipFee: 25000, weight: 600 },
        } },
    };
    const products = [
        { name: 'AINO 720 - Xanh da trời - M', code: 'AINO720', quantity: 1, price: 350000, discount: 0 },
        { name: 'SOREN 753 - Xanh tiffany - M', code: 'SOREN753', quantity: 1, price: 420000, discount: 0 },
    ];
    const locMap = { 'code:AINO720': ['K-A'], 'code:SOREN753': ['K-B'] };
    return buildBillData(order, products, locMap, DEFAULT_SENDER);
})();
