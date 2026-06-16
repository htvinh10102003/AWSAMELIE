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

    const isReqAdmin = reqUser.user_metadata?.role === 'admin';
    const isReqOwner = reqUser.user_metadata?.is_owner === true; // Kiểm tra cờ Tài khoản chủ

    // Chỉ Admin hoặc Chủ mới được quyền sờ vào cổng này
    if (!isReqAdmin && !isReqOwner) {
      return new Response(JSON.stringify({ error: 'Bạn không có quyền truy cập cổng quản trị!' }), { status: 403, headers: corsHeaders });
    }

    const { action, email, password, fullName, role, userId } = await req.json();

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
      const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: role || 'user' }
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

    return new Response(JSON.stringify({ error: 'Hành động không hợp lệ!' }), { status: 400, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: corsHeaders 
    });
  }
});