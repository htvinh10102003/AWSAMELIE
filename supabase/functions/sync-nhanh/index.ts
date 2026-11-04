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

    // 1. Lấy cấu hình từ system_configs
    const { data: configs, error: configError } = await supabase
      .from('system_configs')
      .select('key, value')
      .in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);

    if (configError) throw new Error("Lỗi đọc bảng cấu hình: " + configError.message);

    const configMap: Record<string, string> = {};
    configs?.forEach(c => configMap[c.key] = c.value);

    if (!configMap['nhanh_app_id'] || !configMap['nhanh_access_token']) {
      throw new Error("Thiếu nhanh_app_id hoặc nhanh_access_token trong system_configs!");
    }

    const appId = configMap['nhanh_app_id'];
    const businessId = configMap['nhanh_business_id'];
    const accessToken = configMap['nhanh_access_token'];

    let totalSynced = 0;
    const totalChunks = Math.ceil(days / CHUNK_DAYS);

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
          // Nhanh KHONG ho tro sort o order/list (loi that 2026-11-02:
          // "Khong ho tro sort", code 0) nen khong gui sort nua; phan trang
          // chay bang cursor (paginator.next), thu tu mac dinh cua Nhanh
          // khong anh huong tinh dung dan vi upsert theo id va quet du
          // khoang updatedAt.
          paginator: { size: 50 }
        };
        if (nextCursor) payload.paginator.next = nextCursor;

        // Gọi API Nhanh.vn với JSON (giống file local). Thử lại khi lỗi
        // mạng/DNS (request chưa tới được Nhanh nên thử lại là an toàn;
        // chỉ thử lại khi fetch ném lỗi, không thử lại khi Nhanh đã
        // trả lỗi).
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
                  'Content-Type': 'application/json' // Sửa thành JSON
                },
                body: JSON.stringify(payload) // Gửi thẳng JSON object
              }
            );
            fetchError = null;
            break;
          } catch (e: any) {
            fetchError = e;
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
        if (!res) {
          console.error('[sync-nhanh] Khong goi duoc API Nhanh sau 3 lan thu:', String(fetchError?.message || fetchError).substring(0, 500));
          throw fetchError;
        }

        const result = await res.json();

        // Log để đọc trong Supabase Dashboard > Edge Functions > sync-nhanh
        // > Logs. Chỉ log phản hồi của Nhanh, KHÔNG log access token.
        if (result.code !== 1) {
          const logged = { httpStatus: res.status, code: result.code, errorCode: result.errorCode, messages: result.messages, message: result.message, error: result.error };
          console.error('[sync-nhanh] Nhanh tra loi loi:', JSON.stringify(logged).substring(0, 2000));
        }

        // Nếu API trả lỗi, ném ra message để giao diện hiển thị.
        // Nhanh có khi trả messages là chuỗi (không phải mảng) nên không
        // được lấy messages[0] — với chuỗi đó là ký tự đầu tiên (đã từng
        // hiện ra chỉ chữ "K" và che mất lỗi thật).
        if (result.code !== 1) {
          const rawMsg = result.messages;
          const errMsg = (Array.isArray(rawMsg) ? rawMsg.join(', ') : rawMsg)
            || result.message || result.errorCode || result.error || 'Lỗi không xác định từ Nhanh.vn';
          throw new Error(`Nhanh.vn báo lỗi: ${errMsg} (code: ${result.code}${result.errorCode ? ', ' + result.errorCode : ''})`);
        }

        if (result.data && result.data.length > 0) {
          const rawOrders = result.data;
          const ordersToUpsert: any[] = [];
          const productInsertions: any[] = [];
          const orderIds: string[] = [];
          // Nhận đón: info.tags của API order/list. Chỉ đơn mới đồng bộ
          // mới có nhãn (đơn cũ bỏ qua, cào lại sau). Bảng order_tags
          // thay toàn bộ nhãn của đơn mỗi lần đồng bộ lại đơn đó.
          const tagInsertions: any[] = [];
          const tagListRows: any[] = [];

          rawOrders.forEach((order: any) => {
            const info = order.info || {};
            const carrier = order.carrier || {};
            const channel = order.channel || {};
            if (!info.id) return;
            const orderId = String(info.id);
            orderIds.push(orderId);

            // Giữ ngày đi cũ: chỉ ghi carrier_date khi Nhanh có trả ngày.
            // Nhanh không trả sendCarrier.date (vd đơn đã giao) mà ghi NULL
            // sẽ xóa mất ngày đi quét từ sheet trước đó. Bỏ cột khỏi upsert
            // thì PostgREST giữ nguyên giá trị cũ trong DB.
            const carrierDate = safeDate(carrier.sendCarrier?.date);
            ordersToUpsert.push({
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
            });

            if (Array.isArray(info.tags)) {
              info.tags.forEach((tag: any) => {
                if (tag.id === undefined || tag.id === null) return;
                const tagId = String(tag.id);
                tagInsertions.push({
                  order_id: orderId,
                  tag_id: tagId,
                  tag_name: tag.name || '',
                  bg_color: tag.bgColor || null,
                  text_color: tag.textColor || null
                });
                tagListRows.push({
                  tag_id: tagId,
                  name: tag.name || '',
                  bg_color: tag.bgColor || null,
                  text_color: tag.textColor || null,
                  status: tag.status ?? null,
                  updated_at: new Date().toISOString()
                });
              });
            }

            if (order.products && Array.isArray(order.products)) {
              order.products.forEach((prod: any) => {
                productInsertions.push({
                  order_id: orderId,
                  product_id: prod.id != null ? String(prod.id) : null,
                  product_code: String(prod.code || prod.productCode || ''),
                  product_name: prod.name || prod.productName || '',
                  quantity: Number(prod.quantity || 0),
                  price: Number(prod.price || 0)
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
            // Nhận: xóa nhãn cũ của các đơn trong đợt rồi ghi nhãn mới.
            // Bảng chưa có (chưa chạy migration) thì bỏ qua, không làm
            // hỏng đợt đồng bộ.
            await supabase.from('order_tags').delete().in('order_id', orderIds).then(() => {});
            if (tagInsertions.length > 0) {
              await supabase.from('order_tags').insert(tagInsertions).then(() => {});
            }
            if (tagListRows.length > 0) {
              await supabase.from('nhanh_tags').upsert(tagListRows, { onConflict: 'tag_id' }).then(() => {});
            }
            totalSynced += ordersToUpsert.length;
          }
        }
        nextCursor = result.paginator?.next || '';
        await new Promise(resolve => setTimeout(resolve, 300));
      } while (nextCursor);
    }

    console.log(`[sync-nhanh] Dong bo xong: ${totalSynced} don.`);
    return new Response(JSON.stringify({ success: true, totalSynced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});
