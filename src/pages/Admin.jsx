import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Settings, DownloadCloud, Loader2, CheckCircle2, AlertCircle, PackageSearch,
  Users, UserPlus, UserX, Eye, EyeOff, KeyRound, Pencil, X, Zap, MapPin, UploadCloud
} from 'lucide-react';
import * as Papa from 'papaparse'; // Thư viện đọc CSV

export default function Admin() {
  const [activeTab, setActiveTab] = useState('configs'); 
  const [currentUserMeta, setCurrentUserMeta] = useState({});
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'user' });
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [userMessage, setUserMessage] = useState('');
  const [loading, setLoading] = useState(false); 

  const [editingUser, setEditingUser] = useState(null); 
  const [editForm, setEditForm] = useState({ fullName: '', role: 'user' });

  const [apiConfigs, setApiConfigs] = useState({ nhanh_app_id: '', nhanh_business_id: '', nhanh_secret_key: '', nhanh_access_code: '' });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState('');

  const [filterConfigs, setFilterConfigs] = useState({ allowed_statuses: [] });
  const [statusList, setStatusList] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [selectedNewPriority, setSelectedNewPriority] = useState('');
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterMessage, setFilterMessage] = useState('');

  const [sheetDailyUrl, setSheetDailyUrl] = useState('');
  const [sheetDailyGid, setSheetDailyGid] = useState('0');
  const [sheetPrintUrl, setSheetPrintUrl] = useState('');
  const [sheetPrintGid, setSheetPrintGid] = useState('0');
  const [syncLoading, setSyncLoading] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('');

  const [syncDays, setSyncDays] = useState(1); 
  const [isSyncingOrder, setIsSyncingOrder] = useState(false);
  const [syncOrderMessage, setSyncOrderMessage] = useState('');
  const [syncOrderStatus, setSyncOrderStatus] = useState('idle');

  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const [syncInventoryStatus, setSyncInventoryStatus] = useState('idle');
  const [isSyncingMaster, setIsSyncingMaster] = useState(false);
  const [syncMasterStatus, setSyncMasterStatus] = useState('idle');
  const [syncProductMessage, setSyncProductMessage] = useState(''); 

  // ==========================================
  // ⚡️ MỚI: QUẢN LÝ VỊ TRÍ KHO HÀNG (LOCATION)
  // ==========================================
  const [csvFile, setCsvFile] = useState(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [locationMessage, setLocationMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  const projectUrl = "https://infljrayvhidhfimksfp.supabase.co";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZmxqcmF5dmhpZGhmaW1rc2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzAyNjksImV4cCI6MjA5NjkwNjI2OX0.ap1UnciJ5OccAvC-l5sm-JGqObTkEC038Kjf2L_IFr0";

  const getDynamicPriorityOptions = () => {
    const options = filterConfigs.allowed_statuses.map(statusId => {
      const st = statusList.find(s => String(s.id) === String(statusId));
      return { id: `STATUS_${statusId}`, label: `⭐ Ưu tiên: Đơn ${st ? st.name : 'Mã ' + statusId} (${statusId})` };
    });
    options.push({ id: 'DATE_ASC', label: '🕒 Ưu tiên Thời gian: Đơn tạo cũ nhất xếp trước' });
    return options;
  };

  useEffect(() => {
    fetchData();
    loadCurrentUserData();
  }, []);

  useEffect(() => {
    if (activeTab === 'users_management') fetchSystemUsers();
  }, [activeTab]);

  const loadCurrentUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserMeta(user.user_metadata || {});
  };

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

      setSheetDailyUrl(configMap['sheet_daily_url'] || '');
      setSheetDailyGid(configMap['sheet_daily_gid'] || '0');
      setSheetPrintUrl(configMap['sheet_print_url'] || '');
      setSheetPrintGid(configMap['sheet_print_gid'] || '0');

      let savedStatuses = ['54', '55', '56', '42', '40'];
      if (configMap['print_allowed_statuses']) savedStatuses = configMap['print_allowed_statuses'].split(',');
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

  const callUserManagementApi = async (payload) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${projectUrl}/functions/v1/manage-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': anonKey
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi xử lý hệ thống');
    return data;
  };

  const fetchSystemUsers = async () => {
    setLoading(true); setUserMessage('');
    try {
      const data = await callUserManagementApi({ action: 'list' });
      setUsers(data.users || []);
    } catch (err) {
      setUserMessage(`❌ Lỗi tải thành viên: ${err.message}`);
    } finally { setLoading(false); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.email || !userForm.password || !userForm.fullName) {
      alert('Vui lòng điền đầy đủ thông tin tài khoản!'); return;
    }
    setLoading(true); setUserMessage('');
    try {
      await callUserManagementApi({ action: 'create', ...userForm });
      setUserMessage(`✅ Đã khởi tạo thành công tài khoản cho [${userForm.fullName}]`);
      setUserForm({ email: '', password: '', fullName: '', role: 'user' });
      await fetchSystemUsers();
    } catch (err) {
      setUserMessage(`❌ Lỗi tạo tài khoản: ${err.message}`);
    } finally { setLoading(false); }
  };

  const handleOpenEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setEditForm({
      fullName: targetUser.user_metadata?.full_name || '',
      role: targetUser.user_metadata?.role || 'user'
    });
  };

  const handleSaveEditedInfo = async (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim()) {
      alert('Họ và tên không được để trống!'); return;
    }
    setLoading(true);
    try {
      await callUserManagementApi({
        action: 'update_info',
        userId: editingUser.id,
        fullName: editForm.fullName,
        role: isOwner ? editForm.role : undefined
      });
      setUserMessage(`✅ Đã cập nhật thông tin thành công cho tài khoản.`);
      setEditingUser(null);
      await fetchSystemUsers();
    } catch (err) {
      alert(`❌ Lỗi lưu thông tin: ${err.message}`);
    } finally { setLoading(false); }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!confirm(`🚨 BẠN CÓ CHẮC MUỐN XÓA VĨNH VIỄN tài khoản [${targetUser.user_metadata?.full_name || targetUser.email}] không?`)) return;
    setActionLoadingId(targetUser.id);
    try {
      await callUserManagementApi({ action: 'delete', userId: targetUser.id });
      setUserMessage(`✅ Đã xóa sổ tài khoản khỏi hệ thống.`);
      await fetchSystemUsers();
    } catch (err) {
      setUserMessage(`❌ Không thể xóa: ${err.message}`);
    } finally { setActionLoadingId(null); }
  };

  const handleApiChange = (e) => setApiConfigs({ ...apiConfigs, [e.target.name]: e.target.value });
  
  const handleSaveApi = async (e) => {
    e.preventDefault();
    setApiLoading(true); setApiMessage('');
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
    setFilterLoading(true); setFilterMessage('');
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

  const handleSyncOrdersData = async () => {
    setIsSyncingOrder(true); setSyncOrderStatus('idle'); setSyncOrderMessage(`Đang cào dữ liệu Đơn hàng ${syncDays} ngày qua...`);
    try {
      const res = await fetch(`${projectUrl}/functions/v1/sync-nhanh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ daysToSync: Number(syncDays) })
      });
      const textData = await res.text();
      let data;
      try { data = JSON.parse(textData); } catch(e) { throw new Error(`Máy chủ sập: ${textData}`); }
      if (!res.ok) throw new Error(`[Lỗi Server] ${data.error || data.message || textData}`);
      if (data && data.success) {
        setSyncOrderStatus('success');
        setSyncOrderMessage(`🎉 Đã đồng bộ thành công ${data.totalSynced} đơn hàng.`);
      } else { throw new Error(data?.error || 'Lỗi logic Edge Function'); }
    } catch (err) {
      setSyncOrderStatus('error'); setSyncOrderMessage(`❌ ${err.message}`);
    } finally { setIsSyncingOrder(false); }
  };

  const handleSyncInventoryOnly = async () => {
    setIsSyncingInventory(true); setSyncInventoryStatus('idle'); setSyncProductMessage(`Đang kéo Tồn Kho Siêu Tốc...`);
    try {
      const res = await fetch(`${projectUrl}/functions/v1/sync-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ mode: 'inventory' }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi server');
      
      setSyncInventoryStatus('success');
      setSyncProductMessage(`⚡️ Đã cập nhật Tồn Kho (On Hand) cho ${data.totalSynced} sản phẩm.`);
    } catch (err) {
      setSyncInventoryStatus('error'); setSyncProductMessage(`❌ ${err.message}`);
    } finally { setIsSyncingInventory(false); }
  };

  const handleSyncMasterData = async () => {
    if (!confirm("Việc cào toàn bộ Data (Tên, Mã Vạch) sẽ mất nhiều thời gian hơn. Xác nhận chạy?")) return;
    setIsSyncingMaster(true); setSyncMasterStatus('idle'); setSyncProductMessage(`Đang cào toàn bộ Master Data...`);
    try {
      const res = await fetch(`${projectUrl}/functions/v1/sync-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ mode: 'master' }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi server');
      
      setSyncMasterStatus('success');
      setSyncProductMessage(`🎉 Đã làm mới toàn bộ ${data.totalSynced} sản phẩm.`);
    } catch (err) {
      setSyncMasterStatus('error'); setSyncProductMessage(`❌ ${err.message}`);
    } finally { setIsSyncingMaster(false); }
  };

  const handleSaveConfig = async () => {
    setSyncLoading(true); setSheetMessage('');
    try {
      const updates = [
        { key: 'sheet_daily_url', value: sheetDailyUrl }, { key: 'sheet_daily_gid', value: sheetDailyGid },
        { key: 'sheet_print_url', value: sheetPrintUrl }, { key: 'sheet_print_gid', value: sheetPrintGid }
      ];
      const { error } = await supabase.from('system_configs').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      setSheetMessage('✅ Đã ghi đè link cấu hình mới thành công!');
    } catch (err) { setSheetMessage('❌ Lỗi lưu cấu hình: ' + err.message); } 
    finally { setSyncLoading(false); }
  };

  const handleTriggerSyncSheets = async () => {
    setSyncLoading(true); setSheetMessage('');
    try {
        const res = await fetch(`${projectUrl}/functions/v1/sync-sheets`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (data.success) setSheetMessage("🎉 " + data.message);
        else setSheetMessage("❌ Thất bại: " + data.error);
    } catch (err) { setSheetMessage("❌ Lỗi kết nối: " + err.message); }
    setSyncLoading(false);
  };


  // ==========================================
  // ⚡️ LUỒNG UPLOAD CSV IMPORT VỊ TRÍ SẢN PHẨM
  // ==========================================
  const handleUploadLocationCsv = () => {
    if (!csvFile) {
        setLocationMessage({ text: 'Vui lòng chọn một file CSV trước.', type: 'error' });
        return;
    }
    
    setIsUploadingCsv(true);
    setLocationMessage({ text: 'Đang xử lý file...', type: 'processing' });

    // Dùng PapaParse để đọc file Excel/CSV
    Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            let successCount = 0;
            let errorCount = 0;

            // Chạy vòng lặp cập nhật từng sản phẩm vào Database
            for (const row of data) {
                // Tìm Key dựa trên cả tiếng Việt hoặc tiếng Anh (Mã SP/Product Code, Vị trí/Location)
                const productCode = row['Mã SP'] || row['Mã sản phẩm'] || row['product_code'];
                const location = row['Vị trí'] || row['Vi tri'] || row['location_code'];

                if (productCode && location) {
                    // Update thẳng vào cột location_code của bảng product_inventories
                    const { error } = await supabase
                        .from('product_inventories')
                        .update({ location_code: location })
                        .eq('product_code', productCode); // So khớp với Mã sản phẩm

                    if (!error) successCount++;
                    else errorCount++;
                } else {
                    errorCount++;
                }
            }

            setIsUploadingCsv(false);
            if (successCount > 0) {
                setLocationMessage({ text: `🎉 Đã gắn vị trí cho ${successCount} mã sản phẩm. (Thất bại/Bỏ qua: ${errorCount} mã).`, type: 'success' });
            } else {
                setLocationMessage({ text: '❌ Lỗi định dạng file. Vui lòng đảm bảo file có 2 cột "Mã SP" và "Vị trí".', type: 'error' });
            }
            setCsvFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        },
        error: (error) => {
            setIsUploadingCsv(false);
            setLocationMessage({ text: `❌ Lỗi đọc file: ${error.message}`, type: 'error' });
        }
    });
  };

  const dynamicOptions = getDynamicPriorityOptions();
  const isOwner = currentUserMeta.is_owner === true;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 mt-8">
      
      {/* KHỐI CHUYỂN TAB ĐIỀU HƯỚNG */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-sm">
            <Settings size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">Quản trị Hệ thống</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Thiết lập kết nối vận hành và Quản lý nhân sự</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 flex-wrap">
          <button onClick={() => { setActiveTab('configs'); setUserMessage(''); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'configs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 cursor-pointer'}`}>
            Cấu hình
          </button>
          <button onClick={() => { setActiveTab('users_management'); setUserMessage(''); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'users_management' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 cursor-pointer'}`}>
            User
          </button>
        </div>
      </div>

      {userMessage && (
        <div className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2 ${userMessage.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <CheckCircle2 size={16} /> {userMessage}
        </div>
      )}


      {/* RENDER TAB 1: CẤU HÌNH HỆ THỐNG */}
      {activeTab === 'configs' && (
        <div className="space-y-8 animate-in fade-in duration-300">

          {/* ================= KHỐI ĐỒNG BỘ DỮ LIỆU ĐỘC LẬP ================= */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-4">
              <DownloadCloud size={20}/> Đồng bộ Dữ liệu Cục bộ (Tránh Miss Webhook)
            </h2>

            {/* 1. Tầng cào Đơn hàng (Đã khôi phục) */}
            <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">Đồng bộ dữ liệu Đơn Hàng</p>
                  <p className="text-[11px] text-slate-500 mt-1">Sử dụng tính năng này khi hệ thống Webhook bị ngắt quãng khiến đơn hàng trên Nhanh không đẩy về được bảng phân bổ cục bộ.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={syncDays} 
                    onChange={e => setSyncDays(e.target.value)} 
                    disabled={isSyncingOrder}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                  >
                    <option value={1}>1 ngày</option>
                    <option value={3}>3 ngày</option>
                    <option value={7}>7 ngày</option>
                  </select>
                  <button 
                    onClick={handleSyncOrdersData} 
                    disabled={isSyncingOrder} 
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isSyncingOrder ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />} Kéo Đơn Về
                  </button>
                </div>
              </div>
              
              {syncOrderMessage && (
                <div className={`mt-3 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  syncOrderStatus === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
                  syncOrderStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
                  'bg-white border-blue-200 text-blue-700 animate-pulse shadow-sm'
                }`}>
                  {syncOrderStatus === 'success' && <CheckCircle2 size={16} />}
                  {syncOrderStatus === 'error' && <AlertCircle size={16} />}
                  {syncOrderMessage}
                </div>
              )}
            </div>

            {/* 2. Tầng cào Sản Phẩm */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">Đồng bộ danh bạ Sản Phẩm & Tồn Kho</p>
                  <p className="text-[11px] text-slate-500 mt-1">Bấm "Tồn kho" để cập nhật số lượng nhanh. Bấm "Master Data" khi thêm mã vạch hoặc đổi tên áo quần mới (Thời gian chạy Master sẽ lâu hơn).</p>
                </div>
                
                <div className="flex w-full sm:w-auto gap-2">
                  <button onClick={handleSyncInventoryOnly} disabled={isSyncingInventory || isSyncingMaster} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl shadow-sm transition">
                    {isSyncingInventory ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Tồn kho
                  </button>
                  <button onClick={handleSyncMasterData} disabled={isSyncingInventory || isSyncingMaster} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl shadow-sm transition">
                    {isSyncingMaster ? <Loader2 size={16} className="animate-spin" /> : <PackageSearch size={16} />} Master Data
                  </button>
                </div>
              </div>
              
              {syncProductMessage && (
                <div className={`mt-3 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  syncInventoryStatus === 'success' || syncMasterStatus === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
                  syncInventoryStatus === 'error' || syncMasterStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
                  'bg-white border-slate-300 text-slate-700 animate-pulse shadow-sm'
                }`}>
                  {(syncInventoryStatus === 'success' || syncMasterStatus === 'success') && <CheckCircle2 size={16} />}
                  {(syncInventoryStatus === 'error' || syncMasterStatus === 'error') && <AlertCircle size={16} />}
                  {syncProductMessage}
                </div>
              )}
            </div>
          </div>

          {/* CÀI ĐẶT API NHANH.VN */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2"><Settings size={20}/> Cài đặt kết nối Nhanh.vn</h2>
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

          {/* CẤU HÌNH LỌC & ƯU TIÊN */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2"><Settings size={20}/> Cấu hình Lọc & Ưu tiên Đơn In</h2>
            {filterMessage && <div className={`p-4 mb-6 rounded-lg font-medium text-sm ${filterMessage.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{filterMessage}</div>}
            
            <form onSubmit={handleSaveFilter} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">1. Các trạng thái đơn được phép xử lý</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-5 bg-gray-50 border rounded-lg max-h-64 overflow-y-auto">
                  {statusList.map(status => (
                    <label key={status.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg border border-transparent hover:border-gray-200 transition">
                      <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={filterConfigs.allowed_statuses.includes(String(status.id))} onChange={() => handleStatusToggle(status.id)} />
                      <span className="text-sm font-medium"><span className="text-gray-400 mr-1">[{status.id}]</span> {status.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">2. Thứ tự ưu tiên (Kéo thả để sắp xếp, bấm X để xóa)</label>
                <div className="flex gap-2 mb-4">
                    <select value={selectedNewPriority} onChange={(e) => setSelectedNewPriority(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg bg-gray-50 font-medium text-sm outline-none cursor-pointer">
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

          {/* LIÊN KẾT GOOGLE SHEETS */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2"><Settings size={20}/> Liên kết Google Sheets Vận Hành</h2>
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
        </div>
      )}

      {/* RENDER TAB 2: QUẢN LÝ TÀI KHOẢN KÈM NÚT SỬA THÔNG TIN */}
      {activeTab === 'users_management' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          
          {/* FORM KHỞI TẠO USER */}
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm h-fit space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
              <UserPlus size={16} className="text-blue-600" /> Thêm tài khoản mới
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs font-bold text-slate-600">
              <div>
                <label className="block mb-1">Họ và tên</label>
                <input type="text" placeholder="Ví dụ: Nguyễn Văn A" value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white focus:border-blue-500" />
              </div>
              <div>
                <label className="block mb-1">Địa chỉ Email đăng nhập</label>
                <input type="email" placeholder="username@gmail.com" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white focus:border-blue-500" />
              </div>
              <div>
                <label className="block mb-1">Mật khẩu khởi tạo</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} placeholder="Nhập mật khẩu..." value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white focus:border-blue-500" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block mb-1">Cấp bậc hệ thống ban đầu</label>
                <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none cursor-pointer focus:bg-white">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer mt-2 flex items-center justify-center gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Kích hoạt tài khoản
              </button>
            </form>
          </div>

          {/* BẢNG THÀNH VIÊN */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden lg:col-span-2">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14}/> Danh sách tài khoản ({users.length} người)
              </span>
              <button onClick={fetchSystemUsers} className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer">🔄 Tải lại</button>
            </div>

            {loading && users.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-xs font-bold text-slate-400 gap-2">
                <Loader2 size={24} className="animate-spin text-blue-500" /> Đang truy vấn danh sách tài khoản
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Họ tên & Email</th>
                      <th className="py-3 px-4 text-center">Phân quyền</th>
                      <th className="py-3 px-6 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {users.map(u => {
                      const uRole = u.user_metadata?.role || 'user';
                      const uName = u.user_metadata?.full_name || 'Chưa cập nhật';
                      const isTargetOwner = u.user_metadata?.is_owner === true;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">{uName} {isTargetOwner && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-black ml-1">OWNER</span>}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{u.email}</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 border rounded-md text-[10px] font-black uppercase ${uRole === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {uRole === 'admin' ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="py-3 px-6">
                            <div className="flex items-center justify-center gap-2">
                              {/* ⚡️ THÊM NÚT CHỈNH SỬA THÔNG TIN */}
                              <button
                                onClick={() => handleOpenEditModal(u)}
                                disabled={actionLoadingId === u.id || (isTargetOwner && !isOwner)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition text-[10px] shadow-sm cursor-pointer bg-white text-blue-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50`}
                                title="Chỉnh sửa thông tin thành viên"
                              >
                                <Pencil size={12} /> Sửa
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={actionLoadingId === u.id || !isOwner || isTargetOwner}
                                className={`p-1.5 rounded-lg border transition shadow-sm cursor-pointer ${
                                  !isOwner || isTargetOwner ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                }`}
                                title="Xóa tài khoản vĩnh viễn"
                              >
                                {actionLoadingId === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserX size={12} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================== */}
      {/* ⚡️ KHỐI POP-UP MODAL CHỈNH SỬA THÔNG TIN THÀNH VIÊN */}
      {/* ========================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md p-6 transform transition-all animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl"><Pencil size={16}/></div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Hiệu chỉnh thông tin</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition cursor-pointer"><X size={16} /></button>
            </div>

            <form onSubmit={handleSaveEditedInfo} className="space-y-4 text-xs font-bold text-slate-600">
              <div>
                <label className="block mb-1 text-slate-500">Địa chỉ Email (Không cho phép đổi)</label>
                <input type="text" value={editingUser.email} disabled className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-400 outline-none cursor-not-allowed font-medium" />
              </div>
              
              <div>
                <label className="block mb-1 text-slate-700">Họ và Tên hiển thị</label>
                <input 
                  type="text" 
                  value={editForm.fullName} 
                  onChange={e => setEditForm({...editForm, fullName: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white focus:border-blue-500 font-bold" 
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-700">Cấp bậc phân quyền</label>
                <select 
                  value={editForm.role} 
                  onChange={e => setEditForm({...editForm, role: e.target.value})}
                  disabled={!isOwner} 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="user">Nhân viên kho (User)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
                {!isOwner && <p className="text-[10px] text-amber-600 font-medium mt-1">⚠️ Chỉ tài khoản Chủ mới được phép thay đổi cấp bậc quyền lực.</p>}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition cursor-pointer">Hủy bỏ</button>
                <button type="submit" disabled={loading} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md cursor-pointer flex items-center gap-1">
                  {loading && <Loader2 size={12} className="animate-spin" />} Cập nhật ngay
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}