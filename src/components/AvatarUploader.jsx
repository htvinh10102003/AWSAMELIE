// Chon / doi / xoa anh dai dien.
//
// Component nay chi lo: chon file, kiem tra (JPG/PNG/WebP, toi da 2 MB),
// thu nho con 256px o trinh duyet, hien thi ban xem truoc. NO KHONG tai len
// hay luu metadata — viec do do component cha quyet dinh thoi diem:
//  - Ho so ca nhan: luu ngay khi chon (xem ProfileAvatarSection).
//  - Owner sua user khac (modal Admin): chi giu blob tam, chi tai len + luu
//    khi Owner bam "Luu" (xem edit spec cho Admin.jsx).
// Props:
//  - currentUrl: URL avatar hien tai (null neu chua co)
//  - name: ten hien thi, dung lam chu cai du phong + alt
//  - disabled: khoa nut khi cha dang luu
//  - onSelect({ blob, previewUrl }): goi sau khi thu nho xong
//  - onRemove(): goi khi bam "Xoa anh"
import { useEffect, useRef, useState } from 'react';
import UserAvatar from './UserAvatar';
import { AVATAR_ACCEPTED_ATTR, downscaleAvatar, validateAvatarFile } from '../lib/avatar';

export default function AvatarUploader({ currentUrl, name, disabled = false, onSelect, onRemove }) {
  const inputRef = useRef(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  // Ref giu URL xem truoc moi nhat de cleanup khi unmount revoke dung URL
  // (effect cleanup voi deps rong se thay closure cu neu doc truc tiep state).
  const previewRef = useRef(null);
  const setPreview = (url) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPendingPreview(url);
  };

  // Ban xem truoc tam chi bi xoa khi chinh component nay goi handleRemove
  // hoac khi component unmount (cleanup ben duoi). currentUrl doi tu cha
  // (sau khi luu xong) hien cung anh voi ban xem truoc nen khong can dong bo.
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const invalid = validateAvatarFile(file);
    if (invalid) { setError(invalid); return; }
    setProcessing(true);
    try {
      const blob = await downscaleAvatar(file);
      const previewUrl = URL.createObjectURL(blob);
      setPreview(previewUrl);
      onSelect?.({ blob, previewUrl });
    } catch (err) {
      setError(err?.message || 'Không xử lý được ảnh.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError('');
    onRemove?.();
  };

  const shownUrl = pendingPreview || currentUrl;

  return (
    <div className="flex items-center gap-4">
      <UserAvatar avatarUrl={shownUrl} name={name} size={72} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || processing}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            {processing ? 'Đang xử lý...' : currentUrl || pendingPreview ? 'Đổi ảnh đại diện' : 'Thêm ảnh đại diện'}
          </button>
          {(currentUrl || pendingPreview) && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || processing}
              className="px-4 py-2 bg-white border border-slate-300 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
            >
              Xóa ảnh
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 font-medium mt-2">
          Ảnh JPG, PNG hoặc WebP, tối đa 2 MB. Ảnh được thu nhỏ còn 256 px trước khi tải lên.
        </p>
        {error && <p className="text-xs font-bold text-red-600 mt-1">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPTED_ATTR}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
