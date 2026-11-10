// Anh dai dien (avatar) cua tai khoan.
//
// Luu tru: file anh goc duoc thu nho con toi da 256px o trinh duyet roi tai
// len Supabase Storage bucket public `avatars` theo duong dan
// `<userId>/avatar.jpg`. Chi URL public ngan duoc luu vao
// `user_metadata.avatar_url` — khong luu data URL base64 vao metadata, vi
// metadata di kem trong JWT access token o moi request, anh base64 du nho
// cung lam token phong to va de vuot gioi han header cua server.
//
// Bucket + policy tao bang file migration
// supabase/20261110_avatars_storage_bucket.sql (chi tao, CHUA chay).
// Den khi migration chua chay thi upload se bao loi "Bucket not found".

export const AVATAR_BUCKET = 'avatars';
export const AVATAR_METADATA_KEY = 'avatar_url';
export const AVATAR_MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_MAX_DIMENSION = 256; // px, canh dai nhat sau khi thu nho
export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_ACCEPTED_ATTR = 'image/jpeg,image/png,image/webp';

// Lay URL avatar tu user Supabase (hoac tu user_metadata), null neu chua co.
export function getAvatarUrl(user) {
  const url = user?.user_metadata?.[AVATAR_METADATA_KEY];
  return typeof url === 'string' && url ? url : null;
}

// Chu cai viet tat hien khi chua co avatar.
export function avatarInitials(displayName, email) {
  const base = (displayName || '').trim() || (email || '').split('@')[0] || '?';
  return base.charAt(0).toUpperCase();
}

// Kiem tra file truoc khi xu ly: tra ve thong bao loi, hoac null neu hop le.
export function validateAvatarFile(file) {
  if (!file) return 'Chưa chọn file ảnh.';
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
    return 'Chỉ nhận file ảnh JPG, PNG hoặc WebP.';
  }
  if (file.size > AVATAR_MAX_FILE_BYTES) {
    return 'Ảnh quá lớn — tối đa 2 MB.';
  }
  return null;
}

// Thu nho anh ve toi da AVATAR_MAX_DIMENSION px (giu ti le), xuat Blob JPEG.
// Nen trang lam nen vi JPEG khong co kenh trong suot.
export function downscaleAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File ảnh không đọc được.'));
      img.onload = () => {
        const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Không xử lý được ảnh.'));
          },
          'image/jpeg',
          0.82
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Duong dan file trong bucket cho 1 user (moi user 1 file, ghi de khi doi).
export function avatarStoragePath(userId) {
  return `${userId}/avatar.jpg`;
}

// Tai blob avatar (da thu nho) len Storage, tra ve URL public kem ?v=timestamp
// de trinh duyet khong dung anh cu trong cache khi doi anh moi.
export async function uploadAvatarBlob(supabaseClient, userId, blob) {
  const path = avatarStoragePath(userId);
  const { error } = await supabaseClient.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = supabaseClient.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Xoa file avatar khoi Storage (best-effort: loi thi bo qua, metadata moi la
// nguon hien thi chinh).
export async function removeAvatarFile(supabaseClient, userId) {
  try {
    await supabaseClient.storage.from(AVATAR_BUCKET).remove([avatarStoragePath(userId)]);
  } catch {
    // Bo qua — file co the da khong con, khong anh huong luong chinh.
  }
}
