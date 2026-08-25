import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Settings, DownloadCloud, Loader2, CheckCircle2, AlertCircle, PackageSearch,
  Users, UserPlus, UserX, Eye, EyeOff, KeyRound, Pencil, X, Zap, Lock, RefreshCcw, User, ShieldAlert,
  Palette, TreePine, PartyPopper, MessageSquareQuote, MoonStar, Flag
} from 'lucide-react';
import * as Papa from 'papaparse'; 

export default function Admin() {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('configs'); 
  const [currentUserMeta, setCurrentUserMeta] = useState({});
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  
  const [profileName, setProfileName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'user' });
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [userMessage, setUserMessage] = useState('');
  const [loading, setLoading] = useState(false); 
  const [editingUser, setEditingUser] = useState(null); 
  const [editForm, setEditForm] = useState({ fullName: '', role: 'user' });
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [upgradePassword, setUpgradePassword] = useState('');

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
  const [isSyncingReturns, setIsSyncingReturns] = useState(false);
  const [syncReturnsMessage, setSyncReturnsMessage] = useState({ text: '', type: '' });

  const [cleanDays, setCleanDays] = useState('180');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanMessage, setCleanMessage] = useState({ text: '', type: '' });

  // 🎄 Themes State
  const [xmasTheme, setXmasTheme] = useState({ isXmasEnabled: false, isSantaFlying: false, customMessages: '' });
  const [tetTheme, setTetTheme] = useState({ isTetEnabled: false, isPetalFalling: false, customMessages: '' });
  const [midAutumnTheme, setMidAutumnTheme] = useState({ 
    isMidAutumnEnabled: false, 
    isJadeRabbitEnabled: true, 
    isLanternEnabled: true, 
    customMessages: '' 
  });
  const [nationalDayTheme, setNationalDayTheme] = useState({ 
    isNationalDayEnabled: false, 
    isFireworksEnabled: true, 
    customMessages: '' 
  });
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeMessage, setThemeMessage] = useState('');

  const projectUrl = "https://infljrayvhidhfimksfp.supabase.co";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZmxqcmF5dmhpZGhmaW1rc2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzAyNjksImV4cCI6MjA5NjkwNjI2OX0.ap1UnciJ5OccAvC-l5sm-JGqObTkEC038Kjf2L_IFr0";
  const SUPER_OWNER_EMAIL = "contact.hotavinh@gmail.com";

  useEffect(() => {
    loadCurrentUserData();
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'users_management') fetchSystemUsers();
  }, [activeTab]);

  const loadCurrentUserData = async () => {
    setIsAuthLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserEmail(user.email || '');
      setCurrentUserMeta(user.user_metadata || {});
      setProfileName(user.user_metadata?.full_name || '');
    }
    setIsAuthLoading(false);
  };

  const getDynamicPriorityOptions = () => {
    const options = filterConfigs.allowed_statuses.map(statusId => {
      const st = statusList.find(s => String(s.id) === String(statusId));
      return { id: `STATUS_${statusId}`, label: `⭐ Ưu tiên: Đơn ${st ? st.name : 'Mã ' + statusId} (${statusId})` };
    });
    options.push({ id: 'DATE_ASC', label: '🕒 Ưu tiên Thời gian: Đơn tạo cũ nhất xếp trước' });
    return options;
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

      if (configMap['theme_christmas']) {
        try { setXmasTheme(JSON.parse(configMap['theme_christmas'])); } catch(e) {}
      }
      if (configMap['theme_tet']) {
        try { setTetTheme(JSON.parse(configMap['theme_tet'])); } catch(e) {}
      }
      if (configMap['theme_mid_autumn']) {
        try { setMidAutumnTheme(JSON.parse(configMap['theme_mid_autumn'])); } catch(e) {}
      }
      if (configMap['theme_national_day']) {
        try { setNationalDayTheme(JSON.parse(configMap['theme_national_day'])); } catch(e) {}
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) { setProfileMessage('❌ Tên hiển thị không được để trống.'); return; }
    setProfileLoading(true);
    try {
      const updates = { data: { full_name: profileName } };
      if (profilePassword) {
        if (!currentPassword) throw new Error('Vui lòng nhập mật khẩu hiện tại để được phép đổi mật khẩu mới.');
        if (profilePassword.length < 6) throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
        const { error: verifyError } = await supabase.auth.signInWithPassword({ email: currentUserEmail, password: currentPassword });
        if (verifyError) throw new Error('Mật khẩu hiện tại không chính xác!');
        updates.password = profilePassword;
      }
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      setProfileMessage('✅ Đã cập nhật hồ sơ cá nhân thành công!');
      setProfilePassword(''); setCurrentPassword('');
      await loadCurrentUserData();
    } catch (err) { setProfileMessage(`❌ Lỗi: ${err.message}`); } finally { setProfileLoading(false); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.email || !userForm.password || !userForm.fullName) { alert('Vui lòng điền đầy đủ thông tin tài khoản!'); return; }
    setLoading(true); setUserMessage('');
    try {
      await callUserManagementApi({ action: 'create', ...userForm });
      setUserMessage(`✅ Đã khởi tạo thành công tài khoản cho [${userForm.fullName}]`);
      setUserForm({ email: '', password: '', fullName: '', role: 'user' });
      await fetchSystemUsers();
    } catch (err) { setUserMessage(`❌ Lỗi tạo tài khoản: ${err.message}`); } finally { setLoading(false); }
  };

  const handleOpenEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setEditForm({ fullName: targetUser.user_metadata?.full_name || '', role: targetUser.user_metadata?.role || 'user' });
    setShowUpgradeConfirm(false); setUpgradePassword('');
  };

  const handleSaveEditedInfo = async (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim()) { alert('Họ và tên không được để trống!'); return; }
    setLoading(true);
    try {
      await callUserManagementApi({ action: 'update_info', userId: editingUser.id, fullName: editForm.fullName, role: isOwner ? editForm.role : undefined });
      setUserMessage(`✅ Đã cập nhật thông tin thành công cho tài khoản.`);
      setEditingUser(null); await fetchSystemUsers();
    } catch (err) { alert(`❌ Lỗi lưu thông tin: ${err.message}`); } finally { setLoading(false); }
  };

  const handleUpgradeToOwner = async (e) => {
    e.preventDefault();
    if (!upgradePassword) { alert('Vui lòng nhập mật khẩu của bạn để xác nhận!'); return; }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: currentUserEmail, password: upgradePassword });
      if (verifyError) throw new Error('Mật khẩu xác nhận không chính xác!');
      await callUserManagementApi({ action: 'update_info', userId: editingUser.id, isOwner: true });
      setUserMessage(`🎉 Đã cấp quyền Owner thành công cho [${editingUser.email}]`);
      setEditingUser(null); await fetchSystemUsers();
    } catch (err) { alert(`❌ Lỗi nâng cấp: ${err.message}`); } finally { setLoading(false); }
  };

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.email === SUPER_OWNER_EMAIL) { alert('Không thể xóa tài khoản Super Owner!'); return; }
    if (!confirm(`🚨 BẠN CÓ CHẮC MUỐN XÓA VĨNH VIỄN tài khoản [${targetUser.user_metadata?.full_name || targetUser.email}] không?`)) return;
    setActionLoadingId(targetUser.id);
    try {
      await callUserManagementApi({ action: 'delete', userId: targetUser.id });
      setUserMessage(`✅ Đã xóa sổ tài khoản khỏi hệ thống.`);
      await fetchSystemUsers();
    } catch (err) { setUserMessage(`❌ Không thể xóa: ${err.message}`); } finally { setActionLoadingId(null); }
  };

  const handleApiChange = (e) => setApiConfigs({ ...apiConfigs, [e.target.name]: e.target.value });
  
  const handleSaveApi = async (e) => {
    e.preventDefault();
    setApiLoading(true); setApiMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('nhanh-auth', { body: { ...apiConfigs, access_code: apiConfigs.nhanh_access_code } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setApiMessage('✅ Đã đổi Token thành công!'); setApiConfigs(prev => ({ ...prev, nhanh_access_code: '' }));
    } catch (error) { setApiMessage('❌ Lỗi: ' + error.message); } finally { setApiLoading(false); }
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
    if (ruleToAdd && !priorities.some(p => p.id === ruleToAdd.id)) setPriorities([...priorities, ruleToAdd]);
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
    } catch (error) { setFilterMessage('❌ Lỗi: ' + error.message); } finally { setFilterLoading(false); }
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
        setSyncOrderStatus('success'); setSyncOrderMessage(`🎉 Đã đồng bộ thành công ${data.totalSynced} đơn hàng.`);
      } else { throw new Error(data?.error || 'Lỗi logic Edge Function'); }
    } catch (err) { setSyncOrderStatus('error'); setSyncOrderMessage(`❌ ${err.message}`); } finally { setIsSyncingOrder(false); }
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
      setSyncInventoryStatus('success'); setSyncProductMessage(`⚡️ Đã cập nhật Tồn Kho (On Hand) cho ${data.totalSynced} sản phẩm.`);
    } catch (err) { setSyncInventoryStatus('error'); setSyncProductMessage(`❌ ${err.message}`); } finally { setIsSyncingInventory(false); }
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
      setSyncMasterStatus('success'); setSyncProductMessage(`🎉 Đã làm mới toàn bộ ${data.totalSynced} sản phẩm.`);
    } catch (err) { setSyncMasterStatus('error'); setSyncProductMessage(`❌ ${err.message}`); } finally { setIsSyncingMaster(false); }
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
    } catch (err) { setSheetMessage('❌ Lỗi lưu cấu hình: ' + err.message); } finally { setSyncLoading(false); }
  };

  const handleTriggerSyncSheets = async () => {
    setSyncLoading(true); setSheetMessage('');
    try {
        const res = await fetch(`${projectUrl}/functions/v1/sync-sheets`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (data.success) setSheetMessage("🎉 " + data.message); else setSheetMessage("❌ Thất bại: " + data.error);
    } catch (err) { setSheetMessage("❌ Lỗi kết nối: " + err.message); }
    setSyncLoading(false);
  };

  const handleSyncReturns = async () => {
    setIsSyncingReturns(true);
    const platforms = [{ id: 8195, name: 'Shopee' }, { id: 8855, name: 'TikTok' }, { id: 8142, name: 'Lazada' }];
    let total = 0; let hasError = false;

    try {
      for (const platform of platforms) {
        let currentPage = 1; let hasMoreData = true;
        while (hasMoreData) {
            setSyncReturnsMessage({ text: `Đang cào dữ liệu ${platform.name} (Trang ${currentPage})... Đã kéo: ${total} đơn`, type: 'processing' });
            const res = await fetch(`${projectUrl}/functions/v1/sync-ecom-returns`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
                body: JSON.stringify({ platformId: platform.id, page: currentPage }) 
            });
            const textData = await res.text();
            let data;
            try { data = JSON.parse(textData); } catch(e) { throw new Error(`Máy chủ bị sập ở sàn ${platform.name} trang ${currentPage}`); }
            if (!res.ok) { hasError = true; break; }
            
            total += (data.syncedCount || 0);
            if (data.hasMoreData) currentPage = data.nextPage; else hasMoreData = false;
        }
      }
      if (hasError) setSyncReturnsMessage({ text: `⚠️ Đã cào được ${total} đơn, nhưng bị gián đoạn ở một vài trang.`, type: 'error' });
      else setSyncReturnsMessage({ text: `🎉 Hoàn tất! Đã đồng bộ an toàn ${total} đơn trả hàng từ 3 sàn.`, type: 'success' });
    } catch (err) { setSyncReturnsMessage({ text: `❌ Lỗi hệ thống: ${err.message}`, type: 'error' }); } finally { setIsSyncingReturns(false); }
  };

  const handleCleanData = async () => {
    if (!confirm(`🚨 CẢNH BÁO ĐỎ: Bạn có chắc chắn muốn XÓA VĨNH VIỄN toàn bộ đơn hàng cũ hơn ${cleanDays} ngày không?`)) return;
    setIsCleaning(true); setCleanMessage({ text: 'Đang quét và xóa dữ liệu...', type: 'processing' });
    try {
      const { error } = await supabase.rpc('cleanup_old_data', { days_old: parseInt(cleanDays) });
      if (error) throw error;
      setCleanMessage({ text: `🎉 Đã dọn dẹp sạch sẽ toàn bộ dữ liệu cũ hơn ${cleanDays} ngày!`, type: 'success' });
    } catch (err) { setCleanMessage({ text: `❌ Lỗi xóa dữ liệu: ${err.message}`, type: 'error' }); } finally { setIsCleaning(false); }
  };

  // 🎄 THEME SAVE HANDLER
  const handleSaveThemes = async () => {
    setThemeLoading(true); setThemeMessage('');
    try {
      const updates = [
        { key: 'theme_christmas', value: JSON.stringify(xmasTheme) },
        { key: 'theme_tet', value: JSON.stringify(tetTheme) },
        { key: 'theme_mid_autumn', value: JSON.stringify(midAutumnTheme) },
        { key: 'theme_national_day', value: JSON.stringify(nationalDayTheme) }
      ];
      const { error } = await supabase.from('system_configs').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      setThemeMessage('✅ Đã lưu cấu hình giao diện thành công! Hệ thống sẽ tự động cập nhật ngay.');
    } catch(err) {
      setThemeMessage('❌ Lỗi lưu giao diện: ' + err.message);
    } finally {
      setThemeLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Đang tải phân quyền hệ thống...</p>
      </div>
    );
  }

  const isOwner = currentUserMeta.is_owner === true || currentUserEmail === SUPER_OWNER_EMAIL;
  const isAdminOrOwner = isOwner || currentUserMeta.role === 'admin';
  const dynamicOptions = getDynamicPriorityOptions();

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 mt-8">
      
      {/* KHỐI CHUYỂN TAB ĐIỀU HƯỚNG */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-sm">
            <Settings size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Quản trị Hệ thống</h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Thiết lập kết nối vận hành và Quản lý nhân sự</p>
          </div>
        </div>

        {/* Cấu trúc Menu Tab */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 w-full sm:w-auto overflow-x-auto shadow-inner">
          <button onClick={() => { setActiveTab('configs'); setUserMessage(''); }} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === 'configs' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>
            Cấu hình API
          </button>
          {isOwner && (
  <button 
    onClick={() => { setActiveTab('themes'); setUserMessage(''); }} 
    className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === 'themes' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50 flex items-center gap-1.5' : 'text-slate-500 hover:text-slate-800 flex items-center gap-1.5'}`}
  >
    <Palette size={16}/> Giao diện
  </button>
)}
          <button onClick={() => { setActiveTab('users_management'); setUserMessage(''); }} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === 'users_management' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>
            Quản lý Users
          </button>
          <button onClick={() => { setActiveTab('profile'); setUserMessage(''); }} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>
            Hồ sơ của tôi
          </button>
        </div>
      </div>

      {userMessage && !['profile', 'themes'].includes(activeTab) && (
        <div className={`p-4 rounded-xl border text-sm font-bold flex items-center gap-2 shadow-sm ${userMessage.includes('✅') || userMessage.includes('🎉') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <CheckCircle2 size={18} /> {userMessage}
        </div>
      )}

      {/* ========================================== */}
      {/* RENDER TAB: GIAO DIỆN (THEMES)             */}
      {/* ========================================== */}
      {activeTab === 'themes' &&  isOwner && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-2 text-slate-800 flex items-center gap-2">
              <Palette size={20} className="text-indigo-600"/> Quản lý Giao diện Lễ hội (Festive Themes)
            </h2>
            <p className="text-sm text-slate-500 mb-6">Thay đổi không khí vận hành hệ thống. Bật theme sẽ áp dụng ngay lập tức (Realtime) cho tất cả nhân viên đang đăng nhập.</p>

            {themeMessage && (
              <div className={`p-4 mb-6 rounded-xl font-bold text-sm shadow-sm ${themeMessage.includes('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {themeMessage}
              </div>
            )}

            {isAdminOrOwner ? (
              <div className="space-y-6">
                
                {/* 🧧 GIAO DIỆN TẾT NGUYÊN ĐÁN */}
                <div className="border border-red-200 bg-gradient-to-r from-red-50/50 to-orange-50/30 rounded-2xl p-6 relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><PartyPopper size={100} className="text-red-500"/></div>
                  <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-red-700 flex items-center gap-2">
                        <PartyPopper size={20}/> Chủ đề Tết Nguyên Đán
                      </h3>
                      <p className="text-sm text-red-700/80 mt-1 font-medium">Bao gồm tông Đỏ/Vàng ánh kim, Đèn lồng, Hoa Mai/Đào rơi và Banner Chúc Tết.</p>
                      
                      {/* Form Nhập câu chúc Tết */}
                      <div className={`mt-4 transition-all duration-300 ${tetTheme.isTetEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <label className="text-xs font-bold text-red-800 uppercase flex items-center gap-1.5 mb-1.5">
                          <MessageSquareQuote size={14}/> Các câu chúc hiển thị trên Banner thả xuống (Mỗi câu 1 dòng)
                        </label>
                        <textarea 
                          rows={3}
                          value={tetTheme.customMessages || ''}
                          onChange={(e) => setTetTheme({...tetTheme, customMessages: e.target.value})}
                          placeholder={`🧧 Chúc Mừng Năm Mới 2027\nVạn sự hanh thông — Đơn hàng thuận lợi\n🌸 Xuân sang – Đơn tới – Đóng hàng hết công suất!`}
                          className="w-full text-sm p-3 rounded-xl border border-red-200 bg-white/80 outline-none focus:ring-2 focus:ring-red-200 text-red-900 font-medium placeholder-red-300 shadow-inner"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 min-w-[220px]">
                      <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded-xl border border-red-200 shadow-sm">
                        <span className="text-sm font-bold text-slate-700">Kích hoạt Giao diện</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" className="sr-only peer" checked={tetTheme.isTetEnabled} onChange={(e) => setTetTheme({...tetTheme, isTetEnabled: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </div>
                      </label>
                      <label className={`flex items-center justify-between cursor-pointer p-3 rounded-xl border shadow-sm transition-all ${tetTheme.isTetEnabled ? 'bg-white border-amber-200' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">🌸 Hiệu ứng Hoa rơi</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" disabled={!tetTheme.isTetEnabled} className="sr-only peer" checked={tetTheme.isPetalFalling} onChange={(e) => setTetTheme({...tetTheme, isPetalFalling: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 🎄 GIAO DIỆN NOEL */}
                <div className="border border-green-200 bg-gradient-to-r from-green-50/50 to-emerald-50/30 rounded-2xl p-6 relative overflow-hidden shadow-sm mt-6">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><TreePine size={100} className="text-green-600"/></div>
                  <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-green-800 flex items-center gap-2">
                        <TreePine size={20}/> Chủ đề Giáng Sinh (Christmas)
                      </h3>
                      <p className="text-sm text-green-700/80 mt-1 font-medium">Bao gồm viền Neon, Tuyết rơi siêu nhẹ, Avatar gắn mũ Noel và Xe Tuần Lộc.</p>
                      
                      {/* Form Nhập câu chúc Noel */}
                      <div className={`mt-4 transition-all duration-300 ${xmasTheme.isXmasEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <label className="text-xs font-bold text-green-800 uppercase flex items-center gap-1.5 mb-1.5">
                          <MessageSquareQuote size={14}/> Các câu chúc của Ông già Noel (Mỗi câu 1 dòng)
                        </label>
                        <textarea 
                          rows={3}
                          value={xmasTheme.customMessages || ''}
                          onChange={(e) => setXmasTheme({...xmasTheme, customMessages: e.target.value})}
                          placeholder={`Ho Ho Ho! Chốt đơn mỏi tay nhé các sếp! 🎁\nGiáng sinh an lành! Gói hàng cẩn thận nha! 🎄`}
                          className="w-full text-sm p-3 rounded-xl border border-green-200 bg-white/80 outline-none focus:ring-2 focus:ring-green-200 text-green-900 font-medium placeholder-green-300 shadow-inner"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 min-w-[220px]">
                      <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded-xl border border-green-200 shadow-sm">
                        <span className="text-sm font-bold text-slate-700">Kích hoạt Giao diện</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" className="sr-only peer" checked={xmasTheme.isXmasEnabled} onChange={(e) => setXmasTheme({...xmasTheme, isXmasEnabled: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </div>
                      </label>
                      <label className={`flex items-center justify-between cursor-pointer p-3 rounded-xl border shadow-sm transition-all ${xmasTheme.isXmasEnabled ? 'bg-white border-red-200' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">🎅 Xe tuần lộc bay</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" disabled={!xmasTheme.isXmasEnabled} className="sr-only peer" checked={xmasTheme.isSantaFlying} onChange={(e) => setXmasTheme({...xmasTheme, isSantaFlying: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 🥮 GIAO DIỆN TRUNG THU */}
                <div className="border border-yellow-200 bg-gradient-to-r from-indigo-50/50 to-blue-50/30 rounded-2xl p-6 relative overflow-hidden shadow-sm mt-6">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><MoonStar size={100} className="text-yellow-600"/></div>
                  <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-indigo-800 flex items-center gap-2">
                        <MoonStar size={20}/> Chủ đề Trung Thu
                      </h3>
                      <p className="text-sm text-indigo-700/80 mt-1 font-medium">Nền xanh đêm, trăng rằm, đèn lồng, thỏ ngọc và bánh trung thu.</p>
                      
                      {/* Form nhập câu chúc */}
                      <div className={`mt-4 transition-all duration-300 ${midAutumnTheme.isMidAutumnEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <label className="text-xs font-bold text-indigo-800 uppercase flex items-center gap-1.5 mb-1.5">
                          <MessageSquareQuote size={14}/> Câu chúc hiển thị (nếu có)
                        </label>
                        <textarea 
                          rows={3}
                          value={midAutumnTheme.customMessages || ''}
                          onChange={(e) => setMidAutumnTheme({...midAutumnTheme, customMessages: e.target.value})}
                          placeholder={`Trung thu đoàn viên, đơn hàng tấp nập!\nThỏ ngọc mang may mắn đến mọi nhà 🌕`}
                          className="w-full text-sm p-3 rounded-xl border border-indigo-200 bg-white/80 outline-none focus:ring-2 focus:ring-indigo-200 text-indigo-900 font-medium placeholder-indigo-300 shadow-inner"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 min-w-[220px]">
                      <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded-xl border border-indigo-200 shadow-sm">
                        <span className="text-sm font-bold text-slate-700">Kích hoạt Giao diện</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" className="sr-only peer" checked={midAutumnTheme.isMidAutumnEnabled} onChange={(e) => setMidAutumnTheme({...midAutumnTheme, isMidAutumnEnabled: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </div>
                      </label>
                      
                      <label className={`flex items-center justify-between cursor-pointer p-3 rounded-xl border shadow-sm transition-all ${midAutumnTheme.isMidAutumnEnabled ? 'bg-white border-yellow-200' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">🐇 Thỏ ngọc chạy nhảy</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" disabled={!midAutumnTheme.isMidAutumnEnabled} className="sr-only peer" checked={midAutumnTheme.isJadeRabbitEnabled} onChange={(e) => setMidAutumnTheme({...midAutumnTheme, isJadeRabbitEnabled: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                        </div>
                      </label>
                      
                      <label className={`flex items-center justify-between cursor-pointer p-3 rounded-xl border shadow-sm transition-all ${midAutumnTheme.isMidAutumnEnabled ? 'bg-white border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">🏮 Đèn lồng</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" disabled={!midAutumnTheme.isMidAutumnEnabled} className="sr-only peer" checked={midAutumnTheme.isLanternEnabled} onChange={(e) => setMidAutumnTheme({...midAutumnTheme, isLanternEnabled: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 🇻🇳 GIAO DIỆN QUỐC KHÁNH 2/9 */}
                <div className="border border-red-200 bg-gradient-to-r from-red-50/50 to-blue-50/30 rounded-2xl p-6 relative overflow-hidden shadow-sm mt-6">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Flag size={100} className="text-red-600"/></div>
                  <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-red-800 flex items-center gap-2">
                        <Flag size={20}/> Chủ đề Quốc Khánh 2/9
                      </h3>
                      <p className="text-sm text-red-700/80 mt-1 font-medium">Cờ đỏ sao vàng, pháo hoa, banner chào mừng Quốc khánh.</p>
                      
                      {/* Form nhập câu chúc */}
                      <div className={`mt-4 transition-all duration-300 ${nationalDayTheme.isNationalDayEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <label className="text-xs font-bold text-red-800 uppercase flex items-center gap-1.5 mb-1.5">
                          <MessageSquareQuote size={14}/> Câu chúc hiển thị (nếu có)
                        </label>
                        <textarea 
                          rows={3}
                          value={nationalDayTheme.customMessages || ''}
                          onChange={(e) => setNationalDayTheme({...nationalDayTheme, customMessages: e.target.value})}
                          placeholder={`Chào mừng Quốc khánh 2/9\nTự hào Việt Nam • 1945 — 2026 🇻🇳`}
                          className="w-full text-sm p-3 rounded-xl border border-red-200 bg-white/80 outline-none focus:ring-2 focus:ring-red-200 text-red-900 font-medium placeholder-red-300 shadow-inner"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 min-w-[220px]">
                      <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded-xl border border-red-200 shadow-sm">
                        <span className="text-sm font-bold text-slate-700">Kích hoạt Giao diện</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" className="sr-only peer" checked={nationalDayTheme.isNationalDayEnabled} onChange={(e) => setNationalDayTheme({...nationalDayTheme, isNationalDayEnabled: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </div>
                      </label>
                      
                      <label className={`flex items-center justify-between cursor-pointer p-3 rounded-xl border shadow-sm transition-all ${nationalDayTheme.isNationalDayEnabled ? 'bg-white border-yellow-200' : 'bg-slate-50 border-slate-200 opacity-50'}`}>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">🎆 Pháo hoa</span>
                        <div className="relative inline-flex items-center">
                          <input type="checkbox" disabled={!nationalDayTheme.isNationalDayEnabled} className="sr-only peer" checked={nationalDayTheme.isFireworksEnabled} onChange={(e) => setNationalDayTheme({...nationalDayTheme, isFireworksEnabled: e.target.checked})} />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button onClick={handleSaveThemes} disabled={themeLoading} className="px-8 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-2">
                    {themeLoading && <Loader2 size={16} className="animate-spin"/>} Lưu Tùy Chỉnh Giao Diện
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-slate-500">
                <Lock size={20} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Tính năng giới hạn</p>
                  <p className="text-xs mt-0.5">Chỉ Quản trị viên (Admin) hoặc Owner mới có quyền thay đổi giao diện toàn hệ thống.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER TAB: HỒ SƠ CÁ NHÂN */}
      {activeTab === 'profile' && (
        <div className="animate-in fade-in duration-300 max-w-2xl mx-auto">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            {/* Giữ nguyên Code Tab Profile... */}
            <div className="flex items-center gap-5 border-b border-slate-100 pb-6 mb-6">
              <div className="w-16 h-16 bg-blue-50 border border-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-2xl shadow-sm">
                <User size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{currentUserMeta.full_name || 'Chưa cập nhật tên'}</h2>
                <p className="text-sm font-medium text-slate-500 mt-0.5">{currentUserEmail}</p>
                <div className="mt-2.5 flex gap-2">
                  <span className={`px-3 py-1 border rounded-lg text-xs font-black uppercase tracking-wider ${currentUserMeta.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {currentUserMeta.role === 'admin' ? 'Admin' : 'Nhân viên'}
                  </span>
                  {isOwner && (
                    <span className="px-3 py-1 border rounded-lg text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1.5 shadow-sm">
                      <ShieldAlert size={12} /> Owner
                    </span>
                  )}
                </div>
              </div>
            </div>

            {profileMessage && (
              <div className={`p-4 mb-6 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm ${profileMessage.includes('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {profileMessage.includes('✅') ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {profileMessage}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Họ và tên hiển thị</label>
                <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 font-medium transition" placeholder="Nhập tên hiển thị..." />
              </div>
              
              <div className="pt-4 border-t border-slate-100 space-y-5">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><KeyRound size={16}/> Cập nhật mật khẩu</h3>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 font-medium transition" placeholder="Nhập mật khẩu hiện tại để xác thực..." />
                      <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-4 top-3 text-slate-400 hover:text-slate-600 transition">
                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Mật khẩu mới <span className="text-slate-400 font-medium">(Bỏ trống nếu không muốn đổi)</span></label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 font-medium transition" placeholder="Nhập ít nhất 6 ký tự..." />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3 text-slate-400 hover:text-slate-600 transition">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button type="submit" disabled={profileLoading} className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {profileLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18}/>} Cập nhật Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENDER TAB: CẤU HÌNH HỆ THỐNG */}
      {activeTab === 'configs' && (
        <div className="space-y-8 animate-in fade-in duration-300">
           {/* Giữ nguyên toàn bộ Code Cấu hình Hệ thống (Lọc, Quét Đơn, Cài API...) của phiên bản trước */}
           {/* KHỐI ĐỒNG BỘ DỮ LIỆU ĐỘC LẬP */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
              <DownloadCloud size={20} className="text-blue-600"/> Đồng bộ dữ liệu Cục bộ (Tránh Miss Webhook)
            </h2>

            {/* Tầng cào Đơn hàng */}
            <div className="bg-blue-50/40 p-6 rounded-2xl border border-blue-100/50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="flex-1">
                  <p className="text-base font-bold text-slate-800">Đồng bộ dữ liệu Đơn Hàng</p>
                  <p className="text-sm text-slate-500 mt-1">Sử dụng tính năng này khi hệ thống Webhook bị ngắt quãng khiến đơn hàng trên Nhanh không đẩy về được hệ thống cục bộ.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={syncDays} 
                    onChange={e => setSyncDays(e.target.value)} 
                    disabled={isSyncingOrder}
                    className="flex-1 sm:flex-none w-28 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition disabled:opacity-50"
                  >
                    <option value={1}>1 ngày</option>
                    <option value={3}>3 ngày</option>
                    <option value={7}>7 ngày</option>
                    <option value={30}>30 ngày</option>
                  </select>
                  <button 
                    onClick={handleSyncOrdersData} 
                    disabled={isSyncingOrder} 
                    className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isSyncingOrder ? <Loader2 size={18} className="animate-spin" /> : <DownloadCloud size={18} />} Kéo Đơn
                  </button>
                </div>
              </div>
              
              {syncOrderMessage && (
                <div className={`mt-4 p-4 rounded-xl border text-sm font-bold flex items-center gap-2 shadow-sm ${
                  syncOrderStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                  syncOrderStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
                  'bg-white border-blue-200 text-blue-700 animate-pulse'
                }`}>
                  {syncOrderStatus === 'success' && <CheckCircle2 size={18} />}
                  {syncOrderStatus === 'error' && <AlertCircle size={18} />}
                  {syncOrderMessage}
                </div>
              )}
            </div>

            {/* Tầng cào Sản Phẩm */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/60">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="flex-1">
                  <p className="text-base font-bold text-slate-800">Đồng bộ Danh bạ Sản Phẩm & Tồn Kho</p>
                  <p className="text-sm text-slate-500 mt-1">Bấm "Tồn kho" để cập nhật số lượng nhanh. Bấm "Master Data" khi thêm mã vạch hoặc đổi tên sản phẩm mới.</p>
                </div>
                
                <div className="flex w-full sm:w-auto gap-3">
                  <button onClick={handleSyncInventoryOnly} disabled={isSyncingInventory || isSyncingMaster} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl shadow-md transition">
                    {isSyncingInventory ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />} Tồn kho
                  </button>
                  <button onClick={handleSyncMasterData} disabled={isSyncingInventory || isSyncingMaster} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl shadow-md transition">
                    {isSyncingMaster ? <Loader2 size={18} className="animate-spin" /> : <PackageSearch size={18} />} Master Data
                  </button>
                </div>
              </div>
              
              {syncProductMessage && (
                <div className={`mt-4 p-4 rounded-xl border text-sm font-bold flex items-center gap-2 shadow-sm ${
                  syncInventoryStatus === 'success' || syncMasterStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                  syncInventoryStatus === 'error' || syncMasterStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
                  'bg-white border-slate-300 text-slate-700 animate-pulse'
                }`}>
                  {(syncInventoryStatus === 'success' || syncMasterStatus === 'success') && <CheckCircle2 size={18} />}
                  {(syncInventoryStatus === 'error' || syncMasterStatus === 'error') && <AlertCircle size={18} />}
                  {syncProductMessage}
                </div>
              )}
            </div>
          </div>

          {/* KHỐI ĐỒNG BỘ ĐƠN TRẢ HÀNG (RETURNS) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-2 text-slate-800 flex items-center gap-2">
              <RefreshCcw size={20} className="text-indigo-600"/> Đồng bộ Đơn Trả Hàng & Hoàn Tiền
            </h2>
            <p className="text-sm text-slate-500 mb-6">Chủ động kéo dữ liệu các yêu cầu trả hàng, hoàn tiền từ sàn TMĐT (Shopee, TikTok, Lazada) thay vì đợi lịch tự động cập nhật.</p>

            {syncReturnsMessage.text && (
              <div className={`p-4 mb-6 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm ${
                syncReturnsMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                syncReturnsMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse'
              }`}>
                {syncReturnsMessage.type === 'success' && <CheckCircle2 size={18} />}
                {syncReturnsMessage.type === 'error' && <AlertCircle size={18} />}
                {syncReturnsMessage.type === 'processing' && <Loader2 size={18} className="animate-spin" />}
                {syncReturnsMessage.text}
              </div>
            )}

            {/* Không render phần tương tác nếu không phải Admin */}
            {isAdminOrOwner ? (
              <div className="flex flex-col md:flex-row gap-5 items-center justify-between bg-indigo-50/40 p-6 rounded-2xl border border-indigo-100">
                <div className="flex-1">
                  <p className="text-base font-bold text-indigo-900">Cập nhật danh sách hoàn tiền</p>
                  <p className="text-sm text-indigo-600/80 mt-1">Lấy các yêu cầu trả hàng mới nhất từ API lưu vào hệ thống nội bộ.</p>
                </div>
                <button
                  onClick={handleSyncReturns}
                  disabled={isSyncingReturns}
                  className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-indigo-700 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSyncingReturns ? <Loader2 size={18} className="animate-spin" /> : <DownloadCloud size={18} />} Kéo Đơn Trả Hàng
                </button>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-slate-500">
                <Lock size={20} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Tính năng giới hạn</p>
                  <p className="text-xs mt-0.5">Bạn cần quyền Admin để sử dụng chức năng này.</p>
                </div>
              </div>
            )}
          </div>

          {/* CÀI ĐẶT API NHANH.VN */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2"><Settings size={20} className="text-slate-600"/> Cài đặt kết nối Nhanh.vn</h2>
            {apiMessage && <div className={`p-4 mb-6 rounded-xl font-bold text-sm shadow-sm ${apiMessage.includes('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{apiMessage}</div>}
            
            {/* Không hiển thị form nếu không phải owner */}
            {isOwner ? (
              <form onSubmit={handleSaveApi} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div><label className="text-sm font-bold text-slate-700 mb-1.5 block">App ID</label><input type="text" name="nhanh_app_id" value={apiConfigs.nhanh_app_id} onChange={handleApiChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" /></div>
                    <div><label className="text-sm font-bold text-slate-700 mb-1.5 block">Business ID</label><input type="text" name="nhanh_business_id" value={apiConfigs.nhanh_business_id} onChange={handleApiChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" /></div>
                </div>
                <div><label className="text-sm font-bold text-slate-700 mb-1.5 block">Secret Key</label><input type="password" name="nhanh_secret_key" value={apiConfigs.nhanh_secret_key} onChange={handleApiChange} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" /></div>
                <div className="bg-amber-50/50 p-5 border border-amber-200 rounded-xl"><label className="text-sm font-bold text-amber-800 uppercase mb-2 block">Mã Access Code mới (Hạn 15p)</label><input type="text" name="nhanh_access_code" value={apiConfigs.nhanh_access_code} onChange={handleApiChange} className="w-full px-4 py-2.5 border border-amber-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-500 transition" placeholder="Nhập access code lấy từ Nhanh.vn..." /></div>
                <button type="submit" disabled={apiLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition cursor-pointer text-sm disabled:opacity-50">{apiLoading ? 'Đang lưu...' : 'Lưu cấu hình & Đổi Token'}</button>
              </form>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-slate-500">
                <Lock size={20} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Tính năng bảo mật</p>
                  <p className="text-xs mt-0.5">Chỉ Chủ sở hữu (Owner) mới được quyền thay đổi cấu hình kết nối.</p>
                </div>
              </div>
            )}
          </div>

          {/* LIÊN KẾT GOOGLE SHEETS */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2"><Settings size={20} className="text-slate-600"/> Liên kết Google Sheets Vận Hành</h2>
            {sheetMessage && <div className={`p-4 mb-6 rounded-xl font-bold text-sm shadow-sm ${sheetMessage.includes('✅') || sheetMessage.includes('🎉') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{sheetMessage}</div>}
            
            <div className="space-y-6">
              {isOwner ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                      <div className="md:col-span-3">
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">Link Sheet Đơn Đi</label>
                          <input type="text" value={sheetDailyUrl} onChange={e => setSheetDailyUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"/>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">Mã GID Đơn Đi</label>
                          <input type="text" value={sheetDailyGid} onChange={e => setSheetDailyGid(e.target.value)} placeholder="0" className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"/>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                      <div className="md:col-span-3">
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">Link Sheet Đơn In</label>
                          <input type="text" value={sheetPrintUrl} onChange={e => setSheetPrintUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"/>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">Mã GID Đơn In</label>
                          <input type="text" value={sheetPrintGid} onChange={e => setSheetPrintGid(e.target.value)} placeholder="1245667" className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"/>
                      </div>
                  </div>

                  <div className="pb-2">
                      <button onClick={handleSaveConfig} disabled={syncLoading} className="px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-blue-700 transition cursor-pointer disabled:opacity-50">
                          Lưu cấu hình liên kết
                      </button>
                  </div>
                </>
              ) : (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-slate-500 mb-6">
                  <Lock size={20} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-700">Cấu hình Sheets bị khóa</p>
                    <p className="text-xs mt-0.5">Chỉ Chủ sở hữu (Owner) mới được quyền cấu hình file hệ thống.</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between border-t border-slate-100 pt-8 mt-2">
                  <div>
                    <p className="text-base font-bold text-slate-800">Cập nhật dữ liệu từ Sheets lên Data</p>
                    <p className="text-sm text-slate-500 mt-1">Quét và đồng bộ toàn bộ dữ liệu hiện có trong file Google Sheet.</p>
                  </div>
                  
                  {isAdminOrOwner ? (
                    <button onClick={handleTriggerSyncSheets} disabled={syncLoading} className="w-full sm:w-auto px-8 py-3 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-900 shadow-md transition disabled:opacity-50 cursor-pointer whitespace-nowrap">
                        {syncLoading ? "⏳ Đang xử lý..." : "🔄 Bấm Quét Sheets Ngay"}
                    </button>
                  ) : (
                    <div className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
                      <Lock size={16}/> Yêu cầu quyền Admin
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* CẤU HÌNH LỌC & ƯU TIÊN */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2"><Settings size={20} className="text-slate-600"/> Cấu hình Lọc & Ưu tiên Đơn In</h2>
            {filterMessage && <div className={`p-4 mb-6 rounded-xl font-bold text-sm shadow-sm ${filterMessage.includes('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{filterMessage}</div>}
            
            <form onSubmit={handleSaveFilter} className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">1. Các trạng thái đơn được phép xử lý</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-5 bg-slate-50 border border-slate-200 rounded-2xl max-h-64 overflow-y-auto">
                  {statusList.map(status => (
                    <label key={status.id} className="flex items-center gap-3 cursor-pointer bg-white hover:bg-slate-50 p-3 rounded-xl border border-slate-200 transition shadow-sm">
                      <input type="checkbox" className="w-4 h-4 cursor-pointer accent-blue-600" checked={filterConfigs.allowed_statuses.includes(String(status.id))} onChange={() => handleStatusToggle(status.id)} />
                      <span className="text-sm font-bold text-slate-700"><span className="text-slate-400 mr-1 text-xs">[{status.id}]</span> {status.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">2. Thứ tự ưu tiên (Kéo thả để sắp xếp, bấm X để xóa)</label>
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                    <select value={selectedNewPriority} onChange={(e) => setSelectedNewPriority(e.target.value)} className="flex-1 px-4 py-3 border border-slate-300 rounded-xl bg-slate-50 font-bold text-sm outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 transition">
                        <option value="">-- Chọn luật ưu tiên để thêm --</option>
                        {dynamicOptions.filter(opt => !priorities.some(p => p.id === opt.id)).map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                    <button type="button" onClick={handleAddPriority} className="bg-slate-800 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-md hover:bg-slate-900 cursor-pointer transition">Thêm luật</button>
                </div>
                <div className="space-y-3 bg-blue-50/40 p-6 border border-blue-100 rounded-2xl min-h-[120px]">
                  {priorities.length === 0 && <p className="text-slate-400 text-sm font-medium text-center py-4">Chưa có luật ưu tiên nào được chọn.</p>}
                  {priorities.map((item, index) => (
                    <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, index)}
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab hover:border-blue-400 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-slate-300 text-sm">⋮⋮</div>
                        <span className="font-bold text-sm text-slate-700"><span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs mr-3 font-black tracking-wide">ƯU TIÊN {index + 1}</span>{item.label}</span>
                      </div>
                      <button type="button" onClick={() => handleRemovePriority(item.id)} className="text-red-500 font-black px-3.5 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-xs cursor-pointer transition">X</button>
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={filterLoading} className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-emerald-700 transition cursor-pointer text-sm">
                {filterLoading ? 'Đang lưu...' : 'Lưu Cấu hình Lọc & Ưu tiên'}
              </button>
            </form>
          </div>

          {/* KHỐI DỌN DẸP DỮ LIỆU (CLEANUP) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-200 mt-8">
            <h2 className="text-xl font-bold mb-2 text-red-600 flex items-center gap-2">
              <AlertCircle size={22} /> Dọn dẹp Database (Clear Data)
            </h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Xóa vĩnh viễn <span className="font-bold text-red-500">TOÀN BỘ DỮ LIỆU GIAO DỊCH</span> (Đơn hàng, Lịch sử thao tác, Đơn trả hàng sàn TMĐT, Phiên đối soát kho...) cũ hơn thời gian đã chọn để giải phóng dung lượng. Master Data sẽ được giữ nguyên.
            </p>
            
            {cleanMessage.text && (
              <div className={`p-4 mb-6 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm ${
                cleanMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                cleanMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 
                'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
              }`}>
                {cleanMessage.type === 'success' && <CheckCircle2 size={18} />}
                {cleanMessage.type === 'error' && <AlertCircle size={18} />}
                {cleanMessage.type === 'processing' && <Loader2 size={18} className="animate-spin" />}
                {cleanMessage.text}
              </div>
            )}

            {isOwner ? (
              <div className="flex flex-col md:flex-row gap-5 items-end bg-red-50/40 p-6 rounded-2xl border border-red-100">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-bold text-red-900 mb-2">Chọn mốc thời gian xóa</label>
                  <select 
                    value={cleanDays} 
                    onChange={e => setCleanDays(e.target.value)}
                    disabled={isCleaning}
                    className="w-full px-4 py-3 border border-red-200 rounded-xl text-sm font-bold text-red-800 outline-none focus:ring-2 focus:ring-red-100 bg-white disabled:bg-slate-50 cursor-pointer transition shadow-sm"
                  >
                    <option value="90">Dữ liệu cũ hơn 90 ngày (3 tháng)</option>
                    <option value="180">Dữ liệu cũ hơn 180 ngày (6 tháng)</option>
                    <option value="365">Dữ liệu cũ hơn 365 ngày (1 năm)</option>
                  </select>
                </div>
                
                <button 
                  onClick={handleCleanData}
                  disabled={isCleaning}
                  className="w-full md:w-auto px-8 py-3 bg-red-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-red-700 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCleaning ? <Loader2 size={18} className="animate-spin" /> : 'Xác nhận Dọn dẹp'}
                </button>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-slate-500">
                <Lock size={20} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Chức năng nâng cao bị khóa</p>
                  <p className="text-xs mt-0.5">Chỉ Chủ sở hữu (Owner) mới có quyền truy cập dọn dẹp hệ thống Database.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER TAB: QUẢN LÝ TÀI KHOẢN */}
      {activeTab === 'users_management' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
          
          {/* FORM KHỞI TẠO USER */}
          <div className="bg-white p-8 border border-slate-200 rounded-2xl shadow-sm h-fit space-y-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-4">
              <UserPlus size={18} className="text-blue-600" /> Cấp tài khoản mới
            </h3>

            {isOwner ? (
              <form onSubmit={handleCreateUser} className="space-y-4 text-sm font-bold text-slate-700">
                <div>
                  <label className="block mb-1.5">Họ và tên</label>
                  <input type="text" placeholder="Ví dụ: Nguyễn Văn A" value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block mb-1.5">Địa chỉ Email đăng nhập</label>
                  <input type="email" placeholder="username@gmail.com" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block mb-1.5">Mật khẩu khởi tạo</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} placeholder="Nhập mật khẩu..." value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5">Cấp bậc hệ thống ban đầu</label>
                  <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 bg-white cursor-pointer transition">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer mt-4 flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Kích hoạt tài khoản
                </button>
              </form>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center gap-3 text-slate-500 mt-4">
                <Lock size={32} className="text-slate-300" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Khóa tạo mới</p>
                  <p className="text-xs mt-1 leading-relaxed">Chỉ Chủ sở hữu (Owner) mới có quyền cấp phát tài khoản nhân sự mới.</p>
                </div>
              </div>
            )}
          </div>

          {/* BẢNG THÀNH VIÊN */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden lg:col-span-2 flex flex-col h-full">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <span className="text-sm font-black text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <Users size={18} className="text-blue-600"/> Danh sách tài khoản ({users.length})
              </span>
              <button onClick={fetchSystemUsers} className="text-sm font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1.5 transition">
                <RefreshCcw size={14}/> Tải lại
              </button>
            </div>

            {loading && users.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-sm font-bold text-slate-400 gap-3 flex-1">
                <Loader2 size={32} className="animate-spin text-blue-500" /> Đang truy vấn dữ liệu tài khoản...
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm font-medium">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Họ tên & Email</th>
                      <th className="py-4 px-6 text-center">Phân quyền</th>
                      <th className="py-4 px-6 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {users.map(u => {
                      const uRole = u.user_metadata?.role || 'user';
                      const uName = u.user_metadata?.full_name || 'Chưa cập nhật';
                      const isTargetOwner = u.user_metadata?.is_owner === true || u.email === SUPER_OWNER_EMAIL;
                      const isMe = u.email === currentUserEmail;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 transition">
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-800">{uName} {isMe && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-black ml-1 uppercase">(Bạn)</span>}</div>
                            <div className="text-xs text-slate-500 mt-1">{u.email}</div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`px-3 py-1 border rounded-lg text-xs font-black uppercase tracking-wider inline-block ${isTargetOwner ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' : uRole === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {isTargetOwner ? 'Owner' : uRole === 'admin' ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2.5">
                              {isOwner ? (
                                <>
                                  <button
                                    onClick={() => handleOpenEditModal(u)}
                                    disabled={actionLoadingId === u.id || (isTargetOwner && u.email !== SUPER_OWNER_EMAIL && currentUserEmail !== SUPER_OWNER_EMAIL)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border transition text-xs shadow-sm cursor-pointer bg-white text-blue-600 border-slate-200 hover:bg-slate-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title="Chỉnh sửa thông tin thành viên"
                                  >
                                    <Pencil size={14} /> Sửa
                                  </button>

                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    disabled={actionLoadingId === u.id || u.email === SUPER_OWNER_EMAIL || isMe}
                                    className={`p-2 rounded-lg border transition shadow-sm cursor-pointer ${
                                      u.email === SUPER_OWNER_EMAIL || isMe ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-red-500 border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                                    }`}
                                    title="Xóa tài khoản vĩnh viễn"
                                  >
                                    {actionLoadingId === u.id ? <Loader2 size={16} className="animate-spin" /> : <UserX size={16} />}
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-slate-400 font-bold flex items-center gap-1 justify-center bg-slate-50 px-3 py-1.5 rounded-lg"><Lock size={12}/> Khóa</span>
                              )}
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

      {/* POP-UP MODAL CHỈNH SỬA THÔNG TIN */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md p-8 transform transition-all animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shadow-sm"><Pencil size={18}/></div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Hiệu chỉnh thông tin</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveEditedInfo} className="space-y-5 text-sm font-bold text-slate-700">
              <div>
                <label className="block mb-1.5 text-slate-500">Địa chỉ Email (Cố định)</label>
                <input type="text" value={editingUser.email} disabled className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-100 text-slate-400 outline-none cursor-not-allowed font-medium" />
              </div>
              
              <div>
                <label className="block mb-1.5 text-slate-800">Họ và Tên hiển thị</label>
                <input 
                  type="text" 
                  value={editForm.fullName} 
                  onChange={e => setEditForm({...editForm, fullName: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition" 
                  disabled={editingUser.email === SUPER_OWNER_EMAIL && currentUserEmail !== SUPER_OWNER_EMAIL}
                />
              </div>

              <div>
                <label className="block mb-1.5 text-slate-800">Cấp bậc phân quyền</label>
                <select 
                  value={editForm.role} 
                  onChange={e => setEditForm({...editForm, role: e.target.value})}
                  disabled={!isOwner || (editingUser.user_metadata?.is_owner === true)} 
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition"
                >
                  <option value="user">Nhân viên kho (User)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>
              
              {isOwner && editForm.role === 'admin' && !(editingUser.user_metadata?.is_owner === true) && (
                <div className="mt-6 p-5 border border-amber-200 bg-amber-50/80 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-black text-amber-800 flex items-center gap-1.5"><ShieldAlert size={16}/> Nâng cấp Owner</h4>
                      <p className="text-xs text-amber-700/80 font-medium mt-1 pr-2 leading-relaxed">Người này sẽ có toàn quyền can thiệp hệ thống. Hành động này rất nguy hiểm!</p>
                    </div>
                    <button type="button" onClick={() => setShowUpgradeConfirm(!showUpgradeConfirm)} className="text-xs bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg shadow-sm font-bold hover:bg-amber-100 whitespace-nowrap cursor-pointer transition">
                      {showUpgradeConfirm ? 'Hủy bỏ' : 'Mở khóa'}
                    </button>
                  </div>
                  
                  {showUpgradeConfirm && (
                    <div className="pt-4 border-t border-amber-200/50 mt-2 animate-in slide-in-from-top-2">
                      <label className="block mb-1.5 text-xs text-amber-900 font-bold">Nhập mật khẩu của BẠN để xác nhận:</label>
                      <input 
                        type="password" 
                        value={upgradePassword}
                        onChange={(e) => setUpgradePassword(e.target.value)}
                        className="w-full px-4 py-2.5 border border-amber-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-200 font-medium bg-white transition shadow-sm" 
                        placeholder="Mật khẩu của bạn..."
                      />
                      <button type="button" onClick={handleUpgradeToOwner} disabled={loading} className="mt-3 w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl shadow-md transition font-bold text-sm flex justify-center gap-2 cursor-pointer disabled:opacity-50">
                        {loading && <Loader2 size={16} className="animate-spin" />} Cấp quyền Owner Ngay
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-6 mt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition cursor-pointer">Đóng</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50">
                  {loading && <Loader2 size={16} className="animate-spin" />} Lưu thông tin
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}