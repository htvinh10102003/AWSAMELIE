import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Admin() {
  const [apiConfigs, setApiConfigs] = useState({ nhanh_app_id: '', nhanh_business_id: '', nhanh_secret_key: '', nhanh_access_code: '' });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState('');

  const [filterConfigs, setFilterConfigs] = useState({ allowed_statuses: [] });
  const [statusList, setStatusList] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [selectedNewPriority, setSelectedNewPriority] = useState('');

  const [filterLoading, setFilterLoading] = useState(false);
  const [filterMessage, setFilterMessage] = useState('');

  // 1. TẠO DANH SÁCH LỰA CHỌN ƯU TIÊN ĐỘNG DỰA VÀO CHECKBOX
  const getDynamicPriorityOptions = () => {
    const options = filterConfigs.allowed_statuses.map(statusId => {
      const st = statusList.find(s => String(s.id) === String(statusId));
      return {
        id: `STATUS_${statusId}`,
        label: `⭐ Ưu tiên: Đơn ${st ? st.name : 'Mã ' + statusId} (${statusId})`
      };
    });
    options.push({ id: 'DATE_ASC', label: '🕒 Ưu tiên Thời gian: Đơn tạo cũ nhất xếp trước' });
    return options;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: statuses } = await supabase.from('order_statuses').select('*').order('id');
    if (statuses) setStatusList(statuses);

    const { data: configs } = await supabase.from('system_configs').select('*');
    if (configs) {
      const configMap = {};
      configs.forEach(item => configMap[item.key] = item.value);
      
      setApiConfigs(prev => ({ 
          ...prev, 
          nhanh_app_id: configMap['nhanh_app_id'] || '',
          nhanh_business_id: configMap['nhanh_business_id'] || '',
          nhanh_secret_key: configMap['nhanh_secret_key'] || ''
      }));

      let savedStatuses = ['54', '55', '56', '42', '40']; // Default
      if (configMap['print_allowed_statuses']) {
        savedStatuses = configMap['print_allowed_statuses'].split(',');
      }
      setFilterConfigs({ allowed_statuses: savedStatuses });

      // Lấy danh sách option động để map lại tên cho các luật đã lưu
      const dynamicOptions = [
        ...savedStatuses.map(id => {
            const st = statuses?.find(s => String(s.id) === String(id));
            return { id: `STATUS_${id}`, label: `⭐ Ưu tiên: Đơn ${st ? st.name : id} (${id})` };
        }),
        { id: 'DATE_ASC', label: '🕒 Ưu tiên Thời gian: Đơn tạo cũ nhất xếp trước' }
      ];

      if (configMap['print_priority_mode']) {
        const savedOrder = configMap['print_priority_mode'].split(',');
        const restored = savedOrder.map(id => dynamicOptions.find(p => p.id === id)).filter(Boolean);
        setPriorities(restored);
      }
    }
  };

  const handleApiChange = (e) => setApiConfigs({ ...apiConfigs, [e.target.name]: e.target.value });
  
  const handleSaveApi = async (e) => {
    e.preventDefault();
    setApiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('nhanh-auth', { body: { ...apiConfigs, access_code: apiConfigs.nhanh_access_code } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setApiMessage('✅ Đã đổi Token thành công!');
      setApiConfigs(prev => ({ ...prev, nhanh_access_code: '' }));
    } catch (error) { setApiMessage('❌ Lỗi: ' + error.message); } 
    finally { setApiLoading(false); }
  };

  const handleStatusToggle = (statusId) => {
    const idStr = String(statusId);
    setFilterConfigs(prev => {
      const current = prev.allowed_statuses;
      // Nếu bỏ check, xóa luôn luật ưu tiên tương ứng (nếu có)
      if (current.includes(idStr)) {
        setPriorities(priorities.filter(p => p.id !== `STATUS_${idStr}`));
        return { allowed_statuses: current.filter(id => id !== idStr) }; 
      } else {
        return { allowed_statuses: [...current, idStr] }; 
      }
    });
  };

  const handleDragStart = (e, index) => e.dataTransfer.setData('dragIndex', index);
  const handleDrop = (e, dropIndex) => {
    const dragIndex = Number(e.dataTransfer.getData('dragIndex'));
    const newPriorities = [...priorities];
    const [draggedItem] = newPriorities.splice(dragIndex, 1);
    newPriorities.splice(dropIndex, 0, draggedItem);
    setPriorities(newPriorities);
  };

  const handleRemovePriority = (idToRemove) => setPriorities(priorities.filter(p => p.id !== idToRemove));

  const handleAddPriority = () => {
    if (!selectedNewPriority) return;
    const dynamicOptions = getDynamicPriorityOptions();
    const ruleToAdd = dynamicOptions.find(p => p.id === selectedNewPriority);
    if (ruleToAdd && !priorities.some(p => p.id === ruleToAdd.id)) {
        setPriorities([...priorities, ruleToAdd]);
    }
    setSelectedNewPriority('');
  };

  const handleSaveFilter = async (e) => {
    e.preventDefault();
    setFilterLoading(true);
    try {
      const updates = [
        { key: 'print_allowed_statuses', value: filterConfigs.allowed_statuses.join(',') },
        { key: 'print_priority_mode', value: priorities.map(p => p.id).join(',') }
      ];
      await supabase.from('system_configs').upsert(updates);
      setFilterMessage('✅ Đã lưu cấu hình Lọc & Ưu tiên!');
    } catch (error) { setFilterMessage('❌ Lỗi: ' + error.message); } 
    finally { setFilterLoading(false); }
  };

  const dynamicOptions = getDynamicPriorityOptions();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 mt-8">
      {/* KHỐI CÀI ĐẶT API */}
      <div className="bg-white p-8 rounded-xl shadow-sm border">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Cài đặt kết nối Nhanh.vn</h2>
        {apiMessage && <div className={`p-4 mb-6 rounded-lg font-medium ${apiMessage.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{apiMessage}</div>}
        <form onSubmit={handleSaveApi} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-semibold mb-1 block">App ID</label><input type="text" name="nhanh_app_id" value={apiConfigs.nhanh_app_id} onChange={handleApiChange} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="text-sm font-semibold mb-1 block">Business ID</label><input type="text" name="nhanh_business_id" value={apiConfigs.nhanh_business_id} onChange={handleApiChange} className="w-full px-4 py-2 border rounded-lg" /></div>
          </div>
          <div><label className="text-sm font-semibold mb-1 block">Secret Key</label><input type="password" name="nhanh_secret_key" value={apiConfigs.nhanh_secret_key} onChange={handleApiChange} className="w-full px-4 py-2 border rounded-lg" /></div>
          <div className="bg-yellow-50 p-4 border rounded-lg"><label className="text-sm font-semibold text-yellow-800 mb-1 block">Mã Access Code (15p)</label><input type="text" name="nhanh_access_code" value={apiConfigs.nhanh_access_code} onChange={handleApiChange} className="w-full px-4 py-2 border rounded-lg" /></div>
          <button type="submit" disabled={apiLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">{apiLoading ? 'Đang lưu...' : 'Lưu & Đổi Token'}</button>
        </form>
      </div>

      {/* KHỐI CẤU HÌNH LỌC */}
      <div className="bg-white p-8 rounded-xl shadow-sm border">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Cấu hình Lọc & Ưu tiên Đơn In</h2>
        {filterMessage && <div className={`p-4 mb-6 rounded-lg font-medium ${filterMessage.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{filterMessage}</div>}
        
        <form onSubmit={handleSaveFilter} className="space-y-8">
          {/* CHECKBOX */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">1. Các trạng thái đơn được phép xử lý</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-5 bg-gray-50 border rounded-lg max-h-64 overflow-y-auto">
              {statusList.map(status => (
                <label key={status.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg border border-transparent hover:border-gray-200 transition">
                  <input type="checkbox" className="w-5 h-5" checked={filterConfigs.allowed_statuses.includes(String(status.id))} onChange={() => handleStatusToggle(status.id)} />
                  <span className="text-sm font-medium"><span className="text-gray-400 mr-1">[{status.id}]</span> {status.name}</span>
                </label>
              ))}
            </div>
          </div>
          <hr className="border-gray-100" />
          
          {/* KÉO THẢ */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">2. Thứ tự ưu tiên (Kéo thả để sắp xếp, bấm X để xóa)</label>
            <div className="flex gap-2 mb-4">
                <select value={selectedNewPriority} onChange={(e) => setSelectedNewPriority(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg bg-gray-50 font-medium">
                    <option value="">-- Chọn luật ưu tiên để thêm --</option>
                    {dynamicOptions.filter(opt => !priorities.some(p => p.id === opt.id)).map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                </select>
                <button type="button" onClick={handleAddPriority} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-700">Thêm</button>
            </div>
            <div className="space-y-3 bg-blue-50/50 p-5 border border-blue-100 rounded-lg min-h-[100px]">
              {priorities.map((item, index) => (
                <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, index)}
                  className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm cursor-grab hover:border-blue-400 transition"
                >
                  <div className="flex items-center gap-4"><div className="text-gray-400 text-lg">⋮⋮</div><span className="font-semibold text-gray-700"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs mr-3">Ưu tiên {index + 1}</span>{item.label}</span></div>
                  <button type="button" onClick={() => handleRemovePriority(item.id)} className="text-red-400 font-bold px-3 py-1 bg-red-50 hover:bg-red-100 rounded">X</button>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" disabled={filterLoading} className="w-full bg-green-600 text-white font-bold py-4 rounded-lg hover:bg-green-700 transition">{filterLoading ? 'Đang lưu...' : 'Lưu Cấu hình'}</button>
        </form>
      </div>
    </div>
  );
}