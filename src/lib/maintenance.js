// Che do bao tri: khi bat, moi nguoi (tru Owner) chi thay man hinh xam 404 Not Found.
// Luu trong system_configs, key maintenance_mode, value 'true' / 'false' (dang string).
// Owner duoc nhan dien giong Admin.jsx: is_owner = true hoac email super owner.
import { supabase } from './supabase';

export const MAINTENANCE_KEY = 'maintenance_mode';
export const SUPER_OWNER_EMAIL = 'contact.hotavinh@gmail.com';

export function isOwnerUser(user) {
  if (!user) return false;
  return user.user_metadata?.is_owner === true || user.email === SUPER_OWNER_EMAIL;
}

export async function getMaintenanceMode() {
  try {
    const { data, error } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', MAINTENANCE_KEY)
      .maybeSingle();
    if (error || !data) return false;
    return data.value === 'true' || data.value === true;
  } catch (e) {
    // Doc loi thi mac dinh TAT, tranh khoa ca web vi loi mang / RLS.
    return false;
  }
}

export async function setMaintenanceMode(on) {
  const { error } = await supabase
    .from('system_configs')
    .upsert({ key: MAINTENANCE_KEY, value: on ? 'true' : 'false' }, { onConflict: 'key' });
  if (error) throw error;
}
