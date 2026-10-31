import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getMaintenanceMode, setMaintenanceMode, isOwnerUser, MAINTENANCE_KEY } from '../lib/maintenance';
import Maintenance404 from './Maintenance404';

// Chan toan bo web khi dang bao tri.
// - maintenance = true + khong phai Owner (ke ca chua dang nhap) => chi thay man hinh xam 404.
// - Owner van vao duoc binh thuong de tat bao tri, kem banner canh bao o tren cung.
// - Nghe realtime system_configs nen khi Owner bat/tat, cac tab dang mo se doi ngay khong can F5.
export default function MaintenanceGate({ children }) {
  const [maintenance, setMaintenance] = useState(null);
  const [user, setUser] = useState(null);
  const [turningOff, setTurningOff] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!cancelled) setUser(currentUser);
      const on = await getMaintenanceMode();
      if (!cancelled) setMaintenance(on);
    };
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    const channel = supabase
      .channel('maintenance_mode_listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_configs' }, (payload) => {
        if (payload.new && payload.new.key === MAINTENANCE_KEY) {
          setMaintenance(payload.new.value === 'true' || payload.new.value === true);
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
      setMaintenance(false);
    } catch (e) {
      alert('Lỗi tắt bảo trì: ' + e.message);
    } finally {
      setTurningOff(false);
    }
  };

  // Dang kiem tra thi hien man hinh xam trong, tranh loe noi dung web truoc khi chan.
  if (maintenance === null) {
    return <div className="min-h-screen w-full" style={{ backgroundColor: '#808080' }} />;
  }

  if (maintenance && !isOwnerUser(user)) {
    return <Maintenance404 />;
  }

  if (maintenance && isOwnerUser(user)) {
    return (
      <>
        {/* sticky + z-1000: banner toan cuc trong Layout dang absolute top-0 z-500,
            neu khong co z-index cao hon thi banner bao tri se bi no de len va an mat. */}
        <div className="sticky top-0 z-[1000] w-full bg-slate-900 text-white text-sm font-bold px-4 py-2.5 flex items-center justify-center gap-4 flex-wrap shadow-lg">
          <span>Đang bật chế độ bảo trì — mọi người khác đang thấy trang 404.</span>
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
