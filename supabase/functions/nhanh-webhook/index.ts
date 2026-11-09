import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const payload = await req.json().catch(() => null);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Payload trống hoặc sai định dạng" }), { status: 400 });
    }

    const { event, data } = payload;

    if (event === 'verify') {
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // --------------------------------------------
    // KIỂM TRA VERIFY TOKEN (fail open khi chưa cấu hình)
    // Nhanh gửi token ở header Authorization; bản cũ gửi trong body
    // với key webhooksVerifyToken. Token lưu ở system_configs key
    // 'nhanh_webhook_verify_token' (nhập ở Admin). Chưa lưu mã thì
    // cho qua hết để khỏi chặn đồng bộ (sự cố 2026-11-04: webhook
    // lỗi mà vẫn trả 200 nên mất dữ liệu lặng lẽ). Event 'verify'
    // là bắt tay đăng ký URL nên không kiểm tra.
    // --------------------------------------------
    if (event !== 'verify') {
      let storedToken: string | null = null;
      try {
        const { data: cfg } = await supabase
          .from('system_configs')
          .select('value')
          .eq('key', 'nhanh_webhook_verify_token')
          .maybeSingle();
        storedToken = typeof cfg?.value === 'string' && cfg.value !== '' ? cfg.value : null;
      } catch (_e) { storedToken = null; }
      if (storedToken) {
        const headerToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
        const bodyToken = typeof (payload as any)?.webhooksVerifyToken === 'string' ? (payload as any).webhooksVerifyToken : '';
        const gotToken = headerToken || bodyToken;
        if (!gotToken || gotToken !== storedToken) {
          console.error(`❌ Webhook ${event}: sai verify token.`);
          return new Response(JSON.stringify({ error: 'Verify token không đúng.' }), { status: 401 });
        }
      }
    }

    // ============================================
    // 1. XỬ LÝ TỒN KHO & SẢN PHẨM
    // ============================================
    if (event === 'inventoryChange' || event === 'productUpdate' || event === 'productAdd') {

      // Nhanh.vn có thể gửi data là mảng (inventoryChange) hoặc object (productAdd/Update)
      const products = Array.isArray(data) ? data : [data];

      if (event === 'inventoryChange') {
        // Sự kiện inventoryChange: remain, shipping, available nằm ngay ngoài cùng của object
        const promises = products.map((prod: any) => {
          if (!prod.id) return Promise.resolve();

          const remain = Number(prod.remain || 0);
          const shipping = Number(prod.shipping || 0);

          return supabase.from('product_inventories').update({
            remain: remain,
            shipping: shipping,
            available: Number(prod.available || 0),
            on_hand: remain - shipping,
            last_synced: new Date().toISOString()
          }).eq('product_id', String(prod.id));
        });

        const results = await Promise.all(promises);

      } else {
        // Sự kiện productAdd, productUpdate: tên, mã ở ngoài. Tồn kho nằm trong object `inventory`
        const newProducts: any[] = [];

        products.forEach((prod: any) => {
          if (!prod.id) return;

          const remain = Number(prod.inventory?.remain || 0);
          const shipping = Number(prod.inventory?.shipping || 0);

          const productPayload = {
            product_id: String(prod.id),
            product_code: String(prod.code || prod.barcode || ''),
            product_name: String(prod.name || ''),
            remain: remain,
            shipping: shipping,
            available: Number(prod.inventory?.available || 0),
            on_hand: remain - shipping,
            last_synced: new Date().toISOString()
          };

          newProducts.push(productPayload);
        });

        if (newProducts.length > 0) {
          // Dùng upsert: Nếu có product_id rồi thì update (cho productUpdate), chưa có thì insert (cho productAdd)
          const { error } = await supabase
            .from('product_inventories')
            .upsert(newProducts, { onConflict: 'product_id' });
        }
      }
    }

    // ============================================
    // 2. ĐƠN HOÀN 1 PHẦN (type 16) — BẢNG RIÊNG
    // ============================================
    // orderPartialReturn: đơn hoàn 1 phần tạo trên web/POS Nhanh.
    // Ghi vào bảng riêng partial_return_orders (có index theo đơn gốc
    // để báo cáo "chưa nhận" lọc nhanh), KHÔNG ghi vào orders /
    // order_products / order_histories — đơn hoàn 1 phần là biên nhận
    // hoàn kho, không phải đơn bán hàng.
    if (event === 'orderPartialReturn') {
      const info = data?.info || {};
      const channel = data?.channel || {};
      const originalOrder = data?.originalOrder || {};

      if (!info.id) return new Response("Missing Order ID", { status: 200 });

      const orderId = String(info.id);
      const newStatus = info.status ?? info.statusId ?? null;
      const createdAt = info.createdAt ? new Date(info.createdAt * 1000).toISOString() : new Date().toISOString();
      const updatedAt = info.updatedAt ? new Date(info.updatedAt * 1000).toISOString() : new Date().toISOString();
      const creatorName = info.createdBy?.name || info.sale?.name || '';

      // ID đơn gốc: thử lần lượt info.originalOrderId (payload đồng bộ
      // thật), originalOrder.id (theo docs webhook), cả 2 đường envelope.
      const pickFirst = (...cands: any[]) => {
        for (const c of cands) {
          if (c !== null && c !== undefined && c !== 0 && String(c).trim() !== '') return String(c);
        }
        return null;
      };
      const originalOrderId = pickFirst(
        info.originalOrderId,
        (data as any)?.data?.info?.originalOrderId,
        originalOrder?.id,
        (data as any)?.data?.originalOrder?.id,
      );
      const appOrderId = channel?.appOrderId || originalOrder?.channel?.appOrderId || null;
      // channel.appOrderId của đơn hoàn 1 phần có hậu tố 'R'
      // (VD '586714831070856213R') — bản gốc bỏ 'R' để nối đơn trả.
      const originalEcomOrderId = appOrderId ? String(appOrderId).replace(/R$/, '') : null;
      const shopId = channel?.shopId || channel?.appShopId || originalOrder?.channel?.appShopId || null;
      const saleChannel = channel.saleChannel || null;
      const products = Array.isArray(data?.products) ? data.products : null;

      const { error: partialError } = await supabase.from('partial_return_orders').upsert({
        id: orderId,
        original_order_id: originalOrderId,
        original_ecom_order_id: originalEcomOrderId,
        ecom_order_id: appOrderId ? String(appOrderId) : null,
        shop_id: shopId ? String(shopId) : null,
        sale_channel: saleChannel,
        status: newStatus,
        created_by_name: creatorName,
        products: products,
        raw_data: payload,
        created_at: createdAt,
        updated_at: updatedAt,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (partialError) console.error(`❌ Lỗi ghi đơn hoàn 1 phần ${orderId}:`, partialError.message);
    }

    // ============================================
    // 3. XỬ LÝ SỰ KIỆN ĐƠN HÀNG THAY ĐỔI
    // ============================================
    if (event === 'orderAdd' || event === 'orderUpdate') {
      const info = data?.info || {};
      const carrier = data?.carrier || {};
      const channel = data?.channel || {};
      const originalOrder = data?.originalOrder || {};

      if (!info.id) return new Response("Missing Order ID", { status: 200 });

      const orderId = String(info.id);
      // Webhook (docs) dùng info.status; dữ liệu đồng bộ dùng info.statusId.
      const newStatus = info.status ?? info.statusId ?? null;

      const createdAt = info.createdAt ? new Date(info.createdAt * 1000).toISOString() : new Date().toISOString();
      const updatedAt = info.updatedAt ? new Date(info.updatedAt * 1000).toISOString() : new Date().toISOString();

      // Thời gian đóng gói trả về từ Nhanh
      const payloadPackedAt = info.packedAt ? new Date(info.packedAt * 1000).toISOString() : null;

      const creatorName = info.createdBy?.name || info.sale?.name || '';
      const ecomOrderId = channel?.appOrderId || originalOrder?.channel?.appOrderId || null;
      const saleChannel = channel.saleChannel || null;

      // Cờ xác định đơn Shopee hoặc TikTok
      const isEcom = saleChannel === 42 || saleChannel === 48;

      // --------------------------------------------
      // BƯỚC 2.1: KIỂM TRA TRẠNG THÁI HIỆN TẠI TỪ DB
      // --------------------------------------------
      let oldStatus = null;
      let existingPackedAt = null;
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('status, packed_at')
        .eq('id', orderId)
        .single();

      if (existingOrder) {
        oldStatus = existingOrder.status;
        existingPackedAt = existingOrder.packed_at;
      }

      // --------------------------------------------
      // LOGIC MỚI: XÁC ĐỊNH packed_at
      // --------------------------------------------
      let finalPackedAt = existingPackedAt; // Mặc định giữ nguyên thời gian cũ nếu đã có

      if (isEcom) {
        // Đơn Shopee/TikTok (42, 48): Lấy theo payload của Nhanh.vn gửi về
        if (payloadPackedAt) {
          finalPackedAt = payloadPackedAt;
        }
      } else {
        // Đơn ngoài sàn: Tự động đánh dấu packed_at khi chuyển sang trạng thái 40 (Đã đóng gói)
        if (newStatus === 40 && oldStatus !== 40) {
          finalPackedAt = new Date().toISOString(); // Lấy thời gian lúc trigger webhook
        } else if (payloadPackedAt && !existingPackedAt) {
          // Fallback đề phòng Nhanh có nhả packedAt mà DB chưa có
          finalPackedAt = payloadPackedAt;
        }
      }

      // --------------------------------------------
      // BƯỚC 2.2: LƯU ĐƠN HÀNG
      // --------------------------------------------
      const mappedOrder = {
        id: orderId,
        depot_id: info.depotId || null,
        created_by_name: creatorName,
        created_at: createdAt,
        updated_at: updatedAt,
        packed_at: finalPackedAt, // <--- Sử dụng packed_at đã tính toán
        status: newStatus,
        description: info.description || '',
        private_description: info.privateDescription || '',
        tracking_url: info.trackingUrl || '',
        sale_channel: saleChannel,
        traffic_source: channel.trafficSource?.name || '',
        carrier_name: carrier.name || '',
        carrier_code: carrier.carrierCode || '',
        is_declared_fee: carrier.declaredFee ? 1 : 0,
        ecom_order_id: ecomOrderId,
        raw_data: payload
      };

      const { error: orderError } = await supabase.from('orders').upsert(mappedOrder, { onConflict: 'id' });
      if (orderError) console.error(`❌ Lỗi Upsert đơn hàng ${orderId}:`, orderError.message);

      // --------------------------------------------
      // BƯỚC 2.3: LƯU LỊCH SỬ ĐƠN HÀNG (nếu có đổi trạng thái)
      // --------------------------------------------
      if (newStatus !== oldStatus) {
        const historyId = crypto.randomUUID();
        const historyPayload = {
          id: historyId,
          order_id: orderId,
          created_at: new Date().toISOString(),
          created_by_name: creatorName,
          status_old: oldStatus,
          status_new: newStatus,
          step: null
        };

        const { error: historyErr } = await supabase.from('order_histories').insert([historyPayload]);
        if (historyErr) console.error(`❌ Lỗi ghi lịch sử đơn hàng ${orderId}:`, historyErr.message);
      }

      // --------------------------------------------
      // BƯỚC 2.4: XỬ LÝ SẢN PHẨM ĐƠN HÀNG
      // --------------------------------------------
      const orderProducts = data?.products || [];
      if (Array.isArray(orderProducts) && orderProducts.length > 0) {
        await supabase.from('order_products').delete().eq('order_id', orderId);

        const productInsertions = orderProducts.map((prod: any) => ({
          order_id: orderId,
          product_id: String(prod.id || ''),
          product_code: String(prod.code || ''),
          product_name: prod.name || '',
          quantity: Number(prod.quantity || 0)
        }));

        const { error: prodError } = await supabase.from('order_products').insert(productInsertions);
        if (prodError) console.error(`❌ Lỗi đồng bộ SP vào đơn ${orderId}:`, prodError.message);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: any) {
    console.error("❌ Lỗi cục bộ Webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 200 })
  }
})
