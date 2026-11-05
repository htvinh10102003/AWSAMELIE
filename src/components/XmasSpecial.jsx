import { XMAS_SANTA, XMAS_TREE_LEFT, XMAS_TREE_RIGHT } from '../lib/xmasImages';

/* Christmas decorations for the OrderReport SPECIAL mode only.
   Presentational only: no state, no API, no logic changes. All elements are
   pointer-events-none so they never block clicks on the report underneath. */

// Falling snowflakes over the whole report (fixed overlay, under modals).
const FLAKES = [
  { left: '2%', size: 6, dur: 13, delay: 0 }, { left: '6%', size: 4, dur: 17, delay: 4 },
  { left: '11%', size: 8, dur: 11, delay: 2 }, { left: '16%', size: 5, dur: 15, delay: 7 },
  { left: '21%', size: 7, dur: 12, delay: 1 }, { left: '26%', size: 4, dur: 19, delay: 5 },
  { left: '31%', size: 6, dur: 14, delay: 9 }, { left: '36%', size: 9, dur: 10, delay: 3 },
  { left: '41%', size: 5, dur: 16, delay: 6 }, { left: '46%', size: 7, dur: 12, delay: 0 },
  { left: '51%', size: 4, dur: 18, delay: 8 }, { left: '56%', size: 8, dur: 11, delay: 2 },
  { left: '61%', size: 5, dur: 15, delay: 5 }, { left: '66%', size: 6, dur: 13, delay: 10 },
  { left: '71%', size: 4, dur: 17, delay: 1 }, { left: '76%', size: 9, dur: 10, delay: 4 },
  { left: '81%', size: 5, dur: 14, delay: 7 }, { left: '86%', size: 7, dur: 12, delay: 3 },
  { left: '91%', size: 4, dur: 19, delay: 6 }, { left: '96%', size: 6, dur: 13, delay: 9 },
  { left: '8%', size: 5, dur: 16, delay: 11 }, { left: '48%', size: 4, dur: 20, delay: 12 },
  { left: '68%', size: 5, dur: 15, delay: 13 }, { left: '88%', size: 8, dur: 11, delay: 14 },
  { left: '34%', size: 4, dur: 18, delay: 15 }, { left: '58%', size: 6, dur: 12, delay: 16 },
  { left: '4%', size: 10, dur: 14, delay: 17 }, { left: '14%', size: 5, dur: 12, delay: 18 },
  { left: '24%', size: 11, dur: 15, delay: 19 }, { left: '38%', size: 5, dur: 13, delay: 20 },
  { left: '54%', size: 10, dur: 11, delay: 21 }, { left: '64%', size: 5, dur: 16, delay: 22 },
  { left: '74%', size: 12, dur: 12, delay: 23 }, { left: '84%', size: 5, dur: 14, delay: 24 },
  { left: '94%', size: 10, dur: 13, delay: 25 }, { left: '18%', size: 6, dur: 17, delay: 26 },
  { left: '44%', size: 9, dur: 12, delay: 27 }, { left: '78%', size: 6, dur: 15, delay: 28 },
  { left: '98%', size: 5, dur: 18, delay: 29 }, { left: '28%', size: 8, dur: 14, delay: 30 },
];

export function Snowfall() {
  return (
    <div className="xmas-snowfall no-print" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="xmas-flake"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// Wavy snowdrift that drapes over the top edge of a card/band (dai tuyet
// day, mep duoi uon luon nhu anh mau — khong con hang tron).
// The host element must be positioned (sticky/relative) — it anchors to it.
export function SnowCap({ className = 'top-0' }) {
  const d = 'M0 0H1200V5 C1140 20, 1080 4, 1010 16 C940 26, 870 6, 800 18 C730 26, 660 4, 590 16 C520 26, 450 6, 380 18 C310 26, 240 4, 170 16 C110 24, 50 6, 0 12 Z';
  return (
    <svg
      viewBox="0 0 1200 26"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`absolute ${className} left-3 right-3 h-[20px] w-auto pointer-events-none z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.08)]`}
    >
      <path d={d} fill="#ffffff" />
    </svg>
  );
}

// Santa peeking over the header band + gold greeting, top of special report.
export function SantaStrip() {
  return (
    <div className="relative h-[110px] sm:h-[120px] no-print" aria-hidden="true">
      <img
        src={XMAS_SANTA}
        alt=""
        draggable={false}
        className="absolute left-1 sm:left-3 bottom-[-52px] w-[190px] sm:w-[230px] z-40 pointer-events-none drop-shadow-xl select-none"
      />
      <div className="absolute inset-0 hidden sm:flex items-center justify-center pointer-events-none sm:pl-56">
        <span className="text-2xl lg:text-3xl font-black tracking-wide bg-gradient-to-b from-[#FFE9A3] via-[#FFD166] to-[#E8A93D] bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(255,209,102,0.45)]">
          GIÁNG SINH AN LÀNH
        </span>
      </div>
      <svg viewBox="0 0 24 24" className="xmas-twinkle absolute right-[18%] top-3 w-5 h-5 text-[#FFD166] pointer-events-none" fill="currentColor">
        <path d="M12 1l2.4 7.2H22l-6 4.4 2.3 7.4-6.3-4.6-6.3 4.6L8 12.6 2 8.2h7.6z" />
      </svg>
      <svg viewBox="0 0 24 24" className="xmas-twinkle absolute right-[26%] top-10 w-3.5 h-3.5 text-[#FFD166] pointer-events-none" style={{ animationDelay: '1.2s' }} fill="currentColor">
        <path d="M12 1l2.4 7.2H22l-6 4.4 2.3 7.4-6.3-4.6-6.3 4.6L8 12.6 2 8.2h7.6z" />
      </svg>
    </div>
  );
}

// Two Christmas trees pinned to the bottom corners of the content area.
// Sticky: they ride at the viewport bottom while scrolling, then settle at
// the end of the report. Never blocks clicks (pointer-events-none).
export function TreesFrame() {
  return (
    <div className="sticky bottom-0 z-30 pointer-events-none no-print h-0 relative" aria-hidden="true">
      <img
        src={XMAS_TREE_LEFT}
        alt=""
        draggable={false}
        className="absolute left-0 bottom-0 w-[130px] sm:w-[170px] md:w-[210px] drop-shadow-xl select-none"
      />
      <img
        src={XMAS_TREE_RIGHT}
        alt=""
        draggable={false}
        className="absolute right-0 bottom-0 w-[125px] sm:w-[165px] md:w-[200px] drop-shadow-xl select-none"
      />
    </div>
  );
}

// Snowy ground strip pinned to the viewport bottom, under the trees.
// Wavy top edge, straight bottom — tuyet dong o day khung.
export function SnowDrift() {
  const d = 'M0 36V14 C60 26, 120 6, 200 18 C280 28, 350 8, 430 20 C510 28, 580 6, 660 18 C740 26, 810 8, 890 20 C970 28, 1040 6, 1120 18 C1160 24, 1180 12, 1200 10 V36 Z';
  return (
    <svg
      viewBox="0 0 1200 36"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="fixed bottom-0 left-0 right-0 h-[36px] w-full pointer-events-none z-20 no-print"
    >
      <path d={d} fill="#ffffff" />
    </svg>
  );
}
