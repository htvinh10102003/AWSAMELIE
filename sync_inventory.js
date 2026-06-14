import 'dotenv/config';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, 
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
);

async function syncInventory() {
    console.log('🔑 Đang lấy cấu hình từ Database...');
    const { data: configs } = await supabase.from('system_configs').select('*');
    const configMap = {};
    configs.forEach(c => configMap[c.key] = c.value);

    const APP_ID = configMap['nhanh_app_id'];
    const BUSINESS_ID = configMap['nhanh_business_id'];
    const ACCESS_TOKEN = configMap['nhanh_access_token'];

    if (!APP_ID || !BUSINESS_ID || !ACCESS_TOKEN) {
        console.error('❌ Database chưa có đủ cấu hình.');
        process.exit(1);
    }

    console.log(`🚀 Bắt đầu cào toàn bộ Tồn kho sản phẩm từ Nhanh.vn...`);

    let nextCursor = '';
    let page = 1;
    let totalSynced = 0;

    do {
        console.log(`⏳ Đang kéo trang tồn kho ${page}...`);
        try {
            const payload = {
                filters: {},
                paginator: { size: 100 }
            };
            if (nextCursor) payload.paginator.next = nextCursor;

            const response = await axios.post(
                `https://pos.open.nhanh.vn/v3.0/product/inventory?appId=${APP_ID}&businessId=${BUSINESS_ID}`, 
                payload, 
                { headers: { 'Authorization': ACCESS_TOKEN } }
            );

            const result = response.data;
            
            if (result.code === 1 && result.data && result.data.length > 0) {
                const uniqueInventoryMap = new Map();

                result.data.forEach(prod => {
                    const prodId = String(prod.productId); 
                    const depots = prod.inventory?.depots || [];

                    // CỘNG DỒN TẤT CẢ CÁC KHO CON ĐỂ RA SỐ CHUẨN
                    const totalRemain = depots.reduce((sum, d) => sum + Number(d.remain || 0), 0);
                    const totalShipping = depots.reduce((sum, d) => sum + Number(d.shipping || 0), 0);
                    
                    if (uniqueInventoryMap.has(prodId)) {
                        const existing = uniqueInventoryMap.get(prodId);
                        existing.remain += totalRemain;
                        existing.shipping += totalShipping;
                        existing.on_hand = existing.remain - existing.shipping;
                    } else {
                        uniqueInventoryMap.set(prodId, {
                            product_id: prodId,
                            product_code: prod.barcode || '', 
                            product_name: prod.name || '',
                            remain: totalRemain,
                            shipping: totalShipping,
                            on_hand: totalRemain - totalShipping, // Công thức chuẩn theo ý ông
                            last_synced: new Date().toISOString()
                        });
                    }
                });

                const inventoryData = Array.from(uniqueInventoryMap.values());

                const { error: upsertError } = await supabase
                    .from('product_inventories')
                    .upsert(inventoryData, { onConflict: 'product_id' });

                if (upsertError) {
                    console.error(`⚠️ Lỗi lưu DB trang ${page}:`, upsertError.message);
                } else {
                    totalSynced += inventoryData.length;
                }

                nextCursor = result.paginator?.next || '';
                page++;
                await new Promise(resolve => setTimeout(resolve, 500)); 
            } else {
                nextCursor = '';
            }
        } catch (error) {
            console.error(`❌ Lỗi kéo trang ${page}:`, error.message);
            break;
        }
    } while (nextCursor);

    console.log(`🎉 XONG! Đã vét sạch tồn kho của ${totalSynced} mã sản phẩm vào Database.`);
}

syncInventory();