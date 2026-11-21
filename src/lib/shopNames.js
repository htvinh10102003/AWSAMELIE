// Tên shop sàn TMĐT (Shopee/TikTok/Lazada) lấy qua edge
// nhanh-order-actions action shopList (Nhanh API ecom/shop).
// Cache trong bộ nhớ theo phiên: gọi 1 lần, các trang dùng chung.
// API lỗi hoặc chưa tải xong -> trả về ID như cũ, không sập trang.
import { supabase } from './supabase';

let shopNameCache = null;
let shopNamePromise = null;

export function loadShopNames() {
  if (shopNameCache) return Promise.resolve(shopNameCache);
  if (!shopNamePromise) {
    shopNamePromise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('nhanh-order-actions', { body: { action: 'shopList' } });
        const map = new Map();
        if (!error && data && data.success && Array.isArray(data.shops)) {
          data.shops.forEach((s) => {
            if (s && s.id) map.set(String(s.id), s.name || '');
          });
        }
        shopNameCache = map;
        return map;
      } catch {
        shopNameCache = new Map();
        return shopNameCache;
      }
    })();
  }
  return shopNamePromise;
}

// Tên hiển thị của 1 shop: có tên thì dùng tên, chưa có thì dùng ID.
export function shopDisplayName(shopNames, shopId) {
  if (!shopId) return '';
  const name = shopNames && typeof shopNames.get === 'function' ? shopNames.get(String(shopId)) : '';
  return name || String(shopId);
}
