import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ChevronLeft, ChevronRight, Loader2, Package, Copy, FileDown, Pencil, ScanLine, X, Volume2, VolumeX } from 'lucide-react';
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
// Tên kênh cho mục quét nhận hàng (đơn 71/74 chỉ có sale_channel số).
const CHANNEL_NAMES = { 1: 'Admin', 2: 'Website', 10: 'API', 20: 'Facebook', 21: 'Instagram', 41: 'Lazada', 42: 'Shopee', 43: 'Sendo', 45: 'Tiki', 48: 'TikTok', 49: 'Zalo OA' };
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
// Mã đơn trả "thật" chỉ là mã vận đơn trả có đầu SHOPEE / SPX / VNGH / VTP /
// EA / G / 8 / 1. Mọi mã khác đều chưa phải mã đơn trả (hiển thị
// "Chưa có mã đơn trả"). Thứ tự dài trước: tiền tố dài phải được kiểm
// trước tiền tố 1 ký tự (không có tiền tố 1 ký tự nào là đầu của tiền tố
// dài ở đây, nhưng giữ thứ tự này để sau này thêm tiền tố không bị che).
// VNGH = GHN; EA = VNPost (EMS, VD EA507283035VN); SHOPEE = mã sàn;
// 379 = J&T (mã số VD 37910474801).
const RETURN_CODE_PREFIXES = ['SHOPEE', 'SPX', 'VNGH', 'VTP', 'EA', '379', 'G', '8', '1'];
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

// --- Đơn hoàn 1 phần (type 16) trong bảng riêng partial_return_orders ---
// original_order_id = ID đơn gốc; original_ecom_order_id = mã đơn sàn gốc
// (đã bỏ hậu tố 'R' lúc ghi). stripTrailingR giữ lại phòng hờ dữ liệu cũ.
function stripTrailingR(appOrderId) {
  return String(appOrderId).replace(/R$/, '');
}

// --- Danh sách "Cần check tay": ngày VN + tuổi đơn trả (UTC+7, không Intl) ---
// Ngày VN (YYYY-MM-DD) của 1 timestamp — cộng 7 giờ, đọc bằng UTC getters.
function vnDateOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const v = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
}
// Số ngày nguyên từ ngày A tới ngày B (B - A), chuỗi ngày YYYY-MM-DD.
function daysBetween(dateStrA, dateStrB) {
  const a = Date.parse(`${dateStrA}T00:00:00Z`);
  const b = Date.parse(`${dateStrB}T00:00:00Z`);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
// Tuổi (ngày VN) của đơn trả tính tới hôm nay; null khi không đọc được ngày tạo.
function returnAgeDays(row, todayStr) {
  const created = vnDateOf(row.return_created_at);
  if (!created) return null;
  return daysBetween(created, todayStr);
}
// Tra trạng thái đơn gốc trong 2 map cache: ưu tiên ID đơn Nhanh
// (raw_data.nhanhOrderId), sau đó mã đơn sàn gốc (original_ecom_order_id).
// Trả về status (số) hoặc null khi không nối được.
function lookupOrigStatus(row, statusById, statusByEcom) {
  const nid = row?.raw_data?.nhanhOrderId;
  if (nid !== null && nid !== undefined && nid !== '' && statusById.has(String(nid))) return statusById.get(String(nid));
  const oid = row?.original_ecom_order_id;
  if (oid && statusByEcom.has(String(oid))) return statusByEcom.get(String(oid));
  return null;
}

// --- Danh sách "Cần check tay" (quy tắc đơn giản 2026-11-10) ---
// Một đơn nằm trong danh sách khi ĐỦ cả 5 điều kiện:
// (i) có mã đơn trả thật (đầu SHOPEE/SPX/VNGH/VTP/EA/G/8/1);
// (ii) chưa có đơn hoàn 1 phần (kho đã tick nhận ở Nhanh thì coi là đã nhận);
// (iii) chưa có xác nhận nhận hàng thật: manualChecks[return_id]
//       .received_status !== 'Đã nhận' (chỉ quét/tick mới ghi 'Đã nhận');
// (iv) tuổi > 4 ngày VN (đúng 4 ngày chưa tính; tuổi null thì không tính);
// (v) đơn gốc, KHI NỐI ĐƯỢC, không ở trạng thái 72 (chủ shop tự đổi tay
//     khi đã nhận hàng). Đơn gốc ở 71/74 sau 4 ngày VẪN bị cảnh báo
//     (quá hạn là quá hạn). Trạng thái hãng (carrier_status "Đã hoàn" /
//     "Chưa hoàn") KHÔNG ảnh hưởng danh sách này: hãng báo đã giao chưa
//     chắc chủ shop đã cầm hàng.
// Trả về { pass, age }. hasPartialFn: (row) => boolean; manualChecks:
// Map(return_id -> { received_status }); deps còn có origStatusById /
// origStatusByEcom (Map cache trạng thái đơn gốc).
function needCheckBaseOf(row, deps) {
  const { hasPartialFn, manualChecks, todayStr } = deps;
  if (!returnCodeOf(row)) return { pass: false, age: null };
  if (hasPartialFn(row)) return { pass: false, age: null };
  if (manualChecks.get(row.return_id)?.received_status === 'Đã nhận') return { pass: false, age: null };
  const age = returnAgeDays(row, todayStr);
  if (age === null || age <= 4) return { pass: false, age };
  return { pass: true, age };
}
function needCheckOf(row, deps) {
  const base = needCheckBaseOf(row, deps);
  if (!base.pass) return base;
  // Quy tắc (v): chỉ loại khi nối được đơn gốc VÀ nó đang ở 72.
  // Không nối được (null) -> vẫn tính là cần check.
  if (lookupOrigStatus(row, deps.origStatusById, deps.origStatusByEcom) === 72) return { pass: false, age: base.age };
  return base;
}
function isInNeedCheckList(row, deps) {
  return needCheckOf(row, deps).pass;
}
// "Đang chờ hàng về" = phần bù trong tập báo cáo: có mã trả thật,
// tuổi <= 4 ngày (tuổi null cũng chờ, vì chưa chứng minh được quá hạn),
// chưa có xác nhận nhận thật. Đơn đã nhận / không có mã thật / quá
// 4 ngày (thuộc "Cần check tay") đều không nằm ở đây.
function isWaitingRow(row, manualChecks, todayStr) {
  if (!returnCodeOf(row)) return false;
  if (manualChecks.get(row.return_id)?.received_status === 'Đã nhận') return false;
  const age = returnAgeDays(row, todayStr);
  return age === null || age <= 4;
}

// --- Tách trạng thái hãng ("Đã hoàn") khỏi trạng thái nhận ("Đã nhận") ---
// Dán kết quả AfterShip/17Track/Excel chỉ cho biết HÃNG đã giao hàng trả
// về hay chưa — KHÔNG chứng minh chủ shop đã cầm hàng. Delivered / "Đã
// giao" -> carrier_status 'Đã hoàn'; còn lại -> 'Chưa hoàn'. Hàm thuần
// để test được; received_status KHÔNG được chạm tới ở luồng dán.
function carrierStatusOfPaste(delivered) {
  return delivered ? 'Đã hoàn' : 'Chưa hoàn';
}

// --- Đối chiếu hàng loạt: hãng theo đầu mã vận đơn ---
// Kiểm tra tiền tố dài trước (SHOPEE, SPX, VNGH, VTP, EA, 379) rồi mới tới
// tiền tố 1 ký tự (8, G, 1). VNGH = GHN (cùng hãng với đầu G);
// 379 = J&T (cùng hãng với đầu 8).
const CARRIER_BY_PREFIX = [
  { prefix: 'SHOPEE', name: 'Hãng khác' },
  { prefix: 'SPX', name: 'SPX (Shopee Express)' },
  { prefix: 'VNGH', name: 'GHN' },
  { prefix: 'VTP', name: 'Viettel Post' },
  { prefix: 'EA', name: 'VNPost' },
  { prefix: '379', name: 'J&T Express' },
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

// --- Phân tích đoạn text kết quả 17Track (và các bên khác cùng dạng dòng) ---
// Mỗi đơn 1 dòng, các cột cách nhau bằng tab/khoảng trắng:
//   MÃ<TAB>Quốc gia<TAB>...<TAB>ngày giờ + sự kiện<TAB>Trạng thái<TAB>(N Days)
// Bỏ dòng phân cách ==== và footer "Powered by www.17track.net".
// Trạng thái lấy ở gần cuối dòng (trước "(N Days)" nếu có); dự phòng tìm
// từ "Delivered" trong cả dòng. "Not found" = hãng chưa có dữ liệu giao
// hàng cho mã đó -> tính 'Chưa nhận' (và theo quy tắc theo ngày, đơn này
// ẩn khỏi popup trong hôm nay, hôm sau lại hiện để check tiếp).
const CARRIER_STATUS_WORDS = [
  'Available for Pickup',
  'Out for Delivery',
  'Attempted Delivery',
  'Info Received',
  'In Transit',
  'Not found',
  'Undelivered',
  'Delivered',
  'Exception',
  'Expired',
  'Pending',
];
const CARRIER_STATUS_END_RE = new RegExp(
  `\\b(${CARRIER_STATUS_WORDS.map((w) => w.replace(/ /g, '\\s+')).join('|')})$`,
  'i',
);
function parse17TrackText(text) {
  const results = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^=+\s*$/.test(line)) continue;
    if (/^powered by\b/i.test(line)) continue;
    // Mã vận đơn = token đầu dòng; phải chứa ít nhất 1 chữ số và dài
    // hơn 5 ký tự (để các dòng "Tracking number: ..." của AfterShip
    // không lọt vào parser dòng này khi đoạn dán không có chữ aftership).
    const tracking = line.split(/\s+/)[0].trim();
    if (!tracking || tracking.length <= 5 || !/\d/.test(tracking) || tracking.includes(':')) continue;
    // Ngày giao: ngày ISO đầu tiên trong dòng, chỉ lấy khi Delivered.
    const dateM = line.match(/(\d{4})-(\d{2})-(\d{2})/);
    // Bỏ hậu tố "(N Days)" ở cuối rồi khớp trạng thái ở cuối dòng.
    const noDays = line.replace(/\(\d+\s*days?\)\s*$/i, '').trim();
    const endM = noDays.match(CARRIER_STATUS_END_RE);
    let shipStatus = '';
    let delivered = false;
    if (endM) {
      shipStatus = endM[1];
      delivered = /delivered/i.test(shipStatus) && !/undelivered/i.test(shipStatus);
    } else if (/\bnot\s+delivered\b/i.test(line)) {
      shipStatus = 'Not delivered';
    } else if (/\bdelivered\b/i.test(line)) {
      shipStatus = 'Delivered';
      delivered = true;
    }
    results.push({
      tracking,
      shipStatus,
      delivered,
      receivedDate: delivered && dateM ? `${dateM[1]}-${dateM[2]}-${dateM[3]}` : null,
    });
  }
  return results;
}

// --- Điểm vào chung cho đoạn dán: tự nhận diện nguồn ---
// Có chữ "17track" -> parser 17Track; có chữ "aftership" -> parser
// AfterShip; không có dấu hiệu nào -> thử parser dòng trước (đủ chung cho
// các bên khác dán 1 dòng/đơn: mã đầu dòng + trạng thái + ngày), nếu không
// đọc được mã nào thì thử parser AfterShip. Trả về { rows, source }.
function parseCarrierText(text) {
  const raw = String(text || '');
  if (/17track/i.test(raw)) return { rows: parse17TrackText(raw), source: '17track' };
  if (/aftership/i.test(raw)) return { rows: parseAftershipText(raw), source: 'aftership' };
  const lineRows = parse17TrackText(raw);
  if (lineRows.length > 0) return { rows: lineRows, source: 'generic' };
  return { rows: parseAftershipText(raw), source: 'aftership' };
}

// --- Đọc file Excel đối chiếu (2 cột: Mã vận đơn, Trạng thái) ---
// Dạng mảng 2 chiều (sheet đầu tiên). Nhận diện tiêu đề ở 1 trong 3 dòng
// đầu (khớp "mã vận đơn"/"mã đơn"/"tracking" và "trạng thái"/"status",
// không phân biệt hoa thường, đã trim); nếu không có tiêu đề mà ô đầu
// dòng 1 trông như mã vận đơn thì coi toàn bộ là dữ liệu, cột 1 = mã,
// cột 2 = trạng thái. "Đã giao" hoặc "Delivered" -> đã giao; giá trị khác
// -> chưa giao (giữ nguyên chuỗi trạng thái gốc để xem trước).
function parseExcelAoa(aoa) {
  const rows = (aoa || []).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
  if (rows.length === 0) return [];
  const norm = (v) => String(v ?? '').trim().toLowerCase();
  const isCodeHeader = (v) => /mã vận đơn|mã đơn trả|mã đơn|tracking/.test(norm(v));
  const isStatusHeader = (v) => /trạng thái|status/.test(norm(v));
  let codeIdx = 0;
  let statusIdx = 1;
  let startRow = 0;
  let headerFound = false;
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const cells = rows[i];
    let ci = -1;
    let si = -1;
    for (let j = 0; j < cells.length; j++) {
      if (ci < 0 && isCodeHeader(cells[j])) ci = j;
      if (si < 0 && isStatusHeader(cells[j])) si = j;
    }
    if (ci >= 0 && si >= 0) {
      codeIdx = ci;
      statusIdx = si;
      startRow = i + 1;
      headerFound = true;
      break;
    }
  }
  if (!headerFound) {
    // Không có tiêu đề: dòng 1 phải trông như mã vận đơn thì mới đọc.
    const first = String(rows[0][0] ?? '').trim();
    if (!isReturnCode(first) && !(first.length > 5 && /\d/.test(first))) return [];
  }
  const out = [];
  for (let i = startRow; i < rows.length; i++) {
    const tracking = String(rows[i][codeIdx] ?? '').trim();
    if (!tracking) continue;
    const shipStatus = String(rows[i][statusIdx] ?? '').trim();
    const delivered = ['đã giao', 'delivered'].includes(shipStatus.toLowerCase());
    out.push({ tracking, shipStatus, delivered, receivedDate: null });
  }
  return out;
}

const CARRIER_SOURCE_LABELS = { aftership: 'AfterShip', '17track': '17Track', generic: 'Dạng dòng (bên khác)', excel: 'Excel', quet: 'Quét mã', thu_cong: 'Thủ công' };

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

// --- Âm thanh quét mã (Web Audio API, không file âm thanh, chạy offline) ---
// getScanSoundPattern là hàm thuần: outcome -> danh sách { frequency,
// duration, delay } (tần số Hz, thời lượng giây, trễ giây). Trả về
// literal mới mỗi lần gọi nên test Node được và không bị mutate.
//   match:     2 beep ngắn đi lên  880 -> 1174 Hz, mỗi beep 0.08s
//   notfound:  1 buzz trầm 200 Hz, 0.25s
//   duplicate: 2 beep ngắn giống nhau 660 Hz, mỗi beep 0.08s
// Đơn 71/74-only (không có đơn trả) cũng tính là "tìm thấy mã" -> match.
// outcome lạ -> [] (không phát tiếng).
function getScanSoundPattern(outcome) {
  if (outcome === 'match') {
    return [
      { frequency: 880, duration: 0.08, delay: 0 },
      { frequency: 1174, duration: 0.08, delay: 0.09 },
    ];
  }
  if (outcome === 'duplicate') {
    return [
      { frequency: 660, duration: 0.08, delay: 0 },
      { frequency: 660, duration: 0.08, delay: 0.09 },
    ];
  }
  if (outcome === 'notfound') {
    return [{ frequency: 200, duration: 0.25, delay: 0 }];
  }
  return [];
}

// AudioContext chỉ tạo khi cần phát tiếng (lazy, KHÔNG tạo lúc load
// module — trình duyệt chặn autoplay nếu tạo trước tương tác người dùng).
// Giữ 1 context dùng lại cho mọi lần quét; resume khi đang suspended.
let scanAudioCtx = null;
function getScanAudioContext() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!scanAudioCtx) {
    try {
      scanAudioCtx = new AC();
    } catch {
      return null;
    }
  }
  if (scanAudioCtx.state === 'suspended') {
    scanAudioCtx.resume().catch(() => {});
  }
  return scanAudioCtx;
}

// Phát 1 mẫu âm theo outcome ('match' | 'notfound' | 'duplicate').
// Best-effort: lỗi (không có AudioContext, trình duyệt chặn) thì bỏ qua,
// không làm hỏng luồng quét.
function playScanSound(outcome) {
  try {
    const ctx = getScanAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const tone of getScanSoundPattern(outcome)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = tone.frequency;
      const start = now + (tone.delay || 0);
      const dur = tone.duration || 0.08;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    }
  } catch {
    // Âm thanh chỉ là phản hồi phụ — lỗi thì im lặng.
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
  // Tập riêng cho mục hợp nhất "Cần check tay": tải độc lập, không phụ
  // thuộc bộ lọc trang (không lọc sàn/shop/tìm kiếm); mặc định chỉ tải
  // đơn tạo trong 30 ngày gần nhất (xem uniCrtFrom/uniCrtTo bên dưới).
  const [checkRows, setCheckRows] = useState([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState('');
  // Số thứ tự lần tải checkRows: lần tải cũ về sau thì bỏ kết quả (đổi
  // ô ngày liên tiếp sẽ chạy nhiều lần tải chồng nhau).
  const checkFetchSeq = useRef(0);
  // Đơn hoàn 1 phần (type 16) + kiểm nhận tay.
  const [partialRows, setPartialRows] = useState([]);
  const [partialMissing, setPartialMissing] = useState(false);
  const [manualChecks, setManualChecks] = useState(new Map());
  const [manualMissing, setManualMissing] = useState(false);
  // Trạng thái đơn gốc cho danh sách "Cần check tay" (quy tắc 4) — cache
  // theo ID đơn Nhanh và theo mã đơn sàn gốc; lỗi tra thì bỏ qua quy tắc 4.
  const [origStatusById, setOrigStatusById] = useState(new Map());
  const [origStatusByEcom, setOrigStatusByEcom] = useState(new Map());
  const [origStatusError, setOrigStatusError] = useState(false);
  // --- Phân trang từng nhóm (client-side, trên tập đã lọc đủ) ---
  const [pageCho, setPageCho] = useState(1);
  // --- Mục hợp nhất "Cần check tay": phân trang + bộ lọc riêng ---
  const [pageUnified, setPageUnified] = useState(1);
  const [uniSearch, setUniSearch] = useState('');
  const [uniPlatform, setUniPlatform] = useState('');
  const [uniShop, setUniShop] = useState('');
  const [uniProduct, setUniProduct] = useState('');
  const [uniStatus, setUniStatus] = useState('');
  const [uniTick, setUniTick] = useState('');
  // Khoảng ngày tạo của mục: mặc định 30 ngày gần nhất; người dùng nới
  // rộng ô ngày để tải thêm đơn cũ hơn (tải lại theo khoảng này).
  const [uniCrtFrom, setUniCrtFrom] = useState(() => addDaysStr(vnTodayStr(), -30));
  const [uniCrtTo, setUniCrtTo] = useState(() => vnTodayStr());
  const [uniMoneyMin, setUniMoneyMin] = useState('');
  const [uniMoneyMax, setUniMoneyMax] = useState('');
  // Tick hàng loạt trong mục hợp nhất (chỉ owner): tập return_id đã chọn.
  const [selectedUnified, setSelectedUnified] = useState(new Set());
  const [bulkTickSaving, setBulkTickSaving] = useState(false);
  const [bulkTickMsg, setBulkTickMsg] = useState('');
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
  // Đơn đã check trong ngày hôm nay (theo bảng lịch sử kiểm nhận) — để
  // bỏ khỏi popup đối chiếu, khỏi check đi check lại. Sang hôm sau đơn
  // Chưa nhận lại hiện để check tiếp; Đã nhận thì ẩn hẳn như cũ.
  const [checkedTodayIds, setCheckedTodayIds] = useState(new Set());
  // --- Upload Excel cho mục "Đối chiếu" (thay cho dán tay) ---
  const [excelUpload, setExcelUpload] = useState(null); // { rows, fileName } | null
  // --- Quét nhận hàng (tab riêng trong popup đối chiếu) ---
  const [scanExpected, setScanExpected] = useState([]);
  const [scanLoaded, setScanLoaded] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanSession, setScanSession] = useState(new Map()); // code -> { kind, label }
  const [scanRecent, setScanRecent] = useState([]); // [{ code, kind, label }] mới nhất trước, tối đa 20
  const [scanInput, setScanInput] = useState('');
  const [scanFlash, setScanFlash] = useState(null); // { kind: 'ok'|'dup'|'nomatch'|'err', msg }
  const [scanPasteText, setScanPasteText] = useState('');
  const [scanPasteMsg, setScanPasteMsg] = useState('');
  const [scanBatchId, setScanBatchId] = useState('');
  const [scanOnlyUnscanned, setScanOnlyUnscanned] = useState(true);
  const [scanPage, setScanPage] = useState(1);
  // Giao diện quét-ưu-tiên: danh sách chờ quét ẩn sau nút bấm (mặc định đóng).
  const [scanShowList, setScanShowList] = useState(false);
  // Bật/tắt âm thanh quét (mặc định Bật), lưu localStorage 'wms_scan_sound'
  // ('1' = bật, '0' = tắt). Chỉ áp dụng cho tab quét trang này.
  const [scanSoundEnabled, setScanSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('wms_scan_sound') !== '0';
    } catch {
      return true;
    }
  });
  function toggleScanSound() {
    setScanSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('wms_scan_sound', next ? '1' : '0');
      } catch {
        // localStorage lỗi thì chỉ đổi trong phiên.
      }
      return next;
    });
  }
  // Mã đơn trả đã quét hôm nay (nguồn 'quet' trong lịch sử + quét trong
  // phiên này) — đếm "Đã quét hôm nay", lỗi tải thì chỉ đếm trong phiên.
  const [scannedTodayIds, setScannedTodayIds] = useState(new Set());
  const [scannedTodayLoaded, setScannedTodayLoaded] = useState(false);
  const scanInputRef = useRef(null);

  const filters = applied || { updFrom, updTo, crtFrom, crtTo, platform, shop, search };

  // Lọc gốc của báo cáo (áp dụng cho cả đếm + tải đủ tập):
  // có mã đơn trả thật (đầu SHOPEE/SPX/VNGH/VTP/EA/379/G/8/1) + trạng thái Nhanh Đã hoàn tiền (1)
  // hoặc Đang hoàn tiền (5); đơn hủy đã loại.
  function applyBaseFilters(query, f) {
    query = query.not('return_tracking_number', 'is', null).neq('return_tracking_number', '');
    query = query.in('nhanh_status_id', [1, 5]);
    query = query.or('return_tracking_number.ilike.SHOPEE%,return_tracking_number.ilike.SPX%,return_tracking_number.ilike.VNGH%,return_tracking_number.ilike.VTP%,return_tracking_number.ilike.EA%,return_tracking_number.ilike.379%,return_tracking_number.ilike.G%,return_tracking_number.ilike.8%,return_tracking_number.ilike.1%');
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

  // Tải tập riêng cho mục hợp nhất "Cần check tay": đơn trả có mã đơn
  // trả thật + trạng thái Nhanh Đã hoàn tiền (1) / Đang hoàn tiền (5),
  // lọc server-side theo ngày tạo (crtFrom/crtTo, mặc định 30 ngày gần
  // nhất; rỗng = không giới hạn đầu đó). KHÔNG lọc sàn/shop/tìm kiếm.
  // Lọc mã thật 2 lớp: or ilike theo đầu mã ở server + isReturnCode ở
  // client. Lỗi -> ghi chú mờ trong mục, không sập trang.
  async function fetchCheckRows(crtFrom, crtTo) {
    const seq = ++checkFetchSeq.current;
    setCheckLoading(true);
    setCheckError('');
    try {
      let all = [];
      let from = 0;
      const STEP = 1000;
      for (;;) {
        let q = supabase
          .from('ecom_return_orders')
          .select('*')
          .in('nhanh_status_id', [1, 5])
          .not('return_tracking_number', 'is', null)
          .neq('return_tracking_number', '')
          .or('return_tracking_number.ilike.SHOPEE%,return_tracking_number.ilike.SPX%,return_tracking_number.ilike.VNGH%,return_tracking_number.ilike.VTP%,return_tracking_number.ilike.EA%,return_tracking_number.ilike.379%,return_tracking_number.ilike.G%,return_tracking_number.ilike.8%,return_tracking_number.ilike.1%');
        if (crtFrom) q = q.gte('return_created_at', `${crtFrom}T00:00:00+07:00`);
        if (crtTo) q = q.lt('return_created_at', `${addDaysStr(crtTo, 1)}T00:00:00+07:00`);
        const { data, error: err } = await q
          .order('return_updated_at', { ascending: false })
          .range(from, from + STEP - 1);
        if (err) throw err;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        from += data.length;
        if (data.length < STEP) break;
      }
      if (seq !== checkFetchSeq.current) return; // có lần tải mới hơn, bỏ kết quả cũ
      setCheckRows(all.filter((r) => isReturnCode(r.return_tracking_number)));
    } catch (e) {
      if (seq !== checkFetchSeq.current) return;
      setCheckError('Lỗi tải danh sách cần check tay: ' + (e.message || e));
      setCheckRows([]);
    } finally {
      if (seq === checkFetchSeq.current) setCheckLoading(false);
    }
  }

  useEffect(() => {
    fetchAll(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  // Tải lại tập "Cần check tay" khi đổi khoảng ngày tạo của mục (mặc
  // định 30 ngày gần nhất; nới rộng ô ngày để tải thêm đơn cũ hơn).
  useEffect(() => {
    fetchCheckRows(uniCrtFrom, uniCrtTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniCrtFrom, uniCrtTo]);

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

  // Nạp đơn hoàn 1 phần (type 16, bảng riêng partial_return_orders) +
  // bảng kiểm nhận tay (1 lần lúc mở trang). Bảng chưa có (migration chạy
  // trước khi go-live) thì trang vẫn chạy bình thường với danh sách rỗng +
  // ghi chú nhỏ, không sập trang.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('partial_return_orders')
          .select('id, original_order_id, original_ecom_order_id');
        if (err) throw err;
        if (alive) { setPartialRows(data || []); setPartialMissing(false); }
      } catch (e) {
        console.error('Lỗi nạp đơn hoàn 1 phần:', e);
        if (alive) {
          setPartialRows([]);
          setPartialMissing(true);
        }
      }
      try {
        // select('*') nên cột carrier_status (migration 20261110) tự về
        // cùng received_status/received_date khi cột đã có; chưa chạy
        // migration thì các dòng chỉ thiếu carrier_status (hiển thị trống).
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
    setPageCho(1);
    setApplied({ updFrom, updTo, crtFrom, crtTo, platform, shop, search });
  }

  // --- Ghép nối đơn hoàn 1 phần (trong bộ nhớ, đọc cột index sẵn) ---
  const partialOriginalIds = useMemo(() => {
    const s = new Set();
    for (const p of partialRows) {
      const id = p.original_order_id;
      if (id !== null && id !== undefined && String(id).trim() !== '') s.add(String(id));
    }
    return s;
  }, [partialRows]);
  const partialAppOrderIdsNoR = useMemo(() => {
    const s = new Set();
    for (const p of partialRows) {
      const a = p.original_ecom_order_id;
      if (a !== null && a !== undefined && String(a).trim() !== '') s.add(stripTrailingR(a));
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

  // "Đã nhập kho" = có đơn hoàn 1 phần -> loại khỏi danh sách chờ, chỉ đếm tổng.
  // "Đang chờ hàng về" (isWaitingRow): có mã trả thật + tuổi <= 4 ngày
  // (tuổi null cũng chờ) + chưa có xác nhận nhận thật. Đơn đã nhận, đơn
  // không có mã thật, đơn quá 4 ngày (thuộc "Cần check tay") đều không
  // nằm ở đây — xem isWaitingRow / needCheckOf ở đầu file.
  const groups = useMemo(() => {
    const today = vnTodayStr();
    const cho = [];
    const daNhap = [];
    for (const r of allRows) {
      if (hasPartial(r)) { daNhap.push(r); continue; }
      if (isWaitingRow(r, manualChecks, today)) cho.push(r);
    }
    return { cho, daNhap };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, manualChecks, partialOriginalIds, partialAppOrderIdsNoR]);

  const sumMoney = (rows) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // Deps chung cho vị từ danh sách "Cần check tay" (dùng ở danh sách, Excel, ...).
  function unifiedDeps() {
    return {
      hasPartialFn: hasPartial,
      manualChecks,
      todayStr: vnTodayStr(),
      origStatusById,
      origStatusByEcom,
    };
  }

  // --- Mục "Cần check tay" (trên tập tải riêng checkRows) ---
  // Ứng viên để tra trạng thái đơn gốc (quy tắc v): đủ các điều kiện
  // (i)-(iv) của needCheckBaseOf — tức là chỉ còn chờ kiểm tra đơn gốc
  // có ở 72 không. Dẫn xuất từ cùng manualChecks + tập đơn 1 phần như
  // các nhóm khác nên quét / sửa tay xong là đơn tự biến khỏi danh sách,
  // không cần tải lại trang.
  const needCheckCandidates = useMemo(() => {
    const today = vnTodayStr();
    return checkRows.filter((r) => needCheckBaseOf(r, { hasPartialFn: hasPartial, manualChecks, todayStr: today }).pass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkRows, manualChecks, partialOriginalIds, partialAppOrderIdsNoR]);

  // Tra trạng thái đơn gốc cho ứng viên (quy tắc v: loại khi đơn gốc ở 72).
  // Chỉ tra những đơn chưa có trong cache (chia lô 100); lỗi -> bỏ qua
  // quy tắc v (giữ luật (i)-(iv)) và hiện ghi chú, không sập trang.
  useEffect(() => {
    let cancelled = false;
    const needIds = new Set();
    const needEcoms = new Set();
    for (const row of needCheckCandidates) {
      const nid = row?.raw_data?.nhanhOrderId;
      if (nid !== null && nid !== undefined && nid !== '' && !origStatusById.has(String(nid))) needIds.add(String(nid));
      const oid = row?.original_ecom_order_id;
      if (oid && !origStatusByEcom.has(String(oid))) needEcoms.add(String(oid));
    }
    if (needIds.size === 0 && needEcoms.size === 0) return;
    const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
    (async () => {
      try {
        const byId = new Map();
        const byEcom = new Map();
        const absorb = (rows) => {
          for (const o of rows || []) {
            byId.set(String(o.id), o.status);
            if (o.ecom_order_id !== null && o.ecom_order_id !== undefined && String(o.ecom_order_id) !== '') byEcom.set(String(o.ecom_order_id), o.status);
          }
        };
        for (const part of chunk([...needIds], 100)) {
          const { data, error } = await supabase.from('orders').select('id,status,ecom_order_id').in('id', part);
          if (error) throw error;
          absorb(data);
        }
        for (const part of chunk([...needEcoms], 100)) {
          const { data, error } = await supabase.from('orders').select('id,status,ecom_order_id').in('ecom_order_id', part);
          if (error) throw error;
          absorb(data);
        }
        if (cancelled) return;
        setOrigStatusById((prev) => new Map([...prev, ...byId]));
        setOrigStatusByEcom((prev) => new Map([...prev, ...byEcom]));
        setOrigStatusError(false);
      } catch (e) {
        console.error('Lỗi tra trạng thái đơn gốc:', e);
        if (!cancelled) setOrigStatusError(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needCheckCandidates]);

  // Danh sách "Cần check tay" cuối: 1 lần lọc qua vị từ thuần nên mỗi
  // đơn xuất hiện tối đa 1 lần. Kèm tuổi để hiển thị.
  const unifiedList = useMemo(() => {
    const deps = unifiedDeps();
    const out = [];
    for (const r of checkRows) {
      const { pass, age } = needCheckOf(r, deps);
      if (pass) out.push({ row: r, age });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkRows, manualChecks, partialOriginalIds, partialAppOrderIdsNoR, origStatusById, origStatusByEcom]);

  const summary = useMemo(() => ({
    totalMoney: sumMoney(allRows),
    daNhapMoney: sumMoney(groups.daNhap),
    unifiedMoney: sumMoney(unifiedList.map((x) => x.row)),
    choMoney: sumMoney(groups.cho),
  }), [allRows, groups, unifiedList]);

  const totalPagesCho = Math.max(1, Math.ceil(groups.cho.length / PAGE_SIZE));
  const safePageCho = Math.min(pageCho, totalPagesCho);
  const totalPagesUnified = Math.max(1, Math.ceil(unifiedList.length / PAGE_SIZE));
  const safePageUnified = Math.min(pageUnified, totalPagesUnified);

  // --- Bộ lọc riêng của mục hợp nhất (client-side, trên unifiedList) ---
  // Đổi bất kỳ lọc nào cũng về trang 1 (qua setUniFilter / Xóa lọc).
  function setUniFilter(setter, value) {
    setter(value);
    setPageUnified(1);
  }
  const uniPlatformOptions = useMemo(() => {
    const m = new Map();
    for (const { row } of unifiedList) {
      if (row.platform_id !== null && row.platform_id !== undefined && !m.has(String(row.platform_id))) m.set(String(row.platform_id), row.platform_name || '');
    }
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  }, [unifiedList]);
  const uniShopOptions = useMemo(() => {
    const m = new Map();
    for (const { row } of unifiedList) {
      if (row.shop_id && !m.has(String(row.shop_id))) m.set(String(row.shop_id), row.platform_name || '');
    }
    return [...m.entries()].map(([id, platformName]) => ({ id, platformName })).sort((a, b) => a.id.localeCompare(b.id));
  }, [unifiedList]);
  const uniStatusOptions = useMemo(() => {
    const m = new Map();
    for (const { row } of unifiedList) {
      if (row.nhanh_status_id !== null && row.nhanh_status_id !== undefined && !m.has(String(row.nhanh_status_id))) m.set(String(row.nhanh_status_id), row.nhanh_status_name || NHANH_STATUS_NAMES[row.nhanh_status_id] || '');
    }
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.id.localeCompare(b.id));
  }, [unifiedList]);
  const filteredUnified = useMemo(() => {
    const q = uniSearch.trim().toLowerCase();
    const pq = uniProduct.trim().toLowerCase();
    const min = uniMoneyMin === '' ? null : Number(uniMoneyMin);
    const max = uniMoneyMax === '' ? null : Number(uniMoneyMax);
    return unifiedList.filter(({ row }) => {
      if (q) {
        const hay = [returnCodeOf(row), row.return_tracking_number, row.return_id, row.original_ecom_order_id].map((v) => String(v || '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      if (uniPlatform !== '' && String(row.platform_id) !== uniPlatform) return false;
      if (uniShop !== '' && String(row.shop_id) !== uniShop) return false;
      if (pq) {
        const ok = productsOf(row).some((p) => {
          const mapped = mapReturnProduct(p.name, p.sku, inventoryIndex) || '';
          return [mapped, p.name, p.sku].some((v) => String(v || '').toLowerCase().includes(pq));
        });
        if (!ok) return false;
      }
      if (uniStatus !== '' && String(row.nhanh_status_id) !== uniStatus) return false;
      if (uniTick !== '') {
        const m = manualChecks.get(row.return_id);
        if (uniTick === '__none__') { if (m) return false; }
        else if (m?.received_status !== uniTick) return false;
      }
      if (uniCrtFrom || uniCrtTo) {
        const d = vnDateOf(row.return_created_at);
        if (!d) return false;
        if (uniCrtFrom && d < uniCrtFrom) return false;
        if (uniCrtTo && d > uniCrtTo) return false;
      }
      const amt = Number(row.amount) || 0;
      if (min !== null && !isNaN(min) && amt < min) return false;
      if (max !== null && !isNaN(max) && amt > max) return false;
      return true;
    });
  }, [unifiedList, uniSearch, uniPlatform, uniShop, uniProduct, uniStatus, uniTick, uniCrtFrom, uniCrtTo, uniMoneyMin, uniMoneyMax, manualChecks, inventoryIndex]);
  const totalPagesUnifiedFiltered = Math.max(1, Math.ceil(filteredUnified.length / PAGE_SIZE));
  const safePageUnifiedFiltered = Math.min(safePageUnified, totalPagesUnifiedFiltered);
  const unifiedPageRows = filteredUnified.slice((safePageUnifiedFiltered - 1) * PAGE_SIZE, safePageUnifiedFiltered * PAGE_SIZE);
  function clearUniFilters() {
    setUniSearch(''); setUniPlatform(''); setUniShop(''); setUniProduct('');
    setUniStatus(''); setUniTick('');
    // "Xóa lọc" về lại mặc định: chỉ 30 ngày gần nhất (không để trống = tải hết).
    setUniCrtFrom(addDaysStr(vnTodayStr(), -30)); setUniCrtTo(vnTodayStr());
    setUniMoneyMin(''); setUniMoneyMax(''); setPageUnified(1);
  }

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
    // Phạm vi xuất = tập đã lọc của trang (chưa có đơn hoàn 1 phần);
    // cột Nhóm dùng chung vị từ hợp nhất với mục "Cần check tay".
    const rows = allRows.filter((r) => !hasPartial(r));
    const deps = unifiedDeps();
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
          'Trạng thái hãng': m?.carrier_status || '',
          'Nhóm': hasPartial(r) ? 'Đã nhập kho' : (m?.received_status === 'Đã nhận' ? 'Đã nhận' : (isInNeedCheckList(r, deps) ? 'Cần check tay' : 'Đang chờ hàng về')),
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(rowData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DonHoanChuaNhan');
      XLSX.writeFile(workbook, `unreceived-returns-${vnTodayStr().replaceAll('-', '')}.xlsx`);
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
    // Ngày hàng về chỉ có ý nghĩa khi Đã nhận; các trạng thái khác ép null.
    // (Lưu 'Đã khiếu nại' sẽ lỗi ở DB cho tới khi chạy migration mở rộng
    // CHECK constraint của return_receipt_checks — xem thông báo lỗi.)
    const date = status === 'Đã nhận' ? (d.date || '').trim() : '';
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
        // Giữ carrier_status đã có trong bộ nhớ (upsert chỉ ghi các cột
        // received_*, không chạm tới carrier_status ở DB).
        next.set(row.return_id, { ...(prev.get(row.return_id) || {}), return_id: row.return_id, received_date: date || null, received_status: status });
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

  // --- Tick hàng loạt trong mục "Cần check tay" (chỉ owner) ---
  // Upsert return_receipt_checks cho các đơn đã chọn + 1 lô lịch sử
  // chung (source 'thu_cong', batch_id chung). Ngày = hôm nay (VN) khi
  // Đã nhận, null với các trạng thái khác. Tick Đã nhận gỡ đơn khỏi
  // danh sách ngay (qua manualChecks + tập xác nhận).
  async function handleBulkTick(status) {
    if (selectedUnified.size === 0 || bulkTickSaving) return;
    const ids = [...selectedUnified];
    if (!window.confirm(`Tick ${ids.length} đơn đã chọn thành "${status}"?`)) return;
    setBulkTickSaving(true);
    setBulkTickMsg('');
    try {
      const today = vnTodayStr();
      const payloads = ids.map((id) => ({
        return_id: id,
        received_date: status === 'Đã nhận' ? today : null,
        received_status: status,
        updated_by: userEmail || '',
        updated_at: new Date().toISOString(),
      }));
      const { error: err } = await supabase.from('return_receipt_checks').upsert(payloads, { onConflict: 'return_id' });
      if (err) throw err;
      setManualChecks((prev) => {
        const next = new Map(prev);
        // Giữ carrier_status đã có trong bộ nhớ (upsert chỉ ghi các cột
        // received_*, không chạm tới carrier_status ở DB).
        for (const p of payloads) next.set(p.return_id, { ...(prev.get(p.return_id) || {}), return_id: p.return_id, received_date: p.received_date, received_status: p.received_status });
        return next;
      });
      const batchId = genUuid();
      const byId = new Map(checkRows.map((r) => [String(r.return_id), r]));
      const historyOk = await logCheckHistory(ids.map((id) => {
        const row = byId.get(String(id));
        return {
          return_id: id,
          tracking_number: row ? (returnCodeOf(row) || row.return_tracking_number || null) : null,
          shipment_status: null,
          received_status: status,
          received_date: status === 'Đã nhận' ? today : null,
          source: 'thu_cong',
          batch_id: batchId,
        };
      }), userEmail);
      if (!historyOk) setHistoryWarn('Không lưu được lịch sử — chạy migration bảng lịch sử trước.');
      setSelectedUnified(new Set());
      setBulkTickMsg(`Đã tick ${ids.length} đơn thành "${status}".`);
    } catch (e) {
      setBulkTickMsg('Lỗi tick hàng loạt: ' + (e.message || e) + ' (tick "Đã khiếu nại" cần chạy migration mở rộng CHECK constraint trước).');
    } finally {
      setBulkTickSaving(false);
    }
  }

  // --- Đối chiếu hàng loạt (chỉ owner) ---
  // Toàn bộ tập chưa nhận theo bộ lọc (chưa có đơn hoàn 1 phần), giữ đúng thứ tự
  // return_updated_at desc như bảng (allRows đã xếp sẵn khi tải).
  // Chỉ đơn chưa có trạng thái cuối mới hiện trong popup đối chiếu: đơn
  // Đã nhận (và đơn đã có đơn hoàn 1 phần) bị loại khỏi danh sách — xong
  // là biến mất. Thêm nữa: đơn nào hôm nay đã check rồi (có dòng trong
  // bảng lịch sử từ 00:00 VN hôm nay) cũng bỏ qua luôn, khỏi check đi
  // check lại; sang hôm sau đơn Chưa hoàn lại hiện để check tiếp.
  const bulkRows = useMemo(
    () => allRows.filter((r) => !hasPartial(r) && manualChecks.get(r.return_id)?.received_status !== 'Đã nhận' && !checkedTodayIds.has(r.return_id)),
    [allRows, manualChecks, partialOriginalIds, partialAppOrderIdsNoR, checkedTodayIds]
  );
  // Nhóm TOÀN BỘ danh sách chưa nhận theo hãng (thứ tự SPX, J&T, GHN,
  // GHTK, Viettel Post, Hãng khác; chỉ hãng nào có đơn mới hiện). Không
  // phân trang nữa — hiển thị hết 1 loạt, mỗi hãng copy 20 hoặc 40 mã
  // 1 lần; đơn vừa kiểm xong biến mất khỏi danh sách nên lần copy sau
  // tự lấy tiếp 20/40 mã tiếp theo.
  const bulkCarriers = useMemo(() => {
    const map = new Map();
    for (const r of bulkRows) {
      const name = carrierOf(returnCodeOf(r) || r.return_tracking_number || '');
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(r);
    }
    const order = ['SPX (Shopee Express)', 'J&T Express', 'GHN', 'GHTK', 'Viettel Post', 'VNPost', 'Hãng khác'];
    return order.filter((n) => map.has(n)).map((n) => ({ name: n, rows: map.get(n) }));
  }, [bulkRows]);

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
    setBulkTab('doi-chieu');
    setPasteText('');
    setBulkPreview(null);
    setBulkMsg('');
    setBulkError('');
    setExcelUpload(null);
    // Phiên quét mới: batch_id mới cho lịch sử, trạng thái phiên quét reset.
    setScanBatchId(genUuid());
    setScanSession(new Map());
    setScanRecent([]);
    setScanLoaded(false);
    setScanExpected([]);
    setScanError('');
    setScanFlash(null);
    setScanInput('');
    setScanPasteText('');
    setScanPasteMsg('');
    setScanOnlyUnscanned(true);
    setScanPage(1);
    setScanShowList(false);
    setScannedTodayIds(new Set());
    setScannedTodayLoaded(false);
    fetchCheckedToday();
    setShowBulk(true);
  }
  function closeBulk() {
    setShowBulk(false);
    setBulkPreview(null);
    setBulkMsg('');
    setBulkError('');
  }

  // Đơn đã check trong ngày hôm nay (lấy từ bảng lịch sử kiểm nhận,
  // checked_at từ 00:00 VN hôm nay). Bảng chưa tạo thì coi như chưa có
  // đơn nào đã check — không sập popup. Sửa tay từng dòng cũng ghi lịch
  // sử nên cũng tính là "đã check hôm nay" khi mở popup lần sau.
  async function fetchCheckedToday() {
    try {
      const todayStart = `${vnTodayStr()}T00:00:00+07:00`;
      const { data, error } = await supabase
        .from('return_receipt_check_history')
        .select('return_id')
        .gte('checked_at', todayStart)
        .limit(5000);
      if (error) throw error;
      setCheckedTodayIds(new Set((data || []).map((r) => r.return_id).filter(Boolean)));
    } catch (e) {
      console.error('Lỗi tải danh sách đã kiểm hôm nay:', e);
      setCheckedTodayIds(new Set());
    }
  }

  // Mã đơn trả đã quét hôm nay (nguồn 'quet' trong lịch sử, từ 00:00 VN
  // hôm nay). Gộp với quét trong phiên (đã có trong tập) để số đếm tăng
  // ngay khi quét; lỗi tải thì chỉ đếm trong phiên, không sập popup.
  async function fetchScannedToday() {
    try {
      const todayStart = `${vnTodayStr()}T00:00:00+07:00`;
      const { data, error } = await supabase
        .from('return_receipt_check_history')
        .select('return_id')
        .eq('source', 'quet')
        .gte('checked_at', todayStart)
        .limit(5000);
      if (error) throw error;
      const fetched = new Set((data || []).map((r) => String(r.return_id)).filter(Boolean));
      setScannedTodayIds((prev) => new Set([...prev, ...fetched]));
    } catch (e) {
      console.error('Lỗi tải số đơn đã quét hôm nay:', e);
    }
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
  // Tab "Quét nhận hàng": tải lười danh sách chờ quét + số đơn đã quét
  // hôm nay + focus ô bắn mã. Danh sách chờ vẫn tải khi mở tab (quét cần
  // nó để khớp mã), chỉ là ẩn khỏi giao diện cho tới khi bấm xem.
  useEffect(() => {
    if (showBulk && bulkTab === 'quet-nhan') {
      if (!scanLoaded && !scanLoading) fetchScanExpected();
      if (!scannedTodayLoaded) { setScannedTodayLoaded(true); fetchScannedToday(); }
      setTimeout(() => { if (scanInputRef.current) scanInputRef.current.focus(); }, 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBulk, bulkTab]);

  // --- Quét nhận hàng: danh sách chờ, xử lý mã quét, upload Excel ---
  // Mã -> item chờ quét (1 mã có thể vừa là mã trả vừa là mã đơn 71/74).
  const scanMap = useMemo(() => {
    const m = new Map();
    for (const it of scanExpected) m.set(it.code, it);
    return m;
  }, [scanExpected]);
  // "Đã nhận" = đơn trả đã có kiểm tay Đã nhận, hoặc đã quét trong phiên này.
  function scanItemReceived(it) {
    if (!it) return false;
    if (it.returnRow && manualChecks.get(it.returnRow.return_id)?.received_status === 'Đã nhận') return true;
    return scanSession.has(it.code);
  }
  const scanStats = useMemo(() => {
    const done = scanExpected.filter((it) => scanItemReceived(it)).length;
    return { done, total: scanExpected.length, left: scanExpected.length - done };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanExpected, scanSession, manualChecks]);
  const scanVisible = useMemo(() => {
    const list = scanOnlyUnscanned ? scanExpected.filter((it) => !scanItemReceived(it)) : scanExpected;
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanExpected, scanOnlyUnscanned, scanSession, manualChecks]);
  const SCAN_PAGE_SIZE = 50;
  const scanTotalPages = Math.max(1, Math.ceil(scanVisible.length / SCAN_PAGE_SIZE));
  const safeScanPage = Math.min(scanPage, scanTotalPages);
  const scanPageRows = scanVisible.slice((safeScanPage - 1) * SCAN_PAGE_SIZE, safeScanPage * SCAN_PAGE_SIZE);

  // Danh sách chờ quét nhận hàng: (a) đơn trả có mã vận đơn thật, trạng
  // thái Nhanh 1/2/5 (kể cả Đang xử lý — đang chờ hàng về thì vẫn quét
  // được); (b) đơn Nhanh ở trạng thái Đang chuyển hoàn (71) / Xác nhận
  // hoàn (74) có mã vận đơn thật (mã không phải dạng NVN giả của GHN).
  // Không lọc theo ngày: quét là việc nhận hàng thực tế, danh sách chờ
  // là toàn bộ đơn đang chờ về kho.
  async function fetchScanExpected() {
    setScanLoading(true);
    setScanError('');
    try {
      const STEP = 1000;
      let retRows = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from('ecom_return_orders')
          .select('return_id,return_tracking_number,platform_name,shop_id,nhanh_status_id,nhanh_status_name,original_ecom_order_id')
          .in('nhanh_status_id', [1, 2, 5])
          .not('return_tracking_number', 'is', null)
          .neq('return_tracking_number', '')
          .order('return_updated_at', { ascending: false })
          .range(from, from + STEP - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        retRows = retRows.concat(data);
        from += data.length;
        if (data.length < STEP) break;
      }
      let ordRows = [];
      from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from('orders')
          .select('id,carrier_code,carrier_name,status,sale_channel,updated_at')
          .in('status', [71, 74])
          .not('carrier_code', 'is', null)
          .neq('carrier_code', '')
          .order('updated_at', { ascending: false })
          .range(from, from + STEP - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        ordRows = ordRows.concat(data);
        from += data.length;
        if (data.length < STEP) break;
      }
      const map = new Map();
      for (const r of retRows) {
        const code = returnCodeOf(r);
        if (!code) continue;
        const key = code.trim().toUpperCase();
        if (!map.has(key)) map.set(key, { code: key, returnRow: null, orderRow: null });
        if (!map.get(key).returnRow) map.get(key).returnRow = r;
      }
      for (const o of ordRows) {
        const code = String(o.carrier_code || '').trim().toUpperCase();
        if (!code || code.startsWith('NVN')) continue;
        if (!map.has(code)) map.set(code, { code, returnRow: null, orderRow: null });
        if (!map.get(code).orderRow) map.get(code).orderRow = o;
      }
      setScanExpected([...map.values()]);
      setScanLoaded(true);
    } catch (e) {
      console.error('Lỗi tải danh sách chờ quét:', e);
      setScanError('Lỗi tải danh sách chờ quét: ' + (e.message || e));
    } finally {
      setScanLoading(false);
    }
  }

  function pushScanRecent(entry) {
    setScanRecent((prev) => [entry, ...prev].slice(0, 20));
  }

  // Xử lý 1 mã quét (súng bắn mã gõ mã + Enter, hoặc dán từng dòng).
  // Có đơn trả -> lưu ngay kiểm nhận tay Đã nhận (ngày = hôm nay) + lịch
  // sử nguồn 'quet'. Chỉ có đơn 71/74 (không có đơn trả) thì chỉ ghi
  // nhận trong phiên, không có bảng nào để ghi. Trả về { kind, msg } để
  // hiện phản hồi ngay dưới ô nhập.
  // Âm thanh: options.silent = true (đường dán danh sách) thì KHÔNG phát
  // tiếng nào; quét lẻ từ ô nhập thì phát theo kết quả — 'ok' (cả đơn trả
  // lẫn đơn 71/74-only) -> match, 'dup' -> duplicate, 'nomatch'/'err'
  // (lưu lỗi) -> notfound. Tắt tiếng (scanSoundEnabled = false) thì im.
  async function processScanCode(rawCode, options = {}) {
    const silent = options.silent === true;
    const playOutcome = (kind) => {
      if (silent || !scanSoundEnabled) return;
      if (kind === 'ok') playScanSound('match');
      else if (kind === 'dup') playScanSound('duplicate');
      else if (kind === 'nomatch' || kind === 'err') playScanSound('notfound');
    };
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return { kind: 'err', msg: 'Mã trống.' };
    const it = scanMap.get(code);
    if (!it) {
      pushScanRecent({ code, kind: 'nomatch', label: 'Không khớp' });
      playOutcome('nomatch');
      return { kind: 'nomatch', msg: `${code}: không khớp với đơn nào trong danh sách chờ quét.` };
    }
    if (scanSession.has(code)) {
      playOutcome('dup');
      return { kind: 'dup', msg: `${code}: đã quét rồi trong phiên này.` };
    }
    if (it.returnRow && manualChecks.get(it.returnRow.return_id)?.received_status === 'Đã nhận') {
      pushScanRecent({ code, kind: 'dup', label: 'Đã nhận từ trước' });
      playOutcome('dup');
      return { kind: 'dup', msg: `${code}: đơn này đã có trạng thái Đã nhận từ trước.` };
    }
    if (it.returnRow) {
      try {
        const today = vnTodayStr();
        const payload = {
          return_id: it.returnRow.return_id,
          received_date: today,
          received_status: 'Đã nhận',
          updated_by: userEmail || '',
          updated_at: new Date().toISOString(),
        };
        const { error: err } = await supabase.from('return_receipt_checks').upsert(payload, { onConflict: 'return_id' });
        if (err) throw err;
        setManualChecks((prev) => {
          const next = new Map(prev);
          // Giữ carrier_status đã có trong bộ nhớ (upsert chỉ ghi các cột
          // received_*, không chạm tới carrier_status ở DB).
          next.set(payload.return_id, { ...(prev.get(payload.return_id) || {}), return_id: payload.return_id, received_date: today, received_status: 'Đã nhận' });
          return next;
        });
        setCheckedTodayIds((prev) => {
          const next = new Set(prev);
          next.add(payload.return_id);
          return next;
        });
        // Quét trong phiên này cũng tính vào "Đã quét hôm nay".
        setScannedTodayIds((prev) => {
          const next = new Set(prev);
          next.add(String(payload.return_id));
          return next;
        });
        const historyOk = await logCheckHistory([{
          return_id: it.returnRow.return_id,
          tracking_number: code,
          shipment_status: 'Đã quét',
          received_status: 'Đã nhận',
          received_date: today,
          source: 'quet',
          batch_id: scanBatchId || null,
        }], userEmail);
        if (!historyOk) setHistoryWarn('Không lưu được lịch sử — chạy migration bảng lịch sử trước.');
      } catch (e) {
        console.error('Lỗi lưu quét nhận hàng:', e);
        playOutcome('err');
        return { kind: 'err', msg: `${code}: lỗi lưu — ${e.message || e}` };
      }
      setScanSession((prev) => new Map(prev).set(code, { kind: 'return', label: 'Đã nhận hàng hoàn' }));
      pushScanRecent({ code, kind: 'return', label: 'Đã nhận hàng hoàn' });
      playOutcome('ok');
      return { kind: 'ok', msg: `${code}: đã nhận hàng hoàn.` };
    }
    setScanSession((prev) => new Map(prev).set(code, { kind: 'order-only', label: 'Đã quét — không có đơn trả' }));
    pushScanRecent({ code, kind: 'order-only', label: 'Đã quét — không có đơn trả' });
    playOutcome('ok');
    return { kind: 'ok', msg: `${code}: đã quét (đơn 71/74, không có đơn trả nên không ghi kiểm nhận).` };
  }

  async function handleScanEnter() {
    const code = scanInput.trim();
    if (!code) return;
    setScanInput('');
    const res = await processScanCode(code);
    setScanFlash(res);
    if (scanInputRef.current) scanInputRef.current.focus();
  }

  async function handleScanPaste() {
    const codes = scanPasteText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (codes.length === 0) { setScanPasteMsg('Dán danh sách mã (1 mã 1 dòng) trước.'); return; }
    setScanPasteMsg(`Đang xử lý ${codes.length} mã...`);
    let ok = 0; let dup = 0; let nomatch = 0; let err = 0;
    const seen = new Set();
    for (const c of codes) {
      const key = c.toUpperCase();
      if (seen.has(key)) { dup++; continue; }
      seen.add(key);
      const res = await processScanCode(c, { silent: true });
      if (res.kind === 'ok') ok++;
      else if (res.kind === 'dup') dup++;
      else if (res.kind === 'nomatch') nomatch++;
      else err++;
    }
    setScanPasteMsg(`Đã xử lý ${codes.length} mã: ${ok} đã nhận, ${dup} đã quét rồi, ${nomatch} không khớp${err > 0 ? `, ${err} lỗi` : ''}.`);
    setScanPasteText('');
    if (scanInputRef.current) scanInputRef.current.focus();
  }

  // Tải file Excel đối chiếu (2 cột Mã vận đơn / Trạng thái) — thay thế
  // đoạn dán tay, cùng đi qua 1 luồng xem trước -> xác nhận.
  async function handleExcelUpload(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBulkError('');
    setBulkMsg('');
    try {
      const XLSX = await import('xlsx');
      // CSV phải đọc dạng text (UTF-8) thì tiếng Việt mới không bị vỡ chữ;
      // xlsx/xls đọc dạng array buffer.
      const wb = /\.csv$/i.test(file.name)
        ? XLSX.read(await file.text(), { type: 'string' })
        : XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('File không có sheet nào.');
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      const rows = parseExcelAoa(aoa);
      if (rows.length === 0) {
        setExcelUpload(null);
        setBulkError('Không đọc được mã nào trong file — kiểm tra file có đúng 2 cột "Mã vận đơn" và "Trạng thái" không (dòng đầu có thể là tiêu đề hoặc dữ liệu).');
        return;
      }
      setExcelUpload({ rows, fileName: file.name });
      setPasteText('');
      setBulkPreview(null);
      setBulkMsg(`Đã tải file ${file.name}: ${rows.length} mã. Bấm "Cập nhật trạng thái" để xem trước.`);
    } catch (err) {
      console.error('Lỗi đọc file Excel:', err);
      setExcelUpload(null);
      setBulkError('Lỗi đọc file Excel: ' + (err.message || err));
    }
  }

  // File Excel mẫu 2 cột để kho điền theo đúng form thống nhất.
  async function downloadExcelTemplate() {
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([
        ['Mã vận đơn', 'Trạng thái'],
        ['SPXVN00000000000A', 'Đã giao'],
        ['SPXVN00000000000B', 'Đang giao'],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DoiChieu');
      XLSX.writeFile(wb, 'mau-doi-chieu-van-don.xlsx');
    } catch (err) {
      console.error('Lỗi tạo form mẫu:', err);
      setBulkError('Lỗi tạo form mẫu: ' + (err.message || err));
    }
  }

  // Đọc đoạn dán -> xem trước (chưa ghi gì cả). Khớp theo mã vận đơn
  // (trim + uppercase 2 bên) với TOÀN BỘ tập chưa nhận, không chỉ trang này.
  function handleBulkPreview() {
    setBulkMsg('');
    setBulkError('');
    // Nguồn đang dùng: file Excel (nếu đã tải và ô dán đang trống) hoặc đoạn dán tay.
    let parsed;
    let pasteSource;
    if (excelUpload && !pasteText.trim()) {
      parsed = excelUpload.rows;
      pasteSource = 'excel';
    } else {
      if (!pasteText.trim()) {
        setBulkPreview(null);
        setBulkError('Dán kết quả AfterShip / 17Track vào ô trước, hoặc tải file Excel.');
        return;
      }
      ({ rows: parsed, source: pasteSource } = parseCarrierText(pasteText));
    }
    if (parsed.length === 0) {
      setBulkPreview(null);
      setBulkError('Không đọc được mã vận đơn nào — kiểm tra lại định dạng AfterShip / 17Track hoặc file Excel.');
      return;
    }
    const byCode = new Map();
    for (const r of bulkRows) {
      const code = String(returnCodeOf(r) || r.return_tracking_number || '').trim().toUpperCase();
      if (code && !byCode.has(code)) byCode.set(code, r);
    }
    // Mã không nằm trong danh sách cần kiểm: phân biệt "đã kiểm rồi"
    // (đơn đã check trong hôm nay hoặc đã có trạng thái cuối Đã nhận)
    // với mã hoàn toàn không khớp với tập đã lọc.
    const byCodeAll = new Map();
    for (const r of allRows) {
      const code = String(returnCodeOf(r) || r.return_tracking_number || '').trim().toUpperCase();
      if (code && !byCodeAll.has(code)) byCodeAll.set(code, r);
    }
    // Mã trùng trong 1 lần dán: lần xuất hiện sau thắng.
    const seen = new Map();
    for (const p of parsed) seen.set(p.tracking.trim().toUpperCase(), p);
    const matched = [];
    const alreadyChecked = [];
    const unmatched = [];
    for (const [, p] of seen) {
      const row = byCode.get(p.tracking.trim().toUpperCase());
      if (row) matched.push({ ...p, row });
      else {
        const anyRow = byCodeAll.get(p.tracking.trim().toUpperCase());
        if (anyRow && (checkedTodayIds.has(anyRow.return_id) || manualChecks.get(anyRow.return_id)?.received_status === 'Đã nhận')) alreadyChecked.push(p);
        else unmatched.push(p);
      }
    }
    setBulkPreview({ matched, alreadyChecked, unmatched, source: pasteSource });
  }

  // Ghi xem trước vào return_receipt_checks — CHỈ trạng thái HÃNG
  // (carrier_status), KHÔNG chạm tới trạng thái nhận (received_status):
  // hãng báo Delivered / "Đã giao" chỉ nghĩa là ship đã trả hàng về,
  // chưa chứng minh chủ shop đã cầm hàng. Chỉ đơn có trong đoạn dán mới
  // bị chạm tới (lần dán mới nhất thắng với những đơn đó); đơn nào không
  // có trong đoạn dán thì để nguyên.
  // - Dòng đã có trong manualChecks: chỉ UPDATE carrier_status (giữ
  //   nguyên received_status/received_date). Gộp theo từng giá trị
  //   carrier_status để chỉ cần tối đa 2 câu update.
  // - Dòng chưa có: INSERT 1 dòng mới với carrier_status đã set,
  //   received_status='Chưa nhận', received_date NULL.
  // Lịch sử vẫn ghi (source aftership/17track/excel/generic, batch_id
  // chung 1 lô, shipment_status = trạng thái hãng thô), nhưng dòng lịch
  // sử ghi received_status = trạng thái nhận HIỆN TẠI (chưa đổi) chứ
  // không phải 'Đã nhận' — vì dán kết quả không đổi trạng thái nhận.
  async function handleBulkConfirm() {
    if (!bulkPreview || bulkPreview.matched.length === 0 || bulkSaving) return;
    setBulkSaving(true);
    setBulkMsg('');
    setBulkError('');
    try {
      const nowIso = new Date().toISOString();
      const items = bulkPreview.matched.map(({ row, tracking, shipStatus, delivered }) => ({
        row,
        tracking,
        shipStatus,
        carrierStatus: carrierStatusOfPaste(delivered),
        // Trạng thái nhận hiện tại (trước khi ghi) — để ghi lịch sử.
        currentReceipt: manualChecks.get(row.return_id)?.received_status || 'Chưa nhận',
        currentReceiptDate: manualChecks.get(row.return_id)?.received_date || null,
      }));
      const existing = items.filter((it) => manualChecks.has(it.row.return_id));
      const fresh = items.filter((it) => !manualChecks.has(it.row.return_id));
      // 1) Dòng đã có: update riêng carrier_status, gộp theo giá trị.
      for (const carrierStatus of ['Đã hoàn', 'Chưa hoàn']) {
        const ids = existing.filter((it) => it.carrierStatus === carrierStatus).map((it) => it.row.return_id);
        if (ids.length === 0) continue;
        const { error: err } = await supabase
          .from('return_receipt_checks')
          .update({ carrier_status: carrierStatus, updated_by: userEmail || '', updated_at: nowIso })
          .in('return_id', ids);
        if (err) throw err;
      }
      // 2) Dòng chưa có: insert mới, nhận mặc định 'Chưa nhận', chưa có ngày về.
      if (fresh.length > 0) {
        const { error: err } = await supabase.from('return_receipt_checks').insert(fresh.map((it) => ({
          return_id: it.row.return_id,
          carrier_status: it.carrierStatus,
          received_status: 'Chưa nhận',
          received_date: null,
          updated_by: userEmail || '',
          updated_at: nowIso,
        })));
        if (err) throw err;
      }
      setManualChecks((prev) => {
        const next = new Map(prev);
        for (const it of items) {
          const old = prev.get(it.row.return_id) || {};
          next.set(it.row.return_id, {
            ...old,
            return_id: it.row.return_id,
            carrier_status: it.carrierStatus,
            // Dòng mới chưa có nhận: mặc định 'Chưa nhận', ngày null.
            received_status: old.received_status || 'Chưa nhận',
            received_date: old.received_date || null,
          });
        }
        return next;
      });
      // Đơn vừa check xong tính là "đã check hôm nay" ngay trong bộ
      // nhớ — biến mất khỏi danh sách dán, trang sau tự đôn lên, không
      // cần tải lại.
      setCheckedTodayIds((prev) => {
        const next = new Set(prev);
        for (const it of items) next.add(it.row.return_id);
        return next;
      });
      const nHoan = items.filter((it) => it.carrierStatus === 'Đã hoàn').length;
      const nChuaHoan = items.length - nHoan;
      // Ghi lịch sử (best-effort): 1 lô dán = 1 batch_id chung cho cả lô.
      const batchId = genUuid();
      const historyOk = await logCheckHistory(items.map((it) => ({
        return_id: it.row.return_id,
        tracking_number: it.tracking || null,
        shipment_status: it.shipStatus || null,
        received_status: it.currentReceipt,
        received_date: it.currentReceiptDate,
        source: bulkPreview.source || 'aftership',
        batch_id: batchId,
      })), userEmail);
      if (historyOk) setHistoryWarn('');
      else setHistoryWarn('Không lưu được lịch sử — chạy migration bảng lịch sử trước.');
      setBulkMsg(`Đã cập nhật trạng thái hãng cho ${items.length} đơn: ${nHoan} hãng đã hoàn, ${nChuaHoan} hãng chưa hoàn. Trạng thái nhận hàng không đổi (chỉ quét/tick mới đổi).${bulkPreview.unmatched.length > 0 ? ` ${bulkPreview.unmatched.length} mã không khớp.` : ''}${(bulkPreview.alreadyChecked?.length || 0) > 0 ? ` ${bulkPreview.alreadyChecked.length} mã đã kiểm rồi.` : ''}`);
      setBulkPreview(null);
      setPasteText('');
      setExcelUpload(null);
    } catch (e) {
      setBulkError('Lỗi cập nhật: ' + (e.message || e));
    } finally {
      setBulkSaving(false);
    }
  }

  function renderRow(r, ageDays, opts = {}) {
    const prods = productsOf(r);
    // Checkbox tick hàng loạt: chỉ mục hợp nhất truyền opts.selectable
    // (owner-only); checkbox nằm trong ô mã vận đơn để giữ nguyên 11 cột.
    const selectable = !!opts.selectable;
    const checked = !!opts.checked;
    const onToggle = opts.onToggle || null;
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
          {selectable && isOwner && (
            <input type="checkbox" checked={checked} onChange={(e) => onToggle && onToggle(r.return_id, e.target.checked)} className="w-4 h-4 accent-emerald-600 mb-1" aria-label={`Chọn đơn ${r.return_id}`} />
          )}
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
          {ageDays !== null && ageDays !== undefined && (
            <div className="mt-1"><span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">Quá {ageDays} ngày</span></div>
          )}
        </td>
        {/* Nhận hàng: trạng thái nhận trên, ngày về dưới, trạng thái hãng
            (Hãng: Đã hoàn / Chưa hoàn) ở dòng cuối — chỉ hiện khi đã có
            carrier_status (dán kết quả mới ghi); chưa dán thì không hiện. */}
        <td className="px-3 py-3.5 min-w-0">
          {m ? (
            <>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${m.received_status === 'Đã nhận' ? 'bg-green-100 text-green-800 border border-green-200' : m.received_status === 'Đã khiếu nại' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>{m.received_status}</span>
              <div className="text-xs text-slate-500 mt-1 whitespace-nowrap">{m.received_date ? fmtDateOnly(m.received_date) : '—'}</div>
              {m.carrier_status ? (
                <div className={`text-xs mt-1 whitespace-nowrap ${m.carrier_status === 'Đã hoàn' ? 'text-emerald-700' : 'text-slate-500'}`}>Hãng: {m.carrier_status}</div>
              ) : null}
            </>
          ) : (<span className="text-slate-400 text-xs">Chưa kiểm</span>)}
        </td>
        <td className="px-3 py-3.5">
          {isOwner ? (editing ? (
            <div className="space-y-1 min-w-[110px]">
              {draft.status === 'Đã nhận' && (
                <input
                  type="date"
                  value={draft.date ?? ''}
                  onChange={(e) => setEditDrafts((prev) => ({ ...prev, [r.return_id]: { ...(prev[r.return_id] || {}), date: e.target.value } }))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-slate-700"
                />
              )}
              <select
                value={draft.status ?? 'Chưa nhận'}
                onChange={(e) => setEditDrafts((prev) => ({ ...prev, [r.return_id]: { ...(prev[r.return_id] || {}), status: e.target.value } }))}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-slate-700 bg-white"
              >
                <option value="Chưa nhận">Chưa nhận</option>
                <option value="Đã nhận">Đã nhận</option>
                <option value="Đã khiếu nại">Đã khiếu nại</option>
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
              {title} <span className="text-slate-500 font-medium">({rows.length} đơn · Tổng hoàn {fmtMoney(sumMoney(rows))} VND)</span>
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

  // Mục "Cần check tay": đơn có mã trả thật, tạo quá 4 ngày, chưa có
  // xác nhận nhận hàng thật (quét/tick "Đã nhận"), không có đơn hoàn
  // 1 phần, đơn gốc (nếu nối được) không ở 72. Trạng thái hãng ("Đã
  // hoàn"/"Chưa hoàn") không ảnh hưởng danh sách này. Mặc định chỉ tải
  // đơn tạo trong 30 ngày gần nhất (uniCrtFrom/uniCrtTo); nới rộng ô
  // ngày để tải thêm đơn cũ hơn. Bộ lọc + phân trang + tick hàng loạt
  // riêng, không phụ thuộc bộ lọc trang. Dùng chung bảng/cột với nhóm
  // còn lại; copy 20 hoặc 40 mã 1 lần để check tay (copy theo danh
  // sách đã lọc).
  function renderUnifiedSection() {
    const rows = filteredUnified;
    const n20 = Math.min(20, rows.length);
    const n40 = Math.min(40, rows.length);
    const allPageChecked = isOwner && unifiedPageRows.length > 0 && unifiedPageRows.every(({ row }) => selectedUnified.has(row.return_id));
    const toggleRow = (returnId, checked) => {
      setSelectedUnified((prev) => {
        const next = new Set(prev);
        if (checked) next.add(returnId);
        else next.delete(returnId);
        return next;
      });
    };
    const togglePage = (checked) => {
      setSelectedUnified((prev) => {
        const next = new Set(prev);
        for (const { row } of unifiedPageRows) {
          if (checked) next.add(row.return_id);
          else next.delete(row.return_id);
        }
        return next;
      });
    };
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Cần check tay <span className="text-slate-500 font-medium">({unifiedList.length} đơn · Tổng hoàn {fmtMoney(sumMoney(unifiedList.map((x) => x.row)))} VND)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Đơn có mã trả thật, tạo quá 4 ngày, chưa có xác nhận nhận hàng thật (quét/tick "Đã nhận") — trừ đơn đã có đơn hoàn 1 phần và đơn gốc đang ở trạng thái 72. Đơn đã khiếu nại mà quá 4 ngày vẫn nằm trong danh sách. Hãng báo đã giao ("Hãng: Đã hoàn") chưa tính là đã nhận. Mặc định chỉ tải đơn tạo trong 30 ngày gần nhất — nới rộng ô "Từ ngày tạo" để xem đơn cũ hơn.</p>
            {checkError && <p className="text-xs text-red-600 mt-1">{checkError}</p>}
            {origStatusError && <p className="text-xs text-amber-700 mt-1">Không kiểm tra được trạng thái đơn gốc — danh sách đang hiển thị theo luật tuổi + chưa nhận (chưa lọc đơn gốc ở 72).</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={rows.length === 0} onClick={() => copyCodes(rows.slice(0, 20).map((x) => x.row), 'Cần check tay (20 mã)')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-2">
              <Copy size={15} /> Sao chép {n20} mã
            </button>
            <button disabled={rows.length === 0} onClick={() => copyCodes(rows.slice(0, 40).map((x) => x.row), 'Cần check tay (40 mã)')} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-2">
              <Copy size={15} /> Sao chép {n40} mã
            </button>
          </div>
        </div>
        {/* Bộ lọc riêng của mục (trên danh sách hợp nhất, đổi lọc về trang 1) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tìm mã vận đơn / mã đơn trả / mã đơn gốc</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={uniSearch} onChange={(e) => setUniFilter(setUniSearch, e.target.value)} placeholder="Nhập mã cần tìm" className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Sàn</label>
              <select value={uniPlatform} onChange={(e) => setUniFilter(setUniPlatform, e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white">
                <option value="">Tất cả sàn</option>
                {uniPlatformOptions.map((p) => (<option key={p.id} value={p.id}>{p.name || `Sàn ${p.id}`}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Shop</label>
              <select value={uniShop} onChange={(e) => setUniFilter(setUniShop, e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white">
                <option value="">Tất cả shop</option>
                {uniShopOptions.map((o) => (<option key={o.id} value={o.id}>{o.platformName ? `${o.platformName} · Shop ${o.id}` : `Shop ${o.id}`}</option>))}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Sản phẩm</label>
              <input value={uniProduct} onChange={(e) => setUniFilter(setUniProduct, e.target.value)} placeholder="Tên / mã SP" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trạng thái Nhanh</label>
              <select value={uniStatus} onChange={(e) => setUniFilter(setUniStatus, e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white">
                <option value="">Tất cả trạng thái</option>
                {uniStatusOptions.map((s) => (<option key={s.id} value={s.id}>{s.name || `Trạng thái ${s.id}`}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trạng thái tick</label>
              <select value={uniTick} onChange={(e) => setUniFilter(setUniTick, e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white">
                <option value="">Tất cả</option>
                <option value="Chưa nhận">Chưa nhận</option>
                <option value="Đã nhận">Đã nhận</option>
                <option value="Đã khiếu nại">Đã khiếu nại</option>
                <option value="__none__">Chưa có trạng thái</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Từ ngày tạo</label>
              <input type="date" value={uniCrtFrom} onChange={(e) => setUniFilter(setUniCrtFrom, e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Đến ngày tạo</label>
              <input type="date" value={uniCrtTo} onChange={(e) => setUniFilter(setUniCrtTo, e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tiền hoàn từ</label>
              <input type="number" min="0" value={uniMoneyMin} onChange={(e) => setUniFilter(setUniMoneyMin, e.target.value)} placeholder="0" className="w-28 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">đến</label>
              <input type="number" min="0" value={uniMoneyMax} onChange={(e) => setUniFilter(setUniMoneyMax, e.target.value)} placeholder="Không giới hạn" className="w-32 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
            </div>
            <button onClick={clearUniFilters} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer">Xóa lọc</button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Đang hiện {rows.length} / {unifiedList.length} đơn trong mục.</p>
        </div>
        {/* Chọn + tick hàng loạt (chỉ owner) */}
        {isOwner && (
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={allPageChecked} onChange={(e) => togglePage(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              Chọn tất cả trang này ({unifiedPageRows.length} đơn)
            </label>
            {selectedUnified.size > 0 && (
              <>
                <span className="text-sm font-bold text-slate-700">Đã chọn {selectedUnified.size} đơn</span>
                <button onClick={() => handleBulkTick('Chưa nhận')} disabled={bulkTickSaving} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer">Tick Chưa nhận</button>
                <button onClick={() => handleBulkTick('Đã nhận')} disabled={bulkTickSaving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer">Tick Đã nhận</button>
                <button onClick={() => handleBulkTick('Đã khiếu nại')} disabled={bulkTickSaving} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer">Tick Đã khiếu nại</button>
                <button onClick={() => setSelectedUnified(new Set())} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer">Bỏ chọn</button>
              </>
            )}
            {bulkTickMsg && <p className="text-sm font-bold text-slate-600">{bulkTickMsg}</p>}
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          {checkLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Đang tải...
            </div>
          ) : unifiedPageRows.length === 0 ? (
            <div className="p-8 text-center">
              <Package size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">{unifiedList.length === 0 ? 'Không còn đơn nào cần check tay.' : 'Không có đơn nào khớp bộ lọc.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>{COLS.map((c) => (<col key={c.id} style={{ width: `${c.w}%` }} />))}</colgroup>
                <tbody>{unifiedPageRows.map(({ row, age }) => renderRow(row, age, { selectable: true, checked: selectedUnified.has(row.return_id), onToggle: toggleRow }))}</tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500">Trang {safePageUnifiedFiltered} / {totalPagesUnifiedFiltered} — {rows.length} đơn</span>
            <div className="flex gap-2">
              <button disabled={safePageUnifiedFiltered <= 1} onClick={() => setPageUnified(safePageUnifiedFiltered - 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"><ChevronLeft size={14} /> Trước</button>
              <button disabled={safePageUnifiedFiltered >= totalPagesUnifiedFiltered} onClick={() => setPageUnified(safePageUnifiedFiltered + 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1">Sau <ChevronRight size={14} /></button>
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
            Đơn trả hàng đã/đang hoàn tiền, có mã đơn trả nhưng chưa có đơn hoàn 1 phần nhập kho trên Nhanh. Kiểm nhận tay để tách đơn cần check tay khỏi đơn đang chờ hàng về.
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
          Tổng: <strong className="text-slate-800">{total}</strong> đơn theo bộ lọc (có mã đơn trả thật SHOPEE/SPX/VNGH/VTP/EA/379/G/8/1, trạng thái Nhanh Đã hoàn tiền hoặc Đang hoàn tiền). Ngày cập nhật lọc theo ngày cập nhật trên Nhanh; ngày tạo lọc theo ngày tạo yêu cầu.
        </p>
        {error && <p className="text-sm font-bold text-red-500 mt-2">{error}</p>}
        {partialMissing && (
          <p className="text-xs text-amber-700 mt-2">Chưa tải được danh sách đơn hoàn 1 phần (bảng partial_return_orders chưa có hoặc chưa có quyền đọc) — các đơn tạm xếp hết vào nhóm chưa nhập kho, chạy migration bảng đơn hoàn 1 phần rồi tải lại trang.</p>
        )}
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
          <div className="text-xs text-slate-500 mt-1">Tổng hoàn: {fmtMoney(summary.totalMoney)} VND</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-green-700">{groups.daNhap.length}</div>
          <div className="text-xs font-bold text-slate-500">Đã nhập kho (có đơn hoàn 1 phần)</div>
          <div className="text-xs text-slate-500 mt-1">Tổng hoàn: {fmtMoney(summary.daNhapMoney)} VND</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-red-600">{unifiedList.length}</div>
          <div className="text-xs font-bold text-slate-500">Cần check tay</div>
          <div className="text-xs text-slate-500 mt-1">Tổng hoàn: {fmtMoney(summary.unifiedMoney)} VND</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-amber-700">{groups.cho.length}</div>
          <div className="text-xs font-bold text-slate-500">Chưa nhận: Đang chờ hàng về</div>
          <div className="text-xs text-slate-500 mt-1">Tổng hoàn: {fmtMoney(summary.choMoney)} VND</div>
        </div>
      </div>

      {/* Tải Excel + thông báo */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleExportExcel}
          disabled={exporting || groups.cho.length === 0}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          <FileDown size={16} /> {exporting ? 'Đang tạo file...' : `Tải Excel (${groups.cho.length} đơn chưa nhận)`}
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

      {/* Cần check tay (mục hợp nhất): hãng báo đã giao / quá 4 ngày / đã khiếu nại */}
      {renderUnifiedSection()}

      {/* Nhóm: Đang chờ hàng về */}
      {renderGroupSection({
        sectionKey: 'cho',
        title: 'Đang chờ hàng về',
        desc: 'Đơn tạo trong 4 ngày gần đây (hoặc chưa đọc được ngày tạo), có mã trả thật, chưa có xác nhận nhận hàng thật — đang chờ hãng giao hàng về kho.',
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
                <p className="text-xs text-slate-300 mt-0.5">Copy mã vận đơn theo từng hãng đi check AfterShip, rồi dán kết quả vào để cập nhật trạng thái hãng. Delivered → Hãng: Đã hoàn, còn lại → Hãng: Chưa hoàn. Dán kết quả chỉ cập nhật trạng thái hãng, KHÔNG đổi trạng thái nhận hàng (chỉ quét mã / tick tay mới xác nhận đã nhận hàng thật).</p>
              </div>
              <button onClick={closeBulk} className="p-2 rounded-lg hover:bg-slate-700 cursor-pointer flex-shrink-0" aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex gap-2">
                <button onClick={() => setBulkTab('doi-chieu')} className={`px-4 py-2 text-sm font-bold rounded-xl cursor-pointer ${bulkTab === 'doi-chieu' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>Đối chiếu</button>
                <button onClick={() => setBulkTab('quet-nhan')} className={`px-4 py-2 text-sm font-bold rounded-xl cursor-pointer ${bulkTab === 'quet-nhan' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>Quét nhận hàng</button>
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
                  <p className="text-xs text-slate-500">Lịch sử kiểm nhận gần nhất (tối đa 200 dòng): mỗi lần dán kết quả hoặc quét 1 lô là 1 lô, sửa tay từng đơn ghi riêng 1 dòng "Thủ công". Dán kết quả chỉ cập nhật trạng thái hãng nên đơn không nhảy nhóm sau khi dán — chỉ quét/tick "Đã nhận" mới gỡ đơn khỏi "Cần check tay" / "Đang chờ".</p>
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
                              Lô kiểm {fmtDateTime(g.checkedAt)} · {g.checkedBy || '—'} · {g.rows.length} đơn · {g.rows.filter((r) => r.received_status === 'Đã nhận').length} Đã nhận{g.rows[0]?.source ? ` · ${CARRIER_SOURCE_LABELS[g.rows[0].source] || g.rows[0].source}` : ''}
                            </p>
                          ) : (
                            <p className="text-sm font-bold text-slate-900 mb-2">Sửa tay · {fmtDateTime(g.checkedAt)} · {g.checkedBy || '—'} · Thủ công</p>
                          )}
                          <div className="space-y-1">
                            {g.rows.map((r) => (
                              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                <span className="font-mono font-bold text-indigo-700 break-all">{r.tracking_number || '—'}</span>
                                <span className="text-xs text-slate-500">{r.shipment_status || CARRIER_SOURCE_LABELS[r.source] || '—'}</span>
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
              ) : bulkTab === 'quet-nhan' ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Bắn mã vạch từng đơn nhận về từ shipper — đơn nào bắn rồi thì lưu ngay là <strong>Đã nhận hàng hoàn</strong>, chưa bắn thì vẫn là <strong>Chưa nhận hàng hoàn</strong>. Danh sách chờ gồm đơn trả (trạng thái Nhanh Đã hoàn tiền / Đang xử lý / Đang hoàn tiền) và đơn Nhanh ở trạng thái Đang chuyển hoàn / Xác nhận hoàn.
                </p>
                {scanError && <p className="text-sm font-bold text-red-500">{scanError}</p>}
                {/* Ô bắn mã */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Bắn mã vạch vào đây (súng bắn xong bấm Enter)</label>
                    <button type="button" onClick={toggleScanSound} title={scanSoundEnabled ? 'Tắt âm thanh quét' : 'Bật âm thanh quét'} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer shrink-0">
                      {scanSoundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                      Âm thanh: {scanSoundEnabled ? 'Bật' : 'Tắt'}
                    </button>
                  </div>
                  <input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onFocus={() => { if (scanSoundEnabled) getScanAudioContext(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanEnter(); } }}
                    placeholder="Quét mã vận đơn rồi Enter..."
                    autoFocus
                    className={`w-full text-base font-mono font-bold border-2 rounded-xl px-4 py-3 outline-none ${scanFlash?.kind === 'ok' ? 'border-emerald-500 bg-emerald-50' : scanFlash?.kind === 'dup' ? 'border-amber-400 bg-amber-50' : scanFlash?.kind === 'nomatch' || scanFlash?.kind === 'err' ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-slate-700'}`}
                  />
                  {scanFlash && (
                    <p className={`text-sm font-bold mt-1 ${scanFlash.kind === 'ok' ? 'text-emerald-600' : scanFlash.kind === 'dup' ? 'text-amber-700' : 'text-red-500'}`}>{scanFlash.msg}</p>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-700">Đã quét hôm nay: {scannedTodayIds.size} đơn</p>
                {/* Vừa quét */}
                {scanRecent.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Vừa quét (mới nhất trước)</p>
                    <div className="flex flex-wrap gap-2">
                      {scanRecent.map((s, i) => (
                        <span key={`${s.code}-${i}`} title={s.label} className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${s.kind === 'return' || s.kind === 'order-only' ? 'bg-emerald-100 text-emerald-800' : s.kind === 'dup' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>{s.code}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Dán danh sách mã */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Hoặc dán danh sách mã (1 mã 1 dòng)</label>
                  <textarea value={scanPasteText} onChange={(e) => setScanPasteText(e.target.value)} rows={4} placeholder={'SPXVN06943735682A\nSPXVN06929026928A'} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-mono" />
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <button onClick={handleScanPaste} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md cursor-pointer">Xử lý danh sách</button>
                    {scanPasteMsg && <p className="text-sm font-bold text-slate-600">{scanPasteMsg}</p>}
                  </div>
                </div>
                {/* Danh sách chờ quét — ẩn mặc định, mở bằng nút bên dưới */}
                <button onClick={() => setScanShowList((v) => !v)} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer">
                  {scanShowList ? 'Ẩn danh sách chờ quét' : `Xem danh sách chờ quét${scanLoaded ? ` (${scanExpected.length} đơn)` : ''}`}
                </button>
                {scanShowList && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-700">Đã quét {scanStats.done} / Tổng {scanStats.total} — Còn lại {scanStats.left}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={scanOnlyUnscanned} onChange={(e) => { setScanOnlyUnscanned(e.target.checked); setScanPage(1); }} className="w-4 h-4 accent-emerald-600" />
                          Chỉ hiện chưa quét
                        </label>
                        <button onClick={fetchScanExpected} disabled={scanLoading} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-50 cursor-pointer">Tải lại</button>
                      </div>
                    </div>
                    {scanLoading ? (
                  <div className="p-8 flex items-center justify-center gap-2 text-sm font-bold text-slate-500"><Loader2 size={18} className="animate-spin" /> Đang tải...</div>
                ) : scanVisible.length === 0 ? (
                  <p className="text-sm font-bold text-slate-600">{scanExpected.length === 0 ? 'Không có đơn nào trong danh sách chờ quét.' : 'Đã quét xong tất cả đơn trong danh sách.'}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-700">Trang {safeScanPage} / {scanTotalPages} — {scanVisible.length} đơn{scanOnlyUnscanned ? ' chưa quét' : ''}</span>
                      <div className="flex gap-2">
                        <button disabled={safeScanPage <= 1} onClick={() => setScanPage(safeScanPage - 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"><ChevronLeft size={14} /> Trước</button>
                        <button disabled={safeScanPage >= scanTotalPages} onClick={() => setScanPage(safeScanPage + 1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1">Sau <ChevronRight size={14} /></button>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                      {scanPageRows.map((it) => {
                        const done = scanItemReceived(it);
                        return (
                          <div key={it.code} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <span className="font-mono font-bold text-indigo-700 break-all">{it.code}</span>
                            <span className="text-xs text-slate-500">
                              {it.returnRow ? `Trả ${it.returnRow.return_id}` : ''}{it.returnRow && it.orderRow ? ' · ' : ''}{it.orderRow ? `Đơn ${it.orderRow.id}` : ''}
                            </span>
                            <span className="text-xs text-slate-500">
                              {it.returnRow ? `${it.returnRow.platform_name || ''}${it.returnRow.shop_id ? ` · Shop ${it.returnRow.shop_id}` : ''}` : it.orderRow ? `Kênh ${CHANNEL_NAMES[String(it.orderRow.sale_channel)] || it.orderRow.sale_channel}` : ''}
                            </span>
                            <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${done ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{done ? 'Đã nhận hàng hoàn' : 'Chưa nhận hàng hoàn'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                    <p className="text-xs text-slate-500">Chưa có hoàn tác trong phiên này — quét nhầm thì sửa lại bằng nút "Sửa" từng dòng ở bảng chính.</p>
                  </>
                )}
              </div>
              ) : (
              <>
              {loading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
                  <Loader2 size={18} className="animate-spin" /> Đang tải...
                </div>
              ) : bulkRows.length === 0 ? (
                <p className="text-sm font-bold text-slate-600">Đã kiểm xong tất cả đơn trong bộ lọc.</p>
              ) : (
                <>
                  {/* Dán kết quả AfterShip / 17Track */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Dán kết quả AfterShip / 17Track vào đây</label>
                    <textarea
                      value={pasteText}
                      onChange={(e) => { setPasteText(e.target.value); if (excelUpload) setExcelUpload(null); }}
                      rows={8}
                      placeholder={'AfterShip:\nTracking number: 854169939715\nCourier name: J&T Express Vietnam\nShipment status: Delivered\nDelivery date: Nov 7, 2026 (Sat)\n\n17Track (1 dòng 1 đơn):\nSPXVN06943735682A\tVietnam\tUnknown\t2026-11-04 08:45 Parcel has been delivered\tDelivered\t(5 Days)'}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">Chấp nhận cả 2 dạng: AfterShip (khối nhiều dòng) hoặc 17Track / các bên khác (1 dòng 1 đơn: mã + trạng thái + ngày). Delivered → Hãng: Đã hoàn, trạng thái khác → Hãng: Chưa hoàn. Trạng thái nhận hàng không đổi.</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <button onClick={handleBulkPreview} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md cursor-pointer">Cập nhật trạng thái</button>
                      {bulkError && <p className="text-sm font-bold text-red-500">{bulkError}</p>}
                      {bulkMsg && <p className="text-sm font-bold text-emerald-600">{bulkMsg}</p>}
                      {historyWarn && <p className="text-sm font-bold text-amber-700">{historyWarn}</p>}
                    </div>
                  </div>
                  {/* Tải file Excel thay cho dán tay — cùng 1 luồng xem trước -> xác nhận */}
                  <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50">
                    <p className="text-sm font-bold text-slate-900">Hoặc tải file Excel (2 cột: Mã vận đơn, Trạng thái)</p>
                    <p className="text-xs text-slate-500">Trạng thái "Đã giao" (hoặc "Delivered") tính là đã giao hàng, còn lại tính là chưa giao. Tải file sẽ thay thế đoạn dán tay ở trên (và ngược lại, dán tay sẽ bỏ file đã tải).</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                        <FileDown size={15} /> Chọn file Excel (.xlsx / .xls / .csv)
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
                      </label>
                      <button onClick={downloadExcelTemplate} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer">Tải form mẫu</button>
                      {excelUpload && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                          Đang dùng: Excel — {excelUpload.fileName} ({excelUpload.rows.length} mã)
                          <button onClick={() => setExcelUpload(null)} className="ml-2 text-slate-500 hover:text-slate-800 cursor-pointer underline">Bỏ file</button>
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Xem trước — chưa ghi gì cả */}
                  {bulkPreview && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <p className="text-sm font-bold text-slate-900">
                        Xem trước — chưa lưu gì cả: tìm thấy {bulkPreview.matched.length} đơn, không khớp {bulkPreview.unmatched.length} mã{(bulkPreview.alreadyChecked?.length || 0) > 0 ? `, đã kiểm rồi ${bulkPreview.alreadyChecked.length} mã` : ''}.
                        {bulkPreview.source && ` Nguồn: ${CARRIER_SOURCE_LABELS[bulkPreview.source] || bulkPreview.source}.`}
                      </p>
                      {bulkPreview.matched.length > 0 && (
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                          {bulkPreview.matched.map((p) => (
                            <div key={p.tracking} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                              <span className="font-mono font-bold text-indigo-700 break-all">{p.tracking}</span>
                              <span className="text-xs text-slate-500">{p.shipStatus || '(không có trạng thái)'}</span>
                              <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full ${p.delivered ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                {p.delivered ? 'Hãng: Đã hoàn' : 'Hãng: Chưa hoàn'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {bulkPreview.alreadyChecked?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1">Đã kiểm rồi (đã check trong hôm nay hoặc đã nhận — không cập nhật lại):</p>
                          <p className="font-mono text-xs text-slate-500 break-all">{bulkPreview.alreadyChecked.map((p) => p.tracking).join(', ')}</p>
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
                  {/* Danh sách hết 1 loạt theo hãng — không phân trang; mỗi hãng copy 20 hoặc 40 mã 1 lần */}
                  <p className="text-sm font-bold text-slate-700">Tổng {bulkRows.length} đơn chưa nhận — chia theo hãng vận chuyển, copy 20 hoặc 40 mã 1 lần để đi check.</p>
                  {bulkCarriers.map((c) => {
                    const n20 = Math.min(20, c.rows.length);
                    const n40 = Math.min(40, c.rows.length);
                    const done = c.rows.length === 0;
                    return (
                      <div key={c.name} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                          <h3 className="text-sm font-bold text-slate-900">{c.name} — {c.rows.length} đơn</h3>
                          <div className="flex flex-wrap gap-2">
                            <button disabled={done} onClick={() => copyCodes(c.rows.slice(0, 20), `${c.name} (20 mã)`)} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-2">
                              <Copy size={15} /> {done ? 'Đã kiểm xong' : `Sao chép ${n20} mã`}
                            </button>
                            <button disabled={done} onClick={() => copyCodes(c.rows.slice(0, 40), `${c.name} (40 mã)`)} className="px-4 py-2 bg-white border border-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-2">
                              <Copy size={15} /> {done ? 'Đã kiểm xong' : `Sao chép ${n40} mã`}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                          {c.rows.map((r) => {
                            const m = manualChecks.get(r.return_id);
                            return (
                              <div key={r.return_id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                <span className="font-mono font-bold text-indigo-700 break-all">{returnCodeOf(r) || r.return_tracking_number || '—'}</span>
                                <span className="font-mono text-xs text-slate-500 break-all">{r.return_id || '—'}</span>
                                <span className="ml-auto text-xs font-bold text-slate-500">
                                  {m?.received_status ? `${m.received_status}${m.received_date ? ` · ${fmtDateOnly(m.received_date)}` : ''}` : 'Chưa kiểm'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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
