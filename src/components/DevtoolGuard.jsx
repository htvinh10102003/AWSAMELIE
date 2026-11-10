import { useEffect, useRef, useState } from 'react';
import detectorPkg from 'devtools-detector';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { clearPermCache } from '../lib/permCache';

// Chong mo DevTools tren web bao cao (repo: AEPKILL/devtools-detector,
// npm devtools-detector 2.0.25, MIT).
// - Chi chay tren may khong cam ung (desktop): dien thoai khong mo duoc
//   DevTools, bat len chi them bao nham.
// - Dung bo checker khong do kich thuoc cua so (sidebar trinh duyet / ban
//   phim ao deu gay duong tinh gia) va KHONG dung debuggerChecker (no gay
//   dung hinh moi lan kiem tra). Con lai: eruda (console mobile), element-id
//   (Safari), devtoolsFormatter (Chrome), performance (Chrome/Safari/Firefox).
// - Mo DevTools -> hien ngay man hinh "bat duoc". Dong DevTools lai -> het.
// - Dem vi pham: moi page load mo DevTools 1 lan thi +1 (luu theo user id).
//   Load sach (khong mo trong 2s dau) thi reset ve 0 -> 3 lan phai lien tiep.
// - Du 3 lan -> goi edge manage-users action 'self_lock' khoa chinh tai
//   khoan do (ban 10 nam + thu hoi phien), dang xuat ngay. Owner mo lai
//   trong trang Admin (nut Mo khoa co san).
// - Tai khoan Chu (is_owner / 2 email cua Vinh) duoc mien khoa: van hien
//   man hinh bat, nhung khong dem vi pham, khong bao gio tu khoa.

const MAX_STRIKES = 3;
const RESET_DELAY_MS = 2000;
const OWNER_EMAILS = ['contact.hotavinh@gmail.com', 'contact.hotavinhh@gmail.com'];

function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
}

function isOwnerUser(user) {
  if (!user) return false;
  return user.user_metadata?.is_owner === true || OWNER_EMAILS.includes(user.email || '');
}

function strikesKey(userId) {
  return `wms_devtool_strikes_${userId}`;
}

function readStrikes(userId) {
  try {
    return Math.min(MAX_STRIKES, parseInt(localStorage.getItem(strikesKey(userId)) || '0', 10) || 0);
  } catch {
    return 0;
  }
}

function writeStrikes(userId, n) {
  try {
    localStorage.setItem(strikesKey(userId), String(n));
  } catch {}
}

// Chi khoi dong detector 1 lan cho ca app (ke ca khi StrictMode mount lai).
let guardStarted = false;

export default function DevtoolGuard() {
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const stateRef = useRef({ openedThisLoad: false, lockTriedThisLoad: false, user: null });

  useEffect(() => {
    if (isTouchDevice()) return;
    if (guardStarted) return;
    guardStarted = true;

    supabase.auth.getUser().then(({ data }) => {
      stateRef.current.user = data?.user || null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      stateRef.current.user = session?.user || null;
      // Dang nhap lai duoc = owner da mo khoa -> xoa co "da bi khoa".
      if (session?.user) {
        try {
          localStorage.removeItem('wms_devtool_account_locked');
        } catch {}
      }
    });

    try {
      if (localStorage.getItem('wms_devtool_account_locked') === '1') setLocked(true);
    } catch {}

    // Load nay sach (khong mo DevTools trong 2s dau) -> reset so vi pham.
    const resetTimer = setTimeout(() => {
      if (!stateRef.current.openedThisLoad) {
        const u = stateRef.current.user;
        if (u && !isOwnerUser(u)) {
          writeStrikes(u.id, 0);
          setStrikes(0);
        }
      }
    }, RESET_DELAY_MS);

    const { DevtoolsDetector, checkers } = detectorPkg;
    const detector = new DevtoolsDetector({
      checkers: [
        checkers.erudaChecker,
        checkers.elementIdChecker,
        checkers.devtoolsFormatterChecker,
        checkers.performanceChecker,
      ],
    });
    detector.setDetectDelay(500);
    detector.addListener(async (isOpen) => {
      if (!isOpen) {
        setOpen(false);
        return;
      }
      setOpen(true);
      if (stateRef.current.openedThisLoad) return;
      stateRef.current.openedThisLoad = true;

      let u = stateRef.current.user;
      if (!u) {
        try {
          const { data } = await supabase.auth.getUser();
          u = data?.user || null;
          stateRef.current.user = u;
        } catch {}
      }
      // Chua dang nhap hoac tai khoan Chu: chi hien man hinh, khong dem.
      if (!u || isOwnerUser(u)) return;

      const n = Math.min(MAX_STRIKES, readStrikes(u.id) + 1);
      writeStrikes(u.id, n);
      setStrikes(n);

      if (n >= MAX_STRIKES && !stateRef.current.lockTriedThisLoad) {
        stateRef.current.lockTriedThisLoad = true;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
              'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ action: 'self_lock' }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            try {
              localStorage.setItem('wms_devtool_account_locked', '1');
            } catch {}
            setLocked(true);
            clearPermCache(u.id);
            await supabase.auth.signOut().catch(() => {});
          }
          // Khoa that bai (mang/edge) thi de lan mo sau thu lai.
        } catch {}
      }
    });
    detector.launch();

    return () => {
      clearTimeout(resetTimer);
      subscription.unsubscribe();
      detector.stop();
      guardStarted = false;
    };
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-3xl sm:text-4xl font-bold text-white">Á à, bắt được rồi nhé!</div>
      <div className="text-sm text-slate-400">Có cố gắng, nhưng không phải ở đây</div>
      {locked ? (
        <div className="flex max-w-md items-center gap-2 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-left">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white">!</span>
          <span className="text-sm font-bold text-red-400">Tài khoản của bạn đã bị khóa vì mở DevTools quá 3 lần. Liên hệ chủ tài khoản để mở lại.</span>
        </div>
      ) : strikes > 0 ? (
        <div className="flex flex-col items-center gap-3">
          <div className="text-xs font-bold text-amber-400">Cảnh báo lần {strikes}/{MAX_STRIKES} — đóng DevTools lại để tiếp tục làm việc.</div>
          {strikes < MAX_STRIKES && (
            <div className="flex max-w-md items-center gap-2 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-left">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white">!</span>
              <span className="text-xs font-bold text-red-400">Mở DevTools và tải lại trang quá 3 lần sẽ bị khóa tài khoản.</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
