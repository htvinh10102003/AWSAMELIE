// Phan quyen AWSAMELIE - 1 cho duy nhat de khoi lech nhau giua cac trang.
// - user: nhan vien, chi vao cac trang FeatureGuard cho phep.
// - admin: vao duoc cac trang ProtectedRoute, Admin, KPI, cap nhat...
// - super_admin: giong het admin, CONG THEM 3 quyen rieng trong Admin:
//   thay doi lien ket Nhanh.vn, link Google Sheet don in / don di, va nen giao dien (Festive Themes).
// - owner: co rieng, khong phai 1 role ma la co user_metadata.is_owner (hoac email owner goc).
//   Owner giu nguyen cac quyen rieng khac: don dep DB, cap/xoa tai khoan, thong bao global, dong bo hoan...
//   Super admin KHONG co cac quyen owner do.
export const ROLE_USER = 'user';
export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';

export function getUserRole(user) {
  return user?.user_metadata?.role || ROLE_USER;
}

export function isAdminRole(role) {
  return role === ROLE_ADMIN || role === ROLE_SUPER_ADMIN;
}

export function isSuperAdminRole(role) {
  return role === ROLE_SUPER_ADMIN;
}

export function roleLabel(role) {
  if (role === ROLE_SUPER_ADMIN) return 'Super Admin';
  if (role === ROLE_ADMIN) return 'Admin';
  return 'Nhân viên';
}
