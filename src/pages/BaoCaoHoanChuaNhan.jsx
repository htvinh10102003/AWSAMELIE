import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ChevronLeft, ChevronRight, Loader2, Package, Copy, FileDown, Pencil } from 'lucide-react';
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

// Cột bảng: % cố định (table-fixed + colgroup) để khớp với strip tiêu đề
// gộp vào cụm lọc phía trên. Cả 2 bảng nhóm dùng chung 1 bộ cột.
const COLS = [
  { id: 'code', label: 'Mã vận đơn trả', w: 8 },
  { id: 'return_id', label: 'Mã đơn trả', w: 7 },
  { id: 'orig', label: 'Mã đơn gốc', w: 7 },
  { id: 'nhanhId', label: 'ID đơn Nhanh', w: 6 },
  { id: 'platform', label: 'Sàn', w: 4 },
  { id: 'shop', label: 'Shop', w: 5 },
  { id: 'type', label: 'Loại trả', w: 5 },
  { id: 'reason', label: 'Lý do', w: 6 },
  { id: 'nhanh', label: 'Trạng thái Nhanh', w: 6 },
  { id: 'ecom', label: 'Trạng thái sàn', w: 5 },
  { id: 'money', label: 'Tiền hoàn', w: 6 },
  { id: 'product', label: 'Sản phẩm', w: 8 },
  { id: 'created', label: 'Ngày tạo', w: 5 },
  { id: 'updated', label: 'Ngày cập nhật', w: 5 },
  { id: 'recvDate', label: 'Ngày hàng về', w: 4 },
  { id: 'recvStatus', label: 'Trạng thái nhận', w: 4 },
  { id: 'edit', label: 'Sửa', w: 9 },
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

  function renderRow(r) {
    const prods = productsOf(r);
    const first = prods[0];
    const mappedFirst = first ? mapReturnProduct(first.name, first.sku, inventoryIndex) : null;
    const m = manualChecks.get(r.return_id);
    const editing = editRowId === r.return_id;
    const draft = editDrafts[r.return_id] || {};
    const reasonDesc = r.raw_data?.reasonInfor?.reasonDescription || r.raw_data?.reasonDescription || '';
    return (
      <tr key={r.return_id} className="border-t border-slate-100 hover:bg-slate-50">
        <td className="px-3 py-3 font-mono font-bold text-indigo-700 break-all">{returnCodeOf(r) || r.return_tracking_number || '—'}</td>
        <td className="px-3 py-3 font-mono break-all">{r.return_id || '—'}</td>
        <td className="px-3 py-3 font-mono break-all">{r.original_ecom_order_id || '—'}</td>
        <td className="px-3 py-3 font-mono break-all">{r.raw_data?.nhanhOrderId ?? '—'}</td>
        <td className="px-3 py-3 whitespace-nowrap">{r.platform_name || '—'}</td>
        <td className="px-3 py-3 font-mono break-all">{r.shop_id || '—'}</td>
        <td className="px-3 py-3">{RETURN_TYPE_NAMES[r.return_type] || '—'}</td>
        <td className="px-3 py-3">
          {r.reason_name || '—'}
          {reasonDesc && (<span className="block text-xs text-slate-500 mt-0.5">{reasonDesc}</span>)}
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${NHANH_STATUS_BADGE[r.nhanh_status_id] || 'bg-slate-100 text-slate-700'}`}>
            {r.nhanh_status_name || NHANH_STATUS_NAMES[r.nhanh_status_id] || '—'}
          </span>
        </td>
        <td className="px-3 py-3">{r.ecom_status_name || '—'}</td>
        <td className="px-3 py-3 text-right font-mono font-bold">{fmtMoney(r.amount)}</td>
        <td className="px-3 py-3">
          {mappedFirst && first && mappedFirst !== first.name ? (
            <span><span className="font-bold text-slate-900">{mappedFirst}</span><span className="block text-xs text-slate-500">{first.name}{prods.length > 1 ? ` (+${prods.length - 1} SP)` : ''}</span></span>
          ) : first ? (<span>{first.name}{prods.length > 1 ? ` (+${prods.length - 1} SP)` : ''}</span>) : '—'}
        </td>
        <td className="px-3 py-3 whitespace-nowrap">{fmtDateTime(r.return_created_at)}</td>
        <td className="px-3 py-3 whitespace-nowrap">{fmtDateTime(r.return_updated_at)}</td>
        <td className="px-3 py-3 whitespace-nowrap">{m?.received_date ? fmtDateOnly(m.received_date) : '—'}</td>
        <td className="px-3 py-3 whitespace-nowrap">
          {m ? (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${m.received_status === 'Đã nhận' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>{m.received_status}</span>
          ) : (<span className="text-slate-400 text-xs">Chưa kiểm</span>)}
        </td>
        <td className="px-3 py-3">
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
        {exportMsg && <p className="text-sm font-bold text-slate-600">{exportMsg}</p>}
        {toast && <p className="text-sm font-bold text-emerald-600">{toast}</p>}
        {saveMsg && <p className="text-sm font-bold text-slate-600">{saveMsg}</p>}
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
    </div>
  );
}
