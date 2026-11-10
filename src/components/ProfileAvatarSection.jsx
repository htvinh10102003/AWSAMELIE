// Khoi "Anh dai dien" cho tab Ca nhan (Admin) — nguoi dung tu doi anh cua
// CHINH MINH. Luong: chon anh -> thu nho 256px (AvatarUploader) -> tai len
// Storage bucket `avatars` -> luu URL public vao user_metadata.avatar_url
// qua supabase.auth.updateUser. Xoa anh: xoa metadata (null) + xoa file
// Storage (best-effort). Khong dung edge manage-users: nguoi dung chi duoc
// doi anh cua minh, khong can quyen admin.
//
// Mount (xem edit spec cho Admin.jsx): dat <ProfileAvatarSection /> trong
// tab Ca nhan, ngay duoi khoi header ho so (ten + email) va truoc
// {profileMessage && ...}.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AvatarUploader from './AvatarUploader';
import { AVATAR_METADATA_KEY, getAvatarUrl, removeAvatarFile, uploadAvatarBlob } from '../lib/avatar';

export default function ProfileAvatarSection() {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (cancelled || !u) return;
      setUser(u);
      setAvatarUrl(getAvatarUrl(u));
    });
    return () => { cancelled = true; };
  }, []);

  const friendlyError = (err) => {
    const msg = err?.message || String(err || '');
    if (/bucket not found|Bucket not found|row-level security|RLS/i.test(msg)) {
      return `${msg} (Có thể bucket 'avatars' chưa được tạo — Owner chạy file supabase/20261110_avatars_storage_bucket.sql trong SQL Editor một lần rồi thử lại.)`;
    }
    return msg;
  };

  const handleSelect = async ({ blob }) => {
    if (!user) return;
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const url = await uploadAvatarBlob(supabase, user.id, blob);
      const { error } = await supabase.auth.updateUser({ data: { [AVATAR_METADATA_KEY]: url } });
      if (error) throw error;
      setAvatarUrl(url);
      setMessage({ text: 'Đã cập nhật ảnh đại diện.', type: 'success' });
    } catch (err) {
      setMessage({ text: `Lỗi đổi ảnh: ${friendlyError(err)}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const { error } = await supabase.auth.updateUser({ data: { [AVATAR_METADATA_KEY]: null } });
      if (error) throw error;
      await removeAvatarFile(supabase, user.id);
      setAvatarUrl(null);
      setMessage({ text: 'Đã xóa ảnh đại diện.', type: 'success' });
    } catch (err) {
      setMessage({ text: `Lỗi xóa ảnh: ${friendlyError(err)}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-8 mb-8 border-b border-slate-200">
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ảnh đại diện</label>
      <AvatarUploader
        currentUrl={avatarUrl}
        name={user?.user_metadata?.full_name || user?.email || ''}
        disabled={saving || !user}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />
      {message.text && (
        <p className={`text-sm font-bold mt-3 ${message.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
