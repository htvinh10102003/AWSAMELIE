import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ChevronLeft, ChevronRight, Loader2, Package, Copy, FileDown, Pencil, ScanLine, X } from 'lucide-react';
import { mapReturnProduct, buildInventoryIndex } from '../lib/tiktokProductMap';

const NHANH_STATUS_NAMES = {
  1: 'Đã hoàn tiền',
  2: 'Đang xử lý',
  3: 'Đã hủy yêu cầu',
  4: 'Đang khiếu nại',
  5: 'Đang hoàn tiền',
};
const NHANH_STATUS_BADGE = {
  1: 'bg-green-100 text-green-800 border border-green-200',
  2: 'bg-amber-100 text-amber-800 border border-amber-200',
  3: 'bg-zinc-200 text-zinc-800 border border-zinc-300',
  4: 'bg-purple-100 text-purple-800 border border-purple-200',
  5: 'bg-sky-100 text-sky-800 border border-sky-200',
};
const RETURN_TYPE_NAMES = {
  1: 'Hoàn tiền ngay',
  2: 'Trả hàng và hoàn tiền',
  3: 'Đổi mới',
};
const PLATFORMS = [
  { id: '', name: 'Tất cả sàn' },
  { id: 8195, name: 'Shopee' },
  { id: 8855, name: 'TikTok' },
  { id: 8142, name: 'Lazada' },
];
const PAGE_SIZE = 20;

function vnTodayStr() {
  // Giờ VN = UTC+7, không DST; tính thuần bằng cộng 7 giờ để khỏi phụ thuộc
  // Intl timeZone (có trình duyệt không nhận Asia/Ho_ChiMinh và làm sập trang).
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  if (isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
function fmtDateOnly(dateStr) {
  if (!dateStr) return '—';
  const m = String(dateStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(dateStr);
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('vi-VN').format(v);
}
function escapeLike(q) {
  return q.replace(/[\\%_]/g, (c) => '\\' + c);
}
// Mã đơn trả "thật" chỉ là mã vận đơn trả có đầu SPX / G / 8 / 1 / VTP.
// Mọi mã khác đều chưa phải mã đơn trả (hiển thị "Chưa có mã đơn trả").
const RETURN_CODE_PREFIXES = ['SPX', 'G', '8', '1', 'VTP'];
function isReturnCode(code) {
  const c = String(code || '').trim().toUpperCase();
  return c !== '' && RETURN_CODE_PREFIXES.some((p) => c.startsWith(p));
}
function returnCodeOf(row) {
  const code = row.return_tracking_number || row.return_id;
  return code && isReturnCode(code) ? String(code) : '';
}
function productsOf(row) {
  return Array.isArray(row.products) ? row.products : [];
}
function totalQty(row) {
  return productsOf(row).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
}

// --- Đơn hoàn 1 phần (type 16) trong bảng orders ---
// ID đơn gốc có thể nằm ở nhiều chỗ khác nhau trong raw_data — thử lần lượt
// tất cả, lấy giá trị đầu tiên khác null/0 rồi String() nó.
function partialOriginalIdOf(raw) {
  const cands = [
    raw?.info?.originalOrderId,
    raw?.data?.info?.originalOrderId,
    raw?.originalOrder?.id,
    raw?.data?.originalOrder?.id,
  ];
  for (const c of cands) {
    if (c !== null && c !== undefined && c !== 0 && String(c).trim() !== '') return String(c);
  }
  return null;
}
function partialAppOrderIdOf(raw) {
  const v = raw?.channel?.appOrderId ?? raw?.data?.channel?.appOrderId;
  return v !== null && v !== undefined && String(v).trim() !== '' ? String(v) : null;
}
function stripTrailingR(appOrderId) {
  return String(appOrderId).replace(/R$/, '');
}

// --- Đối chiếu hàng loạt: hãng theo đầu mã vận đơn ---
// Kiểm tra tiền tố dài trước (SPX, VTP) rồi mới tới tiền tố 1 ký tự (8, G, 1).
const CARRIER_BY_PREFIX = [
  { prefix: 'SPX', name: 'SPX (Shopee Express)' },
  { prefix: 'VTP', name: 'Viettel Post' },
  { prefix: '8', name: 'J&T Express' },
  { prefix: 'G', name: 'GHN' },
  { prefix: '1', name: 'GHTK' },
];
function carrierOf(code) {
  const c = String(code || '').trim().toUpperCase();
  for (const { prefix, name } of CARRIER_BY_PREFIX) {
    if (c && c.startsWith(prefix)) return name;
  }
  return 'Hãng khác';
}

// --- Phân tích đoạn text kết quả AfterShip dán vào ---
// Mỗi đơn 1 khối, tách bằng dòng phân cách ==== (20+ dấu =); bỏ footer
// "Powered by www.aftership.com/track" và khối trống. Chỉ đọc 3 dòng đầu:
// Tracking number / Shipment status / Delivery date.
const MONTHS_EN = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseDeliveryDate(raw) {
  // "Nov 7, 2026 (Sat)" -> bỏ phần trong ngoặc, tách tháng/tên theo tay để
  // khỏi lệch ngày do múi giờ (Date.parse hiểu "Nov 7, 2026" là nửa đêm
  // giờ địa phương; trình duyệt +07 sẽ lùi về ngày 6 khi đọc bằng UTC).
  const cleaned = String(raw || '').split('\n')[0].replace(/\([^)]*\)/g, '').trim();
  const m = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const month = MONTHS_EN[m[1].toLowerCase().slice(0, 3)];
  if (month === undefined) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${m[3]}-${p(month + 1)}-${p(Number(m[2]))}`;
}
function parseAftershipText(text) {
  const blocks = String(text || '')
    .split(/={20,}/)
    .map((b) => b.replace(/Powered by www\.aftership\.com\/track/gi, '').trim())
    .filter(Boolean);
  const results = [];
  for (const block of blocks) {
    const trackM = block.match(/Tracking number:\s*(\S+)/i);
    if (!trackM) continue;
    const statusM = block.match(/Shipment status:\s*(.+)/i);
    const dateM = block.match(/Delivery date:\s*(.+)/i);
    const tracking = trackM[1].trim();
    const shipStatus = statusM ? statusM[1].split('\n')[0].trim() : '';
    const delivered = shipStatus.toLowerCase() === 'delivered';
    let receivedDate = null;
    if (delivered && dateM) {
      receivedDate = parseDeliveryDate(dateM[1]);
      if (!receivedDate) {
        // Dự phòng: thử Date.parse rồi format bằng UTC getters.
        const ms = Date.parse(dateM[1].split('\n')[0].replace(/\([^)]*\)/g, '').trim());
        if (!isNaN(ms)) {
          const d = new Date(ms);
          const p = (n) => String(n).padStart(2, '0');
          receivedDate = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
        }
      }
    }
    results.push({ tracking, shipStatus, delivered, receivedDate });
  }
  return results;
}

// UUID cho batch_id của 1 lô dán (crypto.randomUUID có sẵn ở trình duyệt
// hiện đại; dự phòng Math.random khi không có).
function genUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Ghi lịch sử kiểm nhận — BEST-EFFORT: lỗi (ví dụ bảng lịch sử chưa tạo)
// thì chỉ log + trả false, KHÔNG làm hỏng cập nhật trạng thái chính.
async function logCheckHistory(rows, userEmail) {
  try {
    const payloads = rows.map((r) => ({
      return_id: r.return_id,
      tracking_number: r.tracking_number || null,
      shipment_status: r.shipment_status || null,
      received_status: r.received_status,
      received_date: r.received_date || null,
      source: r.source,
      checked_by: userEmail || '',
      checked_at: new Date().toISOString(),
      batch_id: r.batch_id || null,
    }));
    const { error } = await supabase.from('return_receipt_check_history').insert(payloads);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Không lưu được lịch sử kiểm nhận:', e);
    return false;
  }
}

// Cột bảng: % cố định (table-fixed + colgroup) để khớp với strip tiêu đề
// gộp vào cụm lọc phía trên. Cả 2 bảng nhóm dùng chung 1 bộ cột.
// 11 cột gộp (tổng 100%): mỗi cột đủ rộng cho nội dung nowrap của nó
// (ngày giờ, mã, loại trả) để chữ không tràn sang cột bên cạnh.
const COLS = [
  { id: 'code', label: 'Mã vận đơn', w: 11 },
  { id: 'order', label: 'Mã đơn', w: 10 },
  { id: 'platform', label: 'Sàn · Shop', w: 10 },
  { id: 'type', label: 'Loại trả', w: 10 },
  { id: 'reason', label: 'Lý do', w: 8 },
  { id: 'status', label: 'Trạng thái', w: 9 },
  { id: 'money', label: 'Tiền hoàn', w: 7 },
  { id: 'product', label: 'Sản phẩm', w: 10 },
  { id: 'dates', label: 'Ngày', w: 11 },
  { id: 'recv', label: 'Nhận hàng', w: 7 },
  { id: 'edit', label: 'Sửa', w: 7 },
];
const gridCols = COLS.map((c) => `${c.w}%`).join(' ');

export default function BaoCaoHoanChuaNhan() {
  // --- Bộ lọc (pattern `applied` như TraHangHoanTien) ---
  const [updFrom, setUpdFrom] = useState(() => addDaysStr(vnTodayStr(), -30));
  const [updTo, setUpdTo] = useState(() => vnTodayStr());
  const [crtFrom, setCrtFrom] = useState('');
  const [crtTo, setCrtTo] = useState('');
  const [platform, setPlatform] = useState('');
  const [shop, setShop] = useState('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState(null);
  const [shopOptions, setShopOptions] = useState([]);
  // Index kho (product_inventories) để map SP trả hàng về tên đầy đủ.
  const [inventoryIndex, setInventoryIndex] = useState(null);
  // --- Quyền sửa tay (chỉ owner) ---
  const [isOwner, setIsOwner] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  // --- Dữ liệu ---
  const [allRows, setAllRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Đơn hoàn 1 phần (type 16) + kiểm nhận tay.
  const [partialRows, setPartialRows] = useState([]);
  const [partialError, setPartialError] = useState('');
  const [manualChecks, setManualChecks] = useState(new Map());
  const [manualMissing, setManualMissing] = useState(false);
  // --- Phân trang từng nhóm (client-side, trên tập đã lọc đủ) ---
  const [pageDoi, setPageDoi] = useState(1);
  const [pageCho, setPageCho] = useState(1);
  // --- Sửa tay từng dòng ---
  const [editRowId, setEditRowId] = useState(null);
  const [editDrafts, setEditDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  // --- Đối chiếu hàng loạt (chỉ owner) ---
  const [showBulk, setShowBulk] = useState(false);
  const [bulkPage, setBulkPage] = useState(1);
  const [bulkCarrier, setBulkCarrier] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');
  const [bulkError, setBulkError] = useState('');
  // --- Lịch sử kiểm nhận (tab "Lịch sử" trong popup đối chiếu) ---
  const [bulkTab, setBulkTab] = useState('doi-chieu');
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyFilter, setHistoryFilter] = useState('');
  const [historyWarn, setHistoryWarn] = useState('');

  const filters = applied || { updFrom, updTo, crtFrom, crtTo, platform, shop, search };

  // Lọc gốc của báo cáo (áp dụng cho cả đếm + tải đủ tập):
  // có mã đơn trả thật (đầu SPX/G/8/1/VTP) + trạng thái Nhanh Đã hoàn tiền (1)
  // hoặc Đang hoàn tiền (5); đơn hủy đã loại.
  function applyBaseFilters(query, f) {
    query = query.not('return_tracking_number', 'is', null).neq('return_tracking_number', '');
    query = query.in('nhanh_status_id', [1, 5]);
    query = query.or('return_tracking_number.ilike.SPX%,return_tracking_number.ilike.G%,return_tracking_number.ilike.8%,return_tracking_number.ilike.1%,return_tracking_number.ilike.VTP%');
    if (f.updFrom) query = query.gte('return_updated_at', `${f.updFrom}T00:00:00+07:00`);
    if (f.updTo) query = query.lt('return_updated_at', `${addDaysStr(f.updTo, 1)}T00:00:00+07:00`);
    if (f.crtFrom) query = query.gte('return_created_at', `${f.crtFrom}T00:00:00+07:00`);
    if (f.crtTo) query = query.lt('return_created_at', `${addDaysStr(f.crtTo, 1)}T00:00:00+07:00`);
    if (f.platform !== '') query = query.eq('platform_id', Number(f.platform));
    if (f.shop) query = query.eq('shop_id', f.shop);
    if (f.search && f.search.trim()) {
      const q = escapeLike(f.search.trim());
      query = query.or(`return_tracking_number.ilike.%${q}%,return_id.ilike.%${q}%,original_ecom_order_id.ilike.%${q}%`);
    }
    return query;
  }

  // Tải TOÀN BỘ tập đã lọc (loop 1000/trang) — tổng số, tiền hoàn từng nhóm,
  // sao chép và tải Excel đều cần tập đủ, không chỉ trang hiện tại.
  async function fetchAll(f) {
    setLoading(true);
    setError('');
    try {
      let all = [];
      let totalCount = 0;
      let from = 0;
      const STEP = 1000;
      for (;;) {
        let q = supabase.from('ecom_return_orders').select('*', { count: 'exact' });
        q = applyBaseFilters(q, f);
        q = q.order('return_updated_at', { ascending: false }).range(from, from + STEP - 1);
        const { data, count, error: err } = await q;
        if (err) throw err;
        if (from === 0) totalCount = count || 0;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        from += data.length;
        if (data.length < STEP) break;
      }
      setAllRows(all);
      setTotal(totalCount);
    } catch (e) {
      setError('Lỗi tải dữ liệu: ' + (e.message || e));
      setAllRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  // Owner nhận diện giống TraHangHoanTien: user_metadata.is_owner hoặc email owner.
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const u = data?.user;
      setIsOwner(u?.user_metadata?.is_owner === true || u?.email === 'contact.hotavinh@gmail.com');
      setUserEmail(u?.email || '');
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Nạp index kho + danh sách shop cho dropdown lọc (1 lần lúc mở trang).
  useEffect(() => {
    let alive = true;
    (async () => {
      let invRows = [];
      try {
        let page = 0; let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from('product_inventories')
            .select('product_code,product_name')
            .order('product_code', { ascending: true })
            .range(page * 1000, (page + 1) * 1000 - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            invRows = invRows.concat(data);
            page++;
            if (data.length < 1000) hasMore = false;
          } else hasMore = false;
        }
      } catch (e) { console.error('Lỗi nạp kho:', e); }
      if (alive) setInventoryIndex(buildInventoryIndex(invRows));
      try {
        const { data } = await supabase
          .from('ecom_return_orders')
          .select('shop_id,platform_name')
          .not('shop_id', 'is', null)
          .limit(2000);
        if (!alive) return;
        const seen = new Map();
        (data || []).forEach((r) => {
          if (r.shop_id && !seen.has(String(r.shop_id))) {
            seen.set(String(r.shop_id), r.platform_name || '');
          }
        });
        setShopOptions([...seen.entries()].map(([id, platformName]) => ({ id, platformName })).sort((a, b) => a.id.localeCompare(b.id)));
      } catch (e) { console.error('Lỗi nạp danh sách shop:', e); }
    })();
    return () => { alive = false; };
  }, []);

  // Nạp đơn hoàn 1 phần (type 16) + bảng kiểm nhận tay (1 lần lúc mở trang).
  // Bảng return_receipt_checks chưa có (migration chạy trước khi go-live) thì
  // trang vẫn chạy bình thường với map rỗng + ghi chú nhỏ, không sập trang.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('orders')
          .select('id,raw_data')
          .or('raw_data->info->>type.eq.16,raw_data->data->info->>type.eq.16');
        if (err) throw err;
        if (alive) setPartialRows(data || []);
      } catch (e) {
        console.error('Lỗi nạp đơn hoàn 1 phần:', e);
        if (alive) {
          setPartialRows([]);
          setPartialError('Không tải được danh sách đơn hoàn 1 phần: ' + (e.message || e));
        }
      }
      try {
        const { data, error: err } = await supabase.from('return_receipt_checks').select('*');
        if (err) throw err;
        const m = new Map();
        (data || []).forEach((r) => { if (r.return_id) m.set(String(r.return_id), r); });
        if (alive) { setManualChecks(m); setManualMissing(false); }
      } catch (e) {
        console.error('Lỗi nạp kiểm nhận tay:', e);
        if (alive) { setManualChecks(new Map()); setManualMissing(true); }
      }
    })();
    return () => { alive = false; };
  }, []);

  function handleFilter() {
    setPageDoi(1);
    setPageCho(1);
    setBulkPage(1);
    setApplied({ updFrom, updTo, crtFrom, crtTo, platform, shop, search });
  }

  // --- Ghép nối đơn hoàn 1 phần (trong bộ nhớ) ---
  const partialOriginalIds = useMemo(() => {
    const s = new Set();
    for (const p of partialRows) {
      const id = partialOriginalIdOf(p.raw_data);
      if (id) s.add(id);
    }
    return s;
  }, [partialRows]);
  const partialAppOrderIdsNoR = useMemo(() => {
    const s = new Set();
    for (const p of partialRows) {
      const a = partialAppOrderIdOf(p.raw_data);
      if (a) s.add(stripTrailingR(a));
    }
    return s;
  }, [partialRows]);
  function hasPartial(row) {
    const nid = row?.raw_data?.nhanhOrderId;
    if (nid !== null && nid !== undefined && nid !== '' && partialOriginalIds.has(String(nid))) return true;
    const oid = row?.original_ecom_order_id;
    if (oid && partialAppOrderIdsNoR.has(String(oid))) return true;
    return false;
  }

  // "Đã nhập kho" = có đơn hoàn 1 phần -> loại khỏi 2 danh sách, chỉ đếm tổng.
  // Còn lại tách 2 nhóm: "Cần đi đòi" = kiểm tay Đã nhận nhưng chưa có đơn
  // hoàn 1 phần; "Đang chờ hàng về" = phần còn lại (Chưa nhận hoặc chưa kiểm).
  const groups = useMemo(() => {
    const doi = [];
    const cho = [];
    const daNhap = [];
    for (const r of allRows) {
      if (hasPartial(r)) { daNhap.push(r); continue; }
      const m = manualChecks.get(r.return_id);
      if (m && m.received_status === 'Đã nhận') doi.push(r);
      else cho.push(r);
    }
    return { doi, cho, daNhap };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, manualChecks, partialOriginalIds, partialAppOrderIdsNoR]);

  const sumMoney = (rows) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const summary = useMemo(() => ({
    totalMoney: sumMoney(allRows),
    daNhapMoney: sumMoney(groups.daNhap),
    doiMoney: sumMoney(groups.doi),
    choMoney: sumMoney(groups.cho),
  }), [allRows, groups]);

  const totalPagesDoi = Math.max(1, Math.ceil(groups.doi.length / PAGE_SIZE));
  const totalPagesCho = Math.max(1, Math.ceil(groups.cho.length / PAGE_SIZE));
  const safePageDoi = Math.min(pageDoi, totalPagesDoi);
  const safePageCho = Math.min(pageCho, totalPagesCho);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  async function copyCodes(rows, label) {
    const codes = rows.map((r) => returnCodeOf(r) || r.return_tracking_number || '').filter(Boolean);
    if (codes.length === 0) { showToast('Không có mã vận đơn nào để sao chép.'); return; }
    const text = codes.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Đã sao chép ${codes.length} mã vận đơn (${label}).`);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast(`Đã sao chép ${codes.length} mã vận đơn (${label}).`);
      } catch (e2) {
        showToast('Không sao chép được — trình duyệt đã chặn.');
      }
      ta.remove();
    }
  }

  // Tải Excel: 1 file gộp cả 2 nhóm chưa nhận, mỗi đơn 1 dòng, đủ hết cột.
  async function handleExportExcel() {
    const rows = [...groups.doi, ...groups.cho];
    if (rows.length === 0) { setExportMsg('Không có dữ liệu để xuất.'); return; }
    if (exporting) return;
    setExporting(true);
    setExportMsg('Đang tạo file Excel...');
    try {
      const XLSX = await import('xlsx');
      const rowData = rows.map((r) => {
        const prods = productsOf(r);
        const first = prods[0];
        const mappedFirst = first ? mapReturnProduct(first.name, first.sku, inventoryIndex) : null;
        const m = manualChecks.get(r.return_id);
        return {
          'Mã vận đơn': returnCodeOf(r) || r.return_tracking_number || '',
          'Mã đơn trả': r.return_id || '',
          'Mã đơn gốc': r.original_ecom_order_id || '',
          'ID đơn Nhanh': r.raw_data?.nhanhOrderId ?? '',
          'Sàn': r.platform_name || '',
          'Shop': r.shop_id || '',
          'Loại trả': RETURN_TYPE_NAMES[r.return_type] || '',
          'Lý do': r.reason_name || r.raw_data?.reasonInfor?.reasonDescription || r.raw_data?.reasonDescription || '',
          'Trạng thái Nhanh': r.nhanh_status_name || NHANH_STATUS_NAMES[r.nhanh_status_id] || '',
          'Trạng thái sàn': r.ecom_status_name || '',
          'Tiền hoàn': Number(r.amount) || 0,
          'Ngày tạo': fmtDateTime(r.return_created_at),
          'Ngày cập nhật': fmtDateTime(r.return_updated_at),
          'Sản phẩm': mappedFirst || (first ? first.name : ''),
          'Số lượng': totalQty(r),
          'Ngày hàng về': m?.received_date ? fmtDateOnly(m.received_date) : '',
          'Trạng thái nhận': m?.received_status || '',
          'Nhóm': (m && m.received_status === 'Đã nhận') ? 'Cần đi đòi' : 'Đang chờ hàng về',
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(rowData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DonHoanChuaNhan');
      XLSX.writeFile(workbook, `bao-cao-hoan-chua-nhan-${vnTodayStr().replaceAll('-', '')}.xlsx`);
      setExportMsg(`Đã xuất ${rowData.length} đơn ra file Excel.`);
    } catch (e) {
      console.error('Lỗi xuất Excel:', e);
      setExportMsg('Lỗi xuất Excel: ' + (e.message || e));
    } finally {
      setExporting(false);
    }
  }

  // --- Sửa tay kiểm nhận (chỉ owner) ---
  function startEdit(row) {
    const m = manualChecks.get(row.return_id);
    setEditDrafts((prev) => ({ ...prev, [row.return_id]: { date: m?.received_date || '', status: m?.received_status || 'Chưa nhận' } }));
    setEditRowId(row.return_id);
    setSaveMsg('');
  }
  async function handleSaveCheck(row) {
    const d = editDrafts[row.return_id] || {};
    const status = d.status || 'Chưa nhận';
    const date = (d.date || '').trim();
    if (status === 'Đã nhận' && !date) {
      setSaveMsg('Chọn ngày hàng về trước khi lưu trạng thái Đã nhận.');
      return;
    }
    setSavingId(row.return_id);
    setSaveMsg('');
    try {
      const payload = {
        return_id: row.return_id,
        received_date: date || null,
        received_status: status,
        updated_by: userEmail || '',
        updated_at: new Date().toISOString(),
      };
      const { error: err } = await supabase.from('return_receipt_checks').upsert(payload, { onConflict: 'return_id' });
      if (err) throw err;
      setManualChecks((prev) => {
        const next = new Map(prev);
        next.set(row.return_id, { return_id: row.return_id, received_date: date || null, received_status: status });
        return next;
      });
      // Ghi lịch sử (best-effort): sửa tay = 1 dòng riêng, source 'thu_cong'.
      const historyOk = await logCheckHistory([{
        return_id: row.return_id,
        tracking_number: returnCodeOf(row) || row.return_tracking_number || null,
        shipment_status: null,
        received_status: status,
        received_date: date || null,
        source: 'thu_cong',
        batch_id: null,
      }], userEmail);
      if (historyOk) setHistoryWarn('');
      else setHistoryWarn('Không lưu được lịch sử — chạy migration bảng lịch sử trước.');
      setEditRowId(null);
      setEditDrafts((prev) => { const next = { ...prev }; delete next[row.return_id]; return next; });
      setSaveMsg(`Đã lưu kiểm nhận cho đơn ${row.return_id}.`);
      setTimeout(() => setSaveMsg(''), 5000);
    } catch (e) {
      setSaveMsg('Lỗi lưu: ' + (e.message || e) + ' (bảng return_receipt_checks có thể chưa được tạo — chạy migration trước).');
    } finally {
      setSavingId(null);
    }
  }

  // --- Đối chiếu hàng loạt (chỉ owner) ---
  const BULK_PAGE_SIZE = 50;
  // Toàn bộ tập chưa nhận theo bộ lọc (cả 2 nhóm), giữ đúng thứ tự
  // return_updated_at desc như bảng (allRows đã xếp sẵn khi tải).
  const bulkRows = useMemo(() => allRows.filter((r) => !hasPartial(r)), [allRows, partialOriginalIds, partialAppOrderIdsNoR]);
  const bulkTotalPages = Math.max(1, Math.ceil(bulkRows.length / BULK_PAGE_SIZE));
  const safeBulkPage = Math.min(bulkPage, bulkTotalPages);
  const bulkPageRows = bulkRows.slice((safeBulkPage - 1) * BULK_PAGE_SIZE, safeBulkPage * BULK_PAGE_SIZE);
  // Đơn "cần kiểm" = chưa có trạng thái cuối Đã nhận (Chưa nhận hoặc chưa
  // kiểm). AfterShip chỉ check tối đa 20 mã/lần nên nút copy chỉ lấy 20 mã
  // chưa kiểm đầu tiên trên trang, bỏ qua các đơn Đã nhận.
  const isBulkDone = (r) => manualChecks.get(r.return_id)?.received_status === 'Đã nhận';
  const uncheckedRows = (rows) => rows.filter((r) => !isBulkDone(r));
  const bulkPageUnchecked = uncheckedRows(bulkPageRows);
  const bulkPageSkipped = bulkPageRows.length - bulkPageUnchecked.length;
  const bulkPageCopyRows = bulkPageUnchecked.slice(0, 20);
  // Nhóm trang hiện tại theo hãng (tab hiển thị theo thứ tự SPX, J&T, GHN,
  // GHTK, Viettel Post, Hãng khác; chỉ hãng nào có đơn mới hiện).
  const bulkPageCarriers = useMemo(() => {
    const map = new Map();
    for (const r of bulkPageRows) {
      const name = carrierOf(returnCodeOf(r) || r.return_tracking_number || '');
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(r);
    }
    const order = ['SPX (Shopee Express)', 'J&T Express', 'GHN', 'GHTK', 'Viettel Post', 'Hãng khác'];
    return order.filter((n) => map.has(n)).map((n) => ({ name: n, rows: map.get(n) }));
  }, [bulkPageRows]);
  const activeBulkCarrier = bulkPageCarriers.find((c) => c.name === bulkCarrier) || bulkPageCarriers[0] || null;
  // Copy theo hãng cũng chỉ lấy 20 mã chưa kiểm đầu tiên của hãng đó.
  const activeCarrierUnchecked = activeBulkCarrier ? uncheckedRows(activeBulkCarrier.rows) : [];
  const activeCarrierSkipped = activeBulkCarrier ? activeBulkCarrier.rows.length - activeCarrierUnchecked.length : 0;
  const activeCarrierCopyRows = activeCarrierUnchecked.slice(0, 20);

  // Nhóm lịch sử để hiển thị: lọc theo mã vận đơn trước (khớp chuỗi con,
  // không phân biệt hoa thường), rồi gom theo batch_id; sửa tay (batch_id
  // null) mỗi dòng 1 nhóm riêng. Nhóm xếp theo thời gian mới nhất trước.
  const historyGroups = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    const rows = q
      ? historyRows.filter((r) => String(r.tracking_number || '').toLowerCase().includes(q))
      : historyRows;
    const batches = new Map();
    const singles = [];
    for (const r of rows) {
      if (r.batch_id) {
        if (!batches.has(r.batch_id)) batches.set(r.batch_id, []);
        batches.get(r.batch_id).push(r);
      } else singles.push(r);
    }
    const groups = [];
    for (const [batchId, brs] of batches) {
      groups.push({ key: `batch-${batchId}`, batch: true, rows: brs, checkedAt: brs[0].checked_at, checkedBy: brs[0].checked_by });
    }
    for (const r of singles) {
      groups.push({ key: `row-${r.id}`, batch: false, rows: [r], checkedAt: r.checked_at, checkedBy: r.checked_by });
    }
    groups.sort((a, b) => String(b.checkedAt || '').localeCompare(String(a.checkedAt || '')));
    return groups;
  }, [historyRows, historyFilter]);

  function openBulk() {
    setBulkPage(1);
    setBulkCarrier('');
    setBulkTab('doi-chieu');
    setPasteText('');
    setBulkPreview(null);
    setBulkMsg('');
    setBulkError('');
    setShowBulk(true);
  }
  function closeBulk() {
    setShowBulk(false);
    setBulkPreview(null);
    setBulkMsg('');
    setBulkError('');
  }

  // Lịch sử kiểm nhận: 200 dòng mới nhất, chỉ tải khi mở tab "Lịch sử".
  // Bảng chưa tạo (migration chưa chạy) thì báo nhẹ, không sập popup.
  async function fetchHistory() {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const { data, error } = await supabase
        .from('return_receipt_check_history')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setHistoryRows(data || []);
    } catch (e) {
      console.error('Lỗi tải lịch sử kiểm nhận:', e);
      setHistoryRows([]);
      setHistoryError('Không tải được lịch sử — chạy migration bảng lịch sử trước.');
    } finally {
      setHistoryLoading(false);
    }
  }
  useEffect(() => {
    if (showBulk && bulkTab === 'lich-su') fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBulk, bulkTab]);

  // Đọc đoạn dán -> xem trước (chưa ghi gì cả). Khớp theo mã vận đơn
  // (trim + uppercase 2 bên) với TOÀN BỘ tập chưa nhận, không chỉ trang này.
  function handleBulkPreview() {
    setBulkMsg('');
    setBulkError('');
    if (!pasteText.trim()) {
      setBulkPreview(null);
      setBulkError('Dán kết quả AfterShip vào ô trước.');
      return;
    }
    const parsed = parseAftershipText(pasteText);
    if (parsed.length === 0) {
      setBulkPreview(null);
      setBulkError('Không đọc được mã vận đơn nào trong đoạn đã dán — kiểm tra lại định dạng AfterShip.');
      return;
    }
    const byCode = new Map();
    for (const r of bulkRows) {
      const code = String(returnCodeOf(r) || r.return_tracking_number || '').trim().toUpperCase();
      if (code && !byCode.has(code)) byCode.set(code, r);
    }
    // Mã trùng trong 1 lần dán: lần xuất hiện sau thắng.
    const seen = new Map();
    for (const p of parsed) seen.set(p.tracking.trim().toUpperCase(), p);
    const matched = [];
    const unmatched = [];
    for (const [, p] of seen) {
      const row = byCode.get(p.tracking.trim().toUpperCase());
      if (row) matched.push({ ...p, row });
      else unmatched.push(p);
    }
    setBulkPreview({ matched, unmatched });
  }

  // Ghi xem trước vào return_receipt_checks. Chỉ đơn có trong đoạn dán
  // mới bị chạm tới (lần dán mới nhất thắng với những đơn đó); đơn nào
  // không có trong đoạn dán thì để nguyên. Ghi xong map kiểm tay cập nhật
  // trong bộ nhớ nên các đơn tự nhảy nhóm ngay, không cần tải lại trang.
  async function handleBulkConfirm() {
    if (!bulkPreview || bulkPreview.matched.length === 0 || bulkSaving) return;
    setBulkSaving(true);
    setBulkMsg('');
    setBulkError('');
    try {
      const payloads = bulkPreview.matched.map(({ row, delivered, receivedDate }) => ({
        return_id: row.return_id,
        received_date: delivered ? receivedDate : null,
        received_status: delivered ? 'Đã nhận' : 'Chưa nhận',
        updated_by: userEmail || '',
        updated_at: new Date().toISOString(),
      }));
      const { error: err } = await supabase.from('return_receipt_checks').upsert(payloads, { onConflict: 'return_id' });
      if (err) throw err;
      setManualChecks((prev) => {
        const next = new Map(prev);
        for (const p of payloads) {
          next.set(p.return_id, { return_id: p.return_id, received_date: p.received_date, received_status: p.received_status });
        }
        return next;
      });
      const nNhan = payloads.filter((p) => p.received_status === 'Đã nhận').length;
      const nChua = payloads.length - nNhan;
      // Ghi lịch sử (best-effort): 1 lô dán = 1 batch_id chung cho cả lô.
      const batchId = genUuid();
      const historyOk = await logCheckHistory(bulkPreview.matched.map(({ row, tracking, shipStatus, delivered, receivedDate }) => ({
        return_id: row.return_id,
        tracking_number: tracking,
        shipment_status: shipStatus || null,
        received_status: delivered ? 'Đã nhận' : 'Chưa nhận',
        received_date: delivered ? receivedDate : null,
        source: 'aftership',
        batch_id: batchId,
      })), userEmail);
      if (historyOk) setHistoryWarn('');
      else setHistoryWarn('Không lưu được lịch sử — chạy migration bảng lịch sử trước.');
      setBulkMsg(`Đã cập nhật ${payloads.length} đơn: ${nNhan} Đã nhận, ${nChua} Chưa nhận.${bulkPreview.unmatched.length > 0 ? ` ${bulkPreview.unmatched.length} mã không khớp.` : ''}`);
      setBulkPreview(null);
      setPasteText('');
    } catch (e) {
      setBulkError('Lỗi cập nhật: ' + (e.message || e));
    } finally {
      setBulkSaving(false);
    }
  }

  function renderRow(r) {
    const prods = productsOf(r);
    const first = prods[0];
    const mappedFirst = first ? mapReturnProduct(first.name, first.sku, inventoryIndex) : null;
    const m = manualChecks.get(r.return_id);
    const editing = editRowId === r.return_id;
    const draft = editDrafts[r.return_id] || {};
    const reasonDesc = r.raw_data?.reasonInfor?.reasonDescription || r.raw_data?.reasonDescription || '';
    const reasonFull = [r.reason_name || '', reasonDesc].filter(Boolean).join(' — ') || '—';
    return (
      <tr key={r.return_id} className="border-t border-slate-100 hover:bg-slate-50">
        {/* Mã vận đơn trả + ID đơn Nhanh */}
        <td className="px-3 py-3.5 min-w-0">
          <div className="font-mono font-bold text-indigo-700 break-all leading-snug">{returnCodeOf(r) || r.return_tracking_number || '—'}</div>
          <div className="font-mono text-xs text-slate-400 mt-0.5">{r.raw_data?.nhanhOrderId ?? '—'}</div>
        </td>
        {/* Mã đơn: mã trả + mã gốc */}
        <td className="px-3 py-3.5 min-w-0">
          <div className="font-mono text-xs break-all leading-snug">{r.return_id || '—'}</div>
          <div className="font-mono text-xs text-slate-500 break-all leading-snug mt-0.5">{r.original_ecom_order_id || '—'}</div>
        </td>
        {/* Sàn · Shop: tên sàn + mã shop đầy đủ (shop dài tự xuống dòng trong ô) */}
        <td className="px-3 py-3.5 min-w-0">
          <span className="font-bold whitespace-nowrap">{r.platform_name || '—'}</span>{' '}
          <span className="font-mono text-xs text-slate-500 break-all">· {r.shop_id || '—'}</span>
        </td>
        {/* Loại trả: chữ ngắn, không xuống dòng */}
        <td className="px-2 py-3.5 whitespace-nowrap text-xs font-bold">{RETURN_TYPE_NAMES[r.return_type] || '—'}</td>
        {/* Lý do: kẹp tối đa 2 dòng, xem đủ ở title */}
        <td className="px-3 py-3.5 min-w-0">
          <div className="line-clamp-2 leading-snug" title={reasonFull}>{reasonFull}</div>
        </td>
        {/* Trạng thái: Nhanh trên, sàn dưới */}
        <td className="px-3 py-3.5 min-w-0">
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${NHANH_STATUS_BADGE[r.nhanh_status_id] || 'bg-slate-100 text-slate-700'}`}>
            {r.nhanh_status_name || NHANH_STATUS_NAMES[r.nhanh_status_id] || '—'}
          </span>
          <div className="text-xs text-slate-500 mt-1 break-words leading-snug">{r.ecom_status_name || '—'}</div>
        </td>
        <td className="px-3 py-3.5 text-right font-mono font-bold whitespace-nowrap">{fmtMoney(r.amount)}</td>
        {/* Sản phẩm: tên map kẹp 2 dòng + SL; tên gốc kẹp 1 dòng (bỏ khi trùng tên map) */}
        <td className="px-3 py-3.5 min-w-0">
          {mappedFirst && first && mappedFirst !== first.name ? (
            <>
              <div className="font-bold text-slate-900 line-clamp-2 leading-snug" title={mappedFirst}>{mappedFirst}</div>
              <div className="text-xs text-slate-500 line-clamp-1 leading-snug" title={first.name}>{first.name}</div>
              <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">SL {totalQty(r)}{prods.length > 1 ? ` · +${prods.length - 1} SP` : ''}</div>
            </>
          ) : first ? (
            <>
              <div className="line-clamp-2 leading-snug" title={first.name}>{first.name}</div>
              <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">SL {totalQty(r)}{prods.length > 1 ? ` · +${prods.length - 1} SP` : ''}</div>
            </>
          ) : '—'}
        </td>
        {/* Ngày: tạo + cập nhật, mỗi dòng 1 block riêng. Trước đây 2 cột 5%
            quá hẹp nên chuỗi ngày nowrap tràn sang cột bên cạnh và chồng chữ;
            giờ gộp 1 cột 11% nên dòng dài nhất vừa đủ, không tràn nữa */}
        <td className="px-2 py-3.5 min-w-0">
          <div className="whitespace-nowrap text-xs leading-5"><span className="text-slate-400">Tạo</span> {fmtDateTime(r.return_created_at)}</div>
          <div className="whitespace-nowrap text-xs leading-5"><span className="text-slate-400">Cập nhật</span> {fmtDateTime(r.return_updated_at)}</div>
        </td>
        {/* Nhận hàng: trạng thái trên, ngày về dưới */}
        <td className="px-3 py-3.5 min-w-0">
          {m ? (
            <>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${m.received_status === 'Đã nhận' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>{m.received_status}</span>
              <div className="text-xs text-slate-500 mt-1 whitespace-nowrap">{m.received_date ? fmtDateOnly(m.received_date) : '—'}</div>
            </>
          ) : (<span className="text-slate-400 text-xs">Chưa kiểm</span>)}
        </td>
        <td className="px-3 py-3.5">
          {isOwner ? (editing ? (
            <div className="space-y-1 min-w-[110px]">
              <input
                type="date"
                value={draft.date ?? ''}
                onChange={(e) => setEditDrafts((prev) => ({ ...prev, [r.return_id]: { ...(prev[r.return_id] || {}), date: e.target.value } }))}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-slate-700"
              />
              <select
                value={draft.status ?? 'Chưa nhận'}
                onChange={(e) => setEditDrafts((prev) => ({ ...prev, [r.return_id]: { ...(prev[r.return_id] || {}), status: e.target.value } }))}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-slate-700 bg-white"
              >
                <option value="Chưa nhận">Chưa nhận</option>
                <option value="Đã nhận">Đã nhận</option>
              </select>
              <div className="flex gap-1">
                <button onClick={() => handleSaveCheck(r)} disabled={savingId === r.return_id} className="flex-1 px-2 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
                  {savingId === r.return_id ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button
                  onClick={() => { setEditRowId(null); setEditDrafts((prev) => { const n = { ...prev }; delete n[r.return_id]; return n; }); }}
                  className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => startEdit(r)} className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer flex items-center gap-1"><Pencil size={12} /> Sửa</button>
          )) : (<span className="text-slate-300 text-xs">—</span>)}
        </td>
      </tr>
    );
  }

  // Một nhóm = 1 bảng riêng (cùng bộ cột với strip tiêu đề chung phía trên).
  function renderGroupSection({ sectionKey, title, desc, rows, page, setPage, totalPages, copyLabel }) {
    const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return (
      <div key={sectionKey} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {title} <span className="text-slate-500 font-medium">({rows.length} đơn · Tổng hoàn {fmtMoney(sumMoney(rows))})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
          </div>
          <button onClick={() => copyCodes(rows, copyLabel)} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer flex items-center gap-2">
            <Copy size={15} /> Sao chép mã vận đơn
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Đang tải...
            </div>
          ) : paged.length === 0 ? (
            <div className="p-8 text-center">
              <Package size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">Không có đơn nào trong nhóm này theo bộ lọc.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>{COLS.map((c) => (<col key={c.id} style={{ width: `${c.w}%` }} />))}</colgroup>
                <tbody>{paged.map((r) => renderRow(r))}</tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500">Trang {page} / {totalPages} — {rows.length} đơn</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"><ChevronLeft size={14} /> Trước</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1">Sau <ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="sticky top-0 z-30 flex flex-wrap justify-between items-center gap-4 rounded-2xl px-6 py-6 bg-slate-900 border border-slate-900 shadow-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Đơn hoàn chưa nhận</h1>
          <p className="text-sm text-slate-300 mt-1">
            Đơn trả hàng đã/đang hoàn tiền, có mã đơn trả nhưng chưa có đơn hoàn 1 phần nhập kho trên Nhanh. Kiểm nhận tay để tách đơn cần đi đòi khỏi đơn đang chờ hàng về.
          </p>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="sticky top-[106px] z-30 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Từ ngày cập nhật</label>
            <input type="date" value={updFrom} onChange={(e) => setUpdFrom(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Đến ngày cập nhật</label>
            <input type="date" value={updTo} onChange={(e) => setUpdTo(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Từ ngày tạo</label>
            <input type="date" value={crtFrom} onChange={(e) => setCrtFrom(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Đến ngày tạo</label>
            <input type="date" value={crtTo} onChange={(e) => setCrtTo(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Sàn</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white">
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Shop</label>
            <select value={shop} onChange={(e) => setShop(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white">
              <option value="">Tất cả shop</option>
              {shopOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.platformName ? `${o.platformName} · Shop ${o.id}` : `Shop ${o.id}`}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tìm mã vận đơn / mã đơn trả / ID đơn gốc</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleFilter(); }}
                placeholder="Nhập mã cần tìm rồi Enter"
                className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium"
              />
            </div>
          </div>
          <button onClick={handleFilter} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md cursor-pointer">Lọc</button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Tổng: <strong className="text-slate-800">{total}</strong> đơn theo bộ lọc (có mã đơn trả thật SPX/G/8/1/VTP, trạng thái Nhanh Đã hoàn tiền hoặc Đang hoàn tiền). Ngày cập nhật lọc theo ngày cập nhật trên Nhanh; ngày tạo lọc theo ngày tạo yêu cầu.
        </p>
        {error && <p className="text-sm font-bold text-red-500 mt-2">{error}</p>}
        {partialError && <p className="text-sm font-bold text-red-500 mt-2">{partialError}</p>}
        {manualMissing && (
          <p className="text-xs text-amber-700 mt-2">Chưa tải được dữ liệu kiểm nhận tay (bảng return_receipt_checks chưa có hoặc chưa có quyền đọc) — các đơn tạm xếp hết vào nhóm đang chờ, phần sửa tay sẽ báo lỗi cho đến khi bảng được tạo.</p>
        )}
        {/* Tiêu đề bảng gộp vào cụm lọc: dính cùng cụm lọc, cột theo đúng % của colgroup */}
        <div className="-mx-6 -mb-6 mt-4 grid bg-slate-900 text-slate-100 rounded-b-2xl overflow-hidden" style={{ gridTemplateColumns: gridCols }}>
          {COLS.map((col) => (
            <div key={col.id} className="py-3 px-3 text-xs font-bold uppercase tracking-wider min-w-0">
              {col.label}
            </div>
          ))}
        </div>
      </div>

      {/* Tổng quan 4 số */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{total}</div>
          <div className="text-xs font-bold text-slate-500">Tổng đơn lọc được</div>
          <div className="text-xs text-slate-500 mt-1">Tổng hoàn: {fmtMoney(summary.totalMoney)}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-green-700">{groups.daNhap.length}</div>
          <div className="text-xs font-bold text-slate-500">Đã nhập kho (có đơn hoàn 1 phần)</div>
          <div className="text-xs text-slate-500 mt-1">Tổng hoàn: {fmtMoney(summary.daNhapMoney)}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-red-600">{groups.doi.length}</div>
          <div className="text-xs font-bold text-slate-500">Chưa nhận: Cần đi đòi</div>
          <div className="text-xs text-slate-500 mt-1">Tổng hoàn: {fmtMoney(summary.doiMoney)}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-amber-700">{groups.cho.length}</div>
          <div className="text-xs font-bold text-slate-500">Chưa nhận: Đang chờ hàng về</div>
          <div className="text-xs text-slate-500 mt-1">Tổng hoàn: {fmtMoney(summary.choMoney)}</div>
        </div>
      </div>

      {/* Tải Excel + thông báo */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleExportExcel}
          disabled={exporting || groups.doi.length + groups.cho.length === 0}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          <FileDown size={16} /> {exporting ? 'Đang tạo file...' : `Tải Excel (${groups.doi.length + groups.cho.length} đơn chưa nhận)`}
        </button>
        {isOwner && (
          <button
            onClick={openBulk}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
          >
            <ScanLine size={16} /> Đối chiếu hàng loạt
          </button>
        )}
        {exportMsg && <p className="text-sm font-bold text-slate-600">{exportMsg}</p>}
        {toast && <p className="text-sm font-bold text-emerald-600">{toast}</p>}
        {saveMsg && <p className="text-sm font-bold text-slate-600">{saveMsg}</p>}
        {historyWarn && <p className="text-sm font-bold text-amber-700">{historyWarn}</p>}
      </div>

      {/* Nhóm 1: Cần đi đòi */}
      {renderGroupSection({
        sectionKey: 'doi',
        title: 'Cần đi đòi',
        desc: 'Hàng đã về theo kiểm tay (trạng thái Đã nhận) nhưng chưa có đơn hoàn 1 phần trên Nhanh — đi đòi kho/Nhanh.',
        rows: groups.doi,
        page: safePageDoi,
        setPage: setPageDoi,
        totalPages: totalPagesDoi,
        copyLabel: 'Cần đi đòi',
      })}

      {/* Nhóm 2: Đang chờ hàng về */}
      {renderGroupSection({
        sectionKey: 'cho',
        title: 'Đang chờ hàng về',
        desc: 'Chưa kiểm nhận, hoặc kiểm tay vẫn là Chưa nhận — đang chờ hãng giao hàng về kho.',
        rows: groups.cho,
        page: safePageCho,
        setPage: setPageCho,
        totalPages: totalPagesCho,
        copyLabel: 'Đang chờ hàng về',
      })}

      {/* Đối chiếu hàng loạt — popup copy theo hãng + dán kết quả AfterShip */}
      {showBulk && isOwner && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={closeBulk}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-slate-900 text-white px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold">Đối chiếu hàng loạt</h2>
                <p className="text-xs text-slate-300 mt-0.5">Copy mã vận đơn theo từng hãng đi check AfterShip, rồi dán kết quả vào để cập nhật trạng thái. Delivered → Đã nhận (kèm ngày giao), còn lại → Chưa nhận.</p>
              </div>
              <button onClick={closeBulk} className="p-2 rounded-lg hover:bg-slate-700 cursor-pointer flex-shrink-0" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex gap-2">
                <button onClick={() => setBulkTab('doi-chieu')} className={`px-4 py-2 text-sm font-bold rounded-xl cursor-pointer ${bulkTab === 'doi-chieu' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>Đối chiếu</button>
                <button onClick={() => setBulkTab('lich-su')} className={`px-4 py-2 text-sm font-bold rounded-xl cursor-pointer ${bulkTab === 'lich-su' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>Lịch sử</button>
              </div>
              {bulkTab === 'lich-su' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value)}
                        placeholder="Lọc theo mã vận đơn..."
                        className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-mono"
                      />
                    </div>
                    <button onClick={fetchHistory} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer">Tải lại</button>
                  </div>
                  <p className="text-xs text-slate-500">Lịch sử kiểm nhận gần nhất (tối đa 200 dòng): mỗi lần dán AfterShip là 1 lô, sửa tay từng đơn ghi riêng 1 dòng "Thủ công". Đơn Delivered sau khi cập nhật không biến mất — nó nhảy từ nhóm Đang chờ sang Cần đi đòi, vẫn xem lại được ở đây.</p>
                  {historyError && <p className="text-sm font-bold text-amber-700">{historyError}</p>}
                  {historyLoading ? (
                    <div className="p-8 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
                      <Loader2 size={18} className="animate-spin" /> Đang tải...
                    </div>
                  ) : historyGroups.length === 0 ? (
                    <p className="text-sm font-bold text-slate-600">Chưa có lịch sử kiểm nhận nào{historyFilter.trim() ? ' khớp với mã đã lọc' : ''}.</p>
                  ) : (
                    <div className="space-y-3">
                      {historyGroups.map((g) => (
                        <div key={g.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                          {g.batch ? (
                            <p className="text-sm font-bold text-slate-900 mb-2">
                              Lô kiểm {fmtDateTime(g.checkedAt)} · {g.checkedBy || '—'} · {g.rows.length} đơn · {g.rows.filter((r) => r.received_status === 'Đã nhận').length} Đã nhận
                            </p>
                          ) : (
                            <p className="text-sm font-bold text-slate-900 mb-2">Sửa tay · {fmtDateTime(g.checkedAt)} · {g.checkedBy || '—'} · Thủ công</p>
                          )}
                          <div className="space-y-1">
                            {g.rows.map((r) => (
                              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                <span className="font-mono font-bold text-indigo-700 break-all">{r.tracking_number || '—'}</span>
                                <span className="text-xs text-slate-500">{r.shipment_status || (r.source === 'thu_cong' ? 'Thủ công' : '—')}</span>
                                <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${r.received_status === 'Đã nhận' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {r.received_status || '—'}{r.received_date ? ` · ${fmtDateOnly(r.received_date)}` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
              <>
              {loading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
                  <Loader2 size={18} className="animate-spin" /> Đang tải...
                </div>
              ) : bulkRows.length === 0 ? (
                <p className="text-sm font-bold text-slate-600">Không có đơn chưa nhận nào theo bộ lọc hiện tại.</p>
              ) : (
                <>
                  {/* Phân trang 50 đơn/trang */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-700">Trang {safeBulkPage} / {bulkTotalPages} — tổng {bulkRows.length} đơn chưa nhận</span>
                    <div className="flex gap-2">
                      <button disabled={safeBulkPage <= 1} onClick={() => setBulkPage(safeBulkPage - 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"><ChevronLeft size={14} /> Trước</button>
                      <button disabled={safeBulkPage >= bulkTotalPages} onClick={() => setBulkPage(safeBulkPage + 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1">Sau <ChevronRight size={14} /></button>
                    </div>
                  </div>
                  {/* Tab theo hãng — 1 hãng hiện 1 lúc */}
                  <div className="flex flex-wrap gap-2">
                    {bulkPageCarriers.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setBulkCarrier(c.name)}
                        className={`px-4 py-2 text-sm font-bold rounded-xl cursor-pointer ${activeBulkCarrier?.name === c.name ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                      >
                        {c.name} ({c.rows.length})
                      </button>
                    ))}
                  </div>
                  {activeBulkCarrier && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <h3 className="text-sm font-bold text-slate-900">{activeBulkCarrier.name} — {activeBulkCarrier.rows.length} đơn trên trang này</h3>
                        <div className="flex flex-col items-end gap-1">
                          <button disabled={activeCarrierCopyRows.length === 0} onClick={() => copyCodes(activeCarrierCopyRows, activeBulkCarrier.name)} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-2">
                            <Copy size={15} /> {activeCarrierCopyRows.length === 0 ? 'Đã kiểm xong' : `Sao chép mã vận đơn (${activeCarrierCopyRows.length})`}
                          </button>
                          {activeCarrierSkipped > 0 && <span className="text-xs text-slate-500">Đã bỏ qua {activeCarrierSkipped} đơn Đã nhận.</span>}
                        </div>
                      </div>
                      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                        {activeBulkCarrier.rows.map((r) => {
                          const m = manualChecks.get(r.return_id);
                          return (
                            <div key={r.return_id} className={`flex flex-wrap items-center gap-x-4 gap-y-0.5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm ${m?.received_status === 'Đã nhận' ? 'opacity-60' : ''}`}>
                              <span className="font-mono font-bold text-indigo-700 break-all">{returnCodeOf(r) || r.return_tracking_number || '—'}</span>
                              <span className="font-mono text-xs text-slate-500 break-all">{r.return_id || '—'}</span>
                              <span className={`ml-auto text-xs font-bold ${m?.received_status === 'Đã nhận' ? 'text-green-700' : 'text-slate-500'}`}>
                                {m?.received_status ? `${m.received_status}${m.received_date ? ` · ${fmtDateOnly(m.received_date)}` : ''}` : 'Chưa kiểm'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <button disabled={bulkPageCopyRows.length === 0} onClick={() => copyCodes(bulkPageCopyRows, 'chưa kiểm trên trang này')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-2">
                      <Copy size={15} /> {bulkPageCopyRows.length === 0 ? 'Trang này đã kiểm xong' : `Sao chép ${bulkPageCopyRows.length} mã chưa kiểm`}
                    </button>
                    {bulkPageSkipped > 0 && <span className="text-xs text-slate-500">Đã bỏ qua {bulkPageSkipped} đơn Đã nhận trên trang này.</span>}
                  </div>
                  {/* Dán kết quả AfterShip */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Dán kết quả AfterShip vào đây</label>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={8}
                      placeholder={'Tracking number: 854169939715\nCourier name: J&T Express Vietnam\nShipment status: Delivered\nDelivery date: Nov 7, 2026 (Sat)\n\n===============================\n\nTracking number: 854169610860\nCourier name: J&T Express Vietnam\nShipment status: In transit'}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-mono"
                    />
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <button onClick={handleBulkPreview} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md cursor-pointer">Cập nhật trạng thái</button>
                      {bulkError && <p className="text-sm font-bold text-red-500">{bulkError}</p>}
                      {bulkMsg && <p className="text-sm font-bold text-emerald-600">{bulkMsg}</p>}
                      {historyWarn && <p className="text-sm font-bold text-amber-700">{historyWarn}</p>}
                    </div>
                  </div>
                  {/* Xem trước — chưa ghi gì cả */}
                  {bulkPreview && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <p className="text-sm font-bold text-slate-900">
                        Xem trước — chưa lưu gì cả: tìm thấy {bulkPreview.matched.length} đơn, không khớp {bulkPreview.unmatched.length} mã.
                      </p>
                      {bulkPreview.matched.length > 0 && (
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                          {bulkPreview.matched.map((p) => (
                            <div key={p.tracking} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                              <span className="font-mono font-bold text-indigo-700 break-all">{p.tracking}</span>
                              <span className="text-xs text-slate-500">{p.shipStatus || '(không có trạng thái)'}</span>
                              <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full ${p.delivered ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                {p.delivered ? `Đã nhận${p.receivedDate ? ` · ${fmtDateOnly(p.receivedDate)}` : ''}` : 'Chưa nhận'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {bulkPreview.unmatched.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1">Không khớp (không nằm trong danh sách chưa nhận theo bộ lọc):</p>
                          <p className="font-mono text-xs text-slate-500 break-all">{bulkPreview.unmatched.map((p) => p.tracking).join(', ')}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button onClick={handleBulkConfirm} disabled={bulkSaving || bulkPreview.matched.length === 0} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer">
                          {bulkSaving ? 'Đang cập nhật...' : `Xác nhận cập nhật (${bulkPreview.matched.length} đơn)`}
                        </button>
                        <button onClick={() => setBulkPreview(null)} className="px-4 py-2.5 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer">Hủy xem trước</button>
                      </div>
                    </div>
                  )}
                </>
              )}
              </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
