import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { isAdminRole } from '../lib/roles';
import { 
  ScanBarcode, Calendar, Trash2, PackagePlus, PackageMinus, AlertCircle, 
  CheckCircle2, XCircle, CheckCircle, Download, Camera, CameraOff, 
  RefreshCw, List, Plus, ChevronLeft, Clock, Search, Filter, Info,
  Store, Eye
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const STATUS_MAP = {
  40: 'Đã đóng gói', 42: 'Đang đóng gói', 43: 'Chờ thu gom',
  54: 'Đơn mới', 55: 'Đang xác nhận', 56: 'Đã xác nhận',
  57: 'Chờ khách xác nhận', 58: 'Hãng vận chuyển hủy đơn',
  59: 'Đang chuyển', 60: 'Thành công', 61: 'Thất bại',
  63: 'Khách hủy', 64: 'Hệ thống hủy', 68: 'Hết hàng',
  71: 'Đang chuyển hoàn', 72: 'Đã chuyển hoàn', 73: 'Đổi kho xuất hàng', 74: 'Xác nhận hoàn'
};

const EXCLUDED_STATUS_CODES = [40, 43, 59, 60, 61, 71, 72, 74];
const CANCELED_STATUS_CODES = [58, 63, 64];

// ==========================================
// MAPPING KÊNH BÁN (SALE CHANNELS)
// ==========================================
const SALE_CHANNEL_MAP = {
  1: { name: 'Admin', style: 'bg-slate-100 text-slate-700 border-slate-300' },
  42: { name: 'Shopee', style: 'bg-orange-100 text-orange-700 border-orange-300' },
  48: { name: 'TikTok', style: 'bg-zinc-800 text-white border-zinc-900' },
};

const getChannelBadge = (channelId) => {
  if (channelId === null || channelId === undefined) return null;
  const channel = SALE_CHANNEL_MAP[channelId] || { name: `Kênh ${channelId}`, style: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${channel.style} flex items-center gap-1 w-fit`}>
      <Store size={10} /> {channel.name}
    </span>
  );
};

// Hàm chuẩn hóa để tương thích cả dữ liệu mới (lưu chuỗi ID) và dữ liệu cũ (lưu object)
const extractOrderId = (item) => (typeof item === 'object' && item !== null ? item.id : item);

export default function OrderReconciliation() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getWeekAgoStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  };
  
  const [currentUserMeta, setCurrentUserMeta] = useState({});
  const [view, setView] = useState('list');
  
  // ==========================================
  // CUSTOM DIALOG STATE
  // ==========================================
  const [dialogConfig, setDialogConfig] = useState({
    isOpen: false,
    type: 'alert', // 'alert' | 'confirm'
    title: '',
    message: '',
    onConfirm: null
  });

  const showDialog = (type, title, message, onConfirm = null) => {
    setDialogConfig({ isOpen: true, type, title, message, onConfirm });
  };
  const closeDialog = () => setDialogConfig({ ...dialogConfig, isOpen: false });

  // ==========================================
  // SESSIONS & FILTER STATE
  // ==========================================
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [newAuditDate, setNewAuditDate] = useState(getTodayStr());
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Phân trang & Lọc
  const [filterStartDate, setFilterStartDate] = useState(getWeekAgoStr());
  const [filterEndDate, setFilterEndDate] = useState(getTodayStr());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 10;

  // AUDIT STATE
  const [inputCode, setInputCode] = useState('');
  const [todayOrders, setTodayOrders] = useState([]);
  const [scannedCodes, setScannedCodes] = useState([]);
  const [surplusOrders, setSurplusOrders] = useState([]); 
  
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertBanner, setAlertBanner] = useState(null);

  // LAZY LOAD DETAILS STATE (Cho biên bản đã chốt)
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailedOrdersMap, setDetailedOrdersMap] = useState({});

  // CAMERA & POPUP STATE
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState(''); 
  const scannerRef = useRef(null);
  const cameraContainerRef = useRef(null);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [duplicateCode, setDuplicateCode] = useState('');

  const inputRef = useRef(null);
  const audioCtxRef = useRef(null); 
  const lastKeyTimeRef = useRef(Date.now());

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata || {};
        const displayName = meta.full_name || meta.name || user.email?.split('@')[0] || 'Nhân viên';
        setCurrentUserMeta({ ...meta, displayName });
      }
    };
    loadUser();
  }, []);

  const isAdminOrOwner = currentUserMeta.is_owner === true || isAdminRole(currentUserMeta.role);

  // ==========================================
  // QUẢN LÝ PHIÊN (SESSIONS) VỚI PHÂN TRANG
  // ==========================================
  const fetchSessions = async (isLoadMore = false) => {
    setLoadingSessions(true);
    try {
      const currentPage = isLoadMore ? page + 1 : 1;
      const from = (currentPage - 1) * LIMIT;
      const to = from + LIMIT - 1;

      // Chỉ lấy các trường meta & số lượng, không tải các cột JSONB nặng ở danh sách
      const { data, error, count } = await supabase
        .from('reconciliation_sessions')
        .select('id, session_name, audit_date, status, created_at, completed_at, total_printed, total_expected, total_canceled, total_scanned, total_missing, total_surplus', { count: 'exact' })
        .gte('audit_date', filterStartDate)
        .lte('audit_date', filterEndDate)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      if (isLoadMore) {
        setSessions(prev => [...prev, ...data]);
      } else {
        setSessions(data || []);
      }
      
      setPage(currentPage);
      setHasMore(count > to + 1);
    } catch (err) {
      console.error("Lỗi tải danh sách biên bản:", err.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (view === 'list') fetchSessions(false);
  }, [view, filterStartDate, filterEndDate]);

  const handleCreateSession = async () => {
    const sessionName = `Biên bản - ${currentUserMeta.displayName || 'Hệ thống'} - ${new Date().toLocaleString('vi-VN')}`;
    try {
      const { data, error } = await supabase.from('reconciliation_sessions').insert([{
        session_name: sessionName,
        audit_date: newAuditDate,
        status: 'draft',
        scanned_codes: [],
        surplus_orders: []
      }]).select().single();

      if (error) throw error;
      handleOpenSession(data);
    } catch (err) {
      showDialog('alert', 'Lỗi tạo biên bản', "Lỗi tạo biên bản mới: " + err.message);
    }
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    showDialog(
      'confirm', 
      'Xác nhận xóa', 
      'CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn biên bản này không?',
      async () => {
        try {
          const { error } = await supabase.from('reconciliation_sessions').delete().eq('id', sessionId);
          if (error) throw error;
          fetchSessions(false); 
        } catch (err) {
          showDialog('alert', 'Lỗi', "Lỗi khi xóa biên bản: " + err.message);
        }
      }
    );
  };

  const handleOpenSession = async (sessionSummary) => {
    setView('audit');
    setIsDetailsVisible(false);
    setDetailedOrdersMap({});
    setAlertBanner(null);

    const isCompleted = sessionSummary.status === 'completed';
    setIsConfirmed(isCompleted);
    setCurrentSession(sessionSummary);

    if (!isCompleted) {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('reconciliation_sessions')
          .select('*')
          .eq('id', sessionSummary.id)
          .single();

        if (error) throw error;
        setCurrentSession(data);
        setScannedCodes(data.scanned_codes || []);

        // Nếu biên bản nháp đang có đơn thừa chỉ lưu ID, truy vấn lại thông tin từ bảng orders
        const rawSurplus = data.surplus_orders || [];
        if (rawSurplus.length > 0 && typeof rawSurplus[0] === 'string') {
          const { data: surplusData } = await supabase
            .from('orders')
            .select('id, carrier_code, status, sale_channel, order_products (product_code, product_name, quantity)')
            .in('id', rawSurplus);
          
          const foundMap = {};
          (surplusData || []).forEach(o => { foundMap[o.id] = o; });
          setSurplusOrders(rawSurplus.map(id => foundMap[id] || { id, carrier_code: 'Không rõ', status: 'Mã vạch lạ hoắc', sale_channel: null, order_products: [] }));
        } else {
          setSurplusOrders(rawSurplus);
        }
      } catch (err) {
        console.error("Lỗi tải chi tiết phiên nháp:", err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Biên bản đã chốt: Chỉ hiển thị số lượng trước, chưa tải danh sách ID hay chi tiết đơn
      setScannedCodes([]);
      setSurplusOrders([]);
    }
  };

  // ==========================================
  // HÀM TẢI DỮ LIỆU CHI TIẾT KHI BẤM NÚT XEM
  // ==========================================
  const handleLoadConfirmedDetails = async () => {
    if (!currentSession) return null;
    setIsLoadingDetails(true);
    try {
      let sessionData = currentSession;
      // Nếu chưa có mảng ID từ database thì mới tải về
      if (!sessionData.expected_correct || !sessionData.scanned_codes) {
        const { data, error } = await supabase
          .from('reconciliation_sessions')
          .select('scanned_codes, surplus_orders, expected_correct, expected_canceled, missing_orders')
          .eq('id', currentSession.id)
          .single();

        if (error) throw error;
        sessionData = { ...currentSession, ...data };
        setCurrentSession(sessionData);
      }

      setScannedCodes(sessionData.scanned_codes || []);

      const correctIds = (sessionData.expected_correct || []).map(extractOrderId).filter(Boolean);
      const canceledIds = (sessionData.expected_canceled || []).map(extractOrderId).filter(Boolean);
      const missingIds = (sessionData.missing_orders || []).map(extractOrderId).filter(Boolean);
      const surplusIds = (sessionData.surplus_orders || []).map(extractOrderId).filter(Boolean);

      const allOrderIds = Array.from(new Set([...correctIds, ...canceledIds, ...missingIds, ...surplusIds]));

      const ordersMap = {};
      if (allOrderIds.length > 0) {
        // Chia nhỏ batch 200 ID để đảm bảo an toàn với giới hạn URL của Supabase
        const chunkSize = 200;
        for (let i = 0; i < allOrderIds.length; i += chunkSize) {
          const chunk = allOrderIds.slice(i, i + chunkSize);
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select(`
              id, created_at, carrier_code, status, printed_at, packed_at, carrier_date, sale_channel,
              order_products (product_code, product_name, quantity)
            `)
            .in('id', chunk);

          if (ordersError) throw ordersError;
          (ordersData || []).forEach(order => {
            ordersMap[order.id] = order;
          });
        }
      }

      setDetailedOrdersMap(ordersMap);
      setIsDetailsVisible(true);
      return { sessionData, ordersMap };
    } catch (err) {
      showDialog('alert', 'Lỗi tải chi tiết', 'Không thể tải dữ liệu chi tiết: ' + err.message);
      return null;
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleBackToList = () => {
    if (isCameraOpen) stopCamera();
    setView('list');
    setCurrentSession(null);
    setAlertBanner(null);
    setIsDetailsVisible(false);
    setDetailedOrdersMap({});
  };

  // ==========================================
  // LOGIC ĐỐI SOÁT
  // ==========================================
  const fetchTodayOrders = async () => {
    if (!currentSession || currentSession.status === 'completed') return;
    setLoading(true);
    try {
      const startOfDay = new Date(`${currentSession.audit_date}T00:00:00`).toISOString();
      const endOfDay = new Date(`${currentSession.audit_date}T23:59:59.999`).toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, carrier_code, status, printed_at, packed_at, carrier_date, sale_channel,
          order_products (product_code, product_name, quantity)
        `)
        .gte('printed_at', startOfDay)
        .lte('printed_at', endOfDay);

      if (error) throw error;
      setTodayOrders(data || []);
    } catch (err) {
      console.error(" Lỗi tải đơn hàng đối soát:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'audit' && currentSession?.id && currentSession?.status !== 'completed') {
      fetchTodayOrders();
    }
  }, [view, currentSession?.id, currentSession?.status]);

  useEffect(() => {
    if (inputRef.current && !isCameraOpen && view === 'audit' && !isConfirmed && !dialogConfig.isOpen) {
      inputRef.current.focus();
    }
  }, [scannedCodes, inputCode, alertBanner, isCameraOpen, view, isConfirmed, dialogConfig.isOpen]);

  const isScanned = (order) => {
    if (!order) return false;
    return scannedCodes.includes(order.id) || (order.carrier_code && scannedCodes.includes(order.carrier_code));
  };

  // Map từ ID sang thông tin chi tiết đơn hàng trong Database
  const resolveOrderFromMap = (item, mapSource = detailedOrdersMap) => {
    const id = extractOrderId(item);
    if (mapSource[id]) return mapSource[id];
    if (typeof item === 'object' && item !== null) return item;
    return { id, carrier_code: '---', status: 'Không tìm thấy trong CSDL', sale_channel: null, order_products: [] };
  };

  const expectedCorrect = isConfirmed 
    ? (isDetailsVisible ? (currentSession?.expected_correct || []).map(item => resolveOrderFromMap(item)) : [])
    : todayOrders.filter(o => !EXCLUDED_STATUS_CODES.includes(Number(o.status)) && !CANCELED_STATUS_CODES.includes(Number(o.status)));
      
  const expectedCanceled = isConfirmed 
    ? (isDetailsVisible ? (currentSession?.expected_canceled || []).map(item => resolveOrderFromMap(item)) : [])
    : todayOrders.filter(o => CANCELED_STATUS_CODES.includes(Number(o.status)));

  const missingCorrect = expectedCorrect.filter(o => !isScanned(o));
  const missingCanceled = expectedCanceled.filter(o => !isScanned(o));

  const allMissing = isConfirmed 
    ? (isDetailsVisible ? (currentSession?.missing_orders || []).map(item => resolveOrderFromMap(item)) : [])
    : [...missingCorrect, ...missingCanceled];

  const resolvedSurplusOrders = isConfirmed
    ? (isDetailsVisible ? (currentSession?.surplus_orders || []).map(item => resolveOrderFromMap(item)) : [])
    : surplusOrders;

  // Số liệu thống kê hiển thị trên 5 thẻ (Hỗ trợ hiển thị ngay lập tức khi mở biên bản đã chốt mà không cần tải chi tiết)
  const totalPrintedCount = isConfirmed ? (currentSession?.total_printed ?? 0) : todayOrders.length;
  const totalExpectedCount = isConfirmed ? (currentSession?.total_expected ?? 0) : expectedCorrect.length;
  const totalCanceledCount = isConfirmed ? (currentSession?.total_canceled ?? 0) : expectedCanceled.length;
  const totalSurplusCount = isConfirmed ? (currentSession?.total_surplus ?? 0) : surplusOrders.length;
  const totalMissingCount = isConfirmed ? (currentSession?.total_missing ?? 0) : allMissing.length;

  const scannedCorrectCount = isConfirmed && !isDetailsVisible
    ? Math.max(0, totalExpectedCount + totalCanceledCount - totalMissingCount)
    : expectedCorrect.filter(o => isScanned(o)).length;

  const scannedCanceledCount = isConfirmed && !isDetailsVisible
    ? null
    : expectedCanceled.filter(o => isScanned(o)).length;

  const playSound = (type) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.value = 880; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'error') {
        osc.frequency.value = 330; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {}
  };

  const processBarcode = useCallback(async (code) => {
    if (!code || isConfirmed || dialogConfig.isOpen) return;

    if (scannedCodes.includes(code)) {
      setDuplicateCode(code);
      setShowDuplicatePopup(true);
      playSound('error');
      setInputCode('');
      return;
    }

    setAlertBanner(null);
    playSound('success');

    const matchedOrder = todayOrders.find(o => o.id === code || o.carrier_code === code);

    if (matchedOrder) {
      const statusCode = Number(matchedOrder.status);
      if (CANCELED_STATUS_CODES.includes(statusCode)) {
        setAlertBanner({ type: 'danger', message: ` ĐƠN HÀNG HỦY! Mã ${matchedOrder.id} đã bị [${STATUS_MAP[statusCode]}]. Lọc ra rã hàng ngay!` });
      } else if (EXCLUDED_STATUS_CODES.includes(statusCode)) {
        setSurplusOrders(prev => [...prev, matchedOrder]);
        setAlertBanner({ type: 'warning', message: `️ ĐƠN ĐÃ ĐÓNG GÓI RỒI! Mã ${matchedOrder.id} bị in nhầm.` });
      }
      setScannedCodes(prev => [...prev, code]);
    } else {
      const { data } = await supabase
        .from('orders')
        .select(`id, carrier_code, status, sale_channel, order_products (product_code, product_name, quantity)`)
        .or(`id.eq.${code},carrier_code.eq.${code}`)
        .maybeSingle();

      if (data) {
        setSurplusOrders(prev => [...prev, data]);
        if (CANCELED_STATUS_CODES.includes(Number(data.status))) {
          setAlertBanner({ type: 'danger', message: ` ĐƠN HỦY LẠC NGÀY KHÁC! Mã ${data.id} báo hủy. Thu hồi ngay!` });
        }
      } else {
        setSurplusOrders(prev => [...prev, { id: code, carrier_code: 'Không rõ', status: 'Mã vạch lạ hoắc', sale_channel: null, order_products: [] }]);
      }
      setScannedCodes(prev => [...prev, code]);
    }
    
    setInputCode('');
  }, [scannedCodes, todayOrders, isConfirmed, dialogConfig.isOpen]);

  const handleBarcodeSubmit = (e) => { e.preventDefault(); processBarcode(inputCode.trim()); };

  // ==========================================
  // CHỐNG NHẬP TAY / COPY PASTE
  // ==========================================
  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') return; 
    
    const currentTime = Date.now();
    if (currentTime - lastKeyTimeRef.current > 50) {
      setInputCode('');
    }
    lastKeyTimeRef.current = currentTime;
  };

  const handlePasteDropBlock = (e) => {
    e.preventDefault();
    showDialog('alert', 'Cảnh báo', 'Không được copy dán. Vui lòng sử dụng súng bắn mã vạch!');
  };

  // ==========================================
  // LƯU LOG PHIÊN (CHỈ LƯU SỐ LƯỢNG + MẢNG ID ĐƠN)
  // ==========================================
  const handleConfirmSession = async () => {
    setLoading(true);
    try {
      // Chỉ lưu mảng ID đơn hàng thay vì lưu toàn bộ thông tin sàn, sản phẩm...
      const expectedCorrectIds = expectedCorrect.map(o => o.id);
      const expectedCanceledIds = expectedCanceled.map(o => o.id);
      const missingOrderIds = allMissing.map(o => o.id);
      const surplusOrderIds = surplusOrders.map(o => o.id);

      const updates = {
        status: 'completed', 
        completed_at: new Date().toISOString(),
        total_printed: totalPrintedCount, 
        total_expected: expectedCorrectIds.length,
        total_canceled: expectedCanceledIds.length, 
        total_scanned: scannedCodes.length,
        total_missing: missingOrderIds.length, 
        total_surplus: surplusOrderIds.length,
        scanned_codes: scannedCodes, 
        surplus_orders: surplusOrderIds,
        expected_correct: expectedCorrectIds, 
        expected_canceled: expectedCanceledIds, 
        missing_orders: missingOrderIds
      };

      const { error } = await supabase.from('reconciliation_sessions').update(updates).eq('id', currentSession.id);
      if (error) throw error;

      // Chuyển dữ liệu đang có sẵn trên RAM vào map để nếu bấm "Xem chi tiết" ngay thì không cần tải lại
      const currentMemoryMap = {};
      todayOrders.forEach(o => { currentMemoryMap[o.id] = o; });
      surplusOrders.forEach(o => { currentMemoryMap[o.id] = o; });
      setDetailedOrdersMap(currentMemoryMap);
      
      setIsConfirmed(true);
      setIsDetailsVisible(false); // Ẩn chi tiết sau khi chốt, chỉ hiện số lượng và nút "Xem dữ liệu chi tiết"
      setCurrentSession(prev => ({ ...prev, ...updates }));
      setAlertBanner({ type: 'success', message: ' Đã chốt và lưu gọn lịch sử đối soát (Số lượng + ID đơn) thành công!' });
    } catch (err) {
      showDialog('alert', 'Lỗi', "Lỗi khi chốt biên bản: " + err.message);
      setIsConfirmed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAudit = () => {
    showDialog(
      'confirm',
      'Quét lại từ đầu',
      'Xác nhận quét lại từ đầu? Lịch sử quét và biên bản hiện tại sẽ bị xóa sạch.',
      async () => {
        setScannedCodes([]); setSurplusOrders([]); setIsConfirmed(false);
        setIsDetailsVisible(false); setDetailedOrdersMap({});
        setAlertBanner(null); setShowDuplicatePopup(false);
        if (isCameraOpen) stopCamera();
        
        const resetData = {
          status: 'draft', scanned_codes: [], surplus_orders: [], completed_at: null,
          expected_correct: [], expected_canceled: [], missing_orders: []
        };

        await supabase.from('reconciliation_sessions').update(resetData).eq('id', currentSession.id);
        setCurrentSession(prev => ({ ...prev, ...resetData }));
      }
    );
  };

  const handleExportExcel = async () => {
    let ordersToExport = [...expectedCorrect, ...expectedCanceled];
    let activeScannedCodes = scannedCodes;

    // Nếu biên bản đã chốt nhưng người dùng chưa bấm "Xem dữ liệu chi tiết", tự động tải dữ liệu trước khi xuất Excel
    if (isConfirmed && !isDetailsVisible) {
      const loaded = await handleLoadConfirmedDetails();
      if (!loaded) return;
      const { sessionData, ordersMap } = loaded;
      activeScannedCodes = sessionData.scanned_codes || [];
      const correctList = (sessionData.expected_correct || []).map(item => resolveOrderFromMap(item, ordersMap));
      const canceledList = (sessionData.expected_canceled || []).map(item => resolveOrderFromMap(item, ordersMap));
      ordersToExport = [...correctList, ...canceledList];
    }

    if (ordersToExport.length === 0) {
      showDialog('alert', 'Trống', 'Không có đơn nào để xuất Excel!');
      return;
    }

    const checkScannedForExport = (order) => activeScannedCodes.includes(order.id) || (order.carrier_code && activeScannedCodes.includes(order.carrier_code));

    let csvContent = "\uFEFFMã Đơn Hàng (ID),Kênh Bán,Mã Vận Đơn,Trạng Thái Sàn,Đã Trả/Chưa Trả,Mã Sản Phẩm,Tên Sản Phẩm,Số Lượng\n";
    ordersToExport.forEach(order => {
      const carrierCode = order.carrier_code || '---';
      const statusText = STATUS_MAP[order.status] || (order.status ? String(order.status) : '---');
      const scannedStatus = checkScannedForExport(order) ? "Đã trả lại" : "Chưa trả lại";
      const channelName = order.sale_channel ? (SALE_CHANNEL_MAP[order.sale_channel]?.name || `Kênh ${order.sale_channel}`) : '---';

      if (order.order_products && order.order_products.length > 0) {
        order.order_products.forEach(p => { 
          csvContent += `"${order.id}","${channelName}","${carrierCode}","${statusText}","${scannedStatus}","${p.product_code || '---'}","${p.product_name}","${p.quantity}"\n`; 
        });
      } else {
        csvContent += `"${order.id}","${channelName}","${carrierCode}","${statusText}","${scannedStatus}","---","Đơn trống sản phẩm","0"\n`;
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_Doi_Soat_${currentSession.audit_date}.csv`;
    link.click();
  };

  // CAMERA UTILS
  const closeDuplicatePopup = () => { setShowDuplicatePopup(false); setDuplicateCode(''); };
  const startCamera = async () => {
    setCameraErrorMsg(''); setIsCameraOpen(true);
    try {
      const html5QrCode = new Html5Qrcode("camera-container");
      scannerRef.current = html5QrCode;
      await html5QrCode.start( { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => processBarcode(decodedText), () => {}
      );
    } catch (err) {
      setCameraErrorMsg('Không thể truy cập camera.'); setIsCameraOpen(false);
    }
  };
  const stopCamera = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch (e) {}
      scannerRef.current = null;
    }
    setIsCameraOpen(false); setCameraErrorMsg('');
  };

  useEffect(() => {
    if (showDuplicatePopup && scannerRef.current && isCameraOpen) scannerRef.current.pause();
    else if (!showDuplicatePopup && scannerRef.current && isCameraOpen) scannerRef.current.resume();
  }, [showDuplicatePopup, isCameraOpen]);

  useEffect(() => { return () => { if (scannerRef.current) scannerRef.current.stop().catch(()=>{}); }; }, []);
  const handleToggleCamera = () => { if (isCameraOpen) stopCamera(); else startCamera(); };

  // ==========================================
  // RENDER: VIEW DANH SÁCH PHIÊN
  // ==========================================
  if (view === 'list') {
    return (
      <div className="space-y-6 pb-10 px-2 sm:px-0 relative">
        {/* Custom Dialog Render */}
        {dialogConfig.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-5 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 text-slate-800">
                {dialogConfig.type === 'confirm' ? <AlertCircle className="text-blue-500" size={24}/> : <Info className="text-amber-500" size={24}/>}
                <h3 className="text-lg font-bold">{dialogConfig.title}</h3>
              </div>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">{dialogConfig.message}</p>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeDialog} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition">
                  {dialogConfig.type === 'confirm' ? 'Hủy bỏ' : 'Đóng'}
                </button>
                {dialogConfig.type === 'confirm' && (
                  <button 
                    onClick={() => { dialogConfig.onConfirm && dialogConfig.onConfirm(); closeDialog(); }} 
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition"
                  >
                    Xác nhận
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><List size={20} /></span>
              QUẢN LÝ BIÊN BẢN ĐỐI SOÁT
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">Tạo biên bản mới hoặc chọn biên bản cũ để tiếp tục làm việc</p>
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-end p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày dữ liệu đơn in cần đối soát mới</label>
              <input type="date" value={newAuditDate} onChange={e => setNewAuditDate(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-blue-500" />
            </div>
            <button onClick={handleCreateSession} className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-sm transition flex items-center justify-center gap-2">
              <Plus size={18} /> Tạo Biên Bản Mới
            </button>
          </div>

          <hr className="border-slate-100" />

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Filter size={16}/> Lịch sử đối soát</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full sm:w-32 px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none" title="Từ ngày" />
                <span className="text-slate-400 text-xs">-</span>
                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full sm:w-32 px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none" title="Đến ngày" />
              </div>
            </div>

            {loadingSessions && page === 1 ? (
              <p className="text-sm text-slate-500 text-center py-8">Đang tải dữ liệu...</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8 border rounded-xl border-dashed">Không có biên bản nào trong khoảng thời gian này.</p>
            ) : (
              <div className="space-y-3">
                {sessions.map(session => (
                  <div key={session.id} onClick={() => handleOpenSession(session)} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition cursor-pointer bg-white group">
                    <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-blue-700">{session.session_name}</h4>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <Calendar size={12} /> Date: {session.audit_date}
                        <span className="mx-1">•</span>
                        <Clock size={12} /> Tạo: {new Date(session.created_at).toLocaleTimeString('vi-VN')}
                      </p>
                    </div>
                    <div className="mt-3 sm:mt-0 flex items-center gap-2">
                      {session.status === 'completed' ? (
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1"><CheckCircle2 size={14}/> Đã chốt</span>
                      ) : (
                        <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg flex items-center gap-1"><RefreshCw size={14} className="animate-spin-slow"/> Đang quét</span>
                      )}
                      
                      {isAdminOrOwner && (
                        <button onClick={(e) => handleDeleteSession(session.id, e)} className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-md transition" title="Xóa biên bản">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {hasMore && (
                  <button onClick={() => fetchSessions(true)} disabled={loadingSessions} className="w-full py-2.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition">
                    {loadingSessions ? 'Đang tải...' : 'Tải thêm'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: VIEW TRANG ĐỐI SOÁT
  // ==========================================
  return (
    <div className="space-y-4 sm:space-y-6 pb-10 px-2 sm:px-0 relative">

      {/* Custom Dialog Render */}
      {dialogConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-slate-800">
              {dialogConfig.type === 'confirm' ? <AlertCircle className="text-blue-500" size={24}/> : <Info className="text-amber-500" size={24}/>}
              <h3 className="text-lg font-bold">{dialogConfig.title}</h3>
            </div>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">{dialogConfig.message}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeDialog} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition">
                {dialogConfig.type === 'confirm' ? 'Hủy bỏ' : 'Đóng'}
              </button>
              {dialogConfig.type === 'confirm' && (
                <button 
                  onClick={() => { dialogConfig.onConfirm && dialogConfig.onConfirm(); closeDialog(); }} 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition"
                >
                  Xác nhận
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBackToList} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition" title="Quay lại danh sách">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><ScanBarcode size={18} /></span>
              ĐỐI SOÁT PHIẾU IN
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{currentSession?.session_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-inner font-bold text-slate-700 text-sm">
          <Calendar size={16} className="text-blue-500" /> Date: {currentSession?.audit_date}
        </div>
      </div>

      {alertBanner && (
        <div className={`p-3 sm:p-4 font-bold text-xs sm:text-sm rounded-2xl shadow-lg flex items-center gap-3 animate-bounce ${alertBanner.type === 'success' ? 'bg-emerald-600' : alertBanner.type === 'danger' ? 'bg-red-600' : 'bg-amber-500'} text-white`}>
          {alertBanner.type === 'success' ? <CheckCircle2 size={20} className="flex-shrink-0" /> : <XCircle size={20} className="flex-shrink-0" />}
          <span>{alertBanner.message}</span>
        </div>
      )}

      {showDuplicatePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center space-y-4 animate-in zoom-in duration-200">
            <div className="text-4xl">️</div>
            <h3 className="text-lg font-bold text-red-600">Mã đã quét rồi!</h3>
            <p className="text-sm text-slate-600 font-medium">Mã <span className="font-bold text-slate-800">{duplicateCode}</span> đã được quét trước đó.</p>
            <button onClick={closeDuplicatePopup} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition w-full">Đã hiểu</button>
          </div>
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-4">
        {isConfirmed ? (
          <div className="py-4 space-y-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2"><CheckCircle2 size={32} /></div>
            <h3 className="text-lg font-bold text-emerald-700">BIÊN BẢN ĐÃ CHỐT</h3>
            <p className="text-xs text-slate-500 font-medium">
              Tổng số lần quét: <span className="font-bold text-slate-700">{currentSession?.total_scanned ?? scannedCodes.length}</span> mã
            </p>
          </div>
        ) : (
          <>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Quét mã bằng Súng Bắn Mã Vạch</label>
            <form onSubmit={handleBarcodeSubmit} className="relative max-w-md mx-auto flex items-center gap-2">
              <input 
                ref={inputRef} type="text" placeholder="Bắn mã vạch đơn trả về ..." value={inputCode} 
                onChange={e => setInputCode(e.target.value)} 
                onKeyDown={handleBarcodeKeyDown}
                onPaste={handlePasteDropBlock} 
                onDrop={handlePasteDropBlock} 
                disabled={isCameraOpen}
                className="flex-1 text-center text-sm font-bold tracking-wide py-2.5 sm:py-3 px-3 sm:px-4 bg-slate-50 border-2 border-dashed border-blue-400 rounded-xl outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition disabled:opacity-50"
              />
              <button type="button" onClick={handleToggleCamera} disabled={showDuplicatePopup}
                className={`p-2.5 sm:p-3 rounded-xl border-2 font-bold text-xs flex items-center gap-1.5 transition ${
                  isCameraOpen ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' : 'bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100'
                } disabled:opacity-50`}
              >
                {isCameraOpen ? <CameraOff size={18} /> : <Camera size={18} />}
                <span className="hidden sm:inline">{isCameraOpen ? 'Tắt' : 'Camera'}</span>
              </button>
            </form>
            <p className="text-xs text-amber-600 font-medium italic mt-1">*Hệ thống chỉ nhận mã từ thiết bị quét chuyên dụng (Không hỗ trợ Copy/Dán hoặc gõ tay).</p>

            {cameraErrorMsg && (
              <div className="mt-2 text-red-600 text-xs font-medium flex flex-col items-center gap-1">
                <span>{cameraErrorMsg}</span>
                <button onClick={() => startCamera()} className="flex items-center gap-1 px-3 py-1 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold hover:bg-red-100">
                  <RefreshCw size={12} /> Thử lại
                </button>
              </div>
            )}
            {isCameraOpen && !cameraErrorMsg && (
              <div className="mt-4 flex flex-col items-center">
                <div id="camera-container" ref={cameraContainerRef} className="w-full max-w-xs sm:max-w-sm rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg" style={{ minHeight: '200px' }} />
              </div>
            )}

            <div className="flex justify-center gap-2 sm:gap-3 pt-4 flex-wrap border-t border-slate-100 mt-4">
              <button onClick={handleConfirmSession} disabled={loading}
                className="px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50">
                {loading ? 'Đang lưu...' : ' Chốt biên bản & Lưu Log'}
              </button>
              <button onClick={handleResetAudit} className="px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition flex items-center gap-1.5">
                <Trash2 size={13} /> Quét lại
              </button>
            </div>
          </>
        )}
      </div>

      {/* 5 Ô THỐNG KÊ SỐ LƯỢNG */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng đơn in</span>
          <span className="text-base sm:text-lg font-bold text-slate-900 block mt-0.5">{loading ? "..." : totalPrintedCount}</span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Đơn cần trả</span>
          <span className="text-base sm:text-lg font-bold text-emerald-600 block mt-0.5">
            {isConfirmed && !isDetailsVisible ? totalExpectedCount : `${scannedCorrectCount} / ${totalExpectedCount}`}
          </span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Đơn bị hủy</span>
          <span className="text-base sm:text-lg font-bold text-red-600 block mt-0.5">
            {isConfirmed && !isDetailsVisible ? totalCanceledCount : `${scannedCanceledCount} / ${totalCanceledCount}`}
          </span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Đơn thừa</span>
          <span className="text-base sm:text-lg font-bold text-slate-500 block mt-0.5">{totalSurplusCount}</span>
        </div>
        <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">Đơn thiếu</span>
          <span className="text-base sm:text-lg font-bold text-amber-700 block mt-0.5">{isConfirmed ? totalMissingCount : '?'}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleExportExcel} 
          disabled={isLoadingDetails || (totalExpectedCount === 0 && totalCanceledCount === 0)} 
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition cursor-pointer text-sm"
        >
          <Download size={16} /> {isLoadingDetails ? 'Đang tải dữ liệu...' : 'Xuất Báo Cáo Excel'}
        </button>
      </div>

      {/* NẾU ĐÃ CHỐT MÀ CHƯA BẤM XEM CHI TIẾT: HIỂN THỊ NÚT "XEM DỮ LIỆU CHI TIẾT" */}
      {isConfirmed && !isDetailsVisible ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-4">
          <p className="text-sm text-slate-500 font-medium">
            Dữ liệu chi tiết (kênh bán, sản phẩm, trạng thái từng đơn) đang được ẩn để giảm tải.
          </p>
          <button
            onClick={handleLoadConfirmedDetails}
            disabled={isLoadingDetails}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm rounded-xl shadow-md transition inline-flex items-center gap-2"
          >
            {isLoadingDetails ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Đang tải dữ liệu chi tiết từ Database...
              </>
            ) : (
              <>
                <Eye size={18} />
                Xem dữ liệu chi tiết
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Đơn đúng cần trả */}
          <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
            <h3 className="text-xs sm:text-sm font-bold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="p-1 bg-emerald-50 rounded-md"><CheckCircle size={14} /></span> Đơn tồn ({expectedCorrect.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[450px]">
              {expectedCorrect.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-10">Tất cả đơn in đã được bàn giao!</div>
              ) : (
                expectedCorrect.map((order, idx) => {
                  const scanned = isScanned(order);
                  return (
                    <div key={order.id + idx} className={`p-3 border rounded-xl transition-all duration-300 ${scanned ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex justify-between items-start text-xs font-bold mb-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={scanned ? 'text-emerald-700' : 'text-slate-800'}>ID: {order.id}</span>
                            {getChannelBadge(order.sale_channel)}
                          </div>
                          <span className="text-xs text-slate-400 font-medium">MVD: {order.carrier_code || '---'}</span>
                        </div>
                        {scanned ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">ĐÃ TRẢ LẠI</span> 
                                 : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded font-bold">CHƯA THẤY</span>}
                      </div>
                      {/* Danh sách SP */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                        {order.order_products?.length > 0 ? order.order_products.map((p, i) => (
                          <div key={i} className="text-[11px] text-slate-600 flex justify-between">
                            <span className="truncate pr-2">• {p.product_name}</span>
                            <span className="font-bold whitespace-nowrap">x{p.quantity}</span>
                          </div>
                        )) : <span className="text-xs text-slate-400 italic">Không có dữ liệu SP</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Đơn hủy */}
          <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
            <h3 className="text-xs sm:text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="p-1 bg-red-50 rounded-md"><XCircle size={14} /></span> Đơn bị hủy ({expectedCanceled.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[450px]">
              {expectedCanceled.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-10">Không có đơn nào bị hủy!</div>
              ) : (
                expectedCanceled.map((order, idx) => {
                  const scanned = isScanned(order);
                  return (
                    <div key={order.id + idx} className={`p-3 border rounded-xl transition-all duration-300 ${scanned ? 'bg-red-50 border-red-300' : 'bg-white border-red-200 shadow-sm'}`}>
                      <div className="flex justify-between items-start gap-2 text-xs font-bold mb-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={scanned ? 'text-red-800' : 'text-red-600'}>ID: {order.id}</span>
                            {getChannelBadge(order.sale_channel)}
                          </div>
                          <span className="text-xs text-slate-400 font-medium">MVD: {order.carrier_code || '---'}</span>
                        </div>
                        {scanned ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">ĐÃ LẤY RA</span> 
                                 : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded font-bold animate-pulse text-red-500">CẦN TÌM GẤP</span>}
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                        {order.order_products?.length > 0 ? order.order_products.map((p, i) => (
                          <div key={i} className="text-[11px] text-slate-600 flex justify-between">
                            <span className="truncate pr-2">• {p.product_name}</span>
                            <span className="font-bold whitespace-nowrap">x{p.quantity}</span>
                          </div>
                        )) : <span className="text-xs text-slate-400 italic">Không có dữ liệu SP</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Hàng thừa */}
          <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
            <h3 className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="p-1 bg-slate-50 rounded-md"><PackagePlus size={14} /></span> Hàng thừa ({resolvedSurplusOrders.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
              {resolvedSurplusOrders.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-10">Chưa quét trúng mã hàng lạc nào.</div>
              ) : (
                resolvedSurplusOrders.map((order, idx) => (
                  <div key={order.id + idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex flex-col gap-1 text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">ID: {order.id}</span>
                        {getChannelBadge(order.sale_channel)}
                      </div>
                      <span className="text-slate-500 text-xs font-medium">Trạng thái: {STATUS_MAP[order.status] || order.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Hàng thiếu */}
          <div className="p-4 sm:p-6 bg-amber-50/50 border border-amber-200/50 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
            <h3 className="text-xs sm:text-sm font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="p-1 bg-amber-100 rounded-md"><PackageMinus size={14} /></span> Hàng thiếu ({isConfirmed ? allMissing.length : '?'})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
              {!isConfirmed ? (
                <div className="text-center text-amber-500 text-xs py-10 flex flex-col items-center justify-center gap-2 font-medium">
                  <AlertCircle size={28} className="text-amber-300" />
                  <span>Bấm nút "Chốt biên bản" ở trên để xem số hàng thiếu.</span>
                </div>
              ) : allMissing.length === 0 ? (
                <div className="text-center text-emerald-600 font-bold text-xs py-10 flex flex-col items-center justify-center gap-1.5">
                  <CheckCircle2 size={32} className="text-emerald-500" /><span>Đã nhận đủ đơn!</span>
                </div>
              ) : (
                allMissing.map((order, idx) => (
                  <div key={order.id + idx} className="p-3 bg-white border border-amber-200 rounded-xl flex items-center justify-between">
                    <div className="text-xs font-bold text-amber-800">ID: {order.id}</div>
                    {getChannelBadge(order.sale_channel)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
