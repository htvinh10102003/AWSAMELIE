import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { UserRefreshClient } from "npm:google-auth-library@9.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Xử lý CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Không dùng req.json() nữa để tránh lỗi Unexpected end of JSON input
    
    // Lấy thông tin từ Supabase Secrets
    const clientId = Deno.env.get('GCP_CLIENT_ID')
    const clientSecret = Deno.env.get('GCP_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GCP_REFRESH_TOKEN')
    const folderId = Deno.env.get('DRIVE_FOLDER_ID')

    if (!clientId || !clientSecret || !refreshToken || !folderId) {
       throw new Error("Chưa cấu hình đủ biến môi trường OAuth trên Supabase")
    }

    // Đổi Refresh Token lấy Access Token tươi mới
    const client = new UserRefreshClient(clientId, clientSecret, refreshToken)
    const { credentials } = await client.refreshAccessToken()
    
    // Trả thẳng Token và FolderID về cho Frontend tự xử lý
    return new Response(JSON.stringify({ 
      accessToken: credentials.access_token,
      folderId: folderId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})