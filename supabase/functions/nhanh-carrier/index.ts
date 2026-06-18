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
    const payload = await req.json();
    const { action, orderIds } = payload;

    if (action !== 'sendCarrier' || !Array.isArray(orderIds) || orderIds.length === 0) {
        return new Response(JSON.stringify({ success: false, message: 'Dữ liệu không hợp lệ.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: configs } = await supabase.from('system_configs').select('key, value').in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);
    const configMap: Record<string, string> = {};
    configs?.forEach(c => configMap[c.key] = c.value);
    
    const accessToken = configMap['nhanh_access_token'];
    const appId = configMap['nhanh_app_id'];
    const bizId = configMap['nhanh_business_id'] || '';

    if (!accessToken || !appId) {
        return new Response(JSON.stringify({ success: false, message: 'Chưa cấu hình API Nhanh.vn' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // =========================================================
    // ⚡️ HÀM GỌI API CHUẨN: Dùng open.nhanh.vn/api
    // =========================================================
    const callNhanhApi = async (endpoint: string, dataObj: any) => {
      const formData = new URLSearchParams();
      formData.append('version', '3.0');
      formData.append('appId', appId);
      formData.append('businessId', bizId);
      formData.append('accessToken', accessToken);
      formData.append('data', JSON.stringify(dataObj));

      // ⚡️ ĐÃ SỬA: Luôn gọi về cổng Open API tiêu chuẩn
      const res = await fetch(`https://open.nhanh.vn/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      
      const text = await res.text();
      try { return JSON.parse(text); } 
      catch (e) { return { code: 0, messages: [text.substring(0, 200)] }; }
    };

    // =========================================================
    // ⚡️ VÒNG LẶP ĐẨY ĐƠN
    // =========================================================
    for (const id of orderIds) {
        try {
            console.log(`Đang bắn đơn ${id} sang HVC...`);
            
            // Payload chuẩn API V3 theo đúng tài liệu /order/edit
            const apiPayload = {
                id: parseInt(id, 10),
                sendCarrier: 1 // Cờ gửi hãng vận chuyển
            };

            // ⚡️ LỖI 404 TRƯỚC ĐÂY LÀ DO CHỖ NÀY! Phải là /order/edit chứ KHÔNG phải /order/update
            const result = await callNhanhApi("/order/edit", apiPayload);
            
            if (result.code === 1) {
                successCount++;
                results.push({ id, status: 'success' });
                console.log(`✅ Thành công gửi HVC đơn: ${id}`);
            } else {
                errorCount++;
                const errMsg = Array.isArray(result.messages) ? result.messages.join(', ') : (result.messages || 'Lỗi không xác định');
                results.push({ id, status: 'error', message: errMsg });
                console.error(`❌ Nhanh.vn từ chối đơn ${id}:`, errMsg);
            }
        } catch (err: any) {
            errorCount++;
            results.push({ id, status: 'error', message: err.message });
            console.error(`❌ Exception hệ thống tại đơn ${id}:`, err.message);
        }
    }

    const finalMessage = errorCount === 0 
        ? `✅ Đã đẩy thành công ${successCount} đơn sang hãng vận chuyển.` 
        : `Gửi thành công ${successCount} đơn. Bị từ chối ${errorCount} đơn (Bật F12 xem Network/Console để biết chi tiết lỗi).`;

    return new Response(JSON.stringify({ 
        success: errorCount === 0 || successCount > 0, 
        message: finalMessage,
        details: results
    }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});