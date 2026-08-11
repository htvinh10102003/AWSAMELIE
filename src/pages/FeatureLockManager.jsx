import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Unlock, Save, ShieldAlert, Loader2, AlertTriangle, ChevronDown, ChevronRight, FileEdit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// KHAI BÁO CẤU TRÚC CÂY: MỤC TO -> CÁC MỤC NHỎ
const FEATURES = [
  { 
    id: 'dashboard', name: 'Dashboard Tổng quan', icon: 'LayoutDashboard',
    subs: [
      { id: 'tong_quan', name: 'Đơn đi hàng ngày' },
      { id: 'don_hoan', name: 'SL Đơn hoàn theo ngày' },
      { id: 'kpi', name: 'Tổng quan KPI tháng' },
      { id: 'tra_cuu', name: 'Tra cứu luân chuyển' },
    ]
  },
  { 
    id: 'print_orders', name: 'Đơn in & Xử lý AWB', icon: 'Printer',
    subs: [
      { id: 'bao_cao', name: 'Đơn có thể in' },
      { id: 'da_in', name: 'Đơn đã in hôm nay' },
      { id: 'loc_day_ke', name: 'Lọc đơn chia theo dãy kệ' },
      { id: 'chen_awb', name: 'Chèn vị trí SP vào AWB' },
      { id: 'in_spx', name: 'In Đơn SPX Tự Động' }
    ]
  },
  { 
    id: 'packing', name: 'Đóng gói đơn hàng', icon: 'Box',
    subs: [
      { id: 'dong_goi', name: 'Đóng gói đơn hàng' },
      { id: 'toc_do_chung', name: 'Đóng gói chung' },
      { id: 'toc_do_ns', name: 'Đóng gói theo nhân sự' }
    ]
  },
  { 
    id: 'returns', name: 'Xử lý đơn hoàn', icon: 'Undo2',
    subs: [
      { id: 'tong_hop', name: 'Tổng hợp đơn hoàn' },
      { id: 'xu_ly', name: 'Xử lý Đơn hoàn' },
      { id: 'kiem_tra', name: 'Kiểm tra & Chốt SL' }
    ]
  },
  { 
    id: 'inventory', name: 'Báo cáo & Kiểm kê tồn kho', icon: 'Boxes',
    subs: [
      { id: 'thong_ke_kiem_ke', name: 'Báo cáo chung (Kiểm kê)' },
      { id: 'ds_kiem_ke', name: 'Danh sách cần kiểm kê' },
      { id: 'ton_kho', name: 'Tồn kho thực tế' },
      { id: 'vi_tri', name: 'Vị trí sản phẩm' }
    ]
  },
];

export default function FeatureLockManager() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState({}); // Quản lý mở rộng các mục con

  useEffect(() => {
    checkPermissionAndFetch();
  }, []);

  const checkPermissionAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const isOwner = user?.user_metadata?.is_owner === true;

    if (!isOwner) {
      setIsLoading(false);
      setHasPermission(false);
      return;
    }

    setHasPermission(true);

    const { data } = await supabase.from('system_configs').select('*').ilike('key', 'feature_lock_%');
    
    const initialConfigs = {};
    FEATURES.forEach(parent => {
      const dbConfig = data?.find(d => d.key === `feature_lock_${parent.id}`);
      
      // Tạo cấu trúc mặc định nếu db chưa có
      let parsedConfig = { isLocked: false, message: 'Tính năng đang bảo trì.', subs: {} };
      parent.subs.forEach(sub => {
        parsedConfig.subs[sub.id] = { isLocked: false, message: 'Chức năng đang bảo trì.' };
      });

      if (dbConfig && dbConfig.value) {
        const saved = JSON.parse(dbConfig.value);
        parsedConfig.isLocked = saved.isLocked ?? false;
        parsedConfig.message = saved.message ?? 'Tính năng đang bảo trì.';
        // Map lại các mục con đã lưu
        parent.subs.forEach(sub => {
          parsedConfig.subs[sub.id] = {
            isLocked: saved.subs?.[sub.id]?.isLocked ?? false,
            message: saved.subs?.[sub.id]?.message ?? 'Chức năng đang bảo trì.'
          };
        });
      }
      initialConfigs[parent.id] = parsedConfig;
    });
    
    setConfigs(initialConfigs);
    setIsLoading(false);
  };

  const handleToggleParent = (parentId) => {
    setConfigs(prev => ({
      ...prev,
      [parentId]: { ...prev[parentId], isLocked: !prev[parentId].isLocked }
    }));
  };

  const handleMessageParent = (parentId, value) => {
    setConfigs(prev => ({
      ...prev,
      [parentId]: { ...prev[parentId], message: value }
    }));
  };

  const handleToggleSub = (parentId, subId) => {
    setConfigs(prev => {
      const newConfig = { ...prev };
      newConfig[parentId].subs[subId].isLocked = !newConfig[parentId].subs[subId].isLocked;
      return newConfig;
    });
  };

  const handleMessageSub = (parentId, subId, value) => {
    setConfigs(prev => {
      const newConfig = { ...prev };
      newConfig[parentId].subs[subId].message = value;
      return newConfig;
    });
  };

  const toggleExpand = (parentId) => {
    setExpandedKeys(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const upsertData = Object.keys(configs).map(key => ({
        key: `feature_lock_${key}`,
        value: JSON.stringify(configs[key]),
        description: `Cấu hình khóa tính năng ${key}`
      }));

      const { error } = await supabase.from('system_configs').upsert(upsertData);
      if (error) throw error;
      alert('Đã lưu cấu hình khóa tính năng thành công!');
    } catch (error) {
      alert('Lỗi khi lưu: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="h-[80vh] flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  );

  if (!hasPermission) return (
    <div className="h-[80vh] flex flex-col items-center justify-center animate-fade-in">
      <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={40} /></div>
      <h2 className="text-3xl font-black text-slate-800 mb-2">Truy cập bị từ chối</h2>
      <p className="text-slate-500 font-medium mb-6">Chỉ Chủ sở hữu (Owner) mới có quyền truy cập và chỉnh sửa phân hệ này.</p>
      <button onClick={() => navigate('/')} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors">Quay lại trang chủ</button>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto font-sans animate-fade-in mt-4 pb-20">
      <div className="flex justify-between items-end mb-8 sticky top-0 bg-slate-50/80 backdrop-blur-xl py-4 z-10 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 text-red-600 rounded-2xl shadow-inner"><ShieldAlert size={28} strokeWidth={2.5} /></div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Khóa giới hạn tính năng</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Quyền Owner: Tùy chỉnh chi tiết thông báo cho từng phân hệ con.</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50">
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}Lưu thay đổi
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {FEATURES.map(parent => {
          const config = configs[parent.id];
          const isExpanded = expandedKeys[parent.id];
          
          return (
            <div key={parent.id} className={`rounded-2xl border-2 transition-all duration-300 shadow-sm overflow-hidden ${config.isLocked ? 'border-red-300' : 'border-slate-200'}`}>
              
              {/* CARD PHÂN HỆ LỚN */}
              <div className={`p-5 flex flex-col md:flex-row md:items-center gap-4 ${config.isLocked ? 'bg-red-50' : 'bg-white'}`}>
                <div 
                  className="flex items-center gap-4 min-w-[250px] cursor-pointer group select-none"
                  onClick={() => toggleExpand(parent.id)}
                >
                  <div className={`p-2 rounded-xl transition-colors ${config.isLocked ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg uppercase tracking-tight">{parent.name}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded mt-1 inline-block ${config.isLocked ? 'bg-red-200 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {config.isLocked ? 'KHÓA TOÀN BỘ' : 'HOẠT ĐỘNG'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <FileEdit size={16} className="text-slate-400 shrink-0" />
                  <input 
                    type="text" value={config.message} onChange={(e) => handleMessageParent(parent.id, e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none bg-white"
                    placeholder="Thông báo khi khóa phân hệ lớn..."
                  />
                </div>

                <div className="shrink-0">
                  <button onClick={() => handleToggleParent(parent.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${config.isLocked ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm' : 'bg-red-50 border border-red-100 text-red-600 hover:bg-red-100'}`}>
                    {config.isLocked ? <><Unlock size={18} /> Mở khóa toàn bộ</> : <><Lock size={18} /> Khóa toàn bộ</>}
                  </button>
                </div>
              </div>

              {/* LIST CÁC CHỨC NĂNG CON */}
              {isExpanded && (
                <div className={`border-t bg-slate-50 divide-y divide-slate-200 ${config.isLocked ? 'opacity-50 pointer-events-none border-red-200' : 'border-slate-200'}`}>
                  {parent.subs.map(sub => {
                    const subConfig = config.subs[sub.id];
                    return (
                      <div key={sub.id} className="p-4 pl-12 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-100/50 transition-colors">
                        <div className="min-w-[220px] flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${subConfig.isLocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
                          <span className={`font-semibold text-sm ${subConfig.isLocked ? 'text-red-700' : 'text-slate-700'}`}>{sub.name}</span>
                        </div>
                        
                        <div className="flex-1">
                           <input 
                              type="text" value={subConfig.message} onChange={(e) => handleMessageSub(parent.id, sub.id, e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:border-blue-500 outline-none bg-white shadow-sm"
                              placeholder="Thông báo riêng cho mục này..."
                            />
                        </div>

                        <div className="shrink-0">
                          <button onClick={() => handleToggleSub(parent.id, sub.id)} className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${subConfig.isLocked ? 'bg-white border-slate-300 text-slate-600' : 'bg-white border-red-200 text-red-500 hover:bg-red-50'}`}>
                            {subConfig.isLocked ? 'Đang Khóa -> Mở' : 'Khóa mục này'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}