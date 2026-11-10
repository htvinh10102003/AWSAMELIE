import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Khởi tạo Supabase Client bằng Service Role quyền lực tuyệt đối
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // BƯỚC BẢO MẬT CHÍ MẠNG: Xác thực danh tính của tài khoản đang gọi hàm
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: reqUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !reqUser) {
      return new Response(JSON.stringify({ error: 'Không thể xác thực phiên đăng nhập!' }), { status: 401, headers: corsHeaders });
    }

    const isReqAdmin = reqUser.user_metadata?.role === 'admin' || reqUser.user_metadata?.role === 'super_admin';
    // Super admin ke thua admin o day (list/create). Doi role / xoa tai khoan van chi Owner, xem ben duoi.
    const isReqOwner = reqUser.user_metadata?.is_owner === true; // Kiểm tra cờ Tài khoản chủ

    const { action, email, password, fullName, role, userId, avatarUrl, removeAvatar, filterUserId, filterAction, filterOrderId, logLimit, logOffset } = await req.json();

    // Anh dai dien: chi chap nhan URL public cua bucket Storage `avatars`
    // (xem supabase/20261110_avatars_storage_bucket.sql + src/lib/avatar.js).
    // Khong nhan data URL base64: metadata di kem trong JWT moi request.
    const isValidAvatarUrl = (url: unknown): url is string => {
      if (typeof url !== 'string') return false;
      if (url.length === 0 || url.length > 500) return false;
      if (!url.startsWith('https://')) return false;
      return url.includes('/storage/v1/object/public/avatars/');
    };

    // 0. TU KHOA TAI KHOAN (DevTools guard): bat ky tai khoan dang dang nhap nao
    // cung goi duoc, nhung chi khoa CHINH MINH — khong nhan userId tu client.
    // Tai khoan Chu duoc mien (tu khoa thi khong con ai mo lai duoc).
    if (action === 'self_lock') {
      const OWNER_EMAILS = ['contact.hotavinh@gmail.com', 'contact.hotavinhh@gmail.com'];
      if (reqUser.user_metadata?.is_owner === true || OWNER_EMAILS.includes(reqUser.email || '')) {
        return new Response(JSON.stringify({ error: 'Tài khoản Chủ không thể tự khóa!' }), { status: 403, headers: corsHeaders });
      }
      // Khoa dang nhap 10 nam (giong action 'ban'); dong thoi ghi dau thu hoi
      // phien de Layout/Mobile da tai khoan ra ngay lap tuc.
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(reqUser.id, { ban_duration: '87600h' });
      if (banErr) throw banErr;
      const { error: upErr } = await supabaseAdmin.from('system_configs').upsert({ key: `session_revoked_${reqUser.id}`, value: new Date().toISOString() }, { onConflict: 'key' });
      if (upErr) console.error('self_lock: khong ghi duoc session_revoked:', upErr.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Chỉ Admin hoặc Chủ mới được quyền sờ vào cổng này
    if (!isReqAdmin && !isReqOwner) {
      return new Response(JSON.stringify({ error: 'Bạn không có quyền truy cập cổng quản trị!' }), { status: 403, headers: corsHeaders });
    }

    // 1. LẤY DANH SÁCH THÀNH VIÊN
    if (action === 'list') {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;
      return new Response(JSON.stringify({ users }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 2. TẠO TÀI KHOẢN MỚI (Admin hoặc Nhân viên đều tạo được)
    if (action === 'create') {
      if (avatarUrl !== undefined && !isValidAvatarUrl(avatarUrl)) {
        return new Response(JSON.stringify({ error: 'Đường dẫn ảnh đại diện không hợp lệ!' }), { status: 400, headers: corsHeaders });
      }
      const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: role || 'user', ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}) }
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, user }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 3. NÂNG / HẠ CẤP ADMIN (🚨 TUYỆT ĐỐI ÉP CỨNG QUYỀN CHỦ)
    // 3. CẬP NHẬT THÔNG TIN THÀNH VIÊN (MỚI NÂNG CẤP)
    if (action === 'update_info') {
      const updateData: any = { user_metadata: {} };
      if (fullName) updateData.user_metadata.full_name = fullName.trim();
      
      // Kiểm tra bảo mật: Nếu có sự thay đổi về cấp bậc quyền lực (role), bắt buộc phải là CHỦ
      if (role) {
        if (!isReqOwner) {
          return new Response(JSON.stringify({ error: '🚨 Từ chối! Chỉ có Tài khoản Chủ mới có quyền nâng/hạ cấp Admin!' }), { status: 403, headers: corsHeaders });
        }
        updateData.user_metadata.role = role;
      }

      // Anh dai dien cho nguoi khac: chi CHU. (Doi anh cua chinh minh thi
      // dung supabase.auth.updateUser truc tiep, khong qua edge nay.)
      // updateUserById gop (merge) user_metadata nen full_name/role/is_owner
      // cu van duoc giu nguyen nhu cac truong hop tren.
      if (avatarUrl !== undefined || removeAvatar === true) {
        if (!isReqOwner) {
          return new Response(JSON.stringify({ error: 'Chỉ có Tài khoản Chủ mới được đổi ảnh đại diện cho người khác!' }), { status: 403, headers: corsHeaders });
        }
        if (removeAvatar === true) {
          updateData.user_metadata.avatar_url = null;
        } else if (!isValidAvatarUrl(avatarUrl)) {
          return new Response(JSON.stringify({ error: 'Đường dẫn ảnh đại diện không hợp lệ!' }), { status: 400, headers: corsHeaders });
        } else {
          updateData.user_metadata.avatar_url = avatarUrl;
        }
      }

      const { data: { user }, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, user }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 4. XÓA TÀI KHOẢN KHỎI HỆ THỐNG (🚨 TUYỆT ĐỐI ÉP CỨNG QUYỀN CHỦ)
    if (action === 'delete') {
      if (!isReqOwner) {
        return new Response(JSON.stringify({ error: '🚨 Từ chối! Chỉ có Tài khoản Chủ mới được phép xóa thành viên!' }), { status: 403, headers: corsHeaders });
      }
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 5. CHI TIET TAI KHOAN + KICK + KHOA/MO KHOA + NHAT KY CHUNG.
    // Tat ca chi Owner (is_owner) — admin/super_admin khong duoc dung,
    // khac voi list/create o tren. Cac guard cu (list/create/role/delete)
    // giu nguyen, khong sua.
    const SUPER_OWNER_EMAIL = 'contact.hotavinh@gmail.com';
    const requireOwner = () => {
      if (!isReqOwner) {
        return new Response(JSON.stringify({ error: 'Chỉ có Tài khoản Chủ mới được dùng chức năng này!' }), { status: 403, headers: corsHeaders });
      }
      return null;
    };
    // Chan thao tac len chinh minh va len tai khoan Chu so huu.
    const guardTarget = async () => {
      if (!userId) return 'Thiếu ID tài khoản!';
      if (userId === reqUser.id) return 'Không thể thao tác lên chính tài khoản của mình!';
      const { data: { user: target } } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!target) return 'Không tìm thấy tài khoản!';
      if (target.email === SUPER_OWNER_EMAIL) return 'Không thể thao tác lên tài khoản Chủ sở hữu!';
      return null;
    };

    if (action === 'detail') {
      const denied = requireOwner();
      if (denied) return denied;
      const { data: { user: target }, error: uErr } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (uErr || !target) {
        return new Response(JSON.stringify({ error: 'Không tìm thấy tài khoản!' }), { status: 404, headers: corsHeaders });
      }
      const { data: logins } = await supabaseAdmin.from('user_login_history').select('id, signed_in_at, user_email, user_agent').eq('user_id', userId).order('signed_in_at', { ascending: false }).limit(20);
      const { data: devices } = await supabaseAdmin.from('user_presence').select('user_id, device_id, user_email, user_agent, last_seen_at').eq('user_id', userId).order('last_seen_at', { ascending: false }).limit(20);
      const { data: actions } = await supabaseAdmin.from('admin_action_logs').select('id, created_at, action, target_type, target_id, details, result').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
      return new Response(JSON.stringify({ success: true, user: target, logins: logins || [], devices: devices || [], actions: actions || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'kick') {
      const denied = requireOwner();
      if (denied) return denied;
      const blocked = await guardTarget();
      if (blocked) {
        return new Response(JSON.stringify({ error: blocked }), { status: 400, headers: corsHeaders });
      }
      // Dung co che session_revoked san co: Layout (desktop) va Mobile
      // kiem tra key nay roi tu dang xuat tai khoan bi kick.
      const { error } = await supabaseAdmin.from('system_configs').upsert({ key: `session_revoked_${userId}`, value: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'ban') {
      const denied = requireOwner();
      if (denied) return denied;
      const blocked = await guardTarget();
      if (blocked) {
        return new Response(JSON.stringify({ error: blocked }), { status: 400, headers: corsHeaders });
      }
      // Khoa dang nhap 10 nam; mo khoa bang action 'unban'.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '87600h' });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'unban') {
      const denied = requireOwner();
      if (denied) return denied;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'action_logs') {
      const denied = requireOwner();
      if (denied) return denied;
      let query = supabaseAdmin.from('admin_action_logs').select('id, created_at, user_id, user_email, action, target_type, target_id, details, result', { count: 'exact' }).order('created_at', { ascending: false });
      if (filterUserId) query = query.eq('user_id', filterUserId);
      if (filterAction) query = query.eq('action', filterAction);
      if (filterOrderId) query = query.eq('target_id', String(filterOrderId));
      const limit = Math.min(100, Math.max(1, parseInt(String(logLimit || 50), 10) || 50));
      const offset = Math.max(0, parseInt(String(logOffset || 0), 10) || 0);
      query = query.range(offset, offset + limit - 1);
      const { data, count, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, logs: data || [], total: count || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Hành động không hợp lệ!' }), { status: 400, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: corsHeaders 
    });
  }
});