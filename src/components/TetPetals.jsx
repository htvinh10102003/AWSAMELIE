import { useMemo } from 'react';
import { TET_IMG_FLOWER } from '../themes/tet-2027/tetImages';

// Hoa mai rơi — lớp phủ toàn màn hình, pointer-events none nên không
// bao giờ chặn bấm. Mỗi cánh là ẢNH bông mai thật (/tet/tet-flower.jpg,
// nền đen, dùng screen blend để nền đen biến mất), rơi chậm và lệch
// theo gió. Không vẽ hình bằng CSS.
export default function TetPetals({ count = 12 }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 16 + Math.random() * 14,
        delay: Math.random() * 14,
        duration: 11 + Math.random() * 9,
        drift: (Math.random() - 0.5) * 70,
      })),
    [count]
  );

  return (
    <div className="tet-petals" aria-hidden="true">
      {petals.map((p) => (
        <img
          key={p.id}
          src={TET_IMG_FLOWER}
          alt=""
          className="tet-petal-img"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--tet-drift': `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
