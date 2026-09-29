import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ScanBarcode, FileSpreadsheet, UploadCloud, AlertCircle, CheckCircle2, 
  Download, RotateCcw, XCircle, Package, Loader2, Volume2, VolumeX, Camera, CameraOff,
  Save, History, ChevronRight, Trash2, ArrowLeft, Eye
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export default function KiemTraDonHoan() {
  // --- STATES HIỆN TẠI ---
  const [loading, setLoading] = useState(false);
  const [inventoryMap, setInventoryMap] = useState([]); 
  const [checklist, setChecklist] = useState([]); 
  const [fileName, setFileName] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [scannedSurplus, setScannedSurplus] = useState([]); 
  const [alertMessage, setAlertMessage] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isScanningCam, setIsScanningCam] = useState(false);

  // --- STATES LỊCH SỬ ---
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // --- STATES MỚI: XEM CHI TIẾT & POPUP XÁC NHẬN ---
  const [selectedLog, setSelectedLog] = useState(null); // Lưu log đang được xem chi tiết
  const [confirmPopup, setConfirmPopup] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: false });

  // ROLE GIẢ ĐỊNH (Thay đổi theo hệ thống của bạn)
  const [userRole, setUserRole] = useState('owner'); // 'user', 'admin', 'owner'

  const inputRef = useRef(null);

  // --- REFS ---
  const checklistRef = useRef(checklist);
  const scannedSurplusRef = useRef(scannedSurplus);
  const inventoryMapRef = useRef(inventoryMap);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => { checklistRef.current = checklist; }, [checklist]);
  useEffect(() => { scannedSurplusRef.current = scannedSurplus; }, [scannedSurplus]);
  useEffect(() => { inventoryMapRef.current = inventoryMap; }, [inventoryMap]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    if (checklist.length > 0 && inputRef.current && !isScanningCam && !showHistory && !confirmPopup.isOpen) {
      inputRef.current.focus();
    }
  }, [checklist, scannedSurplus, alertMessage, isScanningCam, showHistory, confirmPopup.isOpen]);

  useEffect(() => {
    const fetchAllInventories = async () => {
      setLoading(true);
      try {
        let allData = [];
        let from = 0;
        const step = 1000;
        let keepFetching = true;

        while (keepFetching) {
          const { data, error } = await supabase
            .from('product_inventories')
            .select('product_id, product_code, product_name')
            .range(from, from + step - 1);

          if (error) throw error;
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += step;
            if (data.length < step) keepFetching = false; 
          } else {
            keepFetching = false;
          }
        }
        setInventoryMap(allData);
      } catch (err) {
        console.error("Lỗi kéo dữ liệu tồn kho:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAllInventories();
  }, []);

  // --- HÀM HỖ TRỢ ---
  const closeConfirm = () => setConfirmPopup({ ...confirmPopup, isOpen: false });

  const loadHistory = async (pageIndex = 0, reset = false) => {
    setLoadingHistory(true);
    try {
      const pageSize = 5;
      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;

      let query = supabase.from('return_audit_logs').select('*').order('created_at', { ascending: false });

      if (userRole !== 'owner') {
        query = query.range(0, 4);
      } else {
        query = query.range(from, to);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (reset) {
        setHistoryLogs(data || []);
      } else {
        setHistoryLogs(prev => [...prev, ...(data || [])]);
      }

      if (userRole !== 'owner' || !data || data.length < pageSize) {
        setHasMoreLogs(false);
      } else {
        setHasMoreLogs(true);
      }
    } catch (err) {
      console.error("Lỗi tải lịch sử:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    setShowHistory(true);
    setSelectedLog(null); // Reset detail view
    setHistoryPage(0);
    loadHistory(0, true);
  };

  const handleLoadMoreLogs = () => {
    const nextPage = historyPage + 1;
    setHistoryPage(nextPage);
    loadHistory(nextPage, false);
  };

  const executeDeleteLog = async (id) => {
    try {
      const { error } = await supabase.from('return_audit_logs').delete().eq('id', id);
      if (error) throw error;
      // Cập nhật lại danh sách sau khi xóa
      setHistoryLogs(prev => prev.filter(log => log.id !== id));
      if (selectedLog?.id === id) setSelectedLog(null); // Nếu đang xem chi tiết cái bị xóa thì quay ra ngoài
      setAlertMessage({ type: 'success', text: '✅ Đã xóa biên bản thành công.' });
    } catch (err) {
      console.error("Lỗi khi xóa:", err);
      setAlertMessage({ type: 'danger', text: '🚨 Lỗi khi xóa biên bản.' });
    } finally {
      closeConfirm();
    }
  };

  const requestDeleteLog = (e, id) => {
    e.stopPropagation(); // Ngăn click lan ra ngoài card (tránh mở detail view)
    setConfirmPopup({
      isOpen: true,
      title: 'Xóa biên bản này?',
      message: 'Dữ liệu của biên bản này sẽ bị xóa vĩnh viễn khỏi hệ thống. Hành động này không thể hoàn tác.',
      isDestructive: true,
      onConfirm: () => executeDeleteLog(id)
    });
  };

  const executeSaveAudit = async () => {
    setIsSaving(true);
    closeConfirm();
    try {
      const payload = {
        file_name: fileName,
        total_expected: totalExpected,
        total_scanned_valid: totalScannedValid,
        total_surplus: totalSurplus,
        checklist_data: checklist,
        surplus_data: scannedSurplus
      };

      const { error } = await supabase.from('return_audit_logs').insert([payload]);
      if (error) throw error;

      setAlertMessage({ type: 'success', text: '✅ Đã chốt và lưu biên bản kiểm hoàn thành công!' });
      setChecklist([]);
      setScannedSurplus([]);
      setFileName('');
      setIsScanningCam(false);
    } catch (err) {
      console.error("Lỗi khi lưu:", err);
      setAlertMessage({ type: 'danger', text: '🚨 Đã xảy ra lỗi khi lưu biên bản vào hệ thống.' });
    } finally {
      setIsSaving(false);
    }
  };

  const requestSaveAudit = () => {
    if (checklist.length === 0) return;
    setConfirmPopup({
      isOpen: true,
      title: 'Chốt biên bản kiểm hàng?',
      message: 'Bạn có chắc chắn muốn chốt số liệu? Dữ liệu sau khi chốt sẽ được lưu vào lịch sử.',
      isDestructive: false,
      onConfirm: executeSaveAudit
    });
  };

  const executeReset = () => {
    setChecklist([]); setScannedSurplus([]); setFileName(''); setAlertMessage(null); setIsScanningCam(false);
    closeConfirm();
  };

  const requestResetAudit = () => {
    setConfirmPopup({
      isOpen: true,
      title: 'Làm mới dữ liệu?',
      message: 'Toàn bộ tiến trình quét hiện tại sẽ bị xóa. Bạn có chắc chắn muốn bắt đầu lại?',
      isDestructive: true,
      onConfirm: executeReset
    });
  };

  // --- CÁC HÀM TIỆN ÍCH ---
  const generateMatchKey = (str) => {
    if (!str) return '';
    return String(str).normalize('NFC').toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[–—\-]/g, '').replace(/\s+/g, '');               
  };

  const playSound = (type, isEnabled = true) => {
    if (!isEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      if (type === 'success') {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(1200, ctx.currentTime); 
        gain.gain.setValueAtTime(1.0, ctx.currentTime);
        osc.start(); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'warning') {
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination); osc.type = 'triangle'; 
          osc.frequency.setValueAtTime(900, ctx.currentTime + i * 0.15);
          gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.setValueAtTime(1.0, ctx.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.1);
          osc.start(ctx.currentTime + i * 0.15); osc.stop(ctx.currentTime + i * 0.15 + 0.1);
        }
      } else if (type === 'error') {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, ctx.currentTime); gain.gain.setValueAtTime(1.0, ctx.currentTime);
        osc.start(); osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35); osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) { console.error("Audio playback failed", e); }
  };

  useEffect(() => {
    let html5QrCode;
    if (isScanningCam) {
      html5QrCode = new Html5Qrcode("reader-kiemtra");
      const config = { fps: 10, qrbox: { width: 300, height: 100 }, formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128], aspectRatio: 1.0 };
      html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => { processBarcode(decodedText); }, () => {})
        .catch((err) => {
          console.error("Camera Error:", err); alert("Lỗi Camera: Không thể mở máy ảnh. Hãy đảm bảo bạn dùng HTTPS và đã cấp quyền.");
          setIsScanningCam(false);
        });
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().catch(console.error); } };
  }, [isScanningCam]);

  const processBarcode = (rawCode) => {
    const code = rawCode.trim().toUpperCase(); 
    if (!code) return;
    setAlertMessage(null);
    const currentInventory = inventoryMapRef.current;
    const currentChecklist = checklistRef.current;
    const currentSurplus = scannedSurplusRef.current;

    const dbMatch = currentInventory.find(item => String(item.product_code).toUpperCase() === code || String(item.product_id).toUpperCase() === code);
    const actualCodeToMatch = dbMatch ? String(dbMatch.product_code).toUpperCase() : code;
    const actualIdToMatch = dbMatch ? String(dbMatch.product_id).toUpperCase() : code;
    const targetIndex = currentChecklist.findIndex(item => item.code === code || item.id === code || item.code === actualCodeToMatch || item.id === actualIdToMatch || item.id === actualCodeToMatch || item.code === actualIdToMatch);

    if (targetIndex !== -1) {
      const updatedChecklist = [...currentChecklist];
      const targetItem = { ...updatedChecklist[targetIndex] };
      targetItem.scannedQty += 1;
      updatedChecklist[targetIndex] = targetItem;

      if (targetItem.scannedQty > targetItem.expectedQty) {
        playSound('warning', soundEnabledRef.current); 
        setAlertMessage({ type: 'warning', text: `⚠️ CHÚ Ý: Mã [${targetItem.name}] quét DƯ (Lên ${targetItem.scannedQty}/${targetItem.expectedQty}).` });
      } else {
        playSound('success', soundEnabledRef.current); 
        if (targetItem.scannedQty === targetItem.expectedQty) { setAlertMessage({ type: 'success', text: `✅ Mã [${targetItem.name}] đã ĐỦ SỐ LƯỢNG!` }); }
      }
      setChecklist(updatedChecklist);
    } else {
      playSound('error', soundEnabledRef.current); 
      const existingSurplusIndex = currentSurplus.findIndex(item => item.code === actualCodeToMatch);
      if (existingSurplusIndex !== -1) {
        const updatedSurplus = [...currentSurplus];
        const targetSurplus = { ...updatedSurplus[existingSurplusIndex] };
        targetSurplus.scannedQty += 1;
        updatedSurplus[existingSurplusIndex] = targetSurplus;
        setScannedSurplus(updatedSurplus);
      } else {
        setScannedSurplus([...currentSurplus, { code: actualCodeToMatch !== code ? actualCodeToMatch : code, name: dbMatch ? dbMatch.product_name : 'Mã vạch lạ không rõ trên hệ thống', scannedQty: 1 }]);
      }
      setAlertMessage({ type: 'danger', text: `🚨 BÁO ĐỘNG ĐỎ: Quét trúng mã lạ hoặc dư thừa ngoài danh sách!` });
    }
    setInputCode(''); 
  };

  const handleBarcodeSubmit = (e) => { e.preventDefault(); processBarcode(inputCode); };

  const downloadTemplate = () => {
    const csvContent = "\uFEFFTên sản phẩm,Số lượng hoàn\nÁo thun MARIKA - Trắng - M,5\nQuần Jean SYRRA - Xanh - L,3";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "File_Mau_Don_Hoan.csv"; link.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').filter(row => row.trim().length > 0);
      const parsedMap = new Map();
      const dbDictionary = new Map();
      inventoryMap.forEach(item => { dbDictionary.set(generateMatchKey(item.product_name), item); });

      for (let i = 1; i < rows.length; i++) {
        const rowString = rows[i].trim();
        const lastCommaIndex = rowString.lastIndexOf(',');
        if (lastCommaIndex === -1) continue;

        let rawName = rowString.substring(0, lastCommaIndex);
        let rawQty = rowString.substring(lastCommaIndex + 1);

        const name = rawName.replace(/^"|"$/g, '').trim();
        const qty = parseInt(rawQty.replace(/^"|"$/g, '').trim(), 10) || 0;
        if (!name) continue;

        const csvKey = generateMatchKey(name);
        if (parsedMap.has(csvKey)) {
          parsedMap.get(csvKey).expectedQty += qty;
        } else {
          const dbMatch = dbDictionary.get(csvKey);
          parsedMap.set(csvKey, { id: dbMatch ? dbMatch.product_id : 'N/A', code: dbMatch ? dbMatch.product_code : 'N/A', name: name, expectedQty: qty, scannedQty: 0, matchKey: csvKey });
        }
      }
      setChecklist(Array.from(parsedMap.values()));
    };
    reader.readAsText(file);
    e.target.value = null; 
  };

  const totalExpected = checklist.reduce((sum, item) => sum + item.expectedQty, 0);
  const totalScannedValid = checklist.reduce((sum, item) => sum + item.scannedQty, 0);
  const totalSurplus = scannedSurplus.reduce((sum, item) => sum + item.scannedQty, 0);

  const exportFinalReport = (list, surplusList) => {
    let csvContent = "\uFEFFMã Sản Phẩm,Tên Sản Phẩm,Số Lượng Hoàn,Thực Tế,Trạng Thái Chênh Lệch\n";
    list.forEach(item => {
      const diff = item.scannedQty - item.expectedQty;
      let statusText = diff === 0 ? 'Khớp đủ' : (diff > 0 ? `Dư ${diff}` : `Thiếu ${Math.abs(diff)}`);
      csvContent += `"${item.code || item.id}","${item.name}","${item.expectedQty}","${item.scannedQty}","${statusText}"\n`;
    });
    if (surplusList.length > 0) {
      csvContent += "\n--- DANH SÁCH SẢN PHẨM LẠ KHÔNG CÓ TRONG LIST HOÀN---\n";
      surplusList.forEach(item => { csvContent += `"${item.code}","${item.name}","0","${item.scannedQty}","Sản phẩm dư"\n`; });
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", `Chot_So_Hoan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800 animate-in fade-in duration-300">
      
      {/* POPUP XÁC NHẬN CHUNG (Tùy chỉnh) */}
      {confirmPopup.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className={`text-lg font-black mb-2 flex items-center gap-2 ${confirmPopup.isDestructive ? 'text-red-600' : 'text-slate-900'}`}>
              {confirmPopup.isDestructive ? <AlertCircle size={22} /> : <AlertCircle size={22} className="text-blue-500" />}
              {confirmPopup.title}
            </h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
              {confirmPopup.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={closeConfirm} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition">
                Hủy bỏ
              </button>
              <button onClick={confirmPopup.onConfirm} className={`px-4 py-2 font-bold text-sm rounded-xl transition text-white ${
                confirmPopup.isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}>
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER BẢNG ĐIỀU KHIỂN */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><ScanBarcode size={22} /></span>
            Kiểm tra và Chốt số lượng Hoàn
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">Đối chiếu lại số lượng sản phẩm hoàn</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className={`px-3 py-2 text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center cursor-pointer ${
              soundEnabled ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button onClick={handleOpenHistory} className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
            <History size={14} /> Lịch sử
          </button>

          {checklist.length > 0 && (
            <>
              <button onClick={requestResetAudit} className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                <RotateCcw size={14} /> Làm mới
              </button>
              <button onClick={() => exportFinalReport(checklist, scannedSurplus)} className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                <Download size={14} /> Tải CSV
              </button>
              <button disabled={isSaving} onClick={requestSaveAudit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer">
                {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} />} 
                Lưu & Chốt
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-4 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl flex justify-center items-center gap-2 border border-blue-100">
          <Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu tồn kho...
        </div>
      )}

      {/* GIAO DIỆN CHÍNH KHI CHƯA UPLOAD FILE */}
      {checklist.length === 0 ? (
        <div className="bg-white p-8 md:p-14 border border-slate-200 border-dashed rounded-3xl text-center shadow-sm flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-lg">
            <FileSpreadsheet size={32} className="text-blue-500" />
          </div>
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Tải lên File Danh sách Hoàn</h3>
          <p className="text-xs text-slate-500 font-medium mt-2 max-w-md mx-auto leading-relaxed">
            Hệ thống chỉ cần 2 cột: <strong className="text-slate-800">Tên sản phẩm</strong> và <strong className="text-slate-800">Số lượng</strong>.
          </p>
          
          <div className="flex gap-3 mt-6">
            <button onClick={downloadTemplate} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-xl transition cursor-pointer flex items-center gap-2">
              <Download size={16} /> Tải file mẫu
            </button>
            <label className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition cursor-pointer flex items-center gap-2">
              <UploadCloud size={16} /> Chọn file dữ liệu
              <input type="file" accept=".csv, .txt, text/csv, text/plain" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      ) : (
        // GIAO DIỆN QUÉT BẮN MÃ
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Súng quét Barcode / SKU</label>
                <button 
                    onClick={() => setIsScanningCam(!isScanningCam)}
                    type="button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isScanningCam ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                    {isScanningCam ? <><CameraOff size={14}/> Tắt Cam</> : <><Camera size={14}/> Bật Cam</>}
                </button>
              </div>

              {isScanningCam && (
                <div className="mb-2 overflow-hidden rounded-xl border-2 border-blue-300 shadow-inner bg-black">
                  <div id="reader-kiemtra" className="w-full"></div>
                  <div className="bg-blue-50 p-2 text-center text-[10px] text-blue-600 font-medium border-t border-blue-200">
                    Đưa mã vạch (Code 128) vào khung hình chữ nhật
                  </div>
                </div>
              )}

              <form onSubmit={handleBarcodeSubmit} className="relative">
                <input 
                  ref={inputRef}
                  type="text"
                  placeholder="Bắn mã vạch vào đây..."
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value)}
                  className="w-full text-center text-sm font-bold tracking-widest py-3 px-4 bg-slate-50 border-2 border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition"
                />
              </form>
              <div className="text-[10px] text-slate-400 text-center font-bold">Đang xử lý file: <span className="text-blue-500">{fileName}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số sản phẩm đúng</span>
                <div className="text-2xl font-black text-slate-800 mt-1">
                  <span className="text-blue-600">{totalScannedValid}</span> <span className="text-sm text-slate-300">/ {totalExpected}</span>
                </div>
              </div>
              <div className="bg-white p-4 border border-red-200 bg-red-50/20 rounded-2xl shadow-sm flex flex-col justify-center text-center">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Mã sai / Dư thừa</span>
                <span className="text-2xl font-black text-red-600 mt-1">{totalSurplus}</span>
              </div>
            </div>
          </div>

          {alertMessage && (
            <div className={`p-4 font-black text-sm rounded-2xl shadow-md flex items-center gap-3 animate-in slide-in-from-bottom-2 ${
              alertMessage.type === 'danger' ? 'bg-red-600 text-white animate-bounce' : 
              alertMessage.type === 'warning' ? 'bg-amber-400 text-white' : 
              'bg-emerald-500 text-white'
            }`}>
              {alertMessage.type === 'danger' ? <XCircle size={24} className="flex-shrink-0" /> : <CheckCircle2 size={24} className="flex-shrink-0" />}
              <span>{alertMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Package size={16} className="text-blue-600" />
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">Sản phẩm đối soát ({checklist.length} sản phẩm)</h3>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[500px]">
                <table className="w-full text-left text-xs font-semibold">
                  <thead className="sticky top-0 bg-white shadow-sm">
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Sản phẩm / Barcode</th>
                      <th className="py-3 px-4 text-center">Theo báo cáo</th>
                      <th className="py-3 px-4 text-center">Đã quét</th>
                      <th className="py-3 px-4 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {checklist.map((item, idx) => {
                      const isComplete = item.scannedQty === item.expectedQty;
                      const isOver = item.scannedQty > item.expectedQty;
                      const isPending = item.scannedQty === 0;

                      return (
                        <tr key={idx} className={`transition-colors ${isComplete ? 'bg-emerald-50/40' : isOver ? 'bg-amber-50/40' : 'hover:bg-slate-50/50'}`}>
                          <td className="py-3 px-4">
                            <div className={`font-bold ${isComplete ? 'text-emerald-800' : 'text-slate-800'}`}>{item.name}</div>
                            <div className={`text-[10px] mt-0.5 tracking-wide font-medium ${item.code === 'N/A' ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{item.code || item.id}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-black text-slate-500">{item.expectedQty}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded-md font-black text-[11px] ${
                              isComplete ? 'bg-emerald-100 text-emerald-700' : 
                              isOver ? 'bg-amber-200 text-amber-800' : 
                              isPending ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {item.scannedQty}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isComplete ? <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center justify-end gap-1"><CheckCircle2 size={12}/> Đủ hàng</span> : 
                             isOver ? <span className="text-[10px] font-bold text-amber-600 uppercase flex items-center justify-end gap-1"><AlertCircle size={12}/> Dư {item.scannedQty - item.expectedQty}</span> : 
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Đang chờ...</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-red-50/50 border border-red-200/60 rounded-2xl shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-red-100 bg-red-100/50 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600" />
                <h3 className="text-xs font-black text-red-700 uppercase tracking-wide">Lạ / Dư ({scannedSurplus.length})</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
                {scannedSurplus.length === 0 ? (
                  <div className="text-center text-red-300 text-xs py-14 font-bold flex flex-col items-center gap-2">
                    <CheckCircle2 size={24} /> Chờ quét...
                  </div>
                ) : (
                  scannedSurplus.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white border border-red-200 rounded-xl shadow-sm space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-black text-red-800 truncate">{item.name}</span>
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-black whitespace-nowrap">x{item.scannedQty}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">Mã quét: <span className="text-slate-800 font-bold tracking-wider">{item.code}</span></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LỊCH SỬ BIÊN BẢN CHỐT */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* HEADER MODAL */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                {selectedLog && (
                  <button onClick={() => setSelectedLog(null)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  {selectedLog ? (
                    <><Eye className="text-blue-600" size={20}/> Chi tiết phiên: {selectedLog.file_name}</>
                  ) : (
                    <><History className="text-blue-600" size={20} /> Lịch sử Biên bản Kiểm hàng</>
                  )}
                </h3>
              </div>
              
              <div className="flex items-center gap-3">
                {selectedLog && (
                  <button 
                    onClick={() => exportFinalReport(selectedLog.checklist_data, selectedLog.surplus_data)} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-xs rounded-lg transition"
                  >
                    <Download size={14}/> Tải lại CSV
                  </button>
                )}
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition">
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            
            {/* BODY MODAL */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
              
              {/* TRƯỜNG HỢP: XEM DANH SÁCH LỊCH SỬ */}
              {!selectedLog ? (
                <div className="space-y-4">
                  {historyLogs.length === 0 && !loadingHistory ? (
                    <div className="text-center text-slate-400 py-10 font-bold">Chưa có biên bản nào được chốt.</div>
                  ) : (
                    historyLogs.map((log) => (
                      <div 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-blue-300 hover:shadow-md cursor-pointer transition relative group"
                      >
                        <div className="flex-1">
                          <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-2">
                            {new Date(log.created_at).toLocaleString('vi-VN')}
                            <span className="text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded text-[9px] uppercase">ID: {log.id.slice(0,8)}</span>
                          </div>
                          <div className="font-black text-slate-800 text-sm flex items-center gap-2">
                            <FileSpreadsheet size={16} className="text-slate-400"/> {log.file_name}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <div className="flex gap-4 text-xs font-bold bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <div className="text-center px-2">
                              <span className="text-slate-400 block mb-1">Báo cáo</span>
                              <span className="text-slate-700">{log.total_expected}</span>
                            </div>
                            <div className="text-center px-2 border-l border-slate-200">
                              <span className="text-emerald-500 block mb-1">Hợp lệ</span>
                              <span className="text-emerald-700">{log.total_scanned_valid}</span>
                            </div>
                            <div className="text-center px-2 border-l border-slate-200">
                              <span className="text-red-400 block mb-1">Sai/Dư</span>
                              <span className="text-red-600">{log.total_surplus}</span>
                            </div>
                          </div>
                          
                          {/* NÚT XÓA CHO OWNER */}
                          {userRole === 'owner' && (
                            <button 
                              onClick={(e) => requestDeleteLog(e, log.id)}
                              className="p-2.5 bg-white border border-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition opacity-0 group-hover:opacity-100"
                              title="Xóa biên bản này"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {loadingHistory && (
                    <div className="flex justify-center py-4 text-blue-600"><Loader2 className="animate-spin" size={24}/></div>
                  )}

                  {hasMoreLogs && userRole === 'owner' && !loadingHistory && (
                    <div className="text-center pt-2">
                      <button onClick={handleLoadMoreLogs} className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center mx-auto gap-2 shadow-sm">
                        Tải thêm các phiên cũ <ChevronRight size={14}/>
                      </button>
                    </div>
                  )}
                  
                  {!hasMoreLogs && historyLogs.length > 0 && (
                    <div className="text-center text-[10px] font-bold text-slate-400 pt-4 uppercase tracking-widest">
                      {userRole !== 'owner' ? 'Hiển thị tối đa 5 phiên gần nhất' : 'Đã hết dữ liệu lịch sử'}
                    </div>
                  )}
                </div>

              ) : (
                /* TRƯỜNG HỢP: XEM CHI TIẾT LOG */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-in slide-in-from-right-4 duration-300">
                  {/* BẢNG CHÍNH */}
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-h-[60vh]">
                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-700 uppercase">Sản phẩm có trong danh sách ({selectedLog.checklist_data.length})</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left text-xs font-semibold">
                        <thead className="sticky top-0 bg-white shadow-sm">
                          <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase">
                            <th className="py-2 px-3">Sản phẩm</th>
                            <th className="py-2 px-3 text-center">Báo cáo</th>
                            <th className="py-2 px-3 text-center">Thực tế</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedLog.checklist_data.map((item, idx) => {
                            const isComplete = item.scannedQty === item.expectedQty;
                            const isOver = item.scannedQty > item.expectedQty;
                            return (
                              <tr key={idx} className={isComplete ? 'bg-emerald-50/30' : isOver ? 'bg-amber-50/30' : ''}>
                                <td className="py-2 px-3">
                                  <div className="font-bold text-slate-700">{item.name}</div>
                                  <div className="text-[10px] text-slate-400">{item.code || item.id}</div>
                                </td>
                                <td className="py-2 px-3 text-center text-slate-500">{item.expectedQty}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${isComplete ? 'bg-emerald-100 text-emerald-700' : isOver ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {item.scannedQty}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* BẢNG HÀNG LẠ */}
                  <div className="bg-red-50/50 border border-red-200/60 rounded-2xl shadow-sm flex flex-col h-full max-h-[60vh] overflow-hidden">
                    <div className="p-3 border-b border-red-100 bg-red-100/50">
                      <h3 className="text-xs font-black text-red-700 uppercase">Hàng lạ / Dư thừa ({selectedLog.surplus_data.length})</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {selectedLog.surplus_data.length === 0 ? (
                        <div className="text-center text-red-300 text-xs py-10 font-bold">Không có hàng dư</div>
                      ) : (
                        selectedLog.surplus_data.map((item, idx) => (
                          <div key={idx} className="p-2 bg-white border border-red-100 rounded-lg">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="text-[11px] font-bold text-red-700 leading-tight">{item.name}</span>
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-black">x{item.scannedQty}</span>
                            </div>
                            <div className="text-[9px] text-slate-400">{item.code}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}