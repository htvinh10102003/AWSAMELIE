import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Dùng SERVICE_ROLE_KEY để có quyền cao nhất đọc bảng system_configs
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function safeDate(value: any) {
    if (!value) return null;
    if (!isNaN(value)) return new Date(Number(value) * 1000).toISOString();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

serve(async (req) => {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Lấy thông tin kết nối từ Database (Do ông vừa nhập trên web React)
        const { data: configs, error: configError } = await supabase.from('system_configs').select('*');
        if (configError) throw configError;

        const configMap: Record<string, string> = {};
        configs?.forEach(c => configMap[c.key] = c.value);

        const APP_ID = configMap['nhanh_app_id'];
        const BUSINESS_ID = configMap['nhanh_business_id'];
        const ACCESS_TOKEN = configMap['nhanh_access_token'];

        if (!APP_ID || !BUSINESS_ID || !ACCESS_TOKEN) {
            return new Response(JSON.stringify({ error: "Chưa cấu hình API Nhanh.vn trên Dashboard" }), { status: 400 });
        }

        // 2. Tính mốc thời gian: Lùi 2 tiếng từ hiện tại
        const endDate = new Date();
        const startDate = new Date();
        startDate.setHours(endDate.getHours() - 2);

        let nextCursor = '';
        let totalSynced = 0;

        // 3. Vòng lặp kéo API và UPSERT
        do {
            const payload: any = {
                filters: {
                    updatedAtFrom: Math.floor(startDate.getTime() / 1000),
                    updatedAtTo: Math.floor(endDate.getTime() / 1000)
                },
                paginator: { size: 50, sort: { id: "desc" } }
            };

            if (nextCursor) payload.paginator.next = nextCursor;

            const res = await fetch(`https://pos.open.nhanh.vn/v3.0/order/list?appId=${APP_ID}&businessId=${BUSINESS_ID}`, {
                method: 'POST',
                headers: { 
                    'Authorization': ACCESS_TOKEN, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            
            if (result.code === 1 && result.data && result.data.length > 0) {
                const rawOrders = result.data;
                const uniqueOrdersMap = new Map();
                const supabaseOrderProducts: any[] = [];

                rawOrders.forEach((order: any) => {
                    const info = order.info || {};
                    const carrier = order.carrier || {};
                    const channel = order.channel || {};

                    if (!info.id) return;

                    const createdAt = safeDate(info.createdAt) || new Date().toISOString(); 
                    const updatedAt = safeDate(info.updatedAt) || createdAt;

                    const mappedOrder = {
                        id: String(info.id), 
                        depot_id: info.depotId || null,
                        created_by_name: info.createdBy?.name || info.createdByName || '',
                        created_at: createdAt,
                        updated_at: updatedAt,
                        packed_at: safeDate(info.packedAt),
                        description: info.description || '',
                        private_description: info.privateDescription || '',
                        status: info.status || null,
                        tracking_url: info.trackingUrl || '',
                        sale_channel: channel.saleChannel || null,
                        traffic_source: channel.trafficSource?.name || channel.trafficSource || '',
                        carrier_name: carrier.name || '',
                        carrier_code: carrier.carrierCode || '', 
                        carrier_date: safeDate(carrier.sendCarrier?.date), 
                        is_declared_fee: carrier.isDeclaredFee || 0
                    };

                    uniqueOrdersMap.set(mappedOrder.id, mappedOrder);

                    if (order.products && Array.isArray(order.products)) {
                        order.products.forEach((prod: any) => {
                            supabaseOrderProducts.push({
                                order_id: String(info.id),
                                product_id: String(prod.id),
                                product_code: String(prod.code),
                                product_name: prod.name || '',
                                quantity: Number(prod.quantity)
                            });
                        });
                    }
                });

                const supabaseOrders = Array.from(uniqueOrdersMap.values());
                
                if (supabaseOrders.length > 0) {
                    await supabase.from('orders').upsert(supabaseOrders, { onConflict: 'id' });
                }

                if (supabaseOrderProducts.length > 0) {
                    // Nhờ cái CONSTRAINT UNIQUE lúc nãy, giờ UPSERT thoải mái không lỗi duplicate
                    await supabase.from('order_products').upsert(supabaseOrderProducts, { onConflict: 'order_id,product_id' });
                }

                totalSynced += result.data.length;
                nextCursor = result.paginator?.next || '';
                
                // Tránh Rate Limit của Nhanh
                await new Promise(r => setTimeout(r, 500));
            } else {
                nextCursor = '';
            }
        } while (nextCursor);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `✅ Đã quét và cập nhật ${totalSynced} đơn hàng trong 2 tiếng qua!` 
        }), { 
            headers: { "Content-Type": "application/json" },
            status: 200 
        });

    } catch (error: any) {
        console.error("❌ Lỗi Cron Sync:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
})