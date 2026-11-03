import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Proxy cho API v3 của Nhanh.vn dùng trong báo cáo đặc biệt:
// - Lịch sử đơn (order/history): thao tác trên Nhanh + lịch sử hãng VC.
// - Sửa đơn (order/edit): ghi chú, ghi chú nội bộ, trạng thái, nhãn.
// - Danh sách nhãn (order/tags): cache trong bảng nhanh_tags, mới hơn
//   24h thì dùng luôn, cũ hơn thì gọi API rồi ghi đè (theo tài liệu).
// - Gửi đơn sang hãng (order/sendcarrier) và hủy đơn (order/cancelcarrier):
//   chạy được 1 đơn hoặc nhiều đơn (mảng orderIds, chạy tuần tự từng
//   đơn). Đơn đã gửi rồi (ERR_ORDER_ALREADY_SENT_CARRIER) thì lấy lại
//   mã vận đơn cũ trong data thay vì tính là lỗi.
//   LƯU Ý 2026-11-03: trước đây gửi/hủy gọi shipment/send và
//   shipment/cancel trên host ship.open.nhanh.vn, nhưng host đó chết
//   DNS (NXDOMAIN từ 2026-11-02, đã xác nhận qua Google + Cloudflare
//   DoH); sample Postman chính thức của Nhanh + docs cho thấy đường
//   sống là 2 API POS trên (pos.open.nhanh.vn). API hủy không có tham
//   số lý do hủy nên lý do chỉ lưu trong log của mình, không đẩy sang
//   Nhanh.
// Token Nhanh lấy từ system_configs (do nhanh-auth ghi khi Vinh cấu
// hình ở Admin), không nằm trong code hay trả về frontend. Chỉ Tài
// khoản Chủ được gọi (popup báo cáo đặc biệt vốn cũng chỉ owner mở).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPER_OWNER_EMAIL = 'contact.hotavinh@gmail.com';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Xác thực owner bằng JWT của chính người gọi (như manage-users).
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return json({ success: false, message: 'Không thể xác thực phiên đăng nhập!' }, 401);
    }
    const isOwner = user.user_metadata?.is_owner === true || user.email === SUPER_OWNER_EMAIL;
    if (!isOwner) {
      return json({ success: false, message: 'Chỉ Tài khoản Chủ mới được dùng thao tác Nhanh.vn.' }, 403);
    }

    // Ghi log thao tac don cho Owner check lai sau (bang admin_action_logs).
    // Best-effort: ghi loi thi bo qua, khong bao gio lam hong thao tac;
    // bang chua co (chua chay migration) thi lan ghi nay tu bo qua.
    const logOrderActions = async (rows: any[]) => {
      if (rows.length === 0) return;
      try {
        await supabaseAdmin.from('admin_action_logs').insert(rows.map((r) => ({
          user_id: user.id,
          user_email: user.email || null,
          ...r,
        })));
      } catch { /* Bo qua loi ghi log */ }
    };

    const payload = await req.json().catch(() => ({}));
    const { action } = payload;
    const orderIds: number[] = Array.isArray(payload.orderIds)
      ? payload.orderIds.map((v: unknown) => parseInt(String(v), 10)).filter((n: number) => !Number.isNaN(n))
      : (payload.orderId ? [parseInt(String(payload.orderId), 10)].filter((n: number) => !Number.isNaN(n)) : []);
    // Riêng tags không cần đơn hàng (chỉ lấy danh sách nhãn để lọc),
    // sendHistory cũng vậy (chỉ đọc 5 dòng gần nhất).
    if (action !== 'tags' && action !== 'sendHistory' && orderIds.length === 0) {
      return json({ success: false, message: 'Thiếu ID đơn hàng.' }, 400);
    }

    const { data: configs } = await supabaseAdmin
      .from('system_configs')
      .select('key, value')
      .in('key', ['nhanh_app_id', 'nhanh_business_id', 'nhanh_access_token']);
    const configMap: Record<string, string> = {};
    configs?.forEach((c) => { configMap[c.key] = c.value; });
    const accessToken = configMap['nhanh_access_token'];
    const appId = configMap['nhanh_app_id'];
    const bizId = configMap['nhanh_business_id'] || '';

    if (!accessToken || !appId) {
      return json({ success: false, message: 'Chưa cấu hình API Nhanh.vn (thiếu App ID hoặc Access Token). Vào Admin cấu hình lại rồi thử lại.' });
    }

    const parseNhanh = async (res: Response) => {
      const text = await res.text();
      try { return JSON.parse(text); } catch {
        return { code: 0, messages: [`Nhanh.vn trả về dữ liệu không đọc được: ${text.substring(0, 200)}`] };
      }
    };
    const nhanhErr = (r: any) =>
      Array.isArray(r.messages) ? r.messages.join(', ') : (r.messages || r.message || r.errorCode || 'Nhanh.vn từ chối yêu cầu.');

    // Gọi API Nhanh có thử lại khi lỗi mạng/DNS (ví dụ lỗi "failed to
    // lookup address information" của Supabase Edge Runtime): những lỗi
    // này xảy ra trước khi request tới được Nhanh nên thử lại là an
    // toàn, và gửi đơn vốn đã xử lý ERR_ORDER_EXISTED nếu trùng. Chỉ
    // thử lại khi fetch ném lỗi, không thử lại khi Nhanh đã trả lỗi.
    const fetchWithRetry = async (url: string, init: RequestInit, attempts = 3) => {
      let lastError: any = null;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await fetch(url, init);
        } catch (e: any) {
          lastError = e;
          if (attempt < attempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
      throw lastError;
    };
    // API POS (order/*): Authorization là token thô, theo đúng tài liệu.
    const callPos = async (path: string, body: unknown) => {
      const res = await fetchWithRetry(`https://pos.open.nhanh.vn/v3.0${path}?appId=${appId}&businessId=${bizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': accessToken },
        body: JSON.stringify(body),
      });
      return parseNhanh(res);
    };

    if (action === 'history') {
      // Chỉ 1 đơn (popup chi tiết). Lấy cả 2 loại: thao tác trên Nhanh
      // và lịch sử từ hãng vận chuyển.
      const orderId = orderIds[0];
      const [loguser, logcarrier] = await Promise.all([
        callPos('/order/history', { filters: { orderIds: [orderId], type: 'loguser' } }),
        callPos('/order/history', { filters: { orderIds: [orderId], type: 'logcarrier' } }),
      ]);
      if (loguser.code !== 1 && logcarrier.code !== 1) {
        return json({ success: false, message: nhanhErr(loguser.code !== 1 ? loguser : logcarrier) });
      }
      const logs: any[] = [];
      if (loguser.code === 1) (loguser.data || []).forEach((l: any) => logs.push({ ...l, source: 'Nhanh' }));
      if (logcarrier.code === 1) (logcarrier.data || []).forEach((l: any) => logs.push({ ...l, source: 'Hãng vận chuyển' }));
      logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return json({ success: true, data: logs });
    }

    if (action === 'tags') {
      // Cache 24h trong bảng nhanh_tags (tài liệu khuyên cache vì nhãn
      // rất ít thay đổi). Bảng chưa có (chưa chạy migration) thì bỏ qua
      // cache, gọi API trực tiếp.
      let cached: any[] = [];
      try {
        const { data } = await supabaseAdmin
          .from('nhanh_tags')
          .select('tag_id, name, bg_color, text_color, status, updated_at')
          .order('name');
        cached = data || [];
      } catch { cached = []; }
      const newest = cached.reduce((m, r) => Math.max(m, new Date(r.updated_at).getTime() || 0), 0);
      if (cached.length > 0 && Date.now() - newest < 24 * 3600 * 1000) {
        return json({ success: true, data: cached.map((r) => ({ id: r.tag_id, name: r.name, bgColor: r.bg_color, textColor: r.text_color, status: r.status })) });
      }
      const r = await callPos('/order/tags', { filters: {}, paginator: { size: 100 } });
      if (r.code !== 1) {
        if (cached.length > 0) {
          return json({ success: true, stale: true, data: cached.map((x) => ({ id: x.tag_id, name: x.name, bgColor: x.bg_color, textColor: x.text_color, status: x.status })) });
        }
        return json({ success: false, message: nhanhErr(r) });
      }
      const rows = (r.data || []).map((t: any) => ({
        tag_id: String(t.id), name: t.name, bg_color: t.bgColor || null,
        text_color: t.textColor || null, status: t.status ?? null,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        await supabaseAdmin.from('nhanh_tags').upsert(rows, { onConflict: 'tag_id' }).then(() => {});
      }
      return json({ success: true, data: r.data || [] });
    }

    if (action === 'edit') {
      // Chỉ 1 đơn (popup chi tiết). Tài liệu dặn: chỉ truyền trường cần
      // đổi, truyền rỗng là xóa dữ liệu.
      const info: Record<string, unknown> = { id: orderIds[0] };
      if (typeof payload.description === 'string') info.description = payload.description;
      if (typeof payload.privateDescription === 'string') info.privateDescription = payload.privateDescription;
      if (payload.status) info.status = parseInt(String(payload.status), 10);
      if (Array.isArray(payload.tagIds)) {
        info.tagIds = payload.tagIds.map((n: unknown) => parseInt(String(n), 10)).filter((n: number) => !Number.isNaN(n));
      }
      // Ngay giao/hoan: Nhanh yeu cau ngay khi doi sang Thanh cong (60)
      // hoac Da hoan (72); truong ngay duy nhat trong API sua don la
      // carrier.deliveryDate (yyyy-mm-dd).
      const carrier: Record<string, unknown> = {};
      if (typeof payload.deliveryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.deliveryDate)) carrier.deliveryDate = payload.deliveryDate;
      if (Object.keys(info).length <= 1 && Object.keys(carrier).length === 0) {
        return json({ success: false, message: 'Chưa nhập thông tin nào cần sửa.' });
      }
      const r = await callPos('/order/edit', Object.keys(carrier).length ? { info, carrier } : { info });
      if (r.code !== 1) return json({ success: false, message: nhanhErr(r) });
      // Chi ghi ten truong da doi, khong ghi noi dung ghi chu vao log.
      await logOrderActions([{
        action: 'edit',
        target_type: 'order',
        target_id: String(orderIds[0]),
        details: { fields: [...Object.keys(info).filter((k) => k !== 'id'), ...(Object.keys(carrier).length ? ['deliveryDate'] : [])], status: info.status ?? null },
        result: 'ok',
      }]);
      return json({ success: true, data: r.data });
    }

    if (action === 'send') {
      // Gửi từng đơn tuần tự sang hãng để lấy mã vận đơn. Lỗi mạng của
      // 1 đơn chỉ ghi vào đơn đó, không làm hỏng cả lô (trước đây fetch
      // ném lỗi là cả lô trả 500).
      const results: any[] = [];
      for (const id of orderIds) {
        try {
          const r = await callPos('/order/sendcarrier', { orderId: id });
          if (r.code === 1) {
            results.push({ id, ok: true, carrierCode: r.data?.carrierCode || null });
          } else if ((r.errorCode === 'ERR_ORDER_ALREADY_SENT_CARRIER' || r.errorCode === 'ERR_ORDER_EXISTED') && r.data?.carrierCode) {
            // Đơn đã gửi rồi: Nhanh trả lại thông tin đơn đã có bên hãng.
            results.push({ id, ok: true, existed: true, carrierCode: r.data.carrierCode });
          } else {
            results.push({ id, ok: false, message: nhanhErr(r) });
          }
        } catch (e: any) {
          results.push({ id, ok: false, message: e?.message || 'Lỗi kết nối tới Nhanh.vn.' });
        }
      }
      const okCount = results.filter((x) => x.ok).length;
      // Ghi lịch sử gửi để gửi xong lỡ load lại trang vẫn mở ra check
      // lại được. Ghi lỗi thì không làm hỏng kết quả gửi; bảng chưa có
      // (chưa chạy migration) thì lần ghi này tự bỏ qua.
      const skippedIds = Array.isArray(payload.skippedIds) ? payload.skippedIds : [];
      try {
        await supabaseAdmin.from('send_history').insert({
          created_by: user.email || null,
          source: typeof payload.source === 'string' ? payload.source : null,
          total_count: orderIds.length,
          ok_count: okCount,
          fail_count: results.length - okCount,
          skipped_count: skippedIds.length,
          items: results,
          skipped_ids: skippedIds,
        });
      } catch { /* Bỏ qua lỗi ghi lịch sử */ }
      await logOrderActions(results.map((r) => ({
        action: 'send',
        target_type: 'order',
        target_id: String(r.id),
        details: {
          carrier_code: r.carrierCode || null,
          existed: !!r.existed,
          source: typeof payload.source === 'string' ? payload.source : null,
          message: r.ok ? null : (r.message || null),
        },
        result: r.ok ? (r.existed ? 'existed' : 'ok') : 'failed',
      })));
      return json({ success: okCount > 0, results, okCount, failCount: results.length - okCount });
    }

    if (action === 'sendHistory') {
      // 5 lần gửi gần nhất cho owner check lại sau khi load lại trang.
      const { data, error } = await supabaseAdmin
        .from('send_history')
        .select('id, created_at, created_by, source, total_count, ok_count, fail_count, skipped_count, items, skipped_ids')
        .order('id', { ascending: false })
        .limit(5);
      if (error) {
        return json({ success: false, message: 'Chưa đọc được lịch sử gửi (có thể chưa chạy migration tạo bảng send_history).' });
      }
      return json({ success: true, data: data || [] });
    }

    if (action === 'cancel') {
      const reason = payload.cancelReason || undefined;
      const results: any[] = [];
      for (const id of orderIds) {
        try {
          // cancelcarrier không có tham số lý do (theo docs); lý do chỉ
          // lưu trong log thao tác của mình (details.reason bên dưới).
          const r = await callPos('/order/cancelcarrier', { orderId: id });
          if (r.code === 1) {
            results.push({ id, ok: true, status: r.data?.status ?? null, statusName: r.data?.statusName || null });
          } else {
            results.push({ id, ok: false, message: nhanhErr(r) });
          }
        } catch (e: any) {
          results.push({ id, ok: false, message: e?.message || 'Lỗi kết nối tới Nhanh.vn.' });
        }
      }
      const okCount = results.filter((x) => x.ok).length;
      await logOrderActions(results.map((r) => ({
        action: 'cancel',
        target_type: 'order',
        target_id: String(r.id),
        details: {
          reason: reason || null,
          status: r.status ?? null,
          message: r.ok ? null : (r.message || null),
        },
        result: r.ok ? 'ok' : 'failed',
      })));
      return json({ success: okCount > 0, results, okCount, failCount: results.length - okCount });
    }

    return json({ success: false, message: 'Thao tác không hợp lệ.' }, 400);
  } catch (error: any) {
    console.error('Lỗi nhanh-order-actions:', error.message);
    return json({ success: false, message: error.message }, 500);
  }
});
