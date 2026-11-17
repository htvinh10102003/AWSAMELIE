import { useState } from 'react';

// Lì xì Tết — 3 phong bao nhỏ góc trên phải, chỉ hiện khi theme Tết bật.
// Bấm vào 1 phong bao thì mở popup bốc lì xì. Mỗi phong bao chỉ bốc
// được 1 lần (tổng 3 lượt / lần tải trang); bốc hết 3 cái thì tải lại
// trang mới có lại 3 cái mới. Chỉ chơi cho vui trong app, KHÔNG phải
// tiền thật, KHÔNG lưu DB, KHÔNG động logic/data/quyền.
const PRIZES = [
  { label: 'Chúc may mắn lần sau', amount: 0, weight: 30 },
  { label: '1.000đ', amount: 1000, weight: 20 },
  { label: '2.000đ', amount: 2000, weight: 18 },
  { label: '5.000đ', amount: 5000, weight: 15 },
  { label: '10.000đ', amount: 10000, weight: 10 },
  { label: '50.000đ', amount: 50000, weight: 4 },
  { label: '100.000đ', amount: 100000, weight: 2 },
  { label: '200.000đ', amount: 200000, weight: 0.9 },
  { label: '500.000đ', amount: 500000, weight: 0.1 },
];

const TOTAL_WEIGHT = PRIZES.reduce((s, p) => s + p.weight, 0);

function pickPrize() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const p of PRIZES) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return PRIZES[0];
}

// 3 phong bao xếp hơi xòe, nghiêng nhẹ cho vui.
const ENVELOPES = [
  { id: 0, rotate: -10, offset: 0 },
  { id: 1, rotate: 0, offset: -6 },
  { id: 2, rotate: 10, offset: 0 },
];

export default function TetLixi() {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [picked, setPicked] = useState(null);
  const [pickedIds, setPickedIds] = useState(() => new Set());

  const remaining = ENVELOPES.length - pickedIds.size;

  const openPopup = (id) => {
    if (pickedIds.has(id)) return;
    setCurrentId(id);
    setPicked(null);
    setOpen(true);
  };

  const closePopup = () => setOpen(false);

  const handlePick = () => {
    if (picked || currentId === null) return;
    setPicked(pickPrize());
    setPickedIds((prev) => {
      const next = new Set(prev);
      next.add(currentId);
      return next;
    });
  };

  // Bốc tiếp: đóng popup để bấm phong bao khác còn lại.
  const handleAgain = () => setOpen(false);

  return (
    <>
      <div className="tet-lixi-corner fixed z-[300] top-14 right-4 max-sm:top-[76px] max-sm:right-3 flex items-end select-none" aria-label="Lì xì Tết">
        {ENVELOPES.map((e) => {
          const used = pickedIds.has(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => openPopup(e.id)}
              disabled={used}
              aria-label={used ? 'Đã bốc rồi' : 'Bốc lì xì'}
              className={`tet-lixi ${used ? 'tet-lixi-used' : ''}`}
              style={{ transform: `rotate(${e.rotate}deg) translateY(${e.offset}px)` }}
            >
              <span className="tet-lixi-char">Lộc</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="tet-lixi-overlay" onClick={closePopup}>
          <div className="tet-lixi-modal" onClick={(ev) => ev.stopPropagation()}>
            <button
              type="button"
              onClick={closePopup}
              aria-label="Đóng"
              className="tet-lixi-close"
            >
              ✕
            </button>
            <div className="tet-lixi-title">✦ Bốc lì xì Tết ✦</div>

            {!picked ? (
              <>
                <button type="button" onClick={handlePick} aria-label="Bóc lì xì" className="tet-lixi-big">
                  <span className="tet-lixi-char-big">Lộc</span>
                </button>
                <div className="tet-lixi-hint">Bấm vào lì xì để bóc</div>
              </>
            ) : (
              <div className="tet-lixi-result">
                {picked.amount > 0 ? (
                  <>
                    <div className="tet-lixi-result-label">Chúc mừng bạn nhận được</div>
                    <div className="tet-lixi-result-amount">{picked.label}</div>
                  </>
                ) : (
                  <>
                    <div className="tet-lixi-result-amount tet-lixi-result-luck">{picked.label}</div>
                    <div className="tet-lixi-result-label">Bốc tiếp thử vận may nào!</div>
                  </>
                )}
                {remaining === 0 ? (
                  <div className="tet-lixi-hint">Đã hết 3 lì xì! Tải lại trang để bốc tiếp.</div>
                ) : (
                  <div className="tet-lixi-hint">Còn lại {remaining} lì xì</div>
                )}
                <div className="tet-lixi-actions">
                  {remaining > 0 && (
                    <button type="button" onClick={handleAgain} className="tet-lixi-btn tet-lixi-btn-primary">
                      Bốc tiếp
                    </button>
                  )}
                  <button type="button" onClick={closePopup} className="tet-lixi-btn tet-lixi-btn-ghost">
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
