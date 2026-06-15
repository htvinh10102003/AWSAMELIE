import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, DownloadCloud, Loader2, CheckCircle2, AlertCircle, CalendarClock } from 'lucide-react';

export default function Admin() {
  // ==========================================
  // 1. KHỞI TẠO TẤT CẢ CÁC STATES TRONG SCOPE
  // ==========================================
  const [apiConfigs, setApiConfigs] = useState({ nhanh_app_id: '', nhanh_business_id: '', nhanh_secret_key: '', nhanh_access_code: '' });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState('');

  const [filterConfigs, setFilterConfigs] = useState({ allowed_statuses: [] });
  const [statusList, setStatusList] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [selectedNewPriority, setSelectedNewPriority] = useState('');
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterMessage, setFilterMessage] = useState('');

  // Các states liên kết cấu hình Google Sheets mới thêm
  const [sheetDailyUrl, setSheetDailyUrl] = useState('');
  const [sheetDailyGid, setSheetDailyGid] = useState('0');
  const [sheetPrintUrl, setSheetPrintUrl] = useState('');
  const [sheetPrintGid, setSheetPrintGid] = useState('0');
  const [syncLoading, setSyncLoading] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('');

  // ==========================================
  // 2. THUẬT TOÁN ĐỘNG & LOAD DATA KHI KHỞI CHẠY
  // ==========================================
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
      
      // Load cấu hình API Nhanh
      setApiConfigs(prev => ({ 
          ...prev, 
          nhanh_app_id: configMap['nhanh_app_id'] || '',
          nhanh_business_id: configMap['nhanh_business_id'] || '',
          nhanh_secret_key: configMap['nhanh_secret_key'] || ''
      }));

      // ⚡️ TỰ ĐỘNG LOAD CẤU HÌNH GOOGLE SHEETS LÊN FORM
      setSheetDailyUrl(configMap['sheet_daily_url'] || '');
      setSheetDailyGid(configMap['sheet_daily_gid'] || '0');
      setSheetPrintUrl(configMap['sheet_print_url'] || '');
      setSheetPrintGid(configMap['sheet_print_gid'] || '0');

      let savedStatuses = ['54', '55', '56', '42', '40']; // Mặc định
      if (configMap['print_allowed_statuses']) {
        savedStatuses = configMap['print_allowed_statuses'].split(',');
      }
      setFilterConfigs({ allowed_statuses: savedStatuses });

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

  // ==========================================
  // 3. LOGIC XỬ LÝ SỰ KIỆN (HANDLERS)
  // ==========================================
  const handleApiChange = (e) => setApiConfigs({ ...apiConfigs, [e.target.name]: e.target.value });
  
  const handleSaveApi = async (e) => {
    e.preventDefault();
    setApiLoading(true);
    setApiMessage('');
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
    setFilterMessage('');
    try {
      const updates = [
        { key: 'print_allowed_statuses', value: filterConfigs.allowed_statuses.join(',') },
        { key: 'print_priority_mode', value: priorities.map(p => p.id).join(',') }
      ];
      await supabase.from('system_configs').upsert(updates, { onConflict: 'key' });
      setFilterMessage('✅ Đã lưu cấu hình Lọc & Ưu tiên!');
    } catch (error) { setFilterMessage('❌ Lỗi: ' + error.message); } 
    finally { setFilterLoading(false); }
  };

  const [syncDays, setSyncDays] = useState(1); // Mặc định kéo 1 ngày
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | success | error

const handleSyncNhanhData = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage(`Đang kết nối Nhanh.vn cào dữ liệu ${syncDays} ngày qua...`);

    try {
      // ⚡️ Đóng cứng URL và Anon Key của ông vào đây để loại trừ hoàn toàn lỗi do file .env
      const projectUrl = "https://infljrayvhidhfimksfp.supabase.co";
      const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZmxqcmF5dmhpZGhmaW1rc2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzAyNjksImV4cCI6MjA5NjkwNjI2OX0.ap1UnciJ5OccAvC-l5sm-JGqObTkEC038Kjf2L_IFr0";

      // Đưa thẻ VIP lại cho thằng bảo vệ Kong Gateway
      const res = await fetch(`${projectUrl}/functions/v1/sync-nhanh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify({ daysToSync: Number(syncDays) })
      });

      const textData = await res.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch(e) {
        throw new Error(`Máy chủ sập không trả về JSON: ${textData}`);
      }

      // ⚡️ NẾU LỖI, IN THẲNG MÃ LỖI VÀ LÝ DO TỪ MÁY CHỦ RA MÀN HÌNH
      if (!res.ok) {
        throw new Error(`[Lỗi Server ${res.status}] ${data.error || data.message || textData}`);
      }
      
      if (data && data.success) {
        setSyncStatus('success');
        setSyncMessage(`🎉 Hoàn tất! Đã đồng bộ thành công ${data.totalSynced} đơn hàng.`);
      } else {
        throw new Error(data?.error || 'Lỗi logic không xác định từ Edge Function');
      }

    } catch (err) {
      console.error("Chi tiết lỗi:", err);
      setSyncStatus('error');
      setSyncMessage(`❌ ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // LƯU CẤU HÌNH LIÊN KẾT GOOGLE SHEETS VÀO DATABASE
  const handleSaveConfig = async () => {
    setSyncLoading(true);
    setSheetMessage('');
    try {
      const updates = [
        { key: 'sheet_daily_url', value: sheetDailyUrl },
        { key: 'sheet_daily_gid', value: sheetDailyGid },
        { key: 'sheet_print_url', value: sheetPrintUrl },
        { key: 'sheet_print_gid', value: sheetPrintGid }
      ];

      const { error } = await supabase.from('system_configs').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      setSheetMessage('✅ Đã ghi đè link cấu hình mới thành công!');
    } catch (err) {
      setSheetMessage('❌ Lỗi lưu cấu hình: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // KÍCH HOẠT QUÉT HỒNG LẬP TỨC SANG EDGE FUNCTION
  const handleTriggerSyncSheets = async () => {
    setSyncLoading(true);
    setSheetMessage('');
    try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-sheets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) setSheetMessage("🎉 " + data.message);
        else setSheetMessage("❌ Thất bại: " + data.error);
    } catch (err) {
        setSheetMessage("❌ Lỗi kết nối Edge Function: " + err.message);
    }
    setSyncLoading(false);
  };

  const dynamicOptions = getDynamicPriorityOptions();

  // ==========================================
  // 4. KHUNG GIAO DIỆN HIỂN THỊ ĐỒNG NHẤT (JSX)
  // ==========================================
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 mt-8">
      
      {/* KHỐI 1: CÀI ĐẶT API NHANH.VN */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Cài đặt kết nối Nhanh.vn</h2>
        {apiMessage && <div className={`p-4 mb-6 rounded-lg font-medium text-sm ${apiMessage.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{apiMessage}</div>}
        <form onSubmit={handleSaveApi} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-semibold mb-1 block">App ID</label><input type="text" name="nhanh_app_id" value={apiConfigs.nhanh_app_id} onChange={handleApiChange} className="w-full px-4 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="text-sm font-semibold mb-1 block">Business ID</label><input type="text" name="nhanh_business_id" value={apiConfigs.nhanh_business_id} onChange={handleApiChange} className="w-full px-4 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" /></div>
          </div>
          <div><label className="text-sm font-semibold mb-1 block">Secret Key</label><input type="password" name="nhanh_secret_key" value={apiConfigs.nhanh_secret_key} onChange={handleApiChange} className="w-full px-4 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" /></div>
          <div className="bg-yellow-50/50 p-4 border border-yellow-100 rounded-lg"><label className="text-xs font-bold text-yellow-800 uppercase mb-1.5 block">Mã Access Code mới bốc (Sống 15 phút)</label><input type="text" name="nhanh_access_code" value={apiConfigs.nhanh_access_code} onChange={handleApiChange} className="w-full px-4 py-2 border rounded-lg text-sm bg-white outline-none focus:border-blue-500" /></div>
          <button type="submit" disabled={apiLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition cursor-pointer text-sm">{apiLoading ? 'Đang lưu...' : 'Lưu & Đổi Token'}</button>
        </form>
      </div>

      {/* KHỐI 2: CẤU HÌNH LỌC & ƯU TIÊN ĐƠN IN */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Cấu hình Lọc & Ưu tiên Đơn In</h2>
        {filterMessage && <div className={`p-4 mb-6 rounded-lg font-medium text-sm ${filterMessage.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{filterMessage}</div>}
        
        <form onSubmit={handleSaveFilter} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">1. Các trạng thái đơn được phép xử lý</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-5 bg-gray-50 border rounded-lg max-h-64 overflow-y-auto">
              {statusList.map(status => (
                <label key={status.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg border border-transparent hover:border-gray-200 transition">
                  <input type="checkbox" className="w-4 h-4" checked={filterConfigs.allowed_statuses.includes(String(status.id))} onChange={() => handleStatusToggle(status.id)} />
                  <span className="text-sm font-medium"><span className="text-gray-400 mr-1">[{status.id}]</span> {status.name}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">2. Thứ tự ưu tiên (Kéo thả để sắp xếp, bấm X để xóa)</label>
            <div className="flex gap-2 mb-4">
                <select value={selectedNewPriority} onChange={(e) => setSelectedNewPriority(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg bg-gray-50 font-medium text-sm outline-none">
                    <option value="">-- Chọn luật ưu tiên để thêm --</option>
                    {dynamicOptions.filter(opt => !priorities.some(p => p.id === opt.id)).map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                </select>
                <button type="button" onClick={handleAddPriority} className="bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 cursor-pointer">Thêm</button>
            </div>
            <div className="space-y-3 bg-blue-50/30 p-5 border border-blue-100 rounded-lg min-h-[100px]">
              {priorities.map((item, index) => (
                <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, index)}
                  className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm cursor-grab hover:border-blue-400 transition"
                >
                  <div className="flex items-center gap-4"><div className="text-gray-400 text-sm">⋮⋮</div><span className="font-semibold text-sm text-gray-700"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs mr-3 font-bold">Thứ tự {index + 1}</span>{item.label}</span></div>
                  <button type="button" onClick={() => handleRemovePriority(item.id)} className="text-red-500 font-bold px-3 py-1 bg-red-50 hover:bg-red-100 rounded text-xs cursor-pointer">X</button>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" disabled={filterLoading} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition cursor-pointer text-sm">{filterLoading ? 'Đang lưu...' : 'Lưu Cấu hình Lọc'}</button>
        </form>
      </div>

      {/* KHỐI 3: CẤU HÌNH LIÊN KẾT GOOGLE SHEETS VẬN HÀNH */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-6 text-gray-800">Liên kết Google Sheets Vận Hành</h2>
        {sheetMessage && <div className={`p-4 mb-6 rounded-lg font-medium text-sm ${sheetMessage.includes('✅') || sheetMessage.includes('🎉') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{sheetMessage}</div>}
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1 tracking-wider">Link Sheet Đơn Đi Hàng Ngày</label>
                  <input type="text" value={sheetDailyUrl} onChange={e => setSheetDailyUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-blue-500"/>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1 tracking-wider">Mã GID Đơn Đi</label>
                  <input type="text" value={sheetDailyGid} onChange={e => setSheetDailyGid(e.target.value)} placeholder="0" className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-blue-500"/>
              </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1 tracking-wider">Link Sheet Đơn In Hàng Ngày</label>
                  <input type="text" value={sheetPrintUrl} onChange={e => setSheetPrintUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-blue-500"/>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1 tracking-wider">Mã GID Đơn In</label>
                  <input type="text" value={sheetPrintGid} onChange={e => setSheetPrintGid(e.target.value)} placeholder="1245667" className="w-full text-sm border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-blue-500"/>
              </div>
          </div>

          <div className="flex gap-3 border-t border-slate-100 pt-6 mt-4">
              <button onClick={handleSaveConfig} disabled={syncLoading} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-blue-700 transition cursor-pointer disabled:opacity-50">
                  Lưu cấu hình liên kết
              </button>
              <button onClick={handleTriggerSyncSheets} disabled={syncLoading} className="px-5 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer">
                  {syncLoading ? "⏳ Đang xử lý..." : "🔄 Bấm Quét Sheets Ngay"}
              </button>
          </div>
        </div>
      </div>

{/* ⚡️ KHỐI GIAO DIỆN CÔNG CỤ CÀO DỮ LIỆU THỦ CÔNG */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <DownloadCloud size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Cào dữ liệu API Nhanh.vn</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Xử lý các đơn bị miss webhook bằng cách kéo lại toàn bộ data</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Nút chọn số ngày */}
          <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full sm:w-48">
            <CalendarClock size={16} className="text-slate-400 mr-2" />
            <select 
              value={syncDays}
              onChange={(e) => setSyncDays(e.target.value)}
              disabled={isSyncing}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full cursor-pointer appearance-none"
            >
              <option value={1}>1 ngày qua (Hôm nay)</option>
              <option value={3}>3 ngày qua</option>
              <option value={7}>1 tuần qua</option>
              <option value={15}>15 ngày qua</option>
              <option value={30}>1 tháng qua</option>
            </select>
          </div>

          {/* Nút bấm Kích hoạt */}
          <button
            onClick={handleSyncNhanhData}
            disabled={isSyncing}
            className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
          >
            {isSyncing ? (
              <><Loader2 size={16} className="animate-spin" /> Đang cào data...</>
            ) : (
              <><DownloadCloud size={16} /> Đồng bộ ngay</>
            )}
          </button>
        </div>

        {/* Khối hiển thị thông báo kết quả */}
        {syncMessage && (
          <div className={`mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            syncStatus === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
            syncStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
            'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
          }`}>
            {syncStatus === 'success' && <CheckCircle2 size={16} />}
            {syncStatus === 'error' && <AlertCircle size={16} />}
            {syncMessage}
          </div>
        )}
      </div>


    </div>
  );
}