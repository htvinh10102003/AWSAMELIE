// Map sản phẩm TikTok về mã sản phẩm của shop (Vinh 2026-11-05).
// Đơn TikTok không có SKU sản phẩm — SKU của nó là size (VD "L").
// 1. Có số trong tên -> số đó là mã SP (VD "Xanthe dress Ame683" -> 683),
//    ghép với size: "683 - L" (trong kho là "XANTHE 683 - Beige - L").
// 2. Không có số -> lấy từ ngay trước chữ "Dress", tra bảng dưới ra mã
//    (VD "Ellis Dress" -> Ellis -> 189), ghép với size.
// 3. Mã dạng Luna01 (shop LUNARA) -> giữ nguyên tên, không map.
// Bảng tên -> mã: thêm cặp mới vào đây khi gặp sản phẩm không số khác.
export const TIKTOK_NAME_WORD_TO_CODE = {
  ELLIS: '189',
};

const LUNA_RE = /luna\s*\d+/i;
// Số cuối cùng trong tên (2-4 chữ số) — mã SP nằm ở cuối tên VD "Ame683".
const LAST_NUMBER_RE = /(\d{2,4})(?!.*\d{2,4})/;
// Từ ngay trước chữ "Dress" (VD "Ellis Dress" -> "Ellis").
const WORD_BEFORE_DRESS_RE = /([A-Za-zÀ-ỹ]+)\s+dress/i;

// Trả về { code, size, label, source } hoặc null nếu không map được
// (LUNARA giữ nguyên tên, hoặc tên không có số và từ trước "Dress"
// không nằm trong bảng).
export function mapTiktokProduct(name, sku) {
  if (!name) return null;
  const raw = String(name);
  if (LUNA_RE.test(raw)) return null;
  const size = sku ? String(sku).trim() : '';
  const num = raw.match(LAST_NUMBER_RE);
  if (num) {
    const code = num[1];
    return { code, size, label: size ? `${code} - ${size}` : code, source: 'number' };
  }
  const w = raw.match(WORD_BEFORE_DRESS_RE);
  if (w) {
    const code = TIKTOK_NAME_WORD_TO_CODE[w[1].toUpperCase()];
    if (code) return { code, size, label: size ? `${code} - ${size}` : code, source: 'name' };
  }
  return null;
}
