// sync-orders-by-ids — Cập nhật lại đơn theo đúng mã đơn (kéo lại từ Nhanh).
// Dùng cho mục "Đơn gốc đang hoàn (71/74)" trên trang Trả hàng hoàn tiền:
// những đơn này có thể miss webhook nên trạng thái trong DB bị cũ, mà nút
// "Đồng bộ đơn hàng" ở Admin chỉ kéo lại tối đa 30 ngày theo ngày cập nhật
// nên không với tới đơn cũ (vd từ tháng 8). Hàm này kéo lại theo từng mã
// đơn, không phụ thuộc ngày.
// - Input: { orderIds: string[] } (tối đa 500 mã/lần).
// - Mỗi mã gọi Nhanh order/list với filters { id }, paginator size 1
//   (mẫu đã có trong process-return). Chạy song song tối đa 8 đơn/lần
//   (Promise.all theo lô) cho nhanh thay vì chạy tuần tự.
// - Ghi đè vào orders + order_products theo đúng cách sync-nhanh đang làm
//   (kể cả giữ ngày đi cũ khi Nhanh không trả ngày — sửa 02/11/2026).
//   Không động vào order_carrier_checks (trạng thái hãng/nhận là luồng khác).
// - Trả về tóm tắt: total, updated, noLonger7174 (đã đổi khỏi 71/74),
//   notFound (Nhanh không tìm thấy), errors.
// - Verify JWT: OFF (như sync-nhanh) — frontend gọi bằng anon key qua
//   supabase.functions.invoke. Token Nhanh đọc trong system_configs ở
//   phía server, không lộ ra trình duyệt.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CONCURRENCY = 8;
const MAX_IDS = 500;

function safeDate(value: any) {
  if (!value) return null;
  if (!isNaN(value)) return new Date(Number(value) * 1000).toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Gọi Nhanh order/list lấy 1 đơn theo ID, thử lại tối đa 3 lần khi lỗi mạng.
async function fetchOrderById(appId: string, businessId: string, accessToken: string, orderId: string) {
  let res: Response | null = null;
  let fetchError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(
        `https://pos.open.nhanh.vn/v3.0/order/list?appId=${appId}&businessId=${businessId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filters: { id: orderId },
            paginator: { size: 1 }
          })
        }
      );
      fetchError = null;
      break;
    } catch (e: any) {
      fetchError = e;
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  if (!res) throw fetchError || new Error('Không gọi được API Nhanh');
  const result = await res.json();
  if (result.code !== 1) {
    const rawMsg = result.messages;
    const errMsg = (Array.isArray(rawMsg) ? rawMsg.join(', ') : rawMsg)
      || result.message || result.errorCode || result.error || 'Lỗi không xác định từ Nhanh.vn';
    throw new Error(`Nhanh.vn báo lỗi: ${errMsg} (code: ${result.code}${result.errorCode ? ', ' + result.errorCode : ''})`);
  }
  const data = Array.isArray(result.data) ? result.data : [];
  return data.length > 0 ? data[0] : null;
}

// Dựng payload upsert cho 1 đơn Nhanh — cùng khuôn với sync-nhanh.
function buildOrderPayload(order: any) {
  const info = order.info || {};
  const carrier = order.carrier || {};
  const channel = order.channel || {};
  if (!info.id) return null;
  const orderId = String(info.id);
  const carrierDate = safeDate(carrier.sendCarrier?.date);
  const payload: any = {
    id: orderId,
    status: info.status || null,
    created_at: safeDate(info.createdAt) || new Date().toISOString(),
    carrier_code: carrier.carrierCode || '',
    carrier_name: carrier.carrierName || '',
    ...(carrierDate ? { carrier_date: carrierDate } : {}),
    is_declared_fee: carrier.isDeclaredFee ? 1 : 0,
    sale_channel: channel.saleChannel || null,
    created_by_name: info.createdBy?.name || info.createdByName || '',
    raw_data: order,
    ecom_order_id: channel.ecomOrderId || channel.appOrderId || null,
    depot_id: info.depotId || null,
    ...(safeDate(info.updatedAt) ? { updated_at: safeDate(info.updatedAt) } : {}),
    ...(safeDate(info.packedAt) ? { packed_at: safeDate(info.packedAt) } : {}),
    description: info.description || '',
    private_description: info.privateDescription || '',
    tracking_url: info.trackingUrl || '',
    traffic_source: channel.trafficSource?.name || channel.trafficSource || ''
  };
  const products: any[] = [];
  if (Array.isArray(order.products)) {
    order.products.forEach((prod: any) => {
      products.push({
        order_id: orderId,
        product_id: prod.id != null ? String(prod.id) : null,
        product_code: String(prod.code || prod.productCode || ''),
        product_name: prod.name || prod.productName || '',
        quantity: Number(prod.quantity || 0),
        price: Number(prod.price || 0)
      });
    });
  }
  return { orderId, payload, products };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawIds = Array.isArray(body.orderIds) ? body.orderIds : [];
    // Khử trùng + bỏ mã rỗng, giữ thứ tự.
    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    for (const v of rawIds) {
      const id = String(v ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniqueIds.push(id);
    }
    if (uniqueIds.length === 0) throw new Error('Thiếu orderIds (mảng mã đơn Nhanh).');
    if (uniqueIds.length > MAX_IDS) throw new Error(`Tối đa ${MAX_IDS} mã đơn/lần, đã gửi ${uniqueIds.length}.`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Lấy cấu hình Nhanh từ system_configs.
    const { data: configs, error: configError } = await supabase
      .from('system_configs')
      .select('key, value')
      .in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);
    if (configError) throw new Error("Lỗi đọc bảng cấu hình: " + configError.message);
    const configMap: Record<string, string> = {};
    configs?.forEach((c: any) => configMap[c.key] = c.value);
    if (!configMap['nhanh_app_id'] || !configMap['nhanh_access_token']) {
      throw new Error("Thiếu nhanh_app_id hoặc nhanh_access_token trong system_configs!");
    }
    const appId = configMap['nhanh_app_id'];
    const businessId = configMap['nhanh_business_id'];
    const accessToken = configMap['nhanh_access_token'];

    // 2. Kéo từng đơn từ Nhanh, chạy song song tối đa CONCURRENCY đơn/lô.
    const fetched: any[] = [];
    const notFound: string[] = [];
    const errors: { orderId: string; message: string }[] = [];
    for (let i = 0; i < uniqueIds.length; i += CONCURRENCY) {
      const chunk = uniqueIds.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(async (orderId) => {
        try {
          const order = await fetchOrderById(appId, businessId, accessToken, orderId);
          if (!order) return { orderId, kind: 'notFound' as const };
          const built = buildOrderPayload(order);
          if (!built) return { orderId, kind: 'notFound' as const };
          return { orderId, kind: 'ok' as const, built };
        } catch (e: any) {
          return { orderId, kind: 'error' as const, message: String(e?.message || e) };
        }
      }));
      for (const r of chunkResults) {
        if (r.kind === 'ok' && r.built) fetched.push(r.built);
        else if (r.kind === 'notFound') notFound.push(r.orderId);
        else if (r.kind === 'error') errors.push({ orderId: r.orderId, message: (r as any).message });
      }
    }

    // 3. Ghi đè vào DB (cùng cách sync-nhanh).
    let updated = 0;
    let noLonger7174 = 0;
    if (fetched.length > 0) {
      const ordersToUpsert = fetched.map((f) => f.payload);
      const { error: orderError } = await supabase.from('orders').upsert(ordersToUpsert, { onConflict: 'id' });
      if (orderError) throw new Error('Lỗi ghi orders: ' + orderError.message);
      updated = ordersToUpsert.length;
      noLonger7174 = ordersToUpsert.filter((o: any) => o.status !== 71 && o.status !== 74).length;

      // Sản phẩm: xóa cũ của các đơn vừa kéo rồi ghi mới (gộp trùng như sync-nhanh).
      const orderIds = fetched.map((f) => f.orderId);
      const productInsertions: any[] = [];
      fetched.forEach((f) => productInsertions.push(...f.products));
      if (productInsertions.length > 0) {
        await supabase.from('order_products').delete().in('order_id', orderIds);
        const deduped = new Map<string, any>();
        const dedupedInsertions: any[] = [];
        for (const row of productInsertions) {
          if (row.product_id === null || row.product_id === undefined) {
            dedupedInsertions.push(row);
            continue;
          }
          const key = JSON.stringify([row.order_id, row.product_id]);
          const existing = deduped.get(key);
          if (existing) {
            existing.quantity += Number(row.quantity || 0);
          } else {
            row.quantity = Number(row.quantity || 0);
            deduped.set(key, row);
            dedupedInsertions.push(row);
          }
        }
        const { error: prodError } = await supabase.from('order_products').upsert(dedupedInsertions, { onConflict: 'order_id,product_id' });
        if (prodError) console.error('[sync-orders-by-ids] Lỗi đồng bộ SP:', prodError.message);
      }
    }

    console.log(`[sync-orders-by-ids] Xong: ${updated}/${uniqueIds.length} đơn, ${noLonger7174} đơn đã đổi khỏi 71/74, ${notFound.length} không tìm thấy, ${errors.length} lỗi.`);
    return new Response(JSON.stringify({
      success: true,
      total: uniqueIds.length,
      updated,
      noLonger7174,
      notFound,
      errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});
