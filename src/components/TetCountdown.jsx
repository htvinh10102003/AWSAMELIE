import { useEffect, useState } from 'react';
import { TET_IMG_LANTERN } from '../themes/tet-2027/tetImages';

// Nền widget là ẢNH đèn lồng thật (data URI), phủ lớp đỏ mờ để chữ vàng đọc rõ.

// Mùng 1 Tết Đinh Mùi: thứ Bảy 6/2/2027 00:00 giờ VN (UTC+7)
// = 5/2/2027 17:00 UTC. Tính bằng UTC để không phụ thuộc múi giờ máy.
const TET_TARGET_MS = Date.UTC(2027, 1, 5, 17, 0, 0);

function getRemaining(nowMs) {
  let diff = TET_TARGET_MS - nowMs;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return { days, hours, minutes, seconds };
}

const pad2 = (n) => String(n).padStart(2, '0');

// Widget đếm ngược Tết — ô nhỏ góc dưới phải, chỉ hiện khi theme Tết bật.
// Nút X ẩn tạm trong phiên (sessionStorage); qua Tết thì hiện lời chúc.
export default function TetCountdown() {
  const [remaining, setRemaining] = useState(() => getRemaining(Date.now()));
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('tet_countdown_hidden') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining(Date.now())), 1000);
    return () => clearInterval(id);
  }, []);

  if (hidden) return null;

  const hide = () => {
    try { sessionStorage.setItem('tet_countdown_hidden', '1'); } catch {}
    setHidden(true);
  };

  const cells = remaining
    ? [
        { value: String(remaining.days), label: 'Ngày' },
        { value: pad2(remaining.hours), label: 'Giờ' },
        { value: pad2(remaining.minutes), label: 'Phút' },
        { value: pad2(remaining.seconds), label: 'Giây' },
      ]
    : null;

  return (
    <div
      className="tet-countdown fixed z-[300] bottom-4 right-4 max-sm:bottom-24 max-sm:right-3 rounded-2xl shadow-2xl px-4 py-3 select-none"
      style={{ backgroundImage: `linear-gradient(rgba(82,13,23,0.78), rgba(82,13,23,0.88)), url(${TET_IMG_LANTERN})` }}
    >
      <button
        onClick={hide}
        aria-label="Ẩn đếm ngược"
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#520D17] border border-[#E7BD68] text-[#FFE5A3] text-xs font-bold flex items-center justify-center shadow-md hover:bg-[#8F1420]"
      >
        ✕
      </button>
      <div className="text-center text-[#FFE5A3] text-xs font-bold tracking-[0.18em] uppercase">
        ✦ Đếm ngược Tết về ✦
      </div>
      {cells ? (
        <>
          <div className="flex items-stretch justify-center gap-1.5 mt-2">
            {cells.map((c) => (
              <div key={c.label} className="tet-count-cell min-w-[52px] rounded-xl px-2 py-1.5 text-center">
                <div className="text-xl font-bold leading-none text-[#FFE5A3] tabular-nums">{c.value}</div>
                <div className="text-[10px] font-semibold text-[#E7BD68] mt-1">{c.label}</div>
              </div>
            ))}
          </div>
          <div className="text-center text-[11px] font-semibold text-[#E7BD68]/90 mt-2">
            Mùng 1 Tết Đinh Mùi · Thứ Bảy 6/2/2027
          </div>
        </>
      ) : (
        <div className="text-center text-sm font-bold text-[#FFE5A3] mt-2 px-2">
          Chúc mừng năm mới Đinh Mùi!
        </div>
      )}
    </div>
  );
}
