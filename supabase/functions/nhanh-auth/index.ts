import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Xử lý CORS preflight cho trình duyệt
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}));
        
        // ⚡️ PHÒNG VỆ VẠN NĂNG: Quét sạch mọi kiểu đặt tên từ Frontend (Camel, Snake, DB Name)
        const appId = body.nhanh_app_id || body.app_id || body.appId;
        const businessId = body.nhanh_business_id || body.business_id || body.businessId;
        const secretKey = body.nhanh_secret_key || body.secret_key || body.secretKey;
        const accessCode = body.nhanh_access_code || body.access_code || body.accessCode || body.code;

        console.log(`🔑 Nhận yêu cầu verify - AppID: ${appId}, BusinessID: ${businessId}`);

        // Nếu vẫn thiếu, nhè thẳng danh sách các key nhận được ra màn hình để soi
        if (!appId || !secretKey || !accessCode) {
            const receivedKeys = Object.keys(body).join(', ') || 'Không có dữ liệu';
            return new Response(JSON.stringify({ 
                error: `Frontend gửi sai tên biến! Hệ thống nhận được các key: [${receivedKeys}]. Nhưng cần phải có đầy đủ thông tin về App ID, Secret Key và Access Code.` 
            }), { 
                status: 400, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        // 1. Gọi API Nhanh.vn để đổi Access Code lấy Access Token
        const res = await fetch(`https://pos.open.nhanh.vn/v3.0/app/getaccesstoken?appId=${appId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                appId: String(appId), 
                accessCode: String(accessCode), 
                secretKey: String(secretKey) 
            })
        });

        const nhanhData = await res.json();
        
        if (nhanhData.code !== 1) {
            const errorMsg = nhanhData.messages || nhanhData.message || JSON.stringify(nhanhData);
            return new Response(JSON.stringify({ error: `Nhanh.vn từ chối cấp Token: ${errorMsg}` }), { 
                status: 400, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        const accessToken = nhanhData.data.accessToken;
        console.log("✅ Đổi Token từ Nhanh.vn thành công!");

        // 2. Khởi tạo Supabase bằng Service Role để ghi cấu hình
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const configsToUpdate = [
            { key: 'nhanh_app_id', value: String(appId) },
            { key: 'nhanh_business_id', value: String(businessId) },
            { key: 'nhanh_secret_key', value: String(secretKey) },
            { key: 'nhanh_access_token', value: String(accessToken) }
        ];

        // Cập nhật tuần tự từng dòng theo Key vào Database
        for (const config of configsToUpdate) {
            const { error: dbError } = await supabase
                .from('system_configs')
                .update({ value: config.value })
                .eq('key', config.key);

            if (dbError) {
                console.error(`❌ Lỗi khi update key [${config.key}]:`, dbError.message);
                return new Response(JSON.stringify({ error: `Lỗi lưu Database tại dòng ${config.key}: ${dbError.message}` }), { 
                    headers: { ...corsHeaders, "Content-Type": "application/json" }, 
                    status: 400 
                });
            }
        }

        return new Response(JSON.stringify({ success: true, message: "Hệ thống đã cập nhật và kích hoạt Token mới thành công!" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 200 
        });

    } catch (error: any) {
        console.error("❌ Lỗi hệ thống Edge Function:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 500 
        });
    }
})