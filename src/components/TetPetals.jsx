import { useMemo } from 'react';

// Hoa rơi — lớp phủ toàn màn hình, pointer-events none nên không
// bao giờ chặn bấm. Mỗi bông là HOA VẼ BẰNG CSS (5 cánh, không dùng
// ảnh, không dùng emoji): hoa đào hồng xen kẽ hoa mai vàng, rơi chậm
// và lệch theo gió, xoay nhẹ khi rơi.
export default function TetPetals({ count = 12 }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 14,
        duration: 11 + Math.random() * 9,
        drift: (Math.random() - 0.5) * 70,
        dao: Math.random() > 0.5,
      })),
    [count]
  );

  return (
    <div className="tet-petals" aria-hidden="true">
      {petals.map((p) => (
        <span
          key={p.id}
          className={`tet-flower ${p.dao ? 'tet-flower-dao' : 'tet-flower-mai'}`}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--tet-drift': `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
