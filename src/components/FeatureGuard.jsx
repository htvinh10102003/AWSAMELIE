import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Lock, ShieldAlert } from 'lucide-react';

export default function FeatureGuard({ featureId, subFeatureId, children }) {
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    checkLockStatus();
  }, [featureId, subFeatureId]);

  const checkLockStatus = async () => {
    setLoading(true);
    try {
      // 1. Lấy thông tin user hiện tại
      const { data: { user } } = await supabase.auth.getUser();
      
      // 2. Kiểm tra xem có phải Owner không (Đặc quyền bypass)
      const ownerCheck = user?.user_metadata?.is_owner === true;
      setIsOwner(ownerCheck);

      // Nếu là Owner -> Bỏ qua đoạn check khóa, cho vào thẳng luôn
      if (ownerCheck) {
        // Vẫn gọi DB ngầm để kiểm tra trạng thái khóa (mục đích là để hiện cái cảnh báo màu cam cho Owner biết tính năng này đang khóa)
        const { data } = await supabase
          .from('feature_locks')
          .select('is_locked')
          .eq('feature_id', featureId)
          .eq('sub_feature_id', subFeatureId)
          .single();
          
        if (data && data.is_locked) setIsLocked(true);
        setLoading(false);
        return;
      }

      // 3. Nếu là User thường hoặc Admin -> Kiểm tra xem tính năng có bị khóa không
      const { data, error } = await supabase
        .from('feature_locks')
        .select('is_locked')
        .eq('feature_id', featureId)
        .eq('sub_feature_id', subFeatureId)
        .single();

      if (data && data.is_locked) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    } catch (err) {
      console.error("Lỗi kiểm tra khóa tính năng:", err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
        <p className="text-slate-400 font-medium text-sm">Đang tải tính năng...</p>
      </div>
    );
  }

  // 🚨 CHẶN TRUY CẬP: Tính năng bị khóa và người dùng KHÔNG PHẢI Owner
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
        </div>
      </div>
    );
  }

  // ✅ CHO PHÉP TRUY CẬP
  return (
    <>
      {/* Tính năng thông minh: Báo cho Owner biết họ đang test một tính năng đã bị khóa đối với nhân viên */}
      {isLocked && isOwner && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-black rounded-lg border border-amber-200 shadow-sm animate-in slide-in-from-top-2">
          <ShieldAlert size={14} /> CHẾ ĐỘ TEST (OWNER BYPASS): Tính năng này hiện đang bị khóa đối với Admin và User.
        </div>
      )}
      {children}
    </>
  );
}