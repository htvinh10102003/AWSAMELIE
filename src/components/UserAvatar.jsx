// Hien thi avatar: anh neu co URL, neu khong thi chu cai dau cua ten.
// Dung chung o header (Layout), danh sach Users (Admin) va bat cu cho nao
// hien thi nguoi dung.
import { avatarInitials } from '../lib/avatar';

export default function UserAvatar({ avatarUrl, name, email, size = 36, className = '' }) {
  const px = size;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Ảnh đại diện'}
        width={px}
        height={px}
        style={{ width: px, height: px }}
        className={`rounded-full object-cover border border-slate-200 shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      aria-label={name || 'Chưa có ảnh đại diện'}
      style={{ width: px, height: px, fontSize: Math.round(px * 0.42) }}
      className={`rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 ${className}`}
    >
      {avatarInitials(name, email)}
    </div>
  );
}
