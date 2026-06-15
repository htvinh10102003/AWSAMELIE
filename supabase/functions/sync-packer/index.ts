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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { daysToSync } = await req.json();
    const days = daysToSync || 1;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. ĐỌC API KEY TỪ BẢNG SYSTEM_CONFIGS
    const { data: configs, error: configError } = await supabase
      .from('system_configs')
      .select('key, value')
      .in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);

    if (configError) throw new Error("Lỗi đọc system_configs: " + configError.message);

    const configMap: Record<string, string> = {};
    configs?.forEach(c => configMap[c.key] = c.value);

    const appId = configMap['nhanh_app_id'];
    const businessId = configMap['nhanh_business_id'];
    const accessToken = configMap['nhanh_access_token'];

    if (!appId || !accessToken) {
      throw new Error("Thiếu cấu hình API Nhanh.vn trong database!");
    }

    // 2. LỌC CÁC ĐƠN HÀNG TRONG VÒNG X NGÀY QUA MÀ ĐANG BỊ MISS NGƯỜI ĐÓNG GÓI
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const fromDateIso = targetDate.toISOString().split('T')[0] + "T00:00:00.000Z";

    const { data: targetOrders, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .not('packed_at', 'is', null) // Đã có lịch sử quét gói hàng
      .or('packed_by_name.is.null,packed_by_name.eq.""') // Nhưng tên bị rỗng/null
      .gte('packed_at', fromDateIso);

    if (orderError) throw new Error("Lỗi truy vấn đơn hàng: " + orderError.message);
    if (!targetOrders || targetOrders.length === 0) {
      return new Response(JSON.stringify({ success: true, totalFixed: 0, message: "Không có đơn nào bị miss thông tin!" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalFixed = 0;

    // 3. VÒNG LẶP CUỐN CHIẾU: GÕ CỬA TỪNG ĐƠN ĐỂ LẤY LỊCH SỬ THAO TÁC
    for (const order of targetOrders) {
      try {
        const payload = { orderId: order.id };
        
        const res = await fetch(`https://pos.open.nhanh.vn/v3.0/order/history?appId=${appId}&businessId=${businessId}`, {
          method: 'POST',
          headers: { 'Authorization': accessToken, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: JSON.stringify(payload) })
        });

        const result = await res.json();

        if (result.code === 1 && result.data && Array.isArray(result.data)) {
          // Tìm trong mảng lịch sử: Bản ghi nào chuyển trạng thái sang 40 (Đã đóng gói)
          const packingLog = result.data.find((log: any) => 
            String(log.status) === '40' || 
            (log.description && log.description.includes('trạng thái sang [Đã đóng gói]'))
          );

          if (packingLog) {
            // Lấy tên người thực hiện thao tác
            const operatorName = packingLog.employeeName || packingLog.createdByName || '';

            if (operatorName) {
              // Cập nhật bọc thép ngược lại vào bảng orders
              await supabase
                .from('orders')
                .update({ packed_by_name: operatorName.trim() })
                .eq('id', order.id);
              
              totalFixed++;
            }
          }
        }
        // Delay nhẹ 150ms tránh bị Nhanh bóp nghẹt băng thông chống DDOS
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (singleErr) {
        console.error(`Lỗi khi bốc lịch sử đơn ${order.id}:`, singleErr);
      }
    }

    return new Response(JSON.stringify({ success: true, totalFixed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});