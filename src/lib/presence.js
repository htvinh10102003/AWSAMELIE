// Hien dien + lich su dang nhap + log in don (phuc vu quan ly user cua Owner).
// Tat ca cac ham ghi deu best-effort: ghi loi thi bo qua, khong bao gio
// lam hong luong chinh (in don, dang nhap, mo app).
import { supabase } from './supabase';

// ID thiet bi on dinh theo trinh duyet (luu localStorage), de bang
// user_presence phan biet duoc cac thiet bi cua cung 1 tai khoan.
export function getDeviceId() {
  try {
    let id = localStorage.getItem('wms_device_id');
    if (!id) {
      id = (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
        `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('wms_device_id', id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

// Ten thiet bi gon tu user agent de hien trong chi tiet user
// (VD: "iPhone · Safari", "Máy tính Windows · Chrome").
export function shortDeviceName(ua) {
  const s = String(ua || '');
  let device = 'Máy tính';
  if (/iPhone/i.test(s)) device = 'iPhone';
  else if (/iPad/i.test(s)) device = 'iPad';
  else if (/Android/i.test(s)) device = 'Điện thoại Android';
  else if (/Mobile/i.test(s)) device = 'Điện thoại';
  else if (/Windows/i.test(s)) device = 'Máy tính Windows';
  else if (/Macintosh/i.test(s)) device = 'Máy tính Mac';
  else if (/Linux/i.test(s)) device = 'Máy tính Linux';
  let browser = '';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/Chrome\//i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s)) browser = 'Safari';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  return browser ? `${device} · ${browser}` : device;
}

// Ghi nhan "dang mo app" (heartbeat). Owner coi 1 thiet bi la dang
// online neu last_seen_at trong 10 phut gan nhat.
export async function reportPresence() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_presence').upsert({
      user_id: user.id,
      device_id: getDeviceId(),
      user_email: user.email || null,
      user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id,device_id' });
  } catch { /* khong lam hong app */ }
}

// Ghi 1 dong lich su dang nhap (goi khi su kien SIGNED_IN).
export async function recordLoginHistory() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_login_history').insert({
      user_id: user.id,
      user_email: user.email || null,
      user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
    });
  } catch { /* khong lam hong dang nhap */ }
}

// Ghi log in don (goi tu openNhanhPrint). Moi don 1 dong.
export async function logOrderPrint(orderIds, printSize) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !orderIds || orderIds.length === 0) return;
    const rows = orderIds.map((id) => ({
      user_id: user.id,
      user_email: user.email || null,
      action: 'print',
      target_type: 'order',
      target_id: String(id),
      details: { print_size: printSize || null },
      result: 'ok',
    }));
    await supabase.from('admin_action_logs').insert(rows);
  } catch { /* in van chay binh thuong du log co loi */ }
}
