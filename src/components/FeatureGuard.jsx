import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Lock, ShieldAlert, Bug } from 'lucide-react';

export default function FeatureGuard({ featureId, subFeatureId, children }) {
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    checkLockStatus();
  }, [featureId, subFeatureId]);

  const checkLockStatus = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Kiểm tra Owner
      const ownerCheck = user?.user_metadata?.is_owner === true || user?.user_metadata?.is_owner === 'true';
      setIsOwner(ownerCheck);

      // 2. Lấy dữ liệu từ bảng system_configs chuẩn theo cấu trúc JSON
      const configKey = `feature_lock_${featureId}`;
      const { data, error } = await supabase
        .from('system_configs')
        .select('value')
        .eq('key', configKey)
        .maybeSingle();

      let debugText = `Đang check Key: ${configKey} | Sub: ${subFeatureId}\n`;
      if (error) debugText += `Lỗi SQL: ${error.message}\n`;
      debugText += `Value DB: ${data ? data.value : 'null'}`;
      
      if (data && data.value) {
        try {
          const config = JSON.parse(data.value);
          let locked = false;

          // Kiểm tra khóa Mẹ (Ví dụ khóa nguyên menu Dashboard)
          if (config.isLocked === true || config.isLocked === 'true') {
            locked = true;
          } 
          // Nếu Mẹ không khóa, thì kiểm tra khóa Con (subs)
          else if (subFeatureId && config.subs && config.subs[subFeatureId]) {
            const subConfig = config.subs[subFeatureId];
            if (subConfig.isLocked === true || subConfig.isLocked === 'true') {
              locked = true;
            }
          }
          
          setIsLocked(locked);
        } catch (parseError) {
          debugText += `\nLỗi Parse JSON: ${parseError.message}`;
          setIsLocked(false);
        }
      } else {
        setIsLocked(false);
      }

      setDebugInfo(debugText);

    } catch (err) {
      console.error("[FeatureGuard] Lỗi hệ thống:", err);
      setDebugInfo(`Lỗi Try/Catch: ${err.message}`);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
        <p className="text-slate-400 font-medium text-sm">Đang tải tính năng...</p>
      </div>
    );
  }

  // 🚨 CHẶN TRUY CẬP: Tính năng BỊ KHÓA và người dùng KHÔNG PHẢI OWNER
  if (isLocked && !isOwner) {
    return (
      <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center max-w-lg">
          <div className="w-20 h-20 bg-slate-50 text-slate-400 flex items-center justify-center rounded-full mx-auto mb-6 shadow-inner border border-slate-100">
            <Lock size={36} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Tính năng đang bảo trì</h2>
          <p className="text-slate-500 font-medium leading-relaxed mb-6">
            Tính năng này tạm thời bị khóa để nâng cấp hoặc xử lý sự cố. Vui lòng quay lại sau hoặc liên hệ Quản trị viên.
          </p>
          
          {/* NẾU LÀ ADMIN MÀ VẪN BỊ KHÓA, HIỆN LỖI ĐỂ CHECK */}
          <div className="mt-6 text-left bg-slate-800 p-4 rounded-xl overflow-auto text-[10px] text-emerald-400 font-mono">
            <div className="flex items-center gap-1 mb-2 text-white"><Bug size={12}/> DEBUG INFO (Dành cho Admin):</div>
            <pre className="whitespace-pre-wrap">{debugInfo}</pre>
          </div>
        </div>
      </div>
    );
  }

  // ✅ CHO PHÉP TRUY CẬP
  return (
    <>
      {/* Cảnh báo cho Owner biết tính năng này đang khóa với người khác */}
      {isLocked && isOwner && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-black rounded-lg border border-amber-200 shadow-sm animate-in slide-in-from-top-2">
          <ShieldAlert size={14} /> CHẾ ĐỘ TEST (OWNER BYPASS): Tính năng này hiện đang bị khóa đối với Admin và User.
        </div>
      )}
      
      {children}
    </>
  );
}