import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getMaintenanceMode, setMaintenanceMode, isOwnerUser, MAINTENANCE_KEY } from '../lib/maintenance';
import Maintenance404 from './Maintenance404';
import MaintenanceMobile from './MaintenanceMobile';

// Chan toan bo web khi dang bao tri.
// - maintenance = true + khong phai Owner (ke ca chua dang nhap) => chi thay man hinh xam 404.
// - Owner van vao duoc binh thuong de tat bao tri, kem banner canh bao o tren cung.
// - Nghe realtime system_configs nen khi Owner bat/tat, cac tab dang mo se doi ngay khong can F5.
// - Fix xam moi lan load: nho ket qua kiem tra lan truoc vao localStorage,
//   lan sau mo len la hien ngay trang theo ket qua cu, roi kiem tra ngam o
//   sau va doi neu khac. Nhu vay khong con man hinh xam cho. Doi lai: neu
//   Owner vua bat bao tri ma ai do load lai dung luc do thi ho co the thay
//   trang chinh trong tich tac truoc khi kiem tra ngam doi sang 404; tab
//   dang mo san thi realtime van doi ngay lap tuc nhu cu.
const MAINTENANCE_CACHE_KEY = 'wms_maintenance_cached';
function readCachedMaintenance() {
  try {
    const v = localStorage.getItem(MAINTENANCE_CACHE_KEY);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch (e) {}
  return null;
}
function writeCachedMaintenance(on) {
  try { localStorage.setItem(MAINTENANCE_CACHE_KEY, on ? 'true' : 'false'); } catch (e) {}
}
export default function MaintenanceGate({ children }) {
  const location = useLocation();
  const [maintenance, setMaintenance] = useState(readCachedMaintenance);
  const [user, setUser] = useState(null);
  const [turningOff, setTurningOff] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!cancelled) setUser(currentUser);
      // Màn hình xám ban đầu chỉ để chờ kiểm tra bảo trì, không được kẹt
      // vĩnh viễn nếu mạng chậm: quá 5 giây thì mặc định là không bảo trì
      // (đúng tinh thần fail-open của getMaintenanceMode).
      const on = await Promise.race([
        getMaintenanceMode(),
        new Promise(resolve => setTimeout(() => resolve(false), 5000)),
      ]);
      if (!cancelled) { setMaintenance(on); writeCachedMaintenance(on); }
    };
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    const channel = supabase
      .channel('maintenance_mode_listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_configs' }, (payload) => {
        if (payload.new && payload.new.key === MAINTENANCE_KEY) {
          const on = payload.new.value === 'true' || payload.new.value === true;
          setMaintenance(on); writeCachedMaintenance(on);
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const handleTurnOff = async () => {
    setTurningOff(true);
    try {
      await setMaintenanceMode(false);
      setMaintenance(false); writeCachedMaintenance(false);
    } catch (e) {
      alert('Lỗi tắt bảo trì: ' + e.message);
    } finally {
      setTurningOff(false);
    }
  };

  // Chi lan dau tien chua co cache moi phai cho kiem tra, va cho bang man
  // hinh trang co chu dang tai chu khong phai man hinh xam nua.
  if (maintenance === null) {
    return <div className="min-h-screen w-full flex items-center justify-center font-sans text-slate-500 font-semibold animate-pulse">Đang tải...</div>;
  }

  if (maintenance && !isOwnerUser(user)) {
    // Giao dien mobile (/mobile) co man hinh bao tri rieng, khong dung
    // man hinh xam 404 cua ban may tinh.
    if (location.pathname.startsWith('/mobile')) {
      return <MaintenanceMobile />;
    }
    return <Maintenance404 />;
  }

  if (maintenance && isOwnerUser(user)) {
    return (
      <>
        {/* sticky + z-1000: banner toan cuc trong Layout dang absolute top-0 z-500,
            neu khong co z-index cao hon thi banner bao tri se bi no de len va an mat. */}
        <div className="sticky top-0 z-[1000] w-full bg-slate-900 text-white text-sm font-bold px-4 py-2.5 flex items-center justify-center gap-4 flex-wrap shadow-lg">
          <span>Đang bật chế độ bảo trì — mọi người khác đang thấy trang bảo trì.</span>
          <button
            onClick={handleTurnOff}
            disabled={turningOff}
            className="px-4 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            {turningOff ? 'Đang tắt...' : 'Tắt bảo trì'}
          </button>
        </div>
        {children}
      </>
    );
  }

  return children;
}
