import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function safeDate(value: any) {
  if (!value) return null;
  if (!isNaN(value)) return new Date(Number(value) * 1000).toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { daysToSync } = await req.json();
    const days = daysToSync || 1;
    const CHUNK_DAYS = 15;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ⚡️ 1. BỐC SẠCH CONFIG TỪ DATABASE (LẤY ĐÍNH DANH ACCESS_TOKEN SỐNG 1 NĂM)
    const { data: configs, error: configError } = await supabase
      .from('system_configs')
      .select('key, value')
      .in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);

    if (configError) throw new Error("Lỗi khi đọc bảng cấu hình: " + configError.message);

    const configMap: Record<string, string> = {};
    configs?.forEach(c => configMap[c.key] = c.value);

    if (!configMap['nhanh_app_id'] || !configMap['nhanh_access_token']) {
      throw new Error("Thiếu nhanh_app_id hoặc nhanh_access_token trong bảng system_configs!");
    }

    // Gán thẳng Token hạn 1 năm của ông vào đây luôn
    const accessToken = configMap['nhanh_access_token'];
    
    let totalSynced = 0;
    const totalChunks = Math.ceil(days / CHUNK_DAYS);

    // ⚡️ 2. VÒNG LẶP CHIA NHỎ KHUNG GIỜ ĐỂ QUÉT ĐƠN
    for (let i = 0; i < totalChunks; i++) {
      const chunkEndDate = new Date();
      chunkEndDate.setDate(chunkEndDate.getDate() - (i * CHUNK_DAYS));
      const chunkStartDate = new Date(chunkEndDate);
      const daysLeft = days - (i * CHUNK_DAYS);
      chunkStartDate.setDate(chunkStartDate.getDate() - Math.min(CHUNK_DAYS, daysLeft));

      let nextCursor = '';
      do {
        const payload: any = {
          filters: {
            updatedAtFrom: Math.floor(chunkStartDate.getTime() / 1000),
            updatedAtTo: Math.floor(chunkEndDate.getTime() / 1000)
          },
          paginator: { size: 50, sort: { id: "desc" } }
        };
        if (nextCursor) payload.paginator.next = nextCursor;

        // Gọi thẳng API danh sách đơn với Token có sẵn
        const res = await fetch(`https://pos.open.nhanh.vn/v3.0/order/list?appId=${configMap['nhanh_app_id']}&businessId=${configMap['nhanh_business_id']}`, {
          method: 'POST',
          headers: { 'Authorization': accessToken, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: JSON.stringify(payload) })
        });
        const result = await res.json();

        if (result.code === 1 && result.data && result.data.length > 0) {
          const rawOrders = result.data;
          const ordersToUpsert: any[] = [];
          const productInsertions: any[] = [];
          const orderIds: string[] = [];

          rawOrders.forEach((order: any) => {
            const info = order.info || {};
            const carrier = order.carrier || {};
            const channel = order.channel || {};
            if (!info.id) return;
            const orderId = String(info.id);
            orderIds.push(orderId);

            ordersToUpsert.push({
              id: orderId,
              status: info.status || null,
              created_at: safeDate(info.createdAt) || new Date().toISOString(),
              carrier_code: carrier.carrierCode || '',
              carrier_name: carrier.name || '',
              carrier_date: safeDate(carrier.sendCarrier?.date),
              is_declared_fee: carrier.isDeclaredFee ? 1 : 0,
              sale_channel: channel.saleChannel || null,
              created_by_name: info.createdByName || ''
            });

            if (order.products && Array.isArray(order.products)) {
              order.products.forEach((prod: any) => {
                productInsertions.push({
                  order_id: orderId,
                  product_code: String(prod.code || prod.productCode || ''),
                  product_name: prod.name || prod.productName || '',
                  quantity: Number(prod.quantity || 0)
                });
              });
            }
          });

          if (ordersToUpsert.length > 0) {
            await supabase.from('orders').upsert(ordersToUpsert, { onConflict: 'id' });
            if (productInsertions.length > 0) {
              await supabase.from('order_products').delete().in('order_id', orderIds);
              await supabase.from('order_products').insert(productInsertions);
            }
            totalSynced += ordersToUpsert.length;
          }

          nextCursor = result.paginator?.next || '';
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          nextCursor = '';
        }
      } while (nextCursor);
    }

    return new Response(JSON.stringify({ success: true, totalSynced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});