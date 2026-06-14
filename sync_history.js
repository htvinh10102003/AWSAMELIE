import 'dotenv/config';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, 
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
);

function chunkArray(arr, size) {
    const chunked = [];
    let index = 0;
    while (index < arr.length) {
        chunked.push(arr.slice(index, size + index));
        index += size;
    }
    return chunked;
}

async function syncHistory() {
    console.log('🔑 Đang lấy cấu hình từ Database...');
    const { data: configs, error: configError } = await supabase.from('system_configs').select('*');
    if (configError) throw configError;

    const configMap = {};
    configs.forEach(c => configMap[c.key] = c.value);

    const APP_ID = configMap['nhanh_app_id'];
    const BUSINESS_ID = configMap['nhanh_business_id'];
    const ACCESS_TOKEN = configMap['nhanh_access_token'];

    if (!APP_ID || !BUSINESS_ID || !ACCESS_TOKEN) {
        console.error('❌ Database chưa có đủ cấu hình. Hãy lên Dashboard điền trước!');
        process.exit(1);
    }

    console.log('📦 Đang quét danh sách Đơn hàng từ Supabase để lấy ID...');
    
    let allOrderIds = [];
    let start = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('orders')
            .select('id')
            .range(start, start + limit - 1);
            
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allOrderIds.push(...data.map(o => parseInt(o.id)));
        if (data.length < limit) break;
        start += limit;
    }

    if (allOrderIds.length === 0) {
        console.log('⚠️ Không có đơn hàng nào trong Database.');
        return;
    }

    const chunks = chunkArray(allOrderIds, 100);
    console.log(`🚀 Tìm thấy ${allOrderIds.length} đơn hàng. Chia thành ${chunks.length} mẻ để rà soát lịch sử đóng gói...`);

    let totalLogs = 0;
    let totalPackedRecords = 0;

    for (let i = 0; i < chunks.length; i++) {
        console.log(`⏳ Đang xử lý mẻ ${i + 1}/${chunks.length}...`);
        let nextCursor = '';
        
        do {
            try {
                const payload = {
                    filters: { orderIds: chunks[i] },
                    paginator: { size: 100 }
                };

                if (nextCursor) payload.paginator.next = nextCursor;

                const response = await axios.post(
                    `https://pos.open.nhanh.vn/v3.0/order/history?appId=${APP_ID}&businessId=${BUSINESS_ID}`, 
                    payload, 
                    { headers: { 'Authorization': ACCESS_TOKEN } }
                );

                const result = response.data;
                
                if (result.code === 1 && result.data && result.data.length > 0) {
                    const historyData = [];
                    
                    for (const log of result.data) {
                        const statusNew = log.status?.new || null;
                        const orderId = String(log.orderId);
                        const createdAt = new Date(log.createdAt * 1000).toISOString();
                        const createdByName = log.createdBy || '';

                        historyData.push({
                            id: String(log.logId),             
                            order_id: orderId,     
                            created_at: createdAt,
                            created_by_name: createdByName,
                            status_old: log.status?.old || null,
                            status_new: statusNew,
                            step: log.step || null
                        });

                        // ĐÚNG KHÚC ÔNG CẦN: Lọc riêng hành động cập nhật sang trạng thái Đã đóng gói (code 40)
                        if (statusNew === 40) {
                            totalPackedRecords++;
                            // Cập nhật trực tiếp thời gian gói và người gói vào bảng orders chính
                            await supabase
                                .from('orders')
                                .update({ 
                                    packed_at: createdAt, 
                                    packed_by_name: createdByName 
                                })
                                .eq('id', orderId);
                        }
                    }

                    // Vẫn lưu vào bảng lịch sử tổng để làm dữ liệu đối chiếu đối soát
                    if (historyData.length > 0) {
                        await supabase.from('order_histories').upsert(historyData, { onConflict: 'id' });
                        totalLogs += historyData.length;
                    }

                    nextCursor = result.paginator?.next || '';
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    nextCursor = '';
                }
            } catch (error) {
                console.error(`❌ Lỗi mẻ ${i + 1}:`, error.message);
                break;
            }
        } while (nextCursor);
    }

    console.log(`\n🎉 HOÀN TẤT ĐỒNG BỘ LỊCH SỬ SẠCH SẼ!`);
    console.log(`✅ Đã nạp ${totalLogs} log hệ thống vào bảng 'order_histories'.`);
    console.log(`🎯 Đã bóc tách chuẩn xác ${totalPackedRecords} đơn hàng tìm thấy vết đóng gói (mã 40), tự động điền Tên nhân viên kho và Ngày giờ gói vào thẳng bảng 'orders'!`);
}

syncHistory();