// Map sản phẩm trả hàng (TikTok + Shopee) về tên đầy đủ trong kho
// (product_inventories.product_name, VD "XANTHE 683 - Beige - L").
// - TikTok: không có SKU, SKU = size. Lấy mã từ số trong tên, hoặc từ
//   ngay trước "Dress" tra bảng; ghép với size rồi tra kho.
// - Shopee: đã có sẵn SKU (sku = tên đầy đủ trong kho, hoặc mã vạch
//   product_code) -> tra thẳng kho.
// - Mã dạng Luna01 (shop LUNARA) giữ nguyên tên, không map.
// Bảng tên -> mã: thêm cặp mới vào đây khi gặp sản phẩm không số khác.
export const TIKTOK_NAME_WORD_TO_CODE = {
  ELLIS: '189',
};

// "Luna01" (không khoảng trắng). "LUNA 125 - ..." trong kho thì vẫn map được.
const LUNA_CODE_RE = /luna\d+/i;
// Số cuối cùng trong tên (2-4 chữ số) — mã SP nằm ở cuối tên VD "Ame683".
const LAST_NUMBER_RE = /(\d{2,4})(?!.*\d{2,4})/;
// Từ ngay trước chữ "Dress" (VD "Ellis Dress" -> "Ellis").
const WORD_BEFORE_DRESS_RE = /([A-Za-zÀ-ỹ]+)\s+dress/i;
const SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL|F|FREE)$/i;
// Tên đầy đủ trong kho: "TÊN MÃ - MÀU - SIZE" (VD "XANTHE 683 - Beige - L").
const INVENTORY_NAME_RE = /^(.+?)\s+(\d+)\s*-\s*(.+?)\s*-\s*(\S+)\s*$/;

// rows: [{ product_code, product_name }] -> index để tra cứu.
export function buildInventoryIndex(rows) {
  const byName = new Map(); // tên đầy đủ (viết hoa) -> tên gốc
  const byCode = new Map(); // mã vạch product_code -> tên đầy đủ
  const byCodeSize = new Map(); // "683|L" -> tên đầy đủ
  (rows || []).forEach((r) => {
    const name = r.product_name ? String(r.product_name).trim() : '';
    const code = r.product_code ? String(r.product_code).trim() : '';
    if (!name) return;
    byName.set(name.toUpperCase(), name);
    if (code) byCode.set(code.toUpperCase(), name);
    const m = name.match(INVENTORY_NAME_RE);
    if (m) byCodeSize.set(`${m[2]}|${m[4].toUpperCase()}`, name);
  });
  return { byName, byCode, byCodeSize };
}

function sizeFromSku(sku) {
  const s = sku ? String(sku).trim() : '';
  return SIZE_RE.test(s) ? s.toUpperCase() : '';
}

function codeFromName(name) {
  const raw = String(name || '');
  const num = raw.match(LAST_NUMBER_RE);
  if (num) return num[1];
  const w = raw.match(WORD_BEFORE_DRESS_RE);
  if (w) return TIKTOK_NAME_WORD_TO_CODE[w[1].toUpperCase()] || '';
  return '';
}

// Mã nằm trong SKU Shopee (VD "25AD1-EL189P-WH-M" -> 189);
// đoạn cuối SKU sau dấu "-" là size (VD "...-WH-M" -> M).
function codeFromSku(sku) {
  const raw = String(sku || '');
  const num = raw.match(LAST_NUMBER_RE);
  return num ? num[1] : '';
}

function sizeFromSkuSegments(sku) {
  const raw = String(sku || '');
  const segs = raw.split('-');
  const last = segs.length > 1 ? segs[segs.length - 1].trim() : '';
  return last && SIZE_RE.test(last) ? last.toUpperCase() : '';
}

// Trả về tên đầy đủ trong kho ("XANTHE 683 - Beige - L") hoặc null.
// Chưa nạp kho (index null) thì chỉ ghép mã + size, VD "683 - L".
export function mapReturnProduct(name, sku, index) {
  if (!name && !sku) return null;
  const rawName = name ? String(name).trim() : '';
  const rawSku = sku ? String(sku).trim() : '';
  if (rawName && LUNA_CODE_RE.test(rawName)) return null; // LUNARA giữ nguyên tên
  if (!index) {
    const code = codeFromName(rawName);
    const size = sizeFromSku(rawSku);
    if (code) return size ? `${code} - ${size}` : code;
    return null;
  }
  // 1. SKU đã là tên đầy đủ trong kho (Shopee thường thế này).
  if (rawSku) {
    const hit = index.byName.get(rawSku.toUpperCase()) || index.byCode.get(rawSku.toUpperCase());
    if (hit) return hit;
  }
  // 2. Tên đã là tên đầy đủ trong kho.
  if (rawName) {
    const hit = index.byName.get(rawName.toUpperCase()) || index.byCode.get(rawName.toUpperCase());
    if (hit) return hit;
  }
  // 3. Lấy mã từ tên (không có thì từ SKU, VD Shopee "EL189P" -> 189)
  // + size từ SKU (TikTok: sku chính là size; Shopee: đoạn cuối sau "-"),
  // rồi tra kho theo mã + size.
  const code = codeFromName(rawName) || codeFromSku(rawSku);
  let size = sizeFromSku(rawSku) || sizeFromSkuSegments(rawSku);
  if (!size && rawName) {
    const tail = rawName.match(/-\s*(\S+)\s*$/);
    if (tail && SIZE_RE.test(tail[1])) size = tail[1].toUpperCase();
  }
  if (code && size) {
    const hit = index.byCodeSize.get(`${code}|${size}`);
    if (hit) return hit;
    return `${code} - ${size}`;
  }
  if (code) return code;
  return null;
}
