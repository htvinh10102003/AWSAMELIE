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
    const { mode } = await req.json().catch(() => ({ mode: 'master' }));

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: configs, error: configError } = await supabase
      .from('system_configs')
      .select('key, value')
      .in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);

    if (configError) throw new Error("Lỗi đọc cấu hình: " + configError.message);

    const configMap: Record<string, string> = {};
    configs?.forEach(c => configMap[c.key] = c.value);

    if (!configMap['nhanh_app_id'] || !configMap['nhanh_access_token']) {
      throw new Error("Thiếu App ID hoặc Access Token!");
    }

    const accessToken = configMap['nhanh_access_token'];
    const appId = configMap['nhanh_app_id'];
    const bizId = configMap['nhanh_business_id'] || '';
    
    let totalSynced = 0;
    let page = 1;
    let nextCursor: any = null; // ⚡️ Dùng để hứng cái Object Next đỏng đảnh của API Inventory
    let hasNext = true;

    // ⚡️ VÁ LỖI CHÍ MẠNG: Đổi /product/search thành /product/list
    const endpoint = mode === 'inventory' ? '/product/inventory' : '/product/list';

    while (hasNext) {
      const payload: any = { paginator: { limit: 100 } };
      
      // Thuật toán chuyển đổi linh hoạt: Có Cursor thì xài Cursor, không thì xài Số trang
      if (nextCursor) {
        payload.paginator.next = nextCursor;
      } else {
        payload.paginator.page = page;
      }
      
      const res = await fetch(`https://pos.open.nhanh.vn/v3.0${endpoint}?appId=${appId}&businessId=${bizId}`, {
        method: 'POST',
        headers: { 
          'Authorization': accessToken, 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(payload)
      });
      
      const textData = await res.text();
      let result;
      
      try {
        result = JSON.parse(textData);
      } catch (e) {
        console.error("❌ LỖI RAW HTML:", textData.substring(0, 300));
        throw new Error(`Máy chủ Nhanh.vn chặn yêu cầu (Mã ${res.status}). Endpoint: ${endpoint}`);
      }

      if (result.code === 1 && result.data) {
        const rawProducts = result.data.products || result.data;
        const productsList = Array.isArray(rawProducts) ? rawProducts : Object.values(rawProducts);

        if (productsList.length === 0) {
          hasNext = false; 
          break;
        }

        // ===============================================
        // LUỒNG 1: CẬP NHẬT TỒN KHO SIÊU TỐC
        // ===============================================
        if (mode === 'inventory') {
          const promises = productsList.map((prod: any) => {
            const pId = String(prod.idNhanh || prod.id || prod.productId || '');
            if (!pId) return Promise.resolve();

            const remainQty = Number(prod.remain || 0);
            const shippingQty = Number(prod.shipping || 0);
            const onHandQty = remainQty - shippingQty;

            return supabase.from('product_inventories').update({
              remain: remainQty,
              shipping: shippingQty,
              available: Number(prod.available || 0),
              on_hand: onHandQty,
              last_synced: new Date().toISOString()
            }).eq('product_id', pId);
          });

          await Promise.all(promises);
          totalSynced += productsList.length;
        } 
        
        // ===============================================
        // LUỒNG 2: CÀO FULL MASTER DATA
        // ===============================================
        else {
          const productInsertions = productsList.map((prod: any) => {
            const remainQty = Number(prod.inventory?.remain || 0);
            const shippingQty = Number(prod.inventory?.shipping || 0);

            return {
              product_id: String(prod.idNhanh || prod.id || ''),
              product_code: String(prod.barcode || prod.code || ''),
              product_name: prod.name || prod.productName || 'Chưa có tên',
              remain: remainQty,
              shipping: shippingQty,
              available: Number(prod.inventory?.available || 0),
              on_hand: remainQty - shippingQty,
              last_synced: new Date().toISOString()
            };
          }).filter(p => p.product_id); 

          if (productInsertions.length > 0) {
            const { error: dbError } = await supabase.from('product_inventories').upsert(productInsertions, { onConflict: 'product_id' });
            if (dbError) console.error("Lỗi Upsert SP:", dbError.message);
            totalSynced += productInsertions.length;
          }
        }

        // ⚡️ THUẬT TOÁN PHÂN TRANG KÉP: Xử lý linh hoạt mọi API của Nhanh
        if (result.paginator && result.paginator.next) {
          nextCursor = result.paginator.next; // Nếu nhả Object Next thì bắt lấy
          page++;
        } else {
          const totalPages = result.data.totalPages || result.paginator?.totalPages || 1;
          if (page >= totalPages) {
            hasNext = false;
          } else {
            page++;
            nextCursor = null; // Đặt lại null để fallback về page
          }
        }
      } else {
        throw new Error(`Lỗi từ Nhanh.vn: ${result.messages || JSON.stringify(result)}`);
      }
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