// Giao dien Giang sinh: cong tac bat/tat toan app.
// Luu trong system_configs, key xmas_enabled, value 'true' / 'false' (dang string).
// Mac dinh BAT khi chua co dong cau hinh (hoac doc loi), de sau push Vinh xem live ngay.
// Mau giong maintenance.js (doc system_configs, upsert theo key).
import { supabase } from './supabase';

export const XMAS_KEY = 'xmas_enabled';

export async function getXmasEnabled() {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', XMAS_KEY)
      .maybeSingle();
    if (error || !data) return true;
    return data.value === 'true' || data.value === true;
  } catch (e) {
    return true;
  }
}

export async function setXmasEnabled(on) {
  const { error } = await supabase
    .from('system_configs')
    .upsert({ key: XMAS_KEY, value: on ? 'true' : 'false' }, { onConflict: 'key' });
  if (error) throw error;
}
