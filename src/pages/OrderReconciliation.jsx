import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ScanBarcode, Calendar, Trash2, PackagePlus, PackageMinus, AlertCircle, 
  CheckCircle2, XCircle, CheckCircle, Download, Camera, CameraOff, 
  RefreshCw, List, Plus, ChevronLeft, Clock, Search, Filter
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

  // CAMERA & POPUP STATE
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState(''); 
  const scannerRef = useRef(null);
  const cameraContainerRef = useRef(null);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [duplicateCode, setDuplicateCode] = useState('');

  const inputRef = useRef(null);
  const audioCtxRef = useRef(null); 
  const lastKeyTimeRef = useRef(Date.now()); // Dùng để check tốc độ gõ (chặn gõ tay)

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserMeta(user.user_metadata || {});
    };
    loadUser();
  }, []);

  const isAdminOrOwner = currentUserMeta.is_owner === true || currentUserMeta.role === 'admin';

  // ==========================================
  // QUẢN LÝ PHIÊN (SESSIONS) VỚI PHÂN TRANG
  // ==========================================
  const fetchSessions = async (isLoadMore = false) => {
    setLoadingSessions(true);
    try {
      const currentPage = isLoadMore ? page + 1 : 1;
      const from = (currentPage - 1) * LIMIT;
      const to = from + LIMIT - 1;

      const { data, error, count } = await supabase
        .from('reconciliation_sessions')
        .select('*', { count: 'exact' })
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
    const sessionName = `Biên bản đối soát - ${new Date().toLocaleString('vi-VN')}`;
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
      alert("Lỗi tạo biên bản mới: " + err.message);
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!confirm("🚨 CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn biên bản này không?")) return;
    try {
      const { error } = await supabase.from('reconciliation_sessions').delete().eq('id', sessionId);
      if (error) throw error;
      fetchSessions(false); 
    } catch (err) {
      alert("Lỗi khi xóa biên bản: " + err.message);
    }
  };

  const handleOpenSession = (sessionData) => {
    setCurrentSession(sessionData);
    setScannedCodes(sessionData.scanned_codes || []);
    setSurplusOrders(sessionData.surplus_orders || []);
    setIsConfirmed(sessionData.status === 'completed');
    setView('audit');
  };

  const handleBackToList = () => {
    if (isCameraOpen) stopCamera();
    setView('list');
    setCurrentSession(null);
    setAlertBanner(null);
  };

  // ==========================================
  // LOGIC ĐỐI SOÁT
  // ==========================================
  const fetchTodayOrders = async () => {
    if (!currentSession) return;
    setLoading(true);
    try {
      const startOfDay = new Date(`${currentSession.audit_date}T00:00:00`).toISOString();
      const endOfDay = new Date(`${currentSession.audit_date}T23:59:59.999`).toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, carrier_code, status, printed_at, packed_at, carrier_date,
          order_products (product_code, product_name, quantity)
        `)
        .gte('printed_at', startOfDay)
        .lte('printed_at', endOfDay);

      if (error) throw error;
      setTodayOrders(data || []);
    } catch (err) {
      console.error("❌ Lỗi tải đơn hàng đối soát:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'audit' && currentSession?.status !== 'completed') {
      fetchTodayOrders();
    }
  }, [view, currentSession?.status]);

  useEffect(() => {
    if (inputRef.current && !isCameraOpen && view === 'audit') {
      inputRef.current.focus();
    }
  }, [scannedCodes, inputCode, alertBanner, isCameraOpen, view]);

  const isScanned = (order) => scannedCodes.includes(order.id) || (order.carrier_code && scannedCodes.includes(order.carrier_code));

  const expectedCorrect = isConfirmed 
      ? (currentSession?.expected_correct || []) 
      : todayOrders.filter(o => !EXCLUDED_STATUS_CODES.includes(Number(o.status)) && !CANCELED_STATUS_CODES.includes(Number(o.status)));
      
  const expectedCanceled = isConfirmed 
      ? (currentSession?.expected_canceled || []) 
      : todayOrders.filter(o => CANCELED_STATUS_CODES.includes(Number(o.status)));

  const missingCorrect = expectedCorrect.filter(o => !isScanned(o));
  const missingCanceled = expectedCanceled.filter(o => !isScanned(o));
  const allMissing = isConfirmed ? (currentSession?.missing_orders || []) : [...missingCorrect, ...missingCanceled];
  const totalPrintedCount = isConfirmed ? currentSession?.total_printed : todayOrders.length;

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
    if (!code || isConfirmed) return;

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
        setAlertBanner({ type: 'danger', message: `🚨 ĐƠN HÀNG HỦY! Mã ${matchedOrder.id} đã bị [${STATUS_MAP[statusCode]}]. Lọc ra rã hàng ngay!` });
      } else if (EXCLUDED_STATUS_CODES.includes(statusCode)) {
        setSurplusOrders(prev => [...prev, matchedOrder]);
        setAlertBanner({ type: 'warning', message: `⚠️ ĐƠN ĐÃ ĐÓNG GÓI RỒI! Mã ${matchedOrder.id} bị in nhầm.` });
      }
      setScannedCodes(prev => [...prev, code]);
    } else {
      const { data } = await supabase.from('orders').select(`id, carrier_code, status, order_products (product_code, product_name, quantity)`).or(`id.eq.${code},carrier_code.eq.${code}`).maybeSingle();

      if (data) {
        setSurplusOrders(prev => [...prev, data]);
        if (CANCELED_STATUS_CODES.includes(Number(data.status))) {
          setAlertBanner({ type: 'danger', message: `🚨 ĐƠN HỦY LẠC NGÀY KHÁC! Mã ${data.id} báo hủy. Thu hồi ngay!` });
        }
      } else {
        setSurplusOrders(prev => [...prev, { id: code, carrier_code: 'Không rõ', status: 'Mã vạch lạ hoắc', order_products: [] }]);
      }
      setScannedCodes(prev => [...prev, code]);
    }
    
    setInputCode('');
  }, [scannedCodes, todayOrders, isConfirmed]);

  const handleBarcodeSubmit = (e) => { e.preventDefault(); processBarcode(inputCode.trim()); };

  // ==========================================
  // CHỐNG NHẬP TAY / COPY PASTE
  // ==========================================
  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') return; 
    
    const currentTime = Date.now();
    // Máy quét thường gõ mỗi ký tự cách nhau dưới 30ms. Đặt 50ms để bắt lỗi người gõ.
    if (currentTime - lastKeyTimeRef.current > 50) {
      setInputCode(''); // Tự động xóa nếu phát hiện gõ tay chậm
    }
    lastKeyTimeRef.current = currentTime;
  };

  const handlePasteDropBlock = (e) => {
    e.preventDefault();
    alert("❌ Không được copy dán. Vui lòng sử dụng súng bắn mã vạch!");
  };

  // ==========================================
  // LƯU LOG PHIÊN & EXPORT EXCEL
  // ==========================================
  const handleConfirmSession = async () => {
    setIsConfirmed(true);
    setLoading(true);
    try {
      const updates = {
        status: 'completed', completed_at: new Date().toISOString(),
        total_printed: totalPrintedCount, total_expected: expectedCorrect.length,
        total_canceled: expectedCanceled.length, total_scanned: scannedCodes.length,
        total_missing: allMissing.length, total_surplus: surplusOrders.length,
        scanned_codes: scannedCodes, surplus_orders: surplusOrders,
        expected_correct: expectedCorrect, expected_canceled: expectedCanceled, missing_orders: allMissing
      };

      const { error } = await supabase.from('reconciliation_sessions').update(updates).eq('id', currentSession.id);
      if (error) throw error;
      
      setCurrentSession(prev => ({...prev, ...updates}));
      setAlertBanner({ type: 'success', message: '🎉 Đã chốt và lưu cứng dữ liệu đối soát thành công!' });
    } catch (err) {
      alert("Lỗi khi chốt biên bản: " + err.message);
      setIsConfirmed(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAudit = async () => {
    if (confirm("Xác nhận quét lại từ đầu? Lịch sử quét và biên bản hiện tại sẽ bị xóa sạch.")) {
      setScannedCodes([]); setSurplusOrders([]); setIsConfirmed(false);
      setAlertBanner(null); setShowDuplicatePopup(false);
      if (isCameraOpen) stopCamera();
      
      const resetData = {
        status: 'draft', scanned_codes: [], surplus_orders: [], completed_at: null,
        expected_correct: null, expected_canceled: null, missing_orders: null
      };

      await supabase.from('reconciliation_sessions').update(resetData).eq('id', currentSession.id);
      setCurrentSession(prev => ({...prev, ...resetData}));
    }
  };

  const handleExportExcel = () => {
    const allExpected = [...expectedCorrect, ...expectedCanceled];
    if (allExpected.length === 0) return alert("Không có đơn nào để xuất Excel!");

    let csvContent = "\uFEFFMã Đơn Hàng (ID),Mã Vận Đơn,Trạng Thái Sàn,Đã Trả/Chưa Trả,Mã Sản Phẩm,Tên Sản Phẩm,Số Lượng\n";
    allExpected.forEach(order => {
      const carrierCode = order.carrier_code || '---';
      const statusText = STATUS_MAP[order.status] || order.status;
      const scannedStatus = isScanned(order) ? "Đã trả lại" : "Chưa trả lại";

      if (order.order_products && order.order_products.length > 0) {
        order.order_products.forEach(p => { 
          csvContent += `"${order.id}","${carrierCode}","${statusText}","${scannedStatus}","${p.product_code || '---'}","${p.product_name}","${p.quantity}"\n`; 
        });
      } else {
        csvContent += `"${order.id}","${carrierCode}","${statusText}","${scannedStatus}","---","Đơn trống sản phẩm","0"\n`;
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
      <div className="space-y-6 pb-10 px-2 sm:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><List size={20} /></span>
              QUẢN LÝ BIÊN BẢN ĐỐI SOÁT
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">Tạo biên bản mới hoặc chọn biên bản cũ để tiếp tục làm việc</p>
          </div>
        </div>

        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
          
          {/* Vùng tạo biên bản mới */}
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

          {/* Vùng lọc biên bản cũ */}
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
    <div className="space-y-4 sm:space-y-6 pb-10 px-2 sm:px-0">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBackToList} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition" title="Quay lại danh sách">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
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
        <div className={`p-3 sm:p-4 font-black text-xs sm:text-sm rounded-2xl shadow-lg flex items-center gap-3 animate-bounce ${alertBanner.type === 'success' ? 'bg-emerald-600' : alertBanner.type === 'danger' ? 'bg-red-600' : 'bg-amber-500'} text-white`}>
          {alertBanner.type === 'success' ? <CheckCircle2 size={20} className="flex-shrink-0" /> : <XCircle size={20} className="flex-shrink-0" />}
          <span>{alertBanner.message}</span>
        </div>
      )}

      {showDuplicatePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-lg font-black text-red-600">Mã đã quét rồi!</h3>
            <p className="text-sm text-slate-600 font-medium">Mã <span className="font-black text-slate-800">{duplicateCode}</span> đã được quét trước đó.</p>
            <button onClick={closeDuplicatePopup} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition w-full">Đã hiểu</button>
          </div>
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-2xl shadow-sm text-center max-w-xl mx-auto space-y-4">
        {isConfirmed ? (
          <div className="py-4">
             <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={32} /></div>
             <h3 className="text-lg font-black text-emerald-700">BIÊN BẢN ĐÃ CHỐT</h3>
          </div>
        ) : (
          <>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Quét mã bằng Súng Bắn Mã Vạch</label>
            <form onSubmit={handleBarcodeSubmit} className="relative max-w-md mx-auto flex items-center gap-2">
              <input 
                ref={inputRef} type="text" placeholder="Bắn mã vạch đơn trả về ..." value={inputCode} 
                onChange={e => setInputCode(e.target.value)} 
                onKeyDown={handleBarcodeKeyDown} // Bắt tốc độ gõ phím
                onPaste={handlePasteDropBlock} // Chặn dán
                onDrop={handlePasteDropBlock}  // Chặn kéo thả
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
            <p className="text-[10px] text-amber-600 font-medium italic mt-1">*Hệ thống chỉ nhận mã từ thiết bị quét chuyên dụng (Không hỗ trợ Copy/Dán hoặc gõ tay).</p>

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
              <button onClick={handleConfirmSession} disabled={scannedCodes.length === 0 || loading}
                className="px-4 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50">
                {loading ? 'Đang lưu...' : '✓ Chốt biên bản & Lưu Log'}
              </button>
              <button onClick={handleResetAudit} className="px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition flex items-center gap-1.5">
                <Trash2 size={13} /> Quét lại
              </button>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng đơn in</span>
          <span className="text-base sm:text-lg font-black text-slate-900 block mt-0.5">{loading ? "..." : totalPrintedCount}</span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Đơn cần trả</span>
          <span className="text-base sm:text-lg font-black text-emerald-600 block mt-0.5">{expectedCorrect.filter(o=>isScanned(o)).length} / {expectedCorrect.length}</span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Đơn bị hủy</span>
          <span className="text-base sm:text-lg font-black text-red-600 block mt-0.5">{expectedCanceled.filter(o=>isScanned(o)).length} / {expectedCanceled.length}</span>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-xl text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Đơn thừa</span>
          <span className="text-base sm:text-lg font-black text-slate-500 block mt-0.5">{surplusOrders.length}</span>
        </div>
        <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Đơn thiếu</span>
          <span className="text-base sm:text-lg font-black text-amber-700 block mt-0.5">{isConfirmed ? allMissing.length : '?'}</span>
        </div>
      </div>

      {/* Button xuất Excel chung cho cả Đơn Tồn và Đơn Hủy */}
      <div className="flex justify-end">
        <button onClick={handleExportExcel} disabled={expectedCorrect.length === 0 && expectedCanceled.length === 0} 
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md transition cursor-pointer text-sm">
          <Download size={16} /> Xuất Báo Cáo Excel (Tồn & Hủy)
        </button>
      </div>

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
                      <div className="flex flex-col">
                        <span className={scanned ? 'text-emerald-700' : 'text-slate-800'}>ID: {order.id}</span>
                        <span className="text-[10px] text-slate-400 font-medium">MVD: {order.carrier_code || '---'}</span>
                      </div>
                      {scanned ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black">ĐÃ TRẢ LẠI</span> 
                               : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-black">CHƯA THẤY</span>}
                    </div>
                    {/* Danh sách SP */}
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                      {order.order_products?.length > 0 ? order.order_products.map((p, i) => (
                        <div key={i} className="text-[11px] text-slate-600 flex justify-between">
                          <span className="truncate pr-2">• {p.product_name}</span>
                          <span className="font-bold whitespace-nowrap">x{p.quantity}</span>
                        </div>
                      )) : <span className="text-[10px] text-slate-400 italic">Không có dữ liệu SP</span>}
                    </div>
                  </div>
                )
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
                      <div className="flex flex-col">
                        <span className={scanned ? 'text-red-800' : 'text-red-600'}>ID: {order.id}</span>
                        <span className="text-[10px] text-slate-400 font-medium">MVD: {order.carrier_code || '---'}</span>
                      </div>
                      {scanned ? <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-black">ĐÃ LẤY RA</span> 
                               : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-black animate-pulse text-red-500">CẦN TÌM GẤP</span>}
                    </div>
                    {/* Danh sách SP */}
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                      {order.order_products?.length > 0 ? order.order_products.map((p, i) => (
                        <div key={i} className="text-[11px] text-slate-600 flex justify-between">
                          <span className="truncate pr-2">• {p.product_name}</span>
                          <span className="font-bold whitespace-nowrap">x{p.quantity}</span>
                        </div>
                      )) : <span className="text-[10px] text-slate-400 italic">Không có dữ liệu SP</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Hàng thừa */}
        <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[300px] sm:min-h-[350px]">
          <h3 className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="p-1 bg-slate-50 rounded-md"><PackagePlus size={14} /></span> Hàng thừa ({surplusOrders.length})
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
            {surplusOrders.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-10">Chưa quét trúng mã hàng lạc nào.</div>
            ) : (
              surplusOrders.map((order, idx) => (
                <div key={order.id + idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex flex-col gap-1 text-xs font-bold">
                    <span className="text-slate-700">ID: {order.id}</span>
                    <span className="text-slate-500 text-[10px] font-medium">Trạng thái: {STATUS_MAP[order.status] || order.status}</span>
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
              allMissing.map(order => (
                <div key={order.id} className="p-3 bg-white border border-amber-200 rounded-xl">
                  <div className="text-xs font-bold flex justify-between"><span className="text-amber-800">ID: {order.id}</span></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}