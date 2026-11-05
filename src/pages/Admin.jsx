import { useState, useEffect, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { isAdminRole, isSuperAdminRole, roleLabel } from '../lib/roles';
import { sessionRevokedKey } from '../lib/session';
import { getMaintenanceMode, setMaintenanceMode } from '../lib/maintenance';
import {
  Settings, DownloadCloud, Loader2, CheckCircle2, AlertCircle, PackageSearch,
  Users, UserPlus, UserX, Eye, EyeOff, KeyRound, Pencil, X, Zap, Lock, RefreshCcw, User, ShieldAlert,
  Database, HardDrive, Trash2, AlertTriangle, Info,
  BellRing, Megaphone, MonitorPlay, Ban, History, LogOut, Printer
} from 'lucide-react';
import { shortDeviceName } from '../lib/presence';
import PrintSettings from '../components/PrintSettings';

// --- UTILS ---
const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export default function Admin() {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('configs'); 
  const [currentUserMeta, setCurrentUserMeta] = useState({});
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  
  // --- CUSTOM DIALOG STATE ---
  const [dialogConfig, setDialogConfig] = useState(null);

  // --- PROFILE ---
  const [profileName, setProfileName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  // --- USERS ---
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'user' });
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [userMessage, setUserMessage] = useState('');
  // Chi tiet user (Owner only) + nhat ky thao tac chung (Owner only).
  const [detailUser, setDetailUser] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMsg, setDetailMsg] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilterUser, setLogFilterUser] = useState('');
  const [logFilterAction, setLogFilterAction] = useState('');
  const [logFilterOrder, setLogFilterOrder] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [loading, setLoading] = useState(false); 
  const [editingUser, setEditingUser] = useState(null); 
  const [editForm, setEditForm] = useState({ fullName: '', role: 'user' });
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [upgradePassword, setUpgradePassword] = useState('');

  // --- CONFIGS API ---
  const [apiConfigs, setApiConfigs] = useState({ nhanh_app_id: '', nhanh_business_id: '', nhanh_secret_key: '', nhanh_access_code: '' });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState('');
  const [nhanhDaysLeft, setNhanhDaysLeft] = useState(null);
  const hasWarnedNhanh = useRef(false);

  // --- FILTER & PRIORITY ---
  const [filterConfigs, setFilterConfigs] = useState({ allowed_statuses: [] });
  const [statusList, setStatusList] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [selectedNewPriority, setSelectedNewPriority] = useState('');
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterMessage, setFilterMessage] = useState('');

  // --- SHEETS SYNC ---
  const [sheetDailyUrl, setSheetDailyUrl] = useState('');
  const [sheetDailyGid, setSheetDailyGid] = useState('0');
  const [sheetPrintUrl, setSheetPrintUrl] = useState('');
  const [sheetPrintGid, setSheetPrintGid] = useState('0');
  const [syncLoading, setSyncLoading] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('');
  // Cấu hình cột tự gán: null = chưa cấu hình riêng, dùng cách quét cũ.
  // Khi khác null: { codeChain: [{ db: 'id'|'carrier_code', header }], dateHeader }
  // codeChain theo thứ tự trên xuống = thứ tự thử khi đối chiếu mã đơn.
  const [dailyMap, setDailyMap] = useState(null);
  const [printMap, setPrintMap] = useState(null);
  const [dailyLastScan, setDailyLastScan] = useState('');
  const [printLastScan, setPrintLastScan] = useState('');
  const [syncDailyLoading, setSyncDailyLoading] = useState(false);
  const [syncPrintLoading, setSyncPrintLoading] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  const [printSummary, setPrintSummary] = useState(null);
  const [dailyScanMessage, setDailyScanMessage] = useState('');
  const [printScanMessage, setPrintScanMessage] = useState('');
  // Log đơn in có trong sheet nhưng DB không tìm thấy — chỉ owner/super_admin thấy.
  const [printMissing, setPrintMissing] = useState([]);

  // --- EDGE FUNCTIONS SYNC ---
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
  // Ngày VN tính bằng UTC+7 thuần, không dùng Intl timeZone: có trình duyệt
  // không nhận tên múi giờ Asia/Ho_ChiMinh và làm sập cả trang (lỗi 2026-11-03).
  const vnTodayStr = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [syncReturnsFrom, setSyncReturnsFrom] = useState(() => {
    const d = new Date(vnTodayStr() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [syncReturnsTo, setSyncReturnsTo] = useState(() => vnTodayStr());

  // --- BAO TRI (404) ---
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // --- DB CLEANUP & STORAGE ---
  const [cleanDays, setCleanDays] = useState('180');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanProgress, setCleanProgress] = useState(null);
  const [cleanMessage, setCleanMessage] = useState({ text: '', type: '' });
  const [confirmCleanStep, setConfirmCleanStep] = useState(false);
  const [dbUsage, setDbUsage] = useState({ used: 0, total: 500 * 1024 * 1024 });

  // --- GLOBAL NOTIFICATION (POPUP) ---
  const [globalNotif, setGlobalNotif] = useState({ enabled: false, type: 'info', title: '', content: '' });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');

  // --- GLOBAL BANNER (CHẠY NGANG) ---
  const [bannerNotif, setBannerNotif] = useState({ enabled: false, type: 'info', content: '', speed: 15 });
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');

  // --- ENV CONSTANTS ---
  const projectUrl = SUPABASE_URL;
  const anonKey = SUPABASE_ANON_KEY;
  const SUPER_OWNER_EMAIL = "contact.hotavinh@gmail.com";

  useEffect(() => {
    loadCurrentUserData();
    fetchData();
    fetchDbSize();
  }, []);

  useEffect(() => {
    if (activeTab === 'users_management') fetchSystemUsers();
    if (activeTab === 'action_logs') { if (users.length === 0) fetchSystemUsers(); fetchActionLogs(1); }
    if (activeTab !== 'configs') setConfirmCleanStep(false);
  }, [activeTab]);

  // --- UTILITY: CUSTOM MODAL ---
  const showCustomDialog = (type, title, message) => {
    return new Promise((resolve) => {
      setDialogConfig({
        type, 
        title, 
        message,
        onConfirm: () => { setDialogConfig(null); resolve(true); },
        onCancel: () => { setDialogConfig(null); resolve(false); }
      });
    });
  };

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

  const fetchDbSize = async () => {
    try {
      const { data, error } = await supabase.rpc('get_db_size');
      if (!error && data !== null) {
        setDbUsage(prev => ({ ...prev, used: parseInt(data) }));
      }
    } catch (e) {
      console.warn("Chưa cài đặt RPC get_db_size trên Supabase.");
    }
  };

  const getDynamicPriorityOptions = () => {
    const options = filterConfigs.allowed_statuses.map(statusId => {
      const st = statusList.find(s => String(s.id) === String(statusId));
      return { id: `STATUS_${statusId}`, label: ` Ưu tiên: Đơn ${st ? st.name : 'Mã ' + statusId} (${statusId})` };
    });
    options.push({ id: 'DATE_ASC', label: ' Ưu tiên Thời gian: Đơn tạo cũ nhất xếp trước' });
    return options;
  };

  const fetchData = async () => {
    const { data: statuses } = await supabase.from('order_statuses').select('id,name').order('id');
    if (statuses) setStatusList(statuses);

    const { data: configs } = await supabase.from('system_configs').select('*');
    if (configs) {
      const configMap = {};
      configs.forEach(item => configMap[item.key] = item.value);
      setMaintenanceOn(configMap['maintenance_mode'] === 'true');
      
      setApiConfigs(prev => ({ 
          ...prev, 
          nhanh_app_id: configMap['nhanh_app_id'] || '',
          nhanh_business_id: configMap['nhanh_business_id'] || '',
          nhanh_secret_key: configMap['nhanh_secret_key'] || ''
      }));

      if (configMap['nhanh_token_updated_at']) {
        const updatedDate = new Date(configMap['nhanh_token_updated_at']);
        const now = new Date();
        const diffTime = now - updatedDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const remain = 365 - diffDays;
        setNhanhDaysLeft(remain);

        if (remain < 15 && !hasWarnedNhanh.current) {
          hasWarnedNhanh.current = true;
          setTimeout(() => {
            showCustomDialog('alert', '️ Cảnh báo kết nối Nhanh.vn', `Kết nối Nhanh.vn còn ${remain} ngày nữa hết hạn (Hạn mức 365 ngày). Vui lòng cập nhật Access Code mới để tránh gián đoạn hệ thống.`);
          }, 800);
        }
      }

      setSheetDailyUrl(configMap['sheet_daily_url'] || '');
      setSheetDailyGid(configMap['sheet_daily_gid'] || '0');
      setSheetPrintUrl(configMap['sheet_print_url'] || '');
      setSheetPrintGid(configMap['sheet_print_gid'] || '0');
      const parseSheetMap = (raw) => {
        try {
          const p = JSON.parse(raw || '');
          if (p && Array.isArray(p.code_chain) && p.code_chain.length > 0) {
            return { codeChain: p.code_chain.filter(c => c && (c.db === 'id' || c.db === 'carrier_code') && c.header).map(c => ({ db: c.db, header: String(c.header) })), dateHeader: String(p.date_header || 'Ngày') };
          }
        } catch {}
        return null;
      };
      setDailyMap(parseSheetMap(configMap['sheet_daily_map']));
      setPrintMap(parseSheetMap(configMap['sheet_print_map']));
      setDailyLastScan(configMap['sheet_daily_last_scan_at'] || '');
      setPrintLastScan(configMap['sheet_print_last_scan_at'] || '');

      let savedStatuses = ['54', '55', '56', '42', '40'];
      if (configMap['print_allowed_statuses']) savedStatuses = configMap['print_allowed_statuses'].split(',');
      setFilterConfigs({ allowed_statuses: savedStatuses });

      const dynamicOptions = [
        ...savedStatuses.map(id => {
            const st = statuses?.find(s => String(s.id) === String(id));
            return { id: `STATUS_${id}`, label: ` Ưu tiên: Đơn ${st ? st.name : id} (${id})` };
        }),
        { id: 'DATE_ASC', label: ' Ưu tiên Thời gian: Đơn tạo cũ nhất xếp trước' }
      ];

      if (configMap['print_priority_mode']) {
        const savedOrder = configMap['print_priority_mode'].split(',');
        const restored = savedOrder.map(id => dynamicOptions.find(p => p.id === id)).filter(Boolean);
        setPriorities(restored);
      }

      // Restore Notifications
      if (configMap['global_notification']) try { setGlobalNotif(JSON.parse(configMap['global_notification'])); } catch(e) {}
      if (configMap['global_banner']) try { setBannerNotif(JSON.parse(configMap['global_banner'])); } catch(e) {}
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

  // Ghi dau thu hoi phien cho tai khoan bi xoa/doi quyen. Neu ghi that bai thi bo qua -
  // Layout van da ra bang kiem tra dinh ky (getUser that bai neu bi xoa, role moi neu bi doi quyen).
  const notifySessionRevoked = async (targetUserId) => {
    try {
      await supabase.from('system_configs').upsert({ key: sessionRevokedKey(targetUserId), value: new Date().toISOString() }, { onConflict: 'key' });
    } catch (e) { console.warn('Khong ghi duoc session_revoked:', e?.message); }
  };

  const fetchSystemUsers = async () => {
    setLoading(true); setUserMessage('');
    try {
      const data = await callUserManagementApi({ action: 'list' });
      setUsers(data.users || []);
    } catch (err) {
      setUserMessage(` Lỗi tải thành viên: ${err.message}`);
    } finally { setLoading(false); }
  };

  // --- CHI TIET USER / KICK / KHOA / NHAT KY (OWNER ONLY) ---
  const isUserBanned = (u) => u?.banned_until && new Date(u.banned_until).getTime() > Date.now();
  const ACTION_LABELS = { send: 'Gửi đơn', edit: 'Sửa đơn', cancel: 'Hủy đơn', print: 'In đơn' };
  const RESULT_LABELS = { ok: 'Thành công', failed: 'Thất bại', existed: 'Đã gửi rồi' };
  const isDeviceOnline = (lastSeen) => lastSeen && (Date.now() - new Date(lastSeen).getTime() <= 10 * 60 * 1000);
  const fmtLogDetail = (log) => {
    const d = log.details || {};
    if (log.action === 'send') return d.carrier_code ? `Mã vận đơn: ${d.carrier_code}` : (d.message || '');
    if (log.action === 'edit') return d.fields ? `Đổi: ${(d.fields || []).join(', ')}` : '';
    if (log.action === 'cancel') return d.reason ? `Lý do: ${d.reason}` : (d.message || '');
    if (log.action === 'print') return d.print_size ? `Khổ: ${d.print_size}` : '';
    return d.message || '';
  };

  const fetchUserDetail = async (u) => {
    setDetailUser(u); setDetailData(null); setDetailMsg(''); setDetailLoading(true);
    try {
      const data = await callUserManagementApi({ action: 'detail', userId: u.id });
      setDetailData(data);
    } catch (err) {
      setDetailMsg(`Lỗi tải chi tiết: ${err.message}`);
    } finally { setDetailLoading(false); }
  };

  const handleKickUser = async (u) => {
    const ok = await showCustomDialog('confirm', 'Đá tài khoản ra khỏi hệ thống?', `${u.email} sẽ bị đăng xuất ngay trên mọi thiết bị đang mở app. Tài khoản vẫn đăng nhập lại được sau đó (muốn cấm hẳn thì dùng Khóa tài khoản).`);
    if (!ok) return;
    setActionLoadingId(u.id);
    try {
      await callUserManagementApi({ action: 'kick', userId: u.id });
      setDetailMsg('Đã đá tài khoản ra khỏi hệ thống.');
    } catch (err) {
      setDetailMsg(`Lỗi: ${err.message}`);
    } finally { setActionLoadingId(null); }
  };

  const handleBanUser = async (u, ban) => {
    const ok = await showCustomDialog('confirm', ban ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?', ban ? `${u.email} sẽ không đăng nhập được nữa cho đến khi Owner mở khóa.` : `${u.email} sẽ đăng nhập lại được bình thường.`);
    if (!ok) return;
    setActionLoadingId(u.id);
    try {
      await callUserManagementApi({ action: ban ? 'ban' : 'unban', userId: u.id });
      setDetailMsg(ban ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
      const data = await callUserManagementApi({ action: 'list' });
      setUsers(data.users || []);
      const refreshed = (data.users || []).find(x => x.id === u.id);
      if (refreshed) { setDetailUser(refreshed); fetchUserDetail(refreshed); }
    } catch (err) {
      setDetailMsg(`Lỗi: ${err.message}`);
    } finally { setActionLoadingId(null); }
  };

  const fetchActionLogs = async (page = 1) => {
    setLogsLoading(true);
    try {
      const data = await callUserManagementApi({
        action: 'action_logs',
        filterUserId: logFilterUser || undefined,
        filterAction: logFilterAction || undefined,
        filterOrderId: logFilterOrder || undefined,
        logLimit: 50,
        logOffset: (page - 1) * 50,
      });
      setLogs(data.logs || []); setLogsTotal(data.total || 0); setLogPage(page);
    } catch (err) {
      setUserMessage(`Lỗi tải nhật ký: ${err.message}`);
    } finally { setLogsLoading(false); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) { setProfileMessage(' Tên hiển thị không được để trống.'); return; }
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
      setProfileMessage(' Đã cập nhật hồ sơ cá nhân thành công!');
      setProfilePassword(''); setCurrentPassword('');
      await loadCurrentUserData();
    } catch (err) { setProfileMessage(` Lỗi: ${err.message}`); } finally { setProfileLoading(false); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.email || !userForm.password || !userForm.fullName) { 
      await showCustomDialog('alert', 'Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin tài khoản (Tên, Email, Mật khẩu)!');
      return; 
    }
    setLoading(true); setUserMessage('');
    try {
      await callUserManagementApi({ action: 'create', ...userForm });
      setUserMessage(` Đã khởi tạo thành công tài khoản cho [${userForm.fullName}]`);
      setUserForm({ email: '', password: '', fullName: '', role: 'user' });
      await fetchSystemUsers();
    } catch (err) { setUserMessage(` Lỗi tạo tài khoản: ${err.message}`); } finally { setLoading(false); }
  };

  const handleOpenEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setEditForm({ fullName: targetUser.user_metadata?.full_name || '', role: targetUser.user_metadata?.role || 'user' });
    setShowUpgradeConfirm(false); setUpgradePassword('');
  };

  const handleSaveEditedInfo = async (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim()) { 
      await showCustomDialog('alert', 'Cảnh báo', 'Họ và tên không được để trống!');
      return; 
    }
    setLoading(true);
    try {
      const oldRole = editingUser.user_metadata?.role || 'user';
      await callUserManagementApi({ action: 'update_info', userId: editingUser.id, fullName: editForm.fullName, role: isOwner ? editForm.role : undefined });
      if (isOwner && editForm.role && editForm.role !== oldRole) await notifySessionRevoked(editingUser.id);
      setUserMessage(` Đã cập nhật thông tin thành công.`);
      setEditingUser(null); await fetchSystemUsers();
    } catch (err) { 
      await showCustomDialog('alert', 'Lỗi thao tác', ` Lỗi lưu thông tin: ${err.message}`);
    } finally { setLoading(false); }
  };

  const handleToggleOwnerStatus = async (e, makeOwner) => {
    e.preventDefault();
    if (!upgradePassword) { 
      await showCustomDialog('alert', 'Bảo mật', 'Vui lòng nhập mật khẩu của bạn để xác nhận thao tác!');
      return; 
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: currentUserEmail, password: upgradePassword });
      if (verifyError) throw new Error('Mật khẩu xác nhận không chính xác!');
      
      await callUserManagementApi({ 
        action: 'update_info', 
        userId: editingUser.id, 
        role: makeOwner ? 'admin' : editForm.role,
        isOwner: makeOwner 
      });
      
      await notifySessionRevoked(editingUser.id);
      setUserMessage(makeOwner ? ` Đã cấp quyền Owner cho [${editingUser.email}]` : ` Đã gỡ quyền Owner của [${editingUser.email}]`);
      setEditingUser(null); 
      await fetchSystemUsers();
    } catch (err) { 
      await showCustomDialog('alert', 'Lỗi phân quyền', ` Lỗi thao tác: ${err.message}`); 
    } finally { setLoading(false); }
  };

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.email === SUPER_OWNER_EMAIL) { 
      await showCustomDialog('alert', 'Từ chối', 'Không thể xóa tài khoản Super Owner!');
      return; 
    }
    const confirmed = await showCustomDialog('confirm', 'Xác nhận vô hiệu hóa', ` XÓA VĨNH VIỄN tài khoản [${targetUser.user_metadata?.full_name || targetUser.email}]? Dữ liệu không thể phục hồi.`);
    if (!confirmed) return;

    setActionLoadingId(targetUser.id);
    try {
      await callUserManagementApi({ action: 'delete', userId: targetUser.id });
      await notifySessionRevoked(targetUser.id);
      setUserMessage(` Đã xóa sổ tài khoản khỏi hệ thống.`);
      await fetchSystemUsers();
    } catch (err) { setUserMessage(` Không thể xóa: ${err.message}`); } finally { setActionLoadingId(null); }
  };

  const handleApiChange = (e) => setApiConfigs({ ...apiConfigs, [e.target.name]: e.target.value });
  
  const handleSaveApi = async (e) => {
    e.preventDefault();
    setApiLoading(true); setApiMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('nhanh-auth', { body: { ...apiConfigs, access_code: apiConfigs.nhanh_access_code } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      
      const nowIso = new Date().toISOString();
      await supabase.from('system_configs').upsert([
        { key: 'nhanh_token_updated_at', value: nowIso }
      ], { onConflict: 'key' });

      setApiMessage(' Đã đổi Token thành công!'); 
      setApiConfigs(prev => ({ ...prev, nhanh_access_code: '' }));
      setNhanhDaysLeft(365);
    } catch (error) { setApiMessage(' Lỗi: ' + error.message); } finally { setApiLoading(false); }
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
      setFilterMessage(' Đã lưu cấu hình Lọc & Ưu tiên!');
    } catch (error) { setFilterMessage(' Lỗi: ' + error.message); } finally { setFilterLoading(false); }
  };

  const handleSyncOrdersData = async () => {
    setIsSyncingOrder(true); setSyncOrderStatus('idle'); setSyncOrderMessage(`Đang kéo dữ liệu Đơn hàng ${syncDays} ngày qua...`);
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
        setSyncOrderStatus('success'); setSyncOrderMessage(` Đồng bộ thành công ${data.totalSynced} đơn hàng.`);
      } else { throw new Error(data?.error || 'Lỗi logic Edge Function'); }
    } catch (err) { setSyncOrderStatus('error'); setSyncOrderMessage(` ${err.message}`); } finally { setIsSyncingOrder(false); }
  };

  const handleSyncInventoryOnly = async () => {
    setIsSyncingInventory(true); setSyncInventoryStatus('idle'); setSyncProductMessage(`Đang kéo Tồn Kho...`);
    try {
      const res = await fetch(`${projectUrl}/functions/v1/sync-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ mode: 'inventory' }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi server');
      setSyncInventoryStatus('success'); setSyncProductMessage(`️ Cập nhật Tồn Kho thành công cho ${data.totalSynced} sản phẩm.`);
    } catch (err) { setSyncInventoryStatus('error'); setSyncProductMessage(` ${err.message}`); } finally { setIsSyncingInventory(false); }
  };

  const handleSyncMasterData = async () => {
    const confirmed = await showCustomDialog('confirm', 'Tải danh mục Sản phẩm', "Quá trình cào Master Data (Tên, Mã Vạch) sẽ mất nhiều thời gian. Xác nhận tiến hành chạy?");
    if (!confirmed) return;
    
    setIsSyncingMaster(true); setSyncMasterStatus('idle'); setSyncProductMessage(`Đang cào Master Data...`);
    try {
      const res = await fetch(`${projectUrl}/functions/v1/sync-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ mode: 'master' }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi server');
      setSyncMasterStatus('success'); setSyncProductMessage(` Đã làm mới toàn bộ ${data.totalSynced} sản phẩm.`);
    } catch (err) { setSyncMasterStatus('error'); setSyncProductMessage(` ${err.message}`); } finally { setIsSyncingMaster(false); }
  };

  const handleSaveConfig = async () => {
    setSyncLoading(true); setSheetMessage('');
    try {
      const mapToValue = (m) => m ? JSON.stringify({ code_chain: m.codeChain, date_header: m.dateHeader }) : '';
      const updates = [
        { key: 'sheet_daily_url', value: sheetDailyUrl }, { key: 'sheet_daily_gid', value: sheetDailyGid },
        { key: 'sheet_print_url', value: sheetPrintUrl }, { key: 'sheet_print_gid', value: sheetPrintGid },
        { key: 'sheet_daily_map', value: mapToValue(dailyMap) },
        { key: 'sheet_print_map', value: mapToValue(printMap) }
      ];
      const { error } = await supabase.from('system_configs').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      setSheetMessage('Đã lưu cấu hình liên kết và cấu hình cột thành công!');
    } catch (err) { setSheetMessage('Lỗi lưu cấu hình: ' + err.message); } finally { setSyncLoading(false); }
  };

  const handleTriggerSyncSheets = async (type) => {
    const isDaily = type === 'daily';
    const setLoading = isDaily ? setSyncDailyLoading : setSyncPrintLoading;
    const setScanMessage = isDaily ? setDailyScanMessage : setPrintScanMessage;
    const setSummary = isDaily ? setDailySummary : setPrintSummary;
    setLoading(true); setScanMessage(''); setSummary(null);
    if (!isDaily) setPrintMissing([]);
    try {
        // Gửi kèm JWT của người đang đăng nhập để backend biết có phải
        // owner/super_admin không — chỉ khi đó backend mới trả danh sách
        // mã không tìm thấy. Không có token thì quét vẫn chạy, chỉ có số lượng.
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        const res = await fetch(`${projectUrl}/functions/v1/sync-sheets`, { method: 'POST', headers, body: JSON.stringify({ type }) });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Lỗi server');
        const summary = data.debug?.[isDaily ? 'daily_sheet' : 'print_sheet'] || {};
        setSummary(summary);
        if (summary.error) {
          setScanMessage('Thất bại: ' + summary.error);
        } else if (summary.skipped) {
          setScanMessage(summary.reason || 'Chưa cấu hình sheet này.');
        } else {
          setScanMessage(`Đã quét xong: ${summary.total_rows_parsed ?? 0} dòng, khớp ${summary.matched ?? 0} đơn, cập nhật ${summary.final_unique_updated ?? 0} đơn.`);
          if (!isDaily && Array.isArray(summary.missing)) setPrintMissing(summary.missing);
          if (isDaily) setDailyLastScan(new Date().toISOString()); else setPrintLastScan(new Date().toISOString());
        }
    } catch (err) { setScanMessage('Lỗi kết nối: ' + err.message); }
    setLoading(false);
  };

  const downloadPrintMissingCsv = () => {
    if (!printMissing.length) return;
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Dòng sheet', 'Mã gốc', 'Mã chuẩn hóa', 'Ngày trong sheet', 'Đã thử (theo thứ tự)']];
    printMissing.forEach(m => {
      rows.push([
        m.sheet_row,
        (m.codes || []).map(c => `${c.header}: ${c.raw}`).join(' | '),
        (m.codes || []).map(c => c.cleaned).filter(Boolean).join(' | '),
        m.date_raw || '',
        (m.codes || []).map(c => c.db === 'id' ? 'ID đơn' : 'Mã vận đơn').join(' -> ')
      ]);
    });
    const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `don-in-thieu-db-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // --- Cấu hình cột quét sheet (hàm trả về JSX, không phải component riêng
  // để tránh mất focus khi gõ) ---
  const defaultSheetMap = () => ({ codeChain: [{ db: 'id', header: '' }, { db: 'carrier_code', header: '' }], dateHeader: 'Ngày' });
  const renderSheetMapEditor = (kind, map, setMap) => {
    if (!map) {
      return (
        <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-600 font-medium">Chưa cấu hình cột riêng. Hệ thống đang quét theo cách cũ: mã lấy từ cột “Mã vận đơn” / “Mã đơn hàng” / “Mã đơn” (cột nào có trước), ngày lấy từ cột “Ngày”, tìm theo mã vận đơn trước rồi tới ID đơn.</p>
          <button onClick={() => setMap(defaultSheetMap())} className="mt-3 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold rounded-lg transition-colors cursor-pointer">Tạo cấu hình cột riêng</button>
        </div>
      );
    }
    return (
      <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <p className="text-sm font-bold text-slate-700">Cấu hình cột quét — tiêu đề luôn ở hàng 1, dữ liệu từ hàng 2 trở đi. Thứ tự trên xuống là thứ tự thử: cột trên không tìm thấy đơn thì thử cột dưới.</p>
        {map.codeChain.map((row, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap w-28">Mã đối chiếu {idx + 1}</span>
            <select value={row.db} onChange={e => setMap({ ...map, codeChain: map.codeChain.map((r, i) => i === idx ? { ...r, db: e.target.value } : r) })} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white font-medium">
              <option value="id">ID đơn (orders.id)</option>
              <option value="carrier_code">Mã vận đơn (carrier_code)</option>
            </select>
            <input type="text" value={row.header} onChange={e => setMap({ ...map, codeChain: map.codeChain.map((r, i) => i === idx ? { ...r, header: e.target.value } : r) })} placeholder="Tiêu đề cột trong sheet, ví dụ: ID đơn" className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
            <button onClick={() => setMap({ ...map, codeChain: map.codeChain.filter((_, i) => i !== idx) })} disabled={map.codeChain.length <= 1} className="px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40 cursor-pointer">Xóa</button>
          </div>
        ))}
        <button onClick={() => setMap({ ...map, codeChain: [...map.codeChain, { db: 'carrier_code', header: '' }] })} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-bold rounded-lg transition-colors cursor-pointer">Thêm cột đối chiếu</button>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap w-28">Cột ngày</span>
          <input type="text" value={map.dateHeader} onChange={e => setMap({ ...map, dateHeader: e.target.value })} placeholder="Tiêu đề cột ngày, ví dụ: Ngày" className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium" />
          <span className="text-xs text-slate-500 font-medium">{kind === 'daily' ? 'Gán vào ngày đi đơn (carrier_date).' : 'Gán vào ngày in (printed_at).'}</span>
        </div>
        <div className="flex justify-end">
          <button onClick={() => setMap(null)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">Quay về cách quét cũ (chưa lưu)</button>
        </div>
        <p className="text-xs text-slate-500 font-medium">Nhớ bấm “Lưu cấu hình liên kết” bên dưới để áp dụng. Quét trước khi lưu vẫn dùng cấu hình cũ.</p>
      </div>
    );
  };

  const handleSyncReturns = async () => {
    if (syncReturnsFrom && syncReturnsTo && syncReturnsFrom > syncReturnsTo) {
      setSyncReturnsMessage({ text: 'Từ ngày phải trước Đến ngày.', type: 'error' });
      return;
    }
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
                body: JSON.stringify({ platformId: platform.id, page: currentPage, fromDate: syncReturnsFrom || undefined, toDate: syncReturnsTo || undefined }) 
            });
            const textData = await res.text();
            let data;
            try { data = JSON.parse(textData); } catch(e) { throw new Error(`Máy chủ bị sập ở sàn ${platform.name} trang ${currentPage}`); }
            if (!res.ok) { hasError = true; break; }
            
            total += (data.syncedCount || 0);
            if (data.hasMoreData) currentPage = data.nextPage; else hasMoreData = false;
        }
      }
      if (hasError) setSyncReturnsMessage({ text: `️ Đã cào được ${total} đơn, nhưng bị gián đoạn ở một vài trang.`, type: 'error' });
      else setSyncReturnsMessage({ text: ` Hoàn tất! Đã đồng bộ an toàn ${total} đơn trả hàng từ 3 sàn.`, type: 'success' });
    } catch (err) { setSyncReturnsMessage({ text: ` Lỗi hệ thống: ${err.message}`, type: 'error' }); } finally { setIsSyncingReturns(false); }
  };

  // --- BAO TRI (404): chi Owner moi duoc bat/tat ---
  const handleToggleMaintenance = async () => {
    if (!isOwner) {
      setMaintenanceMessage('Chỉ Chủ sở hữu (Owner) mới được bật/tắt bảo trì.');
      return;
    }
    const turningOn = !maintenanceOn;
    if (turningOn) {
      const ok = await showCustomDialog('confirm', 'Bật chế độ bảo trì?', 'Khi bật, tất cả mọi người trừ Owner sẽ chỉ thấy màn hình xám 404 Not Found, kể cả trang đăng nhập. Owner vẫn vào được để tắt lại. Ông có chắc muốn bật không?');
      if (!ok) return;
    }
    setMaintenanceLoading(true);
    setMaintenanceMessage('');
    try {
      await setMaintenanceMode(turningOn);
      setMaintenanceOn(turningOn);
      setMaintenanceMessage(turningOn ? 'Đã bật bảo trì: mọi người khác đang thấy trang 404.' : 'Đã tắt bảo trì: web đã mở lại bình thường.');
    } catch (err) {
      setMaintenanceMessage('Lỗi: ' + (err.message || err));
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleCleanData = async () => {
    if (!confirmCleanStep) {
        setConfirmCleanStep(true);
        return;
    }

    setIsCleaning(true);
    setCleanProgress(null);
    setCleanMessage({ text: 'Đang xóa theo lô, vui lòng không tắt trang...', type: 'processing' });
    try {
      let totalDeleted = 0;
      let rounds = 0;
      let done = false;
      let lastRemaining = null;
      // Goi lap RPC theo lo 1000 dong/lan. Moi lan goi la 1 transaction rieng nen
      // neu 1 lan bi timeout thi cac lo truoc van giu nguyen, co the goi tiep ma khong mat tien trinh.
      while (!done && rounds < 200) {
        rounds += 1;
        const { data, error } = await supabase.rpc('request_cleanup_batched', { days_old: parseInt(cleanDays), batch_size: 1000 });
        if (error) throw error;
        const deleted = (data?.deleted && Object.values(data.deleted).reduce((a, b) => a + (b || 0), 0)) || 0;
        totalDeleted += deleted;
        lastRemaining = data?.remaining || null;
        done = data?.done === true || deleted === 0;
        setCleanProgress({ rounds, totalDeleted, remaining: lastRemaining, done });
        setCleanMessage({ text: `Đang xóa theo lô ${rounds} — đã xóa ${totalDeleted} dòng. ${done ? 'Đã xong.' : 'Đang tiếp tục...'}`, type: 'processing' });
        if (!done) await new Promise(r => setTimeout(r, 200));
      }
      setCleanMessage({ text: `Đã dọn dẹp xong dữ liệu cũ hơn ${cleanDays} ngày: ${totalDeleted} dòng đã xóa sau ${rounds} lô. Để dung lượng giảm ngay, hãy chạy file VACUUM trong SQL Editor (xem hướng dẫn trong zip) — autovacuum cũng sẽ dọn dần.`, type: 'success' });
      fetchDbSize();
    } catch (err) {
      const msg = String(err.message || err);
      if (/request_cleanup_batched|does not exist|PGRST202/i.test(msg)) {
        setCleanMessage({ text: 'Chưa cài RPC xóa theo lô. Hãy chạy file supabase/20261030_cleanup_batched.sql trong SQL Editor một lần, rồi bấm dọn dẹp lại.', type: 'error' });
      } else {
        setCleanMessage({ text: `Lỗi xóa dữ liệu: ${msg}. Các lô đã xóa trước đó vẫn được giữ, có thể bấm lại để tiếp tục từ chỗ đã dừng.`, type: 'error' });
      }
    } finally {
      setIsCleaning(false);
      setConfirmCleanStep(false);
    }
  };

  // --- LƯU THÔNG BÁO GLOBAL ---
  const handleSaveNotification = async (e) => {
    e.preventDefault();
    setNotifLoading(true); setNotifMessage('');
    try {
      const payload = {
        ...globalNotif,
        id: Date.now()
      };
      const { error } = await supabase.from('system_configs').upsert([
        { key: 'global_notification', value: JSON.stringify(payload) }
      ], { onConflict: 'key' });
      
      if (error) throw error;
      setNotifMessage(' Đã lưu và phát thông báo Popup toàn hệ thống!');
      setGlobalNotif(payload);
    } catch(err) {
      setNotifMessage(' Lỗi: ' + err.message);
    } finally {
      setNotifLoading(false);
    }
  };

  // --- LƯU THÔNG BÁO BANNER NGANG ---
  const handleSaveBanner = async (e) => {
    e.preventDefault();
    setBannerLoading(true); setBannerMessage('');
    try {
      const { error } = await supabase.from('system_configs').upsert([
        { key: 'global_banner', value: JSON.stringify(bannerNotif) }
      ], { onConflict: 'key' });
      
      if (error) throw error;
      setBannerMessage(' Đã lưu và cập nhật dải thông báo chạy chữ!');
    } catch(err) {
      setBannerMessage(' Lỗi: ' + err.message);
    } finally {
      setBannerLoading(false);
    }
  };

  const dbUsagePercent = Math.min((dbUsage.used / dbUsage.total) * 100, 100).toFixed(1);
  let barColor = 'bg-emerald-500';
  if (dbUsagePercent > 60) barColor = 'bg-amber-500';
  if (dbUsagePercent > 85) barColor = 'bg-red-500';

  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 tracking-wide">Đang tải phân quyền hệ thống...</p>
      </div>
    );
  }

  const isOwner = currentUserMeta.is_owner === true || currentUserEmail === SUPER_OWNER_EMAIL;
  const isSuperAdmin = isSuperAdminRole(currentUserMeta.role);
  const isAdminOrOwner = isOwner || isAdminRole(currentUserMeta.role);
  // Super admin = admin + 3 quyen rieng: Nhanh.vn, Google Sheet don in/don di, nen giao dien.
  // Khong bao gom cac quyen owner khac (don dep DB, cap/xoa tai khoan, thong bao global).
  const canEditSensitiveConfig = isOwner || isSuperAdmin;

  if (!isAdminOrOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
        <div className="max-w-md w-full bg-white p-8 border border-red-200 rounded-2xl shadow-xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-2">
            <ShieldAlert size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Truy cập bị từ chối</h2>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Bạn không có quyền truy cập trang quản trị này. Vui lòng liên hệ Owner để được cấp quyền.
          </p>
        </div>
      </div>
    );
  }

  const dynamicOptions = getDynamicPriorityOptions();

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 mt-8 px-4 sm:px-6 relative">
      
      {/* HEADER & TABS */}
      <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sticky top-4 z-40 backdrop-blur-xl bg-white/90">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Settings size={26} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Quản trị Hệ thống</h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Thiết lập kết nối, giao diện & nhân sự</p>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 w-full md:w-auto overflow-x-auto shadow-inner hide-scrollbar">
          <button onClick={() => { setActiveTab('configs'); setUserMessage(''); }} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'configs' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>
            Cấu hình & Data
          </button>
          
          {isOwner && (
            <button onClick={() => { setActiveTab('notifications'); setUserMessage(''); }} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'notifications' ? 'bg-slate-900 text-white shadow flex items-center justify-center gap-1.5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 flex items-center justify-center gap-1.5'}`}>
              <BellRing size={16}/> Thông báo
            </button>
          )}

          <button onClick={() => { setActiveTab('users_management'); setUserMessage(''); }} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'users_management' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>
            Quản lý Users
          </button>
          {isOwner && (
            <button onClick={() => { setActiveTab('action_logs'); setUserMessage(''); }} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'action_logs' ? 'bg-slate-900 text-white shadow flex items-center justify-center gap-1.5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 flex items-center justify-center gap-1.5'}`}>
              <History size={16}/> Nhật ký thao tác
            </button>
          )}
          <button onClick={() => { setActiveTab('profile'); setUserMessage(''); }} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'profile' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>
            Cá nhân
          </button>
        </div>
      </div>

      {userMessage && !['profile', 'themes', 'notifications'].includes(activeTab) && (
        <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2 ${userMessage.includes('Lỗi') || userMessage.includes('Không thể') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {userMessage.includes('Lỗi') || userMessage.includes('Không thể') ? <AlertCircle size={20} className="flex-shrink-0"/> : <CheckCircle2 size={20} className="flex-shrink-0"/>} {userMessage}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: THÔNG BÁO GLOBAL (OWNER ONLY) */}
      {/* ============================================================== */}
      {activeTab === 'notifications' && isOwner && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* BANNER THÔNG BÁO (Dải chạy chữ ngang) */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <h2 className="text-xl font-bold mb-2 text-slate-900 flex items-center gap-2">
              <MonitorPlay size={22} className="text-orange-500"/> Dải thông báo chạy ngang (Marquee)
            </h2>
            <p className="text-sm text-slate-500 font-medium border-b border-slate-200 pb-6 mb-6">
              Chèn một dải thông báo chạy liên tục ngay trên cùng màn hình của hệ thống. Phù hợp để tuyên dương, cảnh báo hoặc push sale.
            </p>

            {bannerMessage && <div className={`p-4 mb-6 rounded-xl font-bold text-sm shadow-sm flex gap-2 ${bannerMessage.includes('Lỗi') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{bannerMessage.includes('Lỗi') ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>} {bannerMessage}</div>}

            <form onSubmit={handleSaveBanner} className="space-y-6">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-orange-50/50 border border-orange-200/50 rounded-2xl gap-4">
                <div>
                  <h3 className="text-sm font-bold text-orange-900">Kích hoạt Dải chữ chạy</h3>
                  <p className="text-xs text-orange-700 font-medium mt-1">Bật để hiển thị. Nội dung sẽ được cập nhật trực tiếp tới toàn bộ nhân viên kho.</p>
                </div>
                <ToggleSwitch checked={bannerNotif.enabled} onChange={(c) => setBannerNotif({...bannerNotif, enabled: c})} color="bg-orange-500" />
              </div>

              <div className={`transition-all duration-300 ${bannerNotif.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Loại giao diện Banner</label>
                    <select 
                      value={bannerNotif.type} 
                      onChange={(e) => setBannerNotif({...bannerNotif, type: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 bg-white cursor-pointer transition"
                    >
                      <option value="info">Thông tin chung (Màu Xanh gradient)</option>
                      <option value="alert">Báo động khẩn (Màu Đỏ nhấp nháy)</option>
                      <option value="warning">Cảnh báo (Màu Vàng-Cam)</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tốc độ chạy (Giây)</label>
                    <input 
                      type="number" 
                      min="5" max="60"
                      value={bannerNotif.speed} 
                      onChange={(e) => setBannerNotif({...bannerNotif, speed: Number(e.target.value)})} 
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-sm font-medium transition bg-slate-50 focus:bg-white" 
                      required={bannerNotif.enabled}
                    />
                    <p className="text-xs text-slate-400 mt-1">Gợi ý: Dưới 10 là nhanh, 15 là vừa, trên 20 là chậm.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nội dung chữ chạy (Nên dùng kèm Emoji)</label>
                  <input 
                    type="text"
                    value={bannerNotif.content} 
                    onChange={(e) => setBannerNotif({...bannerNotif, content: e.target.value})} 
                    placeholder="VD:  Xin chúc mừng bộ phận Kho xuất sắc đạt 200% KPI ngày!..." 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-sm font-medium transition bg-slate-50 focus:bg-white" 
                    required={bannerNotif.enabled}
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button type="submit" disabled={bannerLoading} className="w-full sm:w-auto px-8 py-3.5 bg-orange-500 text-white text-sm font-bold rounded-xl shadow-md hover:bg-orange-600 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {bannerLoading ? <Loader2 size={18} className="animate-spin"/> : <SaveIcon/>} Lưu Dải thông báo
                </button>
              </div>
            </form>
          </div>

          {/* THÔNG BÁO POPUP CŨ (Nằm giữa màn hình) */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <h2 className="text-xl font-bold mb-2 text-slate-900 flex items-center gap-2">
              <Megaphone size={22} className="text-blue-600"/> Phát thông báo dạng Popup
            </h2>
            <p className="text-sm text-slate-500 font-medium border-b border-slate-200 pb-6 mb-6">
              Gửi thông báo bật lên chính giữa màn hình. Nhân viên phải bấm "Đã hiểu" hoặc "Tắt thông báo" để thu gọn.
            </p>

            {notifMessage && <div className={`p-4 mb-6 rounded-xl font-bold text-sm shadow-sm flex gap-2 ${notifMessage.includes('Lỗi') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{notifMessage.includes('Lỗi') ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>} {notifMessage}</div>}

            <form onSubmit={handleSaveNotification} className="space-y-6">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50 border border-slate-200 rounded-2xl gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Kích hoạt thông báo Popup</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Bật để hiển thị thông báo. Tắt để ẩn thông báo với tất cả mọi người.</p>
                </div>
                <ToggleSwitch checked={globalNotif.enabled} onChange={(c) => setGlobalNotif({...globalNotif, enabled: c})} color="bg-slate-700" />
              </div>

              <div className={`transition-all duration-300 ${globalNotif.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Loại thông báo</label>
                    <select 
                      value={globalNotif.type} 
                      onChange={(e) => setGlobalNotif({...globalNotif, type: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-500/20 bg-white cursor-pointer transition"
                    >
                      <option value="info">Thông báo chung (Màu Xám)</option>
                      <option value="update">Cập nhật tính năng (Màu Xanh)</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tiêu đề (Header)</label>
                    <input 
                      type="text" 
                      value={globalNotif.title} 
                      onChange={(e) => setGlobalNotif({...globalNotif, title: e.target.value})} 
                      placeholder="VD: Cập nhật tính năng In Đơn tự động..." 
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 text-sm font-medium transition bg-slate-50 focus:bg-white" 
                      required={globalNotif.enabled}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nội dung chi tiết</label>
                  <textarea 
                    rows={5} 
                    value={globalNotif.content} 
                    onChange={(e) => setGlobalNotif({...globalNotif, content: e.target.value})} 
                    placeholder="Nhập nội dung cần thông báo cho nhân viên..." 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 text-sm font-medium transition bg-slate-50 focus:bg-white resize-none custom-scrollbar" 
                    required={globalNotif.enabled}
                  />
                </div>
                
                <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex gap-3 text-blue-800 text-sm">
                  <Info size={18} className="shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">
                    <strong>Lưu ý:</strong> Khi bạn bấm "Phát thông báo", một ID mới sẽ được tạo. Những nhân viên đã từng bấm <i>"Tắt thông báo này"</i> ở lần trước sẽ <strong>thấy lại popup này</strong> để đảm bảo họ không bỏ lỡ thông tin mới.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button type="submit" disabled={notifLoading} className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {notifLoading ? <Loader2 size={18} className="animate-spin"/> : <Megaphone size={18}/>} Phát thông báo Popup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: CẤU HÌNH HỆ THỐNG */}
      {/* ============================================================== */}
      {activeTab === 'configs' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* SECTION 1: KẾT NỐI API */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 pb-4 mb-6 border-b border-slate-200"><Settings size={20} className="text-blue-600"/> Cài đặt kết nối Nhanh.vn</h2>
            
            {/* THÔNG BÁO THỜI GIAN TOKEN */}
            {nhanhDaysLeft !== null && (
              <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm font-bold shadow-sm ${nhanhDaysLeft < 15 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                {nhanhDaysLeft < 15 ? <AlertTriangle size={20} className="animate-pulse flex-shrink-0"/> : <CheckCircle2 size={20} className="flex-shrink-0"/>}
                Trạng thái liên kết API: {nhanhDaysLeft < 0 ? 'Đã hết hạn! Vui lòng thay Token mới.' : `Hợp lệ (Còn lại ${nhanhDaysLeft} ngày)`}
              </div>
            )}

            {apiMessage && <div className={`p-4 mb-6 rounded-xl font-bold text-sm shadow-sm flex gap-2 ${apiMessage.includes('') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}><CheckCircle2 size={18}/> {apiMessage}</div>}
            
            {canEditSensitiveConfig ? (
              <form onSubmit={handleSaveApi} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">App ID</label>
                      <input type="text" name="nhanh_app_id" value={apiConfigs.nhanh_app_id} onChange={handleApiChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Business ID</label>
                      <input type="text" name="nhanh_business_id" value={apiConfigs.nhanh_business_id} onChange={handleApiChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition" />
                    </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Secret Key</label>
                  <input type="password" name="nhanh_secret_key" value={apiConfigs.nhanh_secret_key} onChange={handleApiChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition" />
                </div>
                
                <div className="bg-amber-50/50 p-5 sm:p-6 border border-amber-200/60 rounded-2xl flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 block flex items-center gap-1.5"><KeyRound size={14}/> Mã Access Code mới (Hạn 15p)</label>
                    <input type="text" name="nhanh_access_code" value={apiConfigs.nhanh_access_code} onChange={handleApiChange} className="w-full px-4 py-3 border border-amber-300/60 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium transition placeholder:text-amber-300" placeholder="Paste access code lấy từ Nhanh.vn vào đây..." />
                  </div>
                  <button type="submit" disabled={apiLoading} className="w-full md:w-auto px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-all cursor-pointer text-sm disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap">
                    {apiLoading ? <Loader2 size={16} className="animate-spin" /> : <SaveIcon />} Lưu Token mới
                  </button>
                </div>
              </form>
            ) : (
              <LockedFeature msg="Chỉ Chủ sở hữu (Owner) hoặc Super Admin mới được quyền thay đổi cấu hình kết nối Nhanh.vn." />
            )}
          </div>

          {/* SECTION 2: GOOGLE SHEETS */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Database size={20} className="text-indigo-600"/> Liên kết Google Sheets</h2>
              {isAdminOrOwner && (
                <div className="flex gap-2">
                  <button onClick={() => handleTriggerSyncSheets('daily')} disabled={syncDailyLoading || syncPrintLoading} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                    {syncDailyLoading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCcw size={16}/>} Quét đơn đi
                  </button>
                  <button onClick={() => handleTriggerSyncSheets('print')} disabled={syncDailyLoading || syncPrintLoading} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                    {syncPrintLoading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCcw size={16}/>} Quét đơn in
                  </button>
                </div>
              )}
            </div>

            {sheetMessage && <div className={`p-4 mb-6 rounded-xl font-bold text-sm shadow-sm flex gap-2 ${sheetMessage.includes('Lỗi') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}><CheckCircle2 size={18}/> {sheetMessage}</div>}
            {dailyScanMessage && <div className={`p-4 mb-4 rounded-xl font-bold text-sm shadow-sm flex gap-2 ${dailyScanMessage.includes('Lỗi') || dailyScanMessage.includes('Thất bại') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}><CheckCircle2 size={18}/> Đơn đi: {dailyScanMessage}</div>}
            {dailySummary && !dailySummary.error && !dailySummary.skipped && (
              <div className="p-4 mb-4 rounded-xl text-sm font-medium bg-slate-50 text-slate-700 border border-slate-200">
                Kết quả quét đơn đi: {dailySummary.total_rows_parsed ?? 0} dòng dữ liệu, khớp {dailySummary.matched ?? 0} đơn (theo ID: {dailySummary.matched_by_id ?? 0}, theo mã vận đơn: {dailySummary.matched_by_carrier ?? 0}), cập nhật {dailySummary.final_unique_updated ?? 0} đơn, không tìm thấy {dailySummary.missing_count ?? dailySummary.skipped_not_found ?? 0} mã, ngày không hợp lệ {dailySummary.skipped_invalid_date ?? 0} dòng.
              </div>
            )}
            {printScanMessage && <div className={`p-4 mb-4 rounded-xl font-bold text-sm shadow-sm flex gap-2 ${printScanMessage.includes('Lỗi') || printScanMessage.includes('Thất bại') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}><CheckCircle2 size={18}/> Đơn in: {printScanMessage}</div>}
            {printSummary && !printSummary.error && !printSummary.skipped && (
              <div className="p-4 mb-6 rounded-xl text-sm font-medium bg-slate-50 text-slate-700 border border-slate-200">
                Kết quả quét đơn in: {printSummary.total_rows_parsed ?? 0} dòng dữ liệu, khớp {printSummary.matched ?? 0} đơn (theo ID: {printSummary.matched_by_id ?? 0}, theo mã vận đơn: {printSummary.matched_by_carrier ?? 0}), cập nhật {printSummary.final_unique_updated ?? 0} đơn, không tìm thấy {printSummary.missing_count ?? printSummary.skipped_not_found ?? 0} mã, ngày không hợp lệ {printSummary.skipped_invalid_date ?? 0} dòng.
              </div>
            )}

            {canEditSensitiveConfig && printSummary && !printSummary.error && !printSummary.skipped && printMissing.length > 0 && (
              <div className="mb-6 bg-white p-5 rounded-2xl border border-amber-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-base font-bold text-slate-800">Log đơn in có trong sheet nhưng database không tìm thấy — {printMissing.length} dòng (chỉ Owner và Super Admin thấy)</h3>
                  <button onClick={downloadPrintMissingCsv} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap">Tải danh sách (CSV)</button>
                </div>
                <p className="text-sm text-slate-500 font-medium mb-3">Bảng hiển thị tối đa 500 dòng đầu, file CSV tải về đủ toàn bộ. Dòng sheet tính từ hàng 1 là tiêu đề.</p>
                <div className="overflow-auto max-h-96 border border-slate-100 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="text-left text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                        <th className="px-4 py-3">Dòng sheet</th>
                        <th className="px-4 py-3">Mã gốc trong sheet</th>
                        <th className="px-4 py-3">Mã chuẩn hóa</th>
                        <th className="px-4 py-3">Ngày trong sheet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printMissing.slice(0, 500).map((m, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-bold">{m.sheet_row}</td>
                          <td className="px-4 py-3 font-medium">{(m.codes || []).map(c => `${c.header}: ${c.raw}`).join(' | ')}</td>
                          <td className="px-4 py-3 font-medium">{(m.codes || []).map(c => c.cleaned).filter(Boolean).join(' | ')}</td>
                          <td className="px-4 py-3">{m.date_raw}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {printSummary.conflicts && printSummary.conflicts.length > 0 && (
                  <p className="mt-3 text-sm font-bold text-amber-700">Cảnh báo xung đột: {printSummary.conflicts.length} dòng có 2 cột mã khớp 2 đơn khác nhau, hệ thống đã ưu tiên cột đứng trước. Kiểm tra lại các dòng này trong file CSV nếu cần — chi tiết xung đột nằm trong phản hồi quét.</p>
                )}
              </div>
            )}
            {canEditSensitiveConfig && printSummary && !printSummary.error && !printSummary.skipped && (printSummary.missing_count ?? 0) > 0 && printMissing.length === 0 && (
              <div className="p-4 mb-6 rounded-xl font-bold text-sm bg-amber-50 text-amber-700 border border-amber-200">Có {printSummary.missing_count} mã không tìm thấy, nhưng backend không trả danh sách chi tiết (có thể do phiên đăng nhập hết hạn hoặc quyền chưa phải Owner/Super Admin). Thử đăng nhập lại rồi quét lại.</div>
            )}

            {canEditSensitiveConfig ? (
              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Link Sheet Đơn Đi (Log)</label>
                            <input type="text" value={sheetDailyUrl} onChange={e => setSheetDailyUrl(e.target.value)} placeholder="https://docs.google.com/..." className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition bg-white"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Mã GID</label>
                            <input type="text" value={sheetDailyGid} onChange={e => setSheetDailyGid(e.target.value)} placeholder="0" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition bg-white"/>
                        </div>
                    </div>
                    {dailyLastScan && <p className="mt-3 text-xs text-slate-500 font-medium">Lần quét đơn đi trước: {new Date(dailyLastScan).toLocaleString('vi-VN')}</p>}
                    {renderSheetMapEditor('daily', dailyMap, setDailyMap)}
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Link Sheet Đơn In (Giao việc)</label>
                            <input type="text" value={sheetPrintUrl} onChange={e => setSheetPrintUrl(e.target.value)} placeholder="https://docs.google.com/..." className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition bg-white"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Mã GID</label>
                            <input type="text" value={sheetPrintGid} onChange={e => setSheetPrintGid(e.target.value)} placeholder="1245667" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition bg-white"/>
                        </div>
                    </div>
                    {printLastScan && <p className="mt-3 text-xs text-slate-500 font-medium">Lần quét đơn in trước: {new Date(printLastScan).toLocaleString('vi-VN')}</p>}
                    {renderSheetMapEditor('print', printMap, setPrintMap)}
                </div>

                <div className="flex justify-end">
                    <button onClick={handleSaveConfig} disabled={syncLoading} className="px-8 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50">
                        Lưu cấu hình liên kết
                    </button>
                </div>
              </div>
            ) : (
              <LockedFeature msg="Chỉ Chủ sở hữu (Owner) hoặc Super Admin mới được quyền thay đổi link Google Sheet đơn in / đơn đi." />
            )}
          </div>

          {/* SECTION 3: ĐỒNG BỘ CỤC BỘ (MANUAL SYNC) */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
              <DownloadCloud size={20} className="text-blue-600"/> Đồng bộ dữ liệu thủ công
            </h2>
            <p className="text-sm text-slate-500 font-medium border-b border-slate-200 pb-6 mb-6">Sử dụng khi Webhook bị lỗi hoặc cần ép hệ thống cập nhật tức thì (Force Sync).</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Đơn hàng */}
              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/60 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-blue-900 mb-1">Đồng bộ Đơn hàng</h3>
                  <p className="text-xs text-blue-700/70 mb-4">Quét các trạng thái đơn hàng bị miss do hệ thống Nhanh quá tải.</p>
                </div>
                <div className="flex items-center gap-3">
                  <select value={syncDays} onChange={e => setSyncDays(e.target.value)} disabled={isSyncingOrder} className="px-4 py-2.5 border border-blue-200 bg-white rounded-xl text-sm font-bold text-blue-900 outline-none focus:ring-2 focus:ring-slate-500/20 cursor-pointer disabled:opacity-50 flex-1">
                    <option value={1}>1 ngày qua</option>
                    <option value={3}>3 ngày qua</option>
                    <option value={7}>7 ngày qua</option>
                    <option value={30}>30 ngày qua</option>
                  </select>
                  <button onClick={handleSyncOrdersData} disabled={isSyncingOrder} className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                    {isSyncingOrder ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />} Kéo
                  </button>
                </div>
                {syncOrderMessage && <p className={`mt-3 text-xs font-bold ${syncOrderStatus === 'error' ? 'text-red-500' : 'text-blue-600'}`}>{syncOrderMessage}</p>}
              </div>

              {/* Hàng hóa */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 mb-1">Sản phẩm & Tồn kho</h3>
                  <p className="text-xs text-slate-500 mb-4">Cập nhật nhanh Tồn kho thực tế hoặc Quét toàn bộ Danh bạ SP.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleSyncInventoryOnly} disabled={isSyncingInventory || isSyncingMaster} className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex justify-center gap-2">
                    {isSyncingInventory ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>} Tồn kho
                  </button>
                  <button onClick={handleSyncMasterData} disabled={isSyncingInventory || isSyncingMaster} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex justify-center gap-2">
                    {isSyncingMaster ? <Loader2 size={16} className="animate-spin"/> : <PackageSearch size={16}/>} Master
                  </button>
                </div>
                {syncProductMessage && <p className="mt-3 text-xs font-bold text-slate-600">{syncProductMessage}</p>}
              </div>

              {/* Trả hàng */}
              <div className="md:col-span-2 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-indigo-900 mb-1 flex items-center gap-2"><RefreshCcw size={16}/> Đồng bộ Đơn Trả Hàng (Returns)</h3>
                  <p className="text-xs text-indigo-700/70">Kéo danh sách hoàn hàng từ Shopee, TikTok, Lazada về hệ thống.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-indigo-900">Từ ngày</span>
                    <input type="date" value={syncReturnsFrom} onChange={e => setSyncReturnsFrom(e.target.value)} className="text-sm border border-indigo-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white" />
                    <span className="text-xs font-bold text-indigo-900">Đến ngày</span>
                    <input type="date" value={syncReturnsTo} onChange={e => setSyncReturnsTo(e.target.value)} className="text-sm border border-indigo-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium bg-white" />
                    <span className="text-xs text-indigo-700/70">Theo ngày cập nhật trên Nhanh, mặc định 30 ngày gần nhất.</span>
                  </div>
                  {syncReturnsMessage.text && <p className={`mt-2 text-xs font-bold ${syncReturnsMessage.type === 'error' ? 'text-red-500' : 'text-indigo-600'}`}>{syncReturnsMessage.text}</p>}
                </div>
                {cleanProgress && (
                <div className="p-4 mb-6 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700">
                  Đã xóa: <strong>{cleanProgress.totalDeleted} dòng</strong> · Số lô: {cleanProgress.rounds}
                  {cleanProgress.remaining && (<span> · Còn lại: đơn hàng {cleanProgress.remaining.orders ?? '?'}, lịch sử {cleanProgress.remaining.order_histories ?? '?'}</span>)}
                </div>
              )}

              {isOwner ? (
                  <button onClick={handleSyncReturns} disabled={isSyncingReturns} className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2 whitespace-nowrap">
                    {isSyncingReturns ? <Loader2 size={16} className="animate-spin"/> : <DownloadCloud size={16}/>} Kéo Hoàn Hàng
                  </button>
                ) : (
                  <div className="text-xs font-bold bg-white text-indigo-400 px-3 py-1.5 rounded border border-indigo-100"><Lock size={12} className="inline mr-1"/> Dành cho Owner</div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: FILTER & PRIORITY */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 pb-4 mb-6 border-b border-slate-200"><Settings size={20} className="text-slate-600"/> Cấu hình Lọc & Ưu tiên Đơn In</h2>
            {filterMessage && <div className="p-4 mb-6 rounded-xl font-bold text-sm bg-slate-50 text-slate-700 border border-slate-200 flex gap-2"><CheckCircle2 size={18}/>{filterMessage}</div>}
            
            <form onSubmit={handleSaveFilter} className="space-y-8">
              {/* Lọc Trạng Thái */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">1. Các trạng thái đơn hiển thị trên App In</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-5 bg-slate-50/50 border border-slate-200 rounded-2xl max-h-64 overflow-y-auto custom-scrollbar">
                  {statusList.map(status => (
                    <label key={status.id} className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition shadow-sm ${filterConfigs.allowed_statuses.includes(String(status.id)) ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input type="checkbox" className="w-4 h-4 cursor-pointer accent-slate-700" checked={filterConfigs.allowed_statuses.includes(String(status.id))} onChange={() => handleStatusToggle(status.id)} />
                      <span className="text-xs font-bold text-slate-700 leading-tight">
                        <span className="text-slate-400 mr-1 opacity-70">[{status.id}]</span><br/>{status.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Sắp xếp ưu tiên */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">2. Thứ tự ưu tiên (Kéo thả để sắp xếp)</label>
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                    <select value={selectedNewPriority} onChange={(e) => setSelectedNewPriority(e.target.value)} className="flex-1 px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-sm outline-none cursor-pointer focus:ring-2 focus:ring-slate-500/20 transition">
                        <option value="">-- Chọn luật ưu tiên để thêm --</option>
                        {dynamicOptions.filter(opt => !priorities.some(p => p.id === opt.id)).map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                    <button type="button" onClick={handleAddPriority} className="bg-white border border-slate-300 text-slate-700 px-8 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 cursor-pointer transition whitespace-nowrap">Thêm luật</button>
                </div>
                
                <div className="space-y-2.5 bg-slate-50/80 p-5 border border-slate-200 rounded-2xl min-h-[120px]">
                  {priorities.length === 0 && <p className="text-slate-400 text-sm font-medium text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">Chưa có luật ưu tiên nào được chọn.</p>}
                  {priorities.map((item, index) => (
                    <div key={item.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, index)}
                      className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-400 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-slate-300">⋮⋮</div>
                        <span className="font-bold text-sm text-slate-700 flex items-center gap-3">
                          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-bold w-6 text-center">{index + 1}</span>
                          {item.label}
                        </span>
                      </div>
                      <button type="button" onClick={() => handleRemovePriority(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg cursor-pointer transition opacity-50 group-hover:opacity-100"><X size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
              
              <button type="submit" disabled={filterLoading} className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-emerald-700 transition cursor-pointer text-sm flex items-center justify-center gap-2">
                {filterLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18}/>} Lưu Cấu hình Lọc & Ưu tiên
              </button>
            </form>
          </div>

          {/* SECTION: CÀI ĐẶT IN (mẫu bill + thông tin người gửi) */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 pb-4 mb-6 border-b border-slate-200"><Printer size={20} className="text-blue-600" /> Cài đặt in</h2>
            {canEditSensitiveConfig ? (
              <PrintSettings />
            ) : (
              <LockedFeature msg="Chỉ Chủ sở hữu (Owner) hoặc Super Admin mới được quyền thay đổi cài đặt in." />
            )}
          </div>

          {/* SECTION 7: DANGER ZONE (DB CLEANUP) */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border-2 border-red-100 mt-8 relative overflow-hidden">
            {/* Background warning pattern */}
                        <div className="relative z-10">
              <h2 className="text-xl font-bold mb-1 text-red-600 flex items-center gap-2">
                <AlertCircle size={22} /> Danger Zone: Dọn dẹp Database
              </h2>
              <p className="text-sm text-slate-500 font-medium max-w-3xl leading-relaxed border-b border-slate-200 pb-6 mb-6">
                Hành động này sẽ <strong className="text-red-500 font-bold">XÓA VĨNH VIỄN</strong> toàn bộ Dữ liệu giao dịch (Đơn hàng, Lịch sử, Hoàn hàng...) cũ hơn thời gian chọn để tiết kiệm dung lượng. Master Data (SP) không bị ảnh hưởng.
              </p>
              
              {/* Progress Bar Storage */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
                    <HardDrive size={16} className="text-slate-400"/> Dung lượng Database
                  </div>
                  <div className="text-xs font-bold text-slate-500 tracking-wide">
                    {formatBytes(dbUsage.used)} / {formatBytes(dbUsage.total, 0)} ({dbUsagePercent}%)
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-2.5 rounded-full transition-all duration-1000 ${barColor}`} style={{width: `${dbUsagePercent}%`}}></div>
                </div>
              </div>

              {cleanMessage.text && (
                <div className={`p-4 mb-6 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm ${
                  cleanMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                  cleanMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 
                  'bg-white border-slate-200 text-slate-700 shadow-lg animate-pulse'
                }`}>
                  {cleanMessage.type === 'success' && <CheckCircle2 size={18} />}
                  {cleanMessage.type === 'error' && <AlertCircle size={18} />}
                  {cleanMessage.type === 'processing' && <Loader2 size={18} className="animate-spin text-red-500" />}
                  {cleanMessage.text}
                </div>
              )}

              {isOwner ? (
                <div className={`transition-all duration-300 p-6 rounded-2xl border ${confirmCleanStep ? 'bg-red-50/80 border-red-300' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chọn mốc thời gian xóa</label>
                      <select 
                        value={cleanDays} 
                        onChange={e => { setCleanDays(e.target.value); setConfirmCleanStep(false); }}
                        disabled={isCleaning || confirmCleanStep}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-100 bg-white disabled:opacity-60 cursor-pointer transition"
                      >
                        <option value="90">Dữ liệu cũ hơn 90 ngày (3 tháng)</option>
                        <option value="180">Dữ liệu cũ hơn 180 ngày (6 tháng)</option>
                        <option value="365">Dữ liệu cũ hơn 365 ngày (1 năm)</option>
                      </select>
                    </div>
                    
                    <div className="w-full sm:w-auto flex gap-2">
                      {confirmCleanStep && (
                        <button onClick={() => setConfirmCleanStep(false)} disabled={isCleaning} className="px-5 py-3 bg-white border border-slate-300 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer">
                          Hủy
                        </button>
                      )}
                      <button 
                        onClick={handleCleanData}
                        disabled={isCleaning}
                        className={`w-full sm:w-auto px-8 py-3 text-sm font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                          confirmCleanStep 
                            ? 'bg-red-600 text-white hover:bg-red-700 ring-4 ring-red-100 animate-pulse' 
                            : 'bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300'
                        }`}
                      >
                        {isCleaning ? <Loader2 size={18} className="animate-spin" /> : confirmCleanStep ? 'Bấm để Xóa Vĩnh Viễn!' : 'Dọn dẹp DB'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <LockedFeature msg="Chỉ Chủ sở hữu (Owner) mới có quyền truy cập dọn dẹp hệ thống Database." />
              )}
            </div>
          </div>

          {/* SECTION 8: BAO TRI (404) - CHI OWNER, AN HAN VOI QUYEN KHAC (GIONG TAB THONG BAO) */}
          {isOwner && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border-2 border-slate-200 mt-8">
            <h2 className="text-xl font-bold mb-1 text-slate-900 flex items-center gap-2">
              <AlertTriangle size={22} className="text-slate-500" /> Bảo trì hệ thống (404)
            </h2>
            <p className="text-sm text-slate-500 mb-4 font-medium max-w-3xl leading-relaxed">
              Khi bật, tất cả mọi người trừ Owner sẽ chỉ thấy màn hình xám 404 Not Found, kể cả trang đăng nhập. Owner vẫn vào web bình thường để tắt lại, và sẽ thấy banner cảnh báo ở trên cùng.
            </p>
            <p className="text-xs font-bold text-red-600 mb-6 border-b border-slate-200 pb-6">
              Lưu ý: nếu Owner đăng xuất trong lúc đang bật bảo trì thì không đăng nhập lại được bằng web, phải tắt bằng Supabase SQL Editor: update system_configs set value = 'false' where key = 'maintenance_mode';
            </p>
            {maintenanceMessage && (
              <div className="p-4 mb-6 rounded-xl font-bold text-sm bg-slate-50 border border-slate-200 text-slate-700">
                {maintenanceMessage}
              </div>
            )}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${maintenanceOn ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {maintenanceOn ? 'Đang bật bảo trì' : 'Đang tắt bảo trì'}
                </span>
                <button
                  onClick={handleToggleMaintenance}
                  disabled={maintenanceLoading}
                  className={`px-8 py-3 text-sm font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 ${maintenanceOn ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-red-600 text-white hover:bg-red-700'}`}
                >
                  {maintenanceLoading ? 'Đang xử lý...' : maintenanceOn ? 'Tắt bảo trì' : 'Bật bảo trì (hiện 404)'}
                </button>
              </div>
          </div>
          )}


        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: QUẢN LÝ TÀI KHOẢN (USERS) */}
      {/* ============================================================== */}
      {activeTab === 'users_management' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Cấp tài khoản mới */}
          <div className="bg-white p-6 sm:p-8 border border-slate-200/80 rounded-2xl shadow-sm h-fit">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-4 mb-6 border-b border-slate-200"><UserPlus size={20} className="text-blue-600" /> Cấp tài khoản mới</h3>
            {isOwner ? (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block mb-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Họ và tên</label>
                  <input type="text" placeholder="Nguyễn Văn A" value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 text-sm font-medium transition bg-slate-50 focus:bg-white" />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Email đăng nhập</label>
                  <input type="email" placeholder="username@gmail.com" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 text-sm font-medium transition bg-slate-50 focus:bg-white" />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Mật khẩu khởi tạo</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} placeholder="••••••" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full pl-4 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 text-sm font-medium transition bg-slate-50 focus:bg-white" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Cấp bậc ban đầu</label>
                  <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 bg-slate-50 text-sm font-bold cursor-pointer transition focus:bg-white">
                    <option value="user">Nhân viên (User)</option>
                    <option value="admin">Quản trị (Admin)</option>
                    <option value="super_admin">Super Admin (Admin + Nhanh / Sheet / Giao diện)</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition cursor-pointer mt-2 flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} Tạo tài khoản
                </button>
              </form>
            ) : (
              <LockedFeature msg="Chỉ Chủ sở hữu (Owner) mới có quyền cấp phát tài khoản nhân sự mới." />
            )}
          </div>

          {/* Bảng Danh Sách */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden lg:col-span-2 flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <span className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-blue-600"/> Danh sách Nhân sự <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{users.length}</span>
              </span>
              <button onClick={fetchSystemUsers} className="text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition">
                <RefreshCcw size={14}/> Refresh
              </button>
            </div>

            {loading && users.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-sm font-bold text-slate-400 gap-3">
                <Loader2 size={32} className="animate-spin text-blue-500" /> Đang tải danh sách...
              </div>
            ) : (
              <div className="overflow-x-auto flex-1 p-2">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3.5 px-4">Họ tên & Email</th>
                      <th className="py-3.5 px-4 text-center">Phân quyền</th>
                      <th className="py-3.5 px-4 text-right">Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {users.map(u => {
                      const uRole = u.user_metadata?.role || 'user';
                      const uName = u.user_metadata?.full_name || 'Chưa cập nhật';
                      const isTargetOwner = u.user_metadata?.is_owner === true || u.email === SUPER_OWNER_EMAIL;
                      const isMe = u.email === currentUserEmail;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors group rounded-xl">
                          <td className="py-3.5 px-4 rounded-l-xl">
                            <div className={`font-bold text-slate-800 flex items-center gap-2 ${isOwner ? 'cursor-pointer hover:text-slate-900' : ''}`} onClick={() => isOwner && fetchUserDetail(u)} title={isOwner ? 'Bấm để xem chi tiết tài khoản' : ''}>
                              {uName} {isMe && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">(Bạn)</span>}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">{u.email}</div>
                            {isUserBanned(u) && <div className="text-xs font-bold text-red-600 mt-0.5">Đã khóa tài khoản</div>}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-3 py-1 border rounded-lg text-xs font-bold uppercase tracking-widest inline-block ${isTargetOwner ? 'bg-amber-50 text-amber-700 border-amber-200' : uRole === 'super_admin' ? 'bg-rose-50 text-rose-700 border-rose-200' : uRole === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {isTargetOwner ? 'Owner' : roleLabel(uRole)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 rounded-r-xl text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isOwner ? (
                                <>
                                  <button onClick={() => handleOpenEditModal(u)} disabled={actionLoadingId === u.id || (isTargetOwner && u.email !== SUPER_OWNER_EMAIL && currentUserEmail !== SUPER_OWNER_EMAIL)} className={`p-2 rounded-lg transition text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer disabled:opacity-30`} title="Chỉnh sửa">
                                    <Pencil size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteUser(u)} disabled={actionLoadingId === u.id || u.email === SUPER_OWNER_EMAIL || isMe} className={`p-2 rounded-lg transition cursor-pointer ${u.email === SUPER_OWNER_EMAIL || isMe ? 'text-slate-200' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`} title="Xóa tài khoản">
                                    {actionLoadingId === u.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                  </button>
                                  <button onClick={() => handleKickUser(u)} disabled={actionLoadingId === u.id || u.email === SUPER_OWNER_EMAIL || isMe} className={`p-2 rounded-lg transition cursor-pointer ${u.email === SUPER_OWNER_EMAIL || isMe ? 'text-slate-200' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`} title="Đá ra khỏi hệ thống">
                                    <LogOut size={16} />
                                  </button>
                                  <button onClick={() => handleBanUser(u, !isUserBanned(u))} disabled={actionLoadingId === u.id || u.email === SUPER_OWNER_EMAIL || isMe} className={`p-2 rounded-lg transition cursor-pointer ${u.email === SUPER_OWNER_EMAIL || isMe ? 'text-slate-200' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`} title={isUserBanned(u) ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}>
                                    <Ban size={16} />
                                  </button>
                                </>
                              ) : (
                                <Lock size={14} className="text-slate-300 mx-auto"/>
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

      {/* MODAL: CHI TIET USER (OWNER ONLY) */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setDetailUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-start bg-slate-50">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{detailUser.user_metadata?.full_name || 'Chưa cập nhật'}</h3>
                <p className="text-sm text-slate-500">{detailUser.email}</p>
              </div>
              <button onClick={() => setDetailUser(null)} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-6">
              {detailLoading && <p className="text-sm text-slate-500 font-medium flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Đang tải chi tiết...</p>}
              {detailMsg && <p className="text-sm font-medium text-slate-700">{detailMsg}</p>}
              {detailData && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleKickUser(detailUser)} disabled={actionLoadingId === detailUser.id} className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"><LogOut size={15} /> Đá ra khỏi hệ thống</button>
                    {isUserBanned(detailData.user) ? (
                      <button onClick={() => handleBanUser(detailUser, false)} disabled={actionLoadingId === detailUser.id} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">Mở khóa tài khoản</button>
                    ) : (
                      <button onClick={() => handleBanUser(detailUser, true)} disabled={actionLoadingId === detailUser.id} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"><Ban size={15} /> Khóa tài khoản</button>
                    )}
                  </div>
                  <section>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 border-b border-slate-200 pb-2">Thông tin</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-sm">
                      <p className="py-1"><span className="text-slate-500">Vai trò: </span><span className="font-bold">{detailData.user.user_metadata?.is_owner ? 'Owner' : roleLabel(detailData.user.user_metadata?.role)}</span></p>
                      <p className="py-1"><span className="text-slate-500">Trạng thái: </span><span className={`font-bold ${isUserBanned(detailData.user) ? 'text-red-600' : 'text-emerald-600'}`}>{isUserBanned(detailData.user) ? 'Đã khóa' : 'Đang hoạt động'}</span></p>
                      <p className="py-1"><span className="text-slate-500">Ngày tạo: </span><span className="font-bold">{detailData.user.created_at ? new Date(detailData.user.created_at).toLocaleString('vi-VN') : 'Chưa có'}</span></p>
                      <p className="py-1"><span className="text-slate-500">Lần cuối đăng nhập: </span><span className="font-bold">{detailData.user.last_sign_in_at ? new Date(detailData.user.last_sign_in_at).toLocaleString('vi-VN') : 'Chưa đăng nhập lần nào'}</span></p>
                    </div>
                  </section>
                  <section>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 border-b border-slate-200 pb-2">Thiết bị đang đăng nhập</h4>
                    {detailData.devices.length === 0 ? (
                      <p className="text-sm text-slate-500">Chưa ghi nhận thiết bị nào (thiết bị chỉ hiện sau khi user mở app bản mới có ghi hiện diện).</p>
                    ) : (
                      <ul className="space-y-2">
                        {detailData.devices.map(d => (
                          <li key={`${d.user_id}-${d.device_id}`} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <div>
                              <p className="font-bold text-slate-800">{shortDeviceName(d.user_agent)}</p>
                              <p className="text-xs text-slate-500">Thấy lần cuối: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('vi-VN') : 'Chưa có'}</p>
                            </div>
                            {isDeviceOnline(d.last_seen_at) ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 shrink-0">Đang online</span> : <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-500 shrink-0">Ngoại tuyến</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-slate-400 mt-2">Online = thiết bị còn mở app trong 10 phút gần nhất.</p>
                  </section>
                  <section>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 border-b border-slate-200 pb-2">Lịch sử đăng nhập (20 gần nhất)</h4>
                    {detailData.logins.length === 0 ? (
                      <p className="text-sm text-slate-500">Chưa có lịch sử (chỉ ghi từ sau khi deploy bản mới).</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {detailData.logins.map(l => (
                          <li key={l.id} className="flex justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <span className="font-medium text-slate-800">{shortDeviceName(l.user_agent)}</span>
                            <span className="text-slate-500 whitespace-nowrap">{l.signed_in_at ? new Date(l.signed_in_at).toLocaleString('vi-VN') : 'Chưa có'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 border-b border-slate-200 pb-2">Thao tác gần nhất (20)</h4>
                    {detailData.actions.length === 0 ? (
                      <p className="text-sm text-slate-500">Chưa có thao tác nào (log chỉ ghi từ sau khi chạy migration và deploy edge mới).</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {detailData.actions.map(a => (
                          <li key={a.id} className="flex flex-wrap justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <span className="font-bold text-slate-800">{ACTION_LABELS[a.action] || a.action}{a.target_id ? ` · Đơn #${a.target_id}` : ''}</span>
                            <span className="text-slate-500">{a.created_at ? new Date(a.created_at).toLocaleString('vi-VN') : ''} · {RESULT_LABELS[a.result] || a.result || ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: NHAT KY THAO TAC (OWNER ONLY) */}
      {/* ============================================================== */}
      {activeTab === 'action_logs' && isOwner && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
            <h2 className="text-xl font-bold text-slate-900">Nhật ký thao tác đơn</h2>
            <p className="text-sm text-slate-500 mt-1">Toàn bộ thao tác Gửi / Sửa / Hủy / In đơn của mọi tài khoản, mới nhất trước.</p>
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200">
              <select value={logFilterUser} onChange={(e) => setLogFilterUser(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white">
                <option value="">Tất cả tài khoản</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
              <select value={logFilterAction} onChange={(e) => setLogFilterAction(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white">
                <option value="">Mọi hành động</option>
                <option value="send">Gửi đơn</option>
                <option value="edit">Sửa đơn</option>
                <option value="cancel">Hủy đơn</option>
                <option value="print">In đơn</option>
              </select>
              <input value={logFilterOrder} onChange={(e) => setLogFilterOrder(e.target.value)} placeholder="Lọc theo mã đơn..." className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none" />
              <button onClick={() => fetchActionLogs(1)} disabled={logsLoading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">Lọc</button>
              <button onClick={() => fetchActionLogs(logPage)} disabled={logsLoading} className="px-3 py-2 bg-white border border-slate-300 text-sm font-bold rounded-lg disabled:opacity-50 flex items-center gap-1"><RefreshCcw size={14} /> Tải lại</button>
            </div>
            {logsLoading && logs.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium py-8 text-center flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> Đang tải nhật ký...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">Chưa có thao tác nào (log chỉ ghi từ sau khi chạy migration và deploy edge mới).</p>
            ) : (
              <>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3.5 px-4">Thời gian</th>
                        <th className="py-3.5 px-4">Tài khoản</th>
                        <th className="py-3.5 px-4">Hành động</th>
                        <th className="py-3.5 px-4">Đơn</th>
                        <th className="py-3.5 px-4">Kết quả</th>
                        <th className="py-3.5 px-4">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {logs.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString('vi-VN') : ''}</td>
                          <td className="py-3.5 px-4">{l.user_email || '—'}</td>
                          <td className="py-3.5 px-4 font-bold">{ACTION_LABELS[l.action] || l.action}</td>
                          <td className="py-3.5 px-4">{l.target_id || '—'}</td>
                          <td className="py-3.5 px-4"><span className={`px-2 py-0.5 rounded text-xs font-bold ${l.result === 'failed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{RESULT_LABELS[l.result] || l.result || '—'}</span></td>
                          <td className="py-3.5 px-4 text-slate-500">{fmtLogDetail(l)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-4 text-sm">
                  <span className="text-slate-500">Tổng {logsTotal} dòng · Trang {logPage} / {Math.max(1, Math.ceil(logsTotal / 50))}</span>
                  <div className="flex gap-2">
                    <button onClick={() => fetchActionLogs(Math.max(1, logPage - 1))} disabled={logsLoading || logPage <= 1} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold disabled:opacity-40">Trước</button>
                    <button onClick={() => fetchActionLogs(logPage + 1)} disabled={logsLoading || logPage * 50 >= logsTotal} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold disabled:opacity-40">Sau</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: HỒ SƠ (PROFILE) */}
      {/* ============================================================== */}
      {activeTab === 'profile' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-slate-200 pb-8 mb-8">
              <div className="w-24 h-24 bg-gradient-to-tr from-blue-100 to-indigo-50 border-4 border-white shadow-lg text-blue-600 rounded-full flex items-center justify-center relative">
                <User size={40} />
                {isOwner && <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white p-1.5 rounded-full border-2 border-white"><ShieldAlert size={14}/></div>}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-bold text-slate-800">{currentUserMeta.full_name || 'Chưa cập nhật tên'}</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">{currentUserEmail}</p>
                <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
                  <span className={`px-3 py-1 border rounded-lg text-xs font-bold uppercase tracking-widest ${currentUserMeta.role === 'super_admin' ? 'bg-rose-50 text-rose-700 border-rose-200' : currentUserMeta.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {`Quyền: ${roleLabel(currentUserMeta.role)}`}
                  </span>
                  {isOwner && <span className="px-3 py-1 border rounded-lg text-xs font-bold uppercase tracking-widest bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 shadow-sm"><ShieldAlert size={12} /> Cấp cao nhất (Owner)</span>}
                </div>
              </div>
            </div>

            {profileMessage && <div className={`p-4 mb-8 rounded-xl font-bold text-sm flex gap-2 shadow-sm ${profileMessage.includes('') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}><CheckCircle2 size={18} className="flex-shrink-0"/> {profileMessage}</div>}

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Họ và tên hiển thị</label>
                <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition bg-slate-50 focus:bg-white" placeholder="Nhập tên..." />
              </div>
              
              <div className="pt-6 border-t border-slate-100 space-y-6">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><KeyRound size={16} className="text-slate-400"/> Đổi mật khẩu</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu hiện tại</label>
                      <div className="relative">
                        <input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full pl-4 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition bg-slate-50 focus:bg-white" placeholder="Bắt buộc nếu muốn đổi..." />
                        <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">
                          {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu mới</label>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} className="w-full pl-4 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 font-medium transition bg-slate-50 focus:bg-white" placeholder="Bỏ trống nếu không đổi..." />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
              </div>

              <div className="pt-8">
                <button type="submit" disabled={profileLoading} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm cursor-pointer">
                  {profileLoading ? <Loader2 size={18} className="animate-spin" /> : <SaveIcon/>} Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT USER */}
      {/* ============================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Pencil size={18}/></div>
                  <h3 className="text-lg font-bold text-slate-800">Hiệu chỉnh User</h3>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"><X size={20} /></button>
              </div>

              <form onSubmit={handleSaveEditedInfo} className="space-y-5">
                <div>
                  <label className="block mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Email (Cố định)</label>
                  <input type="text" value={editingUser.email} disabled className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 font-medium outline-none cursor-not-allowed" />
                </div>
                
                <div>
                  <label className="block mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Họ và Tên</label>
                  <input 
                    type="text" 
                    value={editForm.fullName} 
                    onChange={e => setEditForm({...editForm, fullName: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 transition font-medium" 
                    disabled={editingUser.email === SUPER_OWNER_EMAIL && currentUserEmail !== SUPER_OWNER_EMAIL}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Cấp bậc</label>
                  <select 
                    value={editForm.role} 
                    onChange={e => setEditForm({...editForm, role: e.target.value})}
                    disabled={!isOwner || (editingUser.user_metadata?.is_owner === true)} 
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-700 transition font-bold bg-white disabled:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <option value="user">Nhân viên (User)</option>
                    <option value="admin">Quản trị (Admin)</option>
                    <option value="super_admin">Super Admin (Admin + Nhanh / Sheet / Giao diện)</option>
                  </select>
                </div>
                
                {/* VÙNG NÂNG CẤP/HẠ CẤP OWNER */}
                {isOwner && editingUser.email !== SUPER_OWNER_EMAIL && (() => {
                  const isTargetOwner = editingUser.user_metadata?.is_owner === true;
                  if (editForm.role !== 'admin' && editForm.role !== 'super_admin' && !isTargetOwner) return null;

                  return (
                    <div className={`mt-6 p-5 rounded-2xl space-y-4 border ${isTargetOwner ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isTargetOwner ? 'text-red-800' : 'text-amber-800'}`}>
                            <ShieldAlert size={16}/> {isTargetOwner ? 'Hạ cấp Owner' : 'Nâng cấp Owner'}
                          </h4>
                          <p className={`text-xs font-medium mt-1 leading-relaxed ${isTargetOwner ? 'text-red-700/70' : 'text-amber-700/70'}`}>
                            {isTargetOwner ? 'Thu hồi quyền cao nhất.' : 'Cấp toàn quyền hệ thống. Cẩn thận!'}
                          </p>
                        </div>
                        <button type="button" onClick={() => setShowUpgradeConfirm(!showUpgradeConfirm)} className={`text-xs bg-white border px-3 py-1.5 rounded-lg shadow-sm font-bold whitespace-nowrap cursor-pointer transition ${isTargetOwner ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-amber-300 text-amber-700 hover:bg-amber-50'}`}>
                          {showUpgradeConfirm ? 'Hủy' : (isTargetOwner ? 'Gỡ quyền' : 'Mở khóa')}
                        </button>
                      </div>
                      
                      {showUpgradeConfirm && (
                        <div className={`pt-4 border-t animate-in slide-in-from-top-2 ${isTargetOwner ? 'border-red-200' : 'border-amber-200'}`}>
                          <input 
                            type="password" 
                            value={upgradePassword}
                            onChange={(e) => setUpgradePassword(e.target.value)}
                            className={`w-full px-4 py-2.5 border rounded-xl outline-none text-sm font-medium bg-white transition shadow-sm ${isTargetOwner ? 'border-red-300 focus:ring-red-200' : 'border-amber-300 focus:ring-amber-200'}`} 
                            placeholder="Nhập mật khẩu của BẠN..."
                          />
                          <button type="button" onClick={(e) => handleToggleOwnerStatus(e, !isTargetOwner)} disabled={loading} className={`mt-3 w-full text-white py-2.5 rounded-xl shadow-md transition font-bold text-sm flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 ${isTargetOwner ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16}/>} {isTargetOwner ? 'Xác nhận Hạ Cấp' : 'Cấp quyền Owner'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </form>
            </div>
            
            <div className="bg-slate-50 p-6 flex justify-end gap-3 border-t border-slate-100">
              <button type="button" onClick={() => setEditingUser(null)} className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm font-bold transition cursor-pointer">Hủy</button>
              <button type="button" onClick={handleSaveEditedInfo} disabled={loading} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <SaveIcon/>} Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CUSTOM DIALOG RENDERER */}
      {/* ============================================================== */}
      {dialogConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${dialogConfig.type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                {dialogConfig.type === 'confirm' ? <AlertTriangle size={32} /> : <Info size={32} />}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{dialogConfig.title}</h3>
              <p className="text-sm font-medium text-slate-600 mb-6 px-2">{dialogConfig.message}</p>
              <div className="flex gap-3 justify-center">
                {dialogConfig.type === 'confirm' && (
                  <button onClick={dialogConfig.onCancel} className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition cursor-pointer">
                    Hủy
                  </button>
                )}
                <button 
                  onClick={dialogConfig.onConfirm} 
                  className={`px-6 py-2.5 text-white font-bold rounded-xl transition cursor-pointer ${dialogConfig.type === 'confirm' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-700 hover:bg-slate-800'}`}
                >
                  {dialogConfig.type === 'confirm' ? 'Xác nhận' : 'Đã hiểu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// UI Helper Components
const SaveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;

const LockedFeature = ({ msg }) => (
  <div className="p-5 sm:p-6 bg-slate-50/80 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-slate-500 text-center sm:text-left">
    <div className="p-3 bg-white rounded-full shadow-sm"><Lock size={24} className="text-slate-400" /></div>
    <div>
      <p className="text-sm font-bold text-slate-700">Tính năng giới hạn</p>
      <p className="text-xs font-medium mt-1 leading-relaxed">{msg}</p>
    </div>
  </div>
);

const ToggleSwitch = ({ checked, onChange, color, small = false }) => (
  <div className="relative inline-flex items-center cursor-pointer" onClick={() => onChange(!checked)}>
    <div className={`${small ? 'w-9 h-5' : 'w-11 h-6'} rounded-full transition-colors ${checked ? color : 'bg-slate-200'}`}></div>
    <div className={`absolute bg-white border border-slate-200 rounded-full transition-transform ${small ? 'w-4 h-4 top-0.5 left-0.5' : 'w-5 h-5 top-0.5 left-0.5'} ${checked ? (small ? 'translate-x-4' : 'translate-x-5') : ''} shadow-sm`}></div>
  </div>
);