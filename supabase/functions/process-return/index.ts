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

    if (!accessToken || !appId) {
        return new Response(JSON.stringify({ success: false, message: 'Chưa cấu hình API Nhanh.vn' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Hàm gọi API Nhanh chuẩn V3
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
      try { return JSON.parse(text); } 
      catch (e) { return { code: 0, messages: [text.substring(0, 200)] }; }
    };

    // ==========================================
    // ⚡️ ACTION: SEARCH (TÌM MÃ ĐƠN HOÀN)
    // ==========================================
    if (action === 'search') {
      const searchCode = String(payload?.code || '').trim();
      const debugLogs: string[] = [];
      let finalOrder: any = null;
      let targetNhanhId: string | null = null; 
      let localStatus: number | null = null;

      console.log(`[START] Săn đơn hoàn cho mã: ${searchCode}`);

      // ----------------------------
      // 🔍 TẦNG 1: QUÉT DB NHÀ (TÌM THEO MÃ VẬN ĐƠN ĐI HOẶC ID NHANH)
      // ----------------------------
      const { data: byCarrier } = await supabase.from('orders').select('id, status').eq('carrier_code', searchCode).limit(1);
      
      if (byCarrier && byCarrier.length > 0) {
        targetNhanhId = String(byCarrier[0].id);
        localStatus = byCarrier[0].status;
        debugLogs.push(`✅ T1: Khớp mã vận đơn xuất đi -> ID: ${targetNhanhId}`);
      } else if (/^\d+$/.test(searchCode)) {
        const { data: byId } = await supabase.from('orders').select('id, status').eq('id', searchCode).limit(1);
        if (byId && byId.length > 0) {
          targetNhanhId = String(byId[0].id);
          localStatus = byId[0].status;
          debugLogs.push(`✅ T1: Khớp ID Nhanh -> ID: ${targetNhanhId}`);
        }
      }

      // ----------------------------
      // 🔍 TẦNG 2: QUÉT SÀN -> ĐỐI CHIẾU CỘT MỚI ECOM_ORDER_ID
      // ----------------------------
      if (!targetNhanhId) {
        const ecomAppIds = [8195, 8198, 8193, 1, 2, 3]; 
        for (const eId of ecomAppIds) {
          try {
            const ecomRes = await callNhanhApi("/ecom/return", {
              filters: { appId: eId, returnIdOrReturnTrackingNumber: searchCode }
            });
            
            if (ecomRes?.code === 1 && ecomRes.data) {
                const returnList = Array.isArray(ecomRes.data) ? ecomRes.data : Object.values(ecomRes.data);
                if (returnList.length > 0) {
                    const originalEcomOrderId = (returnList[0] as any).originalEcomOrderId;
                    debugLogs.push(`✅ T2: Lấy được Mã Đơn Sàn từ Nhanh: ${originalEcomOrderId}`);
                    
                    if (originalEcomOrderId) {
                        // ⚡️ ĐỘT PHÁ TẠI ĐÂY: Quét thẳng vào cột mới của DB nhà, không thèm gọi order/list nữa!
                        const { data: localMatch } = await supabase
                            .from('orders')
                            .select('id, status')
                            .eq('ecom_order_id', originalEcomOrderId)
                            .limit(1);

                        if (localMatch && localMatch.length > 0) {
                            targetNhanhId = String(localMatch[0].id);
                            localStatus = localMatch[0].status;
                            debugLogs.push(`✅ T2.5: Khớp cột ecom_order_id trong DB -> ID chuẩn: ${targetNhanhId}`);
                            break;
                        } else {
                            debugLogs.push(`⚠️ T2.5: DB chưa có cột ecom_order_id cho đơn này, chuyển hướng gọi API backup...`);
                            // Luồng dự phòng nếu đơn quá cũ chưa được map cột mới
                            const listRes = await callNhanhApi("/order/list", { 
    filters: { appOrderId: originalEcomOrderId }, // ⚡️ Sửa privateId thành appOrderId
    paginator: { size: 1 } 
});
                        }
                    }
                }
            }
          } catch (e: any) {
            console.error(`Lỗi quét sàn ${eId}:`, e.message);
          }
        }
      }

      // ----------------------------
      // 🔍 TẦNG 3: CHECK TRẠNG THÁI (71, 74) & ĐỔ DATA
      // ----------------------------
      const parsedId = parseInt(targetNhanhId || '', 10);
      
      if (targetNhanhId && !isNaN(parsedId)) {
        let currentStatus = localStatus;
        let prodsList = null;
        let customerName = "Khách hàng hệ thống";

        // Đồng bộ trạng thái real-time từ Nhanh phòng trường hợp webhook bị chậm
        if (currentStatus !== 71 && currentStatus !== 74) {
            debugLogs.push(`⚠️ Trạng thái local là ${currentStatus}. Đang check real-time trên Nhanh...`);
            const listRes = await callNhanhApi("/order/list", { filters: { id: parsedId }, paginator: { size: 1 } });
            if (listRes?.code === 1 && Array.isArray(listRes.data) && listRes.data.length > 0) {
                const orderData = listRes.data[0];
                currentStatus = orderData.statusCode || orderData.status || orderData.info?.status;
                customerName = orderData.shippingAddress?.name || "Khách Hàng Nhanh";
                prodsList = (orderData.products || []).map((p: any) => ({
                    id: p.id,
                    productCode: p.code,
                    productName: p.name,
                    quantity: p.quantity
                }));
            }
        }

        // Kiểm tra điều kiện trạng thái hợp lệ
        if (currentStatus === 71 || currentStatus === 74) {
            if (!prodsList) {
                const { data: localProds } = await supabase.from('order_products').select('product_id, product_code, product_name, quantity').eq('order_id', targetNhanhId);
                prodsList = (localProds || []).map((p: any) => ({
                    id: p.product_id,
                    productCode: p.product_code,
                    productName: p.product_name,
                    quantity: p.quantity
                }));
            }

            finalOrder = {
              id: targetNhanhId,
              customerName: customerName, 
              customerMobile: "",
              products: prodsList
            };
            debugLogs.push(`✅ T3: Đơn hợp lệ (${currentStatus}).`);
        } else {
            return new Response(JSON.stringify({ 
                success: false, 
                message: `Đơn hàng mang mã trạng thái: ${currentStatus}. Hệ thống chỉ chấp nhận xử lý đơn hoàn ở trạng thái 71 (Xác nhận hoàn) hoặc 74 (Đang hoàn)!`, 
                debug: debugLogs 
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }
      }

      // TRẢ KẾT QUẢ
      if (finalOrder) {
        return new Response(JSON.stringify({ success: true, order: finalOrder, debug: debugLogs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ success: false, message: 'Không tìm thấy mã đơn gốc trên hệ thống.', debug: debugLogs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
    }

    // ==========================================
    // ACTION: SUBMIT (Hoàn thành đơn)
    // ==========================================
    if (action === 'submit') {
      const submitPayload = payload.payload || payload; 
      const { returnType, orderId, trackingCode, customerName, customerMobile, returnedProducts } = submitPayload;

      if (returnType === 'FULL') {
        const updatePayload = { info: { id: parseInt(orderId, 10), status: 72 } };
        const result = await callNhanhApi("/order/edit", updatePayload);
        if (result.code === 1) {
          return new Response(JSON.stringify({ success: true, message: 'Đã hoàn toàn bộ đơn hàng thành công.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          throw new Error(Array.isArray(result.messages) ? result.messages.join(', ') : 'Lỗi API Nhanh');
        }
      }

      if (returnType === 'PARTIAL' || returnType === 'EXTERNAL') {
        const nhanhProducts = returnedProducts.map((p: any) => ({ id: p.id, quantity: p.qty, price: 0 }));
        const addPayload = {
          type: 16,
          status: 'Confirmed',
          customerName: customerName || "Khách Trả Hàng Vô Danh",
          customerMobile: customerMobile || "0999999999",
          description: `Hệ thống Amelie xử lý hoàn một phần cho mã: ${trackingCode}`,
          products: nhanhProducts
        };
        const result = await callNhanhApi("/order/add", addPayload);
        if (result.code === 1) {
          return new Response(JSON.stringify({ success: true, message: `Đã tạo Đơn hoàn 1 phần.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          throw new Error(Array.isArray(result.messages) ? result.messages.join(', ') : 'Lỗi API tạo đơn');
        }
      }
    }

    return new Response(JSON.stringify({ success: false, message: 'Invalid Action' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});