import { useState, useEffect, useMemo } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { Search, X, Trash2, ChevronLeft, ChevronRight, Loader2, ScanLine, Package, DownloadCloud } from 'lucide-react';

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
function vnDayBounds(dateStr) {
  return { from: `${dateStr}T00:00:00+07:00`, to: `${addDaysStr(dateStr, 1)}T00:00:00+07:00` };
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  if (isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('vi-VN').format(v);
}
function escapeLike(q) {
  return q.replace(/[\\%_]/g, (c) => '\\' + c);
}
function normCode(s) {
  return String(s || '').trim().toUpperCase().replace(/[\s,]+/g, '');
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

export default function TraHangHoanTien() {
  // --- Bảng báo cáo ---
  const [fromDate, setFromDate] = useState(() => addDaysStr(vnTodayStr(), -30));
  const [toDate, setToDate] = useState(() => vnTodayStr());
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showJson, setShowJson] = useState(false);

  // --- Kéo dữ liệu từ Nhanh.vn (chỉ owner) ---
  const [isOwner, setIsOwner] = useState(false);
  const [syncFrom, setSyncFrom] = useState(() => addDaysStr(vnTodayStr(), -30));
  const [syncTo, setSyncTo] = useState(() => vnTodayStr());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState({ text: '', type: '' });

  // --- Đối soát shipper ---
  const [reconDate, setReconDate] = useState(() => vnTodayStr());
  const [todayRows, setTodayRows] = useState([]);
  const [scanned, setScanned] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [reconLoading, setReconLoading] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  const filters = applied || { fromDate, toDate, platform, status, search };

  function applyFiltersToQuery(query, f) {
    if (f.fromDate) query = query.gte('return_updated_at', `${f.fromDate}T00:00:00+07:00`);
    if (f.toDate) query = query.lt('return_updated_at', `${addDaysStr(f.toDate, 1)}T00:00:00+07:00`);
    if (f.platform !== '') query = query.eq('platform_id', Number(f.platform));
    if (f.status !== '') query = query.eq('nhanh_status_id', Number(f.status));
    if (f.search && f.search.trim()) {
      const q = escapeLike(f.search.trim());
      query = query.or(`return_tracking_number.ilike.%${q}%,return_id.ilike.%${q}%,original_ecom_order_id.ilike.%${q}%`);
    }
    return query;
  }

  async function fetchRows(f, p) {
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('ecom_return_orders').select('*', { count: 'exact' });
      query = applyFiltersToQuery(query, f);
      query = query.order('return_updated_at', { ascending: false }).range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
      const { data, count, error: err } = await query;
      if (err) throw err;
      setRows(data || []);
      setTotal(count || 0);
    } catch (e) {
      setError('Lỗi tải dữ liệu: ' + (e.message || e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows(filters, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, page]);

  // Owner nhận diện giống báo cáo đơn: user_metadata.is_owner hoặc email owner.
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const u = data?.user;
      setIsOwner(u?.user_metadata?.is_owner === true || u?.email === 'contact.hotavinh@gmail.com');
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  function handleFilter() {
    setPage(1);
    setApplied({ fromDate, toDate, platform, status, search });
  }

  // Kéo dữ liệu trả hàng từ Nhanh.vn về để update DB (xem có gì thay đổi
  // hoặc miss không). Gọi edge sync-ecom-returns 1 lần cho cả 3 sàn
  // (không gửi platformId thì edge tự kéo Shopee + TikTok + Lazada).
  async function handleSyncFromNhanh() {
    if (isSyncing) return;
    if (!syncFrom || !syncTo) { setSyncMessage({ text: 'Chọn đủ từ ngày và đến ngày.', type: 'error' }); return; }
    if (syncFrom > syncTo) { setSyncMessage({ text: 'Từ ngày phải nhỏ hơn hoặc bằng đến ngày.', type: 'error' }); return; }
    setIsSyncing(true);
    setSyncMessage({ text: 'Đang kéo dữ liệu từ Nhanh.vn...', type: 'processing' });
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-ecom-returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ fromDate: syncFrom || undefined, toDate: syncTo || undefined }),
      });
      const textData = await res.text();
      let data;
      try { data = JSON.parse(textData); } catch (e) { throw new Error('Máy chủ trả về dữ liệu không đọc được.'); }
      const total = data.syncedCount || 0;
      const perPlatform = Array.isArray(data.platforms)
        ? data.platforms.map((p) => `${p.platformName}: ${p.synced || 0}`).join(', ')
        : '';
      if (!res.ok) {
        setSyncMessage({ text: `Đã kéo được ${total} đơn nhưng bị gián đoạn ở một vài sàn${perPlatform ? ` (${perPlatform})` : ''}.${Array.isArray(data.errors) && data.errors.length ? ' ' + data.errors.join('; ') : ''}`, type: 'error' });
      } else {
        setSyncMessage({ text: `Hoàn tất! Đã đồng bộ ${total} đơn trả hàng từ Nhanh.vn${perPlatform ? ` (${perPlatform})` : ''}.`, type: 'success' });
      }
      // Tải lại bảng + đối soát trong ngày để thấy ngay đơn mới/thay đổi.
      setPage(1);
      fetchRows(filters, 1);
      loadToday(reconDate);
      setScanned([]);
    } catch (e) {
      setSyncMessage({ text: 'Lỗi hệ thống: ' + (e.message || e), type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // --- Đối soát: dữ liệu hôm nay ---
  async function loadToday(dateStr) {
    setReconLoading(true);
    try {
      const b = vnDayBounds(dateStr);
      const { data, error: err } = await supabase
        .from('ecom_return_orders')
        .select('return_tracking_number,return_id,original_ecom_order_id,nhanh_status_id,nhanh_status_name,platform_name,reason_name,return_updated_at')
        .gte('return_updated_at', b.from)
        .lt('return_updated_at', b.to)
        .order('return_updated_at', { ascending: false })
        .range(0, 999);
      if (err) throw err;
      setTodayRows(data || []);
    } catch (e) {
      setTodayRows([]);
    } finally {
      setReconLoading(false);
    }
  }

  useEffect(() => {
    loadToday(reconDate);
    setScanned([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconDate]);

  const todayMap = useMemo(() => {
    const m = new Map();
    for (const r of todayRows) {
      if (r.return_tracking_number) m.set(normCode(r.return_tracking_number), r);
      if (r.return_id) m.set(normCode(r.return_id), r);
    }
    return m;
  }, [todayRows]);

  const scannedNorms = useMemo(() => new Set(scanned.map((s) => s.norm)), [scanned]);

  async function addCode(raw) {
    const norm = normCode(raw);
    if (!norm || scannedNorms.has(norm)) return;
    if (todayMap.has(norm)) {
      setScanned((prev) => [...prev, { code: String(raw).trim(), norm, found: true, row: todayMap.get(norm), today: true }]);
      return;
    }
    setScanBusy(true);
    try {
      const q = escapeLike(norm);
      const { data, error: err } = await supabase
        .from('ecom_return_orders')
        .select('*')
        .or(`return_tracking_number.ilike.${q},return_id.ilike.${q}`)
        .limit(1);
      if (err) throw err;
      if (data && data.length > 0) {
        setScanned((prev) => [...prev, { code: String(raw).trim(), norm, found: true, row: data[0], today: false }]);
      } else {
        setScanned((prev) => [...prev, { code: String(raw).trim(), norm, found: false, row: null, today: false }]);
      }
    } catch (e) {
      setScanned((prev) => [...prev, { code: String(raw).trim(), norm, found: false, row: null, today: false }]);
    } finally {
      setScanBusy(false);
    }
  }

  async function handlePaste() {
    const lines = pasteText.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 100);
    if (lines.length === 0) return;
    for (const line of lines) {
      // eslint-disable-next-line no-await-in-loop
      await addCode(line);
    }
    setPasteText('');
  }

  const matchedCount = scanned.filter((s) => s.found).length;
  const unknownCount = scanned.filter((s) => !s.found).length;
  const missingRows = todayRows.filter(
    (r) => !scannedNorms.has(normCode(r.return_tracking_number)) && !scannedNorms.has(normCode(r.return_id)),
  );

  function openDetail(row) {
    setSelected(row);
    setShowJson(false);
  }

  const detailProducts = selected ? productsOf(selected) : [];
  const reasonDescription = selected?.raw_data?.reasonDescription || '';

  // Cột bảng chính: % cố định (table-fixed + colgroup) để khớp với strip
  // tiêu đề gộp vào cụm lọc phía trên.
  const MAIN_COLS = [
    { id: 'date', label: 'Ngày cập nhật', w: 12 },
    { id: 'platform', label: 'Sàn', w: 7 },
    { id: 'code', label: 'Mã đơn trả', w: 13 },
    { id: 'orig', label: 'ID đơn gốc', w: 11 },
    { id: 'product', label: 'Sản phẩm', w: 16 },
    { id: 'qty', label: 'SL', w: 4 },
    { id: 'reason', label: 'Lý do', w: 9 },
    { id: 'nhanh', label: 'Trạng thái Nhanh', w: 11 },
    { id: 'ecom', label: 'Trạng thái sàn', w: 9 },
    { id: 'money', label: 'Tiền hoàn', w: 8 },
  ];
  const mainGridCols = MAIN_COLS.map((c) => `${c.w}%`).join(' ');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="sticky top-0 z-30 flex flex-wrap justify-between items-center gap-4 rounded-2xl px-6 py-6 bg-slate-900 border border-slate-900 shadow-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Trả hàng hoàn tiền</h1>
          <p className="text-sm text-slate-300 mt-1">
            Yêu cầu trả hàng hoàn tiền trên sàn, đồng bộ từ Nhanh.vn. Bấm vào một dòng để xem chi tiết, lý do và phản hồi của khách.
          </p>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="sticky top-[106px] z-30 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Từ ngày</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Đến ngày</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trạng thái Nhanh</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white">
              <option value="">Tất cả trạng thái</option>
              {Object.entries(NHANH_STATUS_NAMES).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tìm mã đơn trả / ID đơn gốc / mã yêu cầu</label>
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
          Tổng: <strong className="text-slate-800">{total}</strong> yêu cầu theo bộ lọc. Ngày lọc theo ngày cập nhật trên Nhanh.
        </p>
        {error && <p className="text-sm font-bold text-red-500 mt-2">{error}</p>}
        {isOwner && (
          <div className="flex flex-wrap items-end gap-3 pt-4 mt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Đồng bộ từ ngày</label>
              <input type="date" value={syncFrom} onChange={(e) => setSyncFrom(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Đến ngày</label>
              <input type="date" value={syncTo} onChange={(e) => setSyncTo(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
            </div>
            <button onClick={handleSyncFromNhanh} disabled={isSyncing} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2">
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
              {isSyncing ? 'Đang kéo từ Nhanh.vn...' : 'Kéo dữ liệu từ Nhanh.vn'}
            </button>
            {syncMessage.text && <p className={`text-sm font-bold ${syncMessage.type === 'error' ? 'text-red-500' : syncMessage.type === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}>{syncMessage.text}</p>}
          </div>
        )}
        {/* Tiêu đề bảng gộp vào cụm lọc: dính cùng cụm lọc, cột theo đúng % của colgroup */}
        <div className="-mx-6 -mb-6 mt-4 grid bg-slate-900 text-slate-100 rounded-b-2xl overflow-hidden" style={{ gridTemplateColumns: mainGridCols }}>
          {MAIN_COLS.map((col) => (
            <div key={col.id} className={`py-3 px-5 text-xs font-bold uppercase tracking-wider min-w-0 ${col.id === 'money' ? 'text-right' : ''}`}>
              {col.label}
            </div>
          ))}
        </div>
      </div>

      {/* Bảng */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 size={18} className="animate-spin" /> Đang tải...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <Package size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">Chưa có dữ liệu.</p>
            <p className="text-xs text-slate-500 mt-1">Bấm nút Kéo Hoàn Hàng trong Admin (có chọn khoảng ngày) để đồng bộ dữ liệu về trước.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>{MAIN_COLS.map((c) => (<col key={c.id} style={{ width: `${c.w}%` }} />))}</colgroup>
              <tbody>
                {rows.map((r) => {
                  const prods = productsOf(r);
                  const first = prods[0];
                  return (
                    <tr key={r.return_id} onClick={() => openDetail(r)} className="border-t border-slate-100 hover:bg-slate-100 cursor-pointer">
                      <td className="px-5 py-3.5 whitespace-nowrap font-medium">{fmtDateTime(r.return_updated_at)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">{r.platform_name || '—'}</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-indigo-700 break-all">{returnCodeOf(r) || <span className="font-sans font-medium text-slate-400">Chưa có mã đơn trả</span>}</td>
                      <td className="px-5 py-3.5 font-mono break-all">{r.original_ecom_order_id || '—'}</td>
                      <td className="px-5 py-3.5">
                        {first ? (<span>{first.name}{prods.length > 1 ? ` (+${prods.length - 1} SP)` : ''}</span>) : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-bold">{totalQty(r) || '—'}</td>
                      <td className="px-5 py-3.5">{r.reason_name || '—'}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${NHANH_STATUS_BADGE[r.nhanh_status_id] || 'bg-slate-100 text-slate-700'}`}>
                          {r.nhanh_status_name || NHANH_STATUS_NAMES[r.nhanh_status_id] || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">{r.ecom_status_name || '—'}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold">{fmtMoney(r.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500">Trang {page} / {totalPages} — {total} yêu cầu</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"><ChevronLeft size={14} /> Trước</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1">Sau <ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* Đối soát shipper */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100"><ScanLine size={18} /> Đối soát shipper</h2>
        <p className="text-xs text-slate-500 mt-1">
          Shipper trả bao nhiêu kiện thì bắn mã vạch từng kiện vào đây, hệ thống đối chiếu với danh sách đơn trả trong ngày.
          Đối soát theo dữ liệu Nhanh; check trạng thái thành công theo hãng vận chuyển sẽ bổ sung sau.
        </p>
        <div className="flex flex-wrap items-end gap-3 mt-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ngày đối soát</label>
            <input type="date" value={reconDate} onChange={(e) => setReconDate(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-bold text-slate-500 mb-1">Bắn mã vạch / nhập mã đơn trả (Enter để thêm)</label>
            <input
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { addCode(scanInput); setScanInput(''); } }}
              placeholder="Quét hoặc nhập mã rồi Enter"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium"
            />
          </div>
          <button onClick={() => { if (scanInput.trim()) { addCode(scanInput); setScanInput(''); } }} disabled={scanBusy} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer">Thêm mã</button>
          <button onClick={() => setScanned([])} className="px-4 py-2.5 text-sm font-bold rounded-xl border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer flex items-center gap-1"><Trash2 size={14} /> Xóa hết</button>
        </div>
        <div className="mt-3">
          <label className="block text-xs font-bold text-slate-500 mb-1">Hoặc dán nhiều mã (mỗi dòng 1 mã, tối đa 100 mã)</label>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={3} placeholder={'SPXVN0123...\nSPXVN0456...'} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
          <button onClick={handlePaste} disabled={scanBusy} className="mt-2 px-5 py-2 text-sm font-bold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">Thêm nhiều mã</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4"><div className="text-3xl font-bold text-slate-900">{scanned.length}</div><div className="text-xs font-bold text-slate-500">Đã quét</div></div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4"><div className="text-3xl font-bold text-green-700">{matchedCount}</div><div className="text-xs font-bold text-slate-500">Khớp trong hệ thống</div></div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4"><div className="text-3xl font-bold text-red-600">{unknownCount}</div><div className="text-xs font-bold text-slate-500">Mã lạ (không có trong hệ thống)</div></div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4"><div className="text-3xl font-bold text-amber-700">{missingRows.length}</div><div className="text-xs font-bold text-slate-500">Trong ngày chưa quét</div></div>
        </div>
        {reconLoading && <p className="text-xs font-bold text-slate-500 mt-3 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải danh sách trong ngày...</p>}

        {scanned.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Mã đã quét</h3>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold text-slate-500">
                    <th className="bg-slate-50 px-4 py-2">Mã quét</th>
                    <th className="bg-slate-50 px-4 py-2">Kết quả</th>
                    <th className="bg-slate-50 px-4 py-2">ID đơn gốc</th>
                    <th className="bg-slate-50 px-4 py-2">Trạng thái Nhanh</th>
                    <th className="bg-slate-50 px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {scanned.map((s) => (
                    <tr key={s.norm} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono font-bold">{s.code}</td>
                      <td className="px-4 py-2">
                        {s.found
                          ? (<span className="text-xs font-bold text-green-700">Khớp{s.today ? ' (hôm nay)' : ' (ngày khác)'}</span>)
                          : (<span className="text-xs font-bold text-red-600">Không có trong hệ thống</span>)}
                      </td>
                      <td className="px-4 py-2">{s.row?.original_ecom_order_id || '—'}</td>
                      <td className="px-4 py-2">{s.row?.nhanh_status_name || NHANH_STATUS_NAMES[s.row?.nhanh_status_id] || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => setScanned((prev) => prev.filter((x) => x.norm !== s.norm))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {missingRows.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Trong ngày ({reconDate}) chưa quét</h3>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold text-slate-500">
                    <th className="bg-slate-50 px-4 py-2">Mã đơn trả</th>
                    <th className="bg-slate-50 px-4 py-2">ID đơn gốc</th>
                    <th className="bg-slate-50 px-4 py-2">Sàn</th>
                    <th className="bg-slate-50 px-4 py-2">Trạng thái Nhanh</th>
                  </tr>
                </thead>
                <tbody>
                  {missingRows.map((r) => (
                    <tr key={r.return_id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono font-bold break-all">{returnCodeOf(r) || <span className="font-sans font-medium text-slate-400">Chưa có mã đơn trả</span>}</td>
                      <td className="px-4 py-2">{r.original_ecom_order_id || '—'}</td>
                      <td className="px-4 py-2">{r.platform_name || '—'}</td>
                      <td className="px-4 py-2">{r.nhanh_status_name || NHANH_STATUS_NAMES[r.nhanh_status_id] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Popup chi tiết */}
      {selected && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Chi tiết yêu cầu trả hàng</h2>
                <p className="text-sm text-slate-500">Mã yêu cầu: <strong className="text-slate-800">{selected.return_id}</strong></p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20} /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Sàn</span><strong>{selected.platform_name || '—'}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Shop</span><strong>{selected.shop_id || '—'}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Mã đơn trả</span><strong>{returnCodeOf(selected) || 'Chưa có mã đơn trả'}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">ID đơn gốc</span><strong>{selected.original_ecom_order_id || '—'}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Loại trả</span><strong>{RETURN_TYPE_NAMES[selected.return_type] || '—'}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Tiền hoàn</span><strong>{fmtMoney(selected.amount)}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Trạng thái Nhanh</span><strong>{selected.nhanh_status_name || NHANH_STATUS_NAMES[selected.nhanh_status_id] || '—'}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Trạng thái sàn</span><strong>{selected.ecom_status_name || '—'}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Ngày tạo</span><strong>{fmtDateTime(selected.return_created_at)}</strong></div>
              <div className="bg-slate-50 rounded-xl p-3"><span className="text-xs font-bold text-slate-500 block">Ngày cập nhật</span><strong>{fmtDateTime(selected.return_updated_at)}</strong></div>
            </div>

            <h3 className="text-sm font-bold text-slate-800 mt-5 mb-2">Sản phẩm trả ({detailProducts.length} loại, tổng {totalQty(selected)} SP)</h3>
            {detailProducts.length === 0 ? (
              <p className="text-sm text-slate-500">Không có thông tin sản phẩm.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-bold text-slate-500">
                      <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2">Sản phẩm</th>
                      <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2">SKU</th>
                      <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2">SL</th>
                      <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right">Giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailProducts.map((p, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2">{p.name || '—'}</td>
                        <td className="px-3 py-2">{p.sku || '—'}</td>
                        <td className="px-3 py-2 font-bold">{p.quantity ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{fmtMoney(p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="text-sm font-bold text-slate-800 mt-5 mb-2">Lý do trả hàng</h3>
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <p><strong>{selected.reason_name || '—'}</strong>{selected.reason_id ? ` (mã lý do: ${selected.reason_id})` : ''}</p>
              {reasonDescription && (
                <p className="mt-2 text-slate-700 whitespace-pre-wrap">{reasonDescription}</p>
              )}
              {!reasonDescription && (
                <p className="mt-2 text-slate-400 text-xs">Không có phản hồi chi tiết của khách trong dữ liệu Nhanh.</p>
              )}
            </div>

            <button onClick={() => setShowJson(!showJson)} className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
              {showJson ? 'Ẩn JSON gốc' : 'Xem JSON gốc'}
            </button>
            {showJson && (
              <pre className="mt-2 bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(selected.raw_data || selected, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
