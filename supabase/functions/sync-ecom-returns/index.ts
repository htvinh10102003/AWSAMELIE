import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// 3 sàn Nhanh hỗ trợ cho API ecom/return (docs developers.nhanh.group/pos/ecom/return).
// ID này là "ID các sàn trên Nhanh.vn" (filters.appId), KHÔNG phải appId của mình.
const PLATFORMS: Record<number, string> = {
  8195: 'Shopee',
  8855: 'TikTok',
  8142: 'Lazada',
};

// Nhanh trả messages dạng string HOẶC array — lấy an toàn, không lấy [0] của string
// (lỗi từng gặp ở sync-nhanh: message string bị cắt còn 1 ký tự).
function nhanhMessage(result: any): string {
  const m = result?.messages;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  if (result?.errorCode) return String(result.errorCode);
  return 'Lỗi không rõ từ Nhanh';
}

function epochToIso(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (isNaN(n)) return null;
  const d = new Date(n * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function str(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_e) { body = {}; }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Lấy cấu hình từ system_configs (giống sync-nhanh)
    const { data: configs, error: configError } = await supabase
      .from('system_configs')
      .select('key, value')
      .in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);

    if (configError) throw new Error('Lỗi đọc bảng cấu hình: ' + configError.message);

    const configMap: Record<string, string> = {};
    configs?.forEach((c) => (configMap[c.key] = c.value));

    if (!configMap['nhanh_app_id'] || !configMap['nhanh_access_token']) {
      throw new Error('Thiếu nhanh_app_id hoặc nhanh_access_token trong system_configs!');
    }

    const appId = configMap['nhanh_app_id'];
    const businessId = configMap['nhanh_business_id'] || '';
    const accessToken = configMap['nhanh_access_token'];

    // 2. Sàn cần đồng bộ: Admin gửi { platformId } cho từng sàn;
    // cron hoặc gọi tay không gửi platformId thì đồng bộ cả 3 sàn.
    const requested = Number(body.platformId);
    const platformIds = PLATFORMS[requested] ? [requested] : Object.keys(PLATFORMS).map(Number);

    const callNhanh = async (platformId: number, next: any) => {
      // Chỉ kéo yêu cầu cập nhật trong 30 ngày gần nhất (Vinh chốt 2026-11-03:
      // "kéo 1 tháng gần nhất thôi"; bản cũ là 7 ngày, bản đầu viết không lọc ngày).
      const updatedFromAt = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const payload: any = {
        filters: { appId: platformId, updatedFromAt },
        paginator: { icpp: 50 },
      };
      // Phân trang cursor: gửi lại nguyên giá trị paginator.next mà Nhanh trả về
      // (docs: response paginator.next.id; pattern này giống sync-nhanh đã chạy tốt).
      if (next) payload.paginator.next = next;

      const url = `https://pos.open.nhanh.vn/v3.0/ecom/return?appId=${appId}&businessId=${businessId}`;
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          try { return JSON.parse(text); }
          catch (_e) { return { code: 0, messages: [text.substring(0, 200)] }; }
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error('Không gọi được API Nhanh');
    };

    let totalSynced = 0;
    const platformResults: any[] = [];
    const errors: string[] = [];

    for (const platformId of platformIds) {
      const platformName = PLATFORMS[platformId];
      let synced = 0;
      let pages = 0;
      let next: any = null;
      try {
        // Một lần gọi = kéo HẾT các trang của sàn đó bằng cursor.
        // Admin vẫn gọi theo vòng page cũ nhưng edge trả hasMoreData=false nên chỉ gọi 1 lần/sàn.
        do {
          const result = await callNhanh(platformId, next);
          if (result?.code !== 1) {
            throw new Error(`Nhanh báo lỗi (${platformName}): ${nhanhMessage(result)} (code: ${result?.code})`);
          }
          const rawList = result.data;
          const items: any[] = Array.isArray(rawList) ? rawList : (rawList ? Object.values(rawList) : []);
          pages++;

          if (items.length > 0) {
            // Tải HẾT các trường: cột riêng cho trường hay lọc + raw_data giữ nguyên toàn bộ payload.
            const rows = items.map((item: any) => ({
              return_id: str(item.returnId),
              platform_id: platformId,
              platform_name: platformName,
              shop_id: str(item.shopId),
              business_id: item.businessId ?? null,
              return_type: item.returnType ?? null,
              original_ecom_order_id: str(item.originalEcomOrderId),
              reason_id: str(item.reasonInfor?.reasonId),
              reason_name: item.reasonInfor?.reasonName ?? null,
              amount: item.amount ?? null,
              ecom_status_id: str(item.ecomStatus?.id),
              ecom_status_name: item.ecomStatus?.name ?? null,
              nhanh_status_id: item.nhanhStatus?.id ?? null,
              nhanh_status_name: item.nhanhStatus?.name ?? null,
              return_created_at: epochToIso(item.createdAt),
              return_updated_at: epochToIso(item.updateAt),
              products: item.productsInfor ?? null,
              raw_data: item,
              synced_at: new Date().toISOString(),
            })).filter((r: any) => r.return_id);

            // Upsert theo từng mẻ 100 để tránh payload quá lớn.
            for (let i = 0; i < rows.length; i += 100) {
              const batch = rows.slice(i, i + 100);
              const { error } = await supabase
                .from('ecom_return_orders')
                .upsert(batch, { onConflict: 'return_id' });
              if (error) throw new Error(`Lỗi ghi DB (${platformName}): ${error.message}`);
            }
            synced += rows.length;
          }

          next = result.paginator?.next ?? null;
          // Chặn vòng lặp vô hạn nếu Nhanh trả cursor không đổi.
          if (pages >= 500) {
            console.log(`[${platformName}] Dừng sau 500 trang (giới hạn an toàn), đã kéo ${synced} yêu cầu.`);
            break;
          }
        } while (next);

        console.log(`[${platformName}] Xong: ${synced} yêu cầu, ${pages} trang.`);
        platformResults.push({ platformId, platformName, synced, pages });
        totalSynced += synced;
      } catch (e: any) {
        console.error(`[${platformName}] Lỗi:`, e?.message || e);
        errors.push(`${platformName}: ${e?.message || e}`);
        platformResults.push({ platformId, platformName, synced, pages, error: e?.message || String(e) });
      }
    }

    // Admin xử lý: res.ok=false -> "bị gián đoạn" kèm tổng đã kéo được.
    // Trả 500 khi có sàn lỗi để Admin không báo thành công sai.
    const status = errors.length > 0 ? 500 : 200;
    return new Response(JSON.stringify({
      success: errors.length === 0,
      syncedCount: totalSynced,
      hasMoreData: false,
      nextPage: null,
      platforms: platformResults,
      errors,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });
  } catch (error: any) {
    console.error('[sync-ecom-returns] Lỗi hệ thống:', error?.message || error);
    return new Response(JSON.stringify({
      success: false,
      syncedCount: 0,
      hasMoreData: false,
      message: error?.message || String(error),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
