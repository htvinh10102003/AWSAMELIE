import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Loader2 } from 'lucide-react';

export default function FeatureGuard({ featureId, subFeatureId, children }) {
  const [isLocked, setIsLocked] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const processConfig = (configValue) => {
      if (!configValue) return;
      const config = JSON.parse(configValue);
      
      // Check lớp 1: Khóa toàn cục phân hệ lớn
      if (config.isLocked) {
        setIsLocked(true);
        setMessage(config.message || 'Phân hệ này đang được bảo trì toàn bộ.');
        return;
      }

      // Check lớp 2: Khóa từng chức năng nhỏ (nếu có truyền subFeatureId)
      if (subFeatureId && config.subs && config.subs[subFeatureId]?.isLocked) {
        setIsLocked(true);
        setMessage(config.subs[subFeatureId].message || 'Chức năng này đang được bảo trì.');
        return;
      }

      // Nếu lọt qua hết thì là Mở
      setIsLocked(false);
      setMessage('');
    };

    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('system_configs')
          .select('value')
          .eq('key', `feature_lock_${featureId}`)
          .single();

        if (data && data.value) {
          processConfig(data.value);
        }
      } catch (error) {
        console.error("Lỗi khi tải cấu hình tính năng:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();

    const subscription = supabase
      .channel(`system_configs_changes_${featureId}_${subFeatureId || 'main'}`)
      .on('postgres_changes', { 
        event: '*', // Lắng nghe mọi thay đổi (INSERT, UPDATE)
        schema: 'public', 
        table: 'system_configs',
        filter: `key=eq.feature_lock_${featureId}` 
      }, (payload) => {
        if (payload.new && payload.new.value) {
          processConfig(payload.new.value);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [featureId, subFeatureId]);

  if (isLoading) {
    return (
      <div className="h-[50vh] w-full flex items-center justify-center bg-transparent">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className={`h-full w-full transition-all duration-300 ${isLocked ? 'pointer-events-none select-none blur-[3px] grayscale-[30%]' : ''}`}>
        {children}
      </div>

      {isLocked && (
        <div className="absolute inset-0 z-[100] bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Lock size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">Tính năng đang khóa</h3>
            <p className="text-slate-600 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              {message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}