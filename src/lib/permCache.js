// Cache quyen HIEN THI (DISPLAY-ONLY) cho man hinh khoi dong.
// - Chi dung de ve menu/layout ngay lap tuc tu lan load truoc, trong khi
//   cho du lieu tuoi tu server ve (revalidate nen).
// - KHONG dung de quyet dinh quyen: FeatureGuard van fetch tuoi va chan
//   that moi lan mo trang, ProtectedRoute van check session/role tuoi,
//   edge function + check is_owner phia server khong doi gi.
// - Key theo user id: doi tai khoan thi khong dung nham cache nguoi khac.
// - Luu: co role (owner/admin/super_admin), ban do feature_lock_*,
//   che do bao tri (maintenance_mode) va thoi diem luu (cachedAt).
// - Xoa khi dang xuat (xem cac cho goi clearPermCache / clearAllPermCaches).

export const PERM_CACHE_PREFIX = 'wms_perm_cache_';

// Nguong tuoi cache cho safety net khi quay lai tab: cu hon 5 phut thi
// tai lai quyen/locks ngam; moi hon thi giu nguyen, tranh spam server.
export const FOCUS_REVALIDATE_MS = 5 * 60 * 1000;

export function permCacheKey(userId) {
  return `${PERM_CACHE_PREFIX}${userId}`;
}

function isValidCache(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.userId === 'string' &&
    value.userId.length > 0 &&
    typeof value.cachedAt === 'number' &&
    (!value.featureLocks || typeof value.featureLocks === 'object')
  );
}

export function readPermCache(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(permCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidCache(parsed) || parsed.userId !== userId) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

export function writePermCache(userId, perm) {
  if (!userId) return;
  try {
    const entry = {
      userId,
      role: perm?.role || 'user',
      isOwner: perm?.isOwner === true,
      isAdmin: perm?.isAdmin === true,
      isSuperAdmin: perm?.isSuperAdmin === true,
      featureLocks: perm?.featureLocks || {},
      maintenance: perm?.maintenance === true,
      cachedAt: Date.now(),
    };
    localStorage.setItem(permCacheKey(userId), JSON.stringify(entry));
  } catch (e) {}
}

// Cap nhat 1 phan cache hien co (vd realtime doi 1 khoa): giu cac truong
// con lai, chi doi thoi diem luu. Khong co cache san thi khong tao moi
// (tranh luu ban cache thieu truong tu 1 su kien realtime don le).
export function updatePermCache(userId, patch) {
  if (!userId) return;
  const current = readPermCache(userId);
  if (!current) return;
  writePermCache(userId, { ...current, ...patch });
}

export function isPermCacheStale(cache, maxAgeMs = FOCUS_REVALIDATE_MS) {
  if (!cache || typeof cache.cachedAt !== 'number') return true;
  return Date.now() - cache.cachedAt > maxAgeMs;
}

export function clearPermCache(userId) {
  try {
    if (!userId) {
      clearAllPermCaches();
      return;
    }
    localStorage.removeItem(permCacheKey(userId));
  } catch (e) {}
}

// Quet sach moi cache quyen (khi khong biet user id, vd phien da mat).
export function clearAllPermCaches() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PERM_CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
}
