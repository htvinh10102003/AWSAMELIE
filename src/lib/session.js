// Quan ly phien lam viec bi thu hoi boi Owner.
// Co che: khi Owner xoa tai khoan hoac doi quyen cua 1 tai khoan khac, Admin ghi 1 dong
// system_configs co key `session_revoked_<userId>` voi gia tri la thoi diem thu hoi (ISO).
// Layout kiem tra dong nay (realtime + dinh ky) va chi da ra khi thoi diem thu hoi MUON HON
// lan dang nhap gan nhat (last_sign_in_at) - nho vay nguoi dung dang nhap lai sau khi bi doi
// quyen se khong bi da ra oan.
export function sessionRevokedKey(userId) {
  return `session_revoked_${userId}`;
}

export function isRevokedAfterLogin(revokedAtIso, user) {
  if (!revokedAtIso || !user) return false;
  const revokedAt = Date.parse(revokedAtIso);
  if (Number.isNaN(revokedAt)) return false;
  const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  return revokedAt > lastSignIn;
}
