import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action, payload } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: configs } = await supabase.from('system_configs')
      .select('key, value')
      .in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);
    const configMap: Record<string, string> = {};
    configs?.forEach(c => configMap[c.key] = c.value);
    
    const accessToken = configMap['nhanh_access_token'];
    const appId = configMap['nhanh_app_id'];
    const bizId = configMap['nhanh_business_id'] || '';

    // =========================================================
    // HÀM GỌI API NHANH.VN (CHUẨN JSON, TOKEN TRONG HEADER)
    // =========================================================
    const callNhanhApi = async (endpoint: string, dataObj: any) => {
      const url = `https://pos.open.nhanh.vn/v3.0${endpoint}?appId=${appId}&businessId=${bizId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataObj)
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { code: 0, messages: [text.substring(0, 200)] };
      }
    };

    // ==========================================
    // ACTION: SEARCH
    // ==========================================
    if (action === 'search') {
      const searchCode = String(payload.code).trim();
      const debugLogs: string[] = [];
      let finalOrder: any = null;

      console.log(`[START] Tìm kiếm với mã: ${searchCode}`);

      // ----------------------------
      // TẦNG 1: DB LOCAL
      // ----------------------------
      const { data: byCarrier } = await supabase
        .from('orders')
        .select('id, created_at')
        .like('carrier_code', `%${searchCode}%`)
        .limit(1);
      
      if (byCarrier && byCarrier.length > 0) {
        const targetId = String(byCarrier[0].id);
        const { data: prods } = await supabase
          .from('order_products')
          .select('product_id, product_code, product_name, quantity')
          .eq('order_id', targetId);
        finalOrder = {
          id: targetId,
          customerName: "Khách hàng hệ thống",
          customerMobile: "",
          products: (prods || []).map((p: any) => ({
            id: p.product_id,
            productCode: p.product_code,
            productName: p.product_name,
            quantity: p.quantity
          }))
        };
        debugLogs.push(`✅ T1-Carrier: tìm thấy ID=${targetId}`);
        return new Response(JSON.stringify({ success: true, order: finalOrder, debug: debugLogs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (/^\d+$/.test(searchCode)) {
        const { data: byId } = await supabase
          .from('orders')
          .select('id, created_at')
          .eq('id', parseInt(searchCode, 10))
          .limit(1);
        if (byId && byId.length > 0) {
          const targetId = String(byId[0].id);
          const { data: prods } = await supabase
            .from('order_products')
            .select('product_id, product_code, product_name, quantity')
            .eq('order_id', targetId);
          finalOrder = {
            id: targetId,
            customerName: "Khách hàng hệ thống",
            customerMobile: "",
            products: (prods || []).map((p: any) => ({
              id: p.product_id,
              productCode: p.product_code,
              productName: p.product_name,
              quantity: p.quantity
            }))
          };
          debugLogs.push(`✅ T1-ID: tìm thấy ID=${targetId}`);
          return new Response(JSON.stringify({ success: true, order: finalOrder, debug: debugLogs }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ----------------------------
      // TẦNG 2: ECOM RETURN -> LẤY originalEcomOrderId
      // ----------------------------
      const ecomAppIds = [8195, 8198, 8193]; // Shopee, TikTok, Lazada
      for (const eId of ecomAppIds) {
        try {
          debugLogs.push(`T2: Thử sàn appId=${eId}`);
          const ecomRes = await callNhanhApi("/ecom/return", {
            filters: {
              appId: eId,
              returnIdOrReturnTrackingNumber: searchCode
            }
          });
          console.log(`[T2] appId=${eId} resp:`, JSON.stringify(ecomRes).substring(0, 300));
          debugLogs.push(`T2 appId=${eId}: code=${ecomRes?.code}`);

          if (ecomRes?.code === 1 && Array.isArray(ecomRes.data) && ecomRes.data.length > 0) {
            const originalEcomOrderId = ecomRes.data[0].originalEcomOrderId;
            debugLogs.push(`✅ T2: originalEcomOrderId = ${originalEcomOrderId}`);
            if (!originalEcomOrderId) {
              debugLogs.push("⚠️ Không có originalEcomOrderId");
              break;
            }

            // ----------------------------
            // TẦNG 3: DÙNG order/list VỚI privateId
            // ----------------------------
            const listPayload = {
              filters: { privateId: originalEcomOrderId },
              paginator: { size: 1 },
              dataOptions: {}
            };
            const listRes = await callNhanhApi("/order/list", listPayload);
            console.log(`[T3] order/list resp:`, JSON.stringify(listRes).substring(0, 300));
            debugLogs.push(`T3 order/list: code=${listRes?.code}`);

            if (listRes?.code === 1 && Array.isArray(listRes.data) && listRes.data.length > 0) {
              const orderData = listRes.data[0];
              // Chuyển đổi cấu trúc về dạng dễ dùng cho client
              finalOrder = {
                id: orderData.info?.id,
                type: orderData.info?.type,
                status: orderData.info?.status,
                customerName: orderData.shippingAddress?.name || "",
                customerMobile: orderData.shippingAddress?.mobile || "",
                carrierCode: orderData.carrier?.carrierCode || "",
                products: (orderData.products || []).map((p: any) => ({
                  id: p.id,
                  code: p.code,
                  name: p.name,
                  quantity: p.quantity,
                  price: p.price,
                  discount: p.discount
                })),
                // Giữ lại toàn bộ để client có thêm thông tin nếu cần
                raw: orderData
              };
              debugLogs.push(`✅ T3: Đã lấy đơn hàng từ order/list`);
              break;
            } else {
              debugLogs.push(`❌ T3: Không tìm thấy đơn với privateId = ${originalEcomOrderId}`);
            }
            break; // Dừng quét sàn khác
          }
        } catch (e: any) {
          debugLogs.push(`❌ Lỗi T2 appId=${eId}: ${e.message}`);
        }
      }

      if (finalOrder) {
        return new Response(JSON.stringify({ success: true, order: finalOrder, debug: debugLogs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ success: false, message: 'Không tìm thấy đơn gốc', debug: debugLogs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
    }

    // ==========================================
    // ACTION: SUBMIT (giữ nguyên)
    // ==========================================
    if (action === 'submit') {
      const { returnType, orderId, trackingCode, customerName, customerMobile, returnedProducts } = payload;

      if (returnType === 'FULL') {
        const result = await callNhanhApi("/order/update", { id: orderId, status: 72 });
        if (result.code === 1) {
          return new Response(JSON.stringify({ success: true, message: 'Đã hoàn toàn bộ.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          throw new Error(Array.isArray(result.messages) ? result.messages.join(', ') : 'Lỗi API Nhanh');
        }
      }

      if (returnType === 'PARTIAL' || returnType === 'EXTERNAL') {
        const nhanhProducts = returnedProducts.map((p: any) => ({
          id: p.id,
          quantity: p.qty,
          price: 0
        }));
        const addPayload = {
          type: 16,
          status: 'Confirmed',
          customerName: customerName || "Khách Trả Hàng Vô Danh",
          customerMobile: customerMobile || "0999999999",
          description: `Hệ thống xử lý hoàn cho mã: ${trackingCode}`,
          products: nhanhProducts
        };
        const result = await callNhanhApi("/order/add", addPayload);
        if (result.code === 1) {
          return new Response(JSON.stringify({ success: true, message: `Đã tạo Đơn hoàn 1 phần.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          throw new Error(Array.isArray(result.messages) ? result.messages.join(', ') : 'Lỗi API tạo đơn');
        }
      }
    }

    return new Response(JSON.stringify({ success: false, message: 'Invalid Action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});