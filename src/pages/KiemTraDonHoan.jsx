import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ScanBarcode, FileSpreadsheet, UploadCloud, AlertCircle, CheckCircle2, 
  Download, RotateCcw, XCircle, Package, Loader2, Volume2, VolumeX
} from 'lucide-react';

export default function KiemTraDonHoan() {
  const [loading, setLoading] = useState(false);
  const [inventoryMap, setInventoryMap] = useState([]); 
  
  const [checklist, setChecklist] = useState([]); 
  const [fileName, setFileName] = useState('');
  
  const [inputCode, setInputCode] = useState('');
  const [scannedSurplus, setScannedSurplus] = useState([]); 
  const [alertMessage, setAlertMessage] = useState(null);
  
  const [soundEnabled, setSoundEnabled] = useState(true);

  const inputRef = useRef(null);

  useEffect(() => {
    if (checklist.length > 0 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [checklist, scannedSurplus, alertMessage]);

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
            if (data.length < step) {
              keepFetching = false; 
            }
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

  const generateMatchKey = (str) => {
    if (!str) return '';
    return String(str)
      .normalize('NFC')                   
      .toLowerCase()                      
      .replace(/[\u200B-\u200D\uFEFF]/g, '') 
      .replace(/[–—\-]/g, '')             
      .replace(/\s+/g, '');               
  };

  // --- HÀM TẠO ÂM THANH MỚI - PHÂN BIỆT RÕ RÀNG 3 TRƯỜNG HỢP ---
  const playSound = (type) => {
    if (!soundEnabled) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();

      if (type === 'success') {
        // 1. Đúng hàng: 1 tiếng "Tít" trong trẻo, ngắn
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime); 
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
      } 
      else if (type === 'warning') {
        // 2. Dư hàng: 2 tiếng "Tít Tít" liên tiếp
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'triangle'; 
          osc.frequency.setValueAtTime(900, ctx.currentTime + i * 0.15);
          
          gain.gain.setValueAtTime(0, ctx.currentTime); 
          gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + i * 0.15 + 0.1);
          
          osc.start(ctx.currentTime + i * 0.15);
          osc.stop(ctx.currentTime + i * 0.15 + 0.1);
        }
      } 
      else if (type === 'error') {
        // 3. Sai hàng (Mã lạ): Kêu "Rè rè" trầm cảnh báo
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "\uFEFFTên sản phẩm,Số lượng hoàn\nÁo thun MARIKA - Trắng - M,5\nQuần Jean SYRRA - Xanh - L,3";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "File_Mau_Don_Hoan.csv";
    link.click();
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
      inventoryMap.forEach(item => {
        const key = generateMatchKey(item.product_name);
        dbDictionary.set(key, item);
      });

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
          
          parsedMap.set(csvKey, {
            id: dbMatch ? dbMatch.product_id : 'N/A',
            code: dbMatch ? dbMatch.product_code : 'N/A',
            name: name, 
            expectedQty: qty,
            scannedQty: 0,
            matchKey: csvKey 
          });
        }
      }
      setChecklist(Array.from(parsedMap.values()));
    };
    reader.readAsText(file);
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const code = inputCode.trim().toUpperCase(); 
    if (!code) return;
    
    setAlertMessage(null);

    const dbMatch = inventoryMap.find(item => 
      String(item.product_code).toUpperCase() === code || 
      String(item.product_id).toUpperCase() === code
    );

    const actualCodeToMatch = dbMatch ? String(dbMatch.product_code).toUpperCase() : code;
    const actualIdToMatch = dbMatch ? String(dbMatch.product_id).toUpperCase() : code;

    const targetIndex = checklist.findIndex(item => 
      item.code === code || item.id === code || 
      item.code === actualCodeToMatch || item.id === actualIdToMatch || 
      item.id === actualCodeToMatch || item.code === actualIdToMatch 
    );

    if (targetIndex !== -1) {
      const updatedChecklist = [...checklist];
      const targetItem = updatedChecklist[targetIndex];
      
      targetItem.scannedQty += 1;

      if (targetItem.scannedQty > targetItem.expectedQty) {
        playSound('warning'); // Bíp đúp cảnh báo dư
        setAlertMessage({ type: 'warning', text: `⚠️ CHÚ Ý: Mã [${targetItem.name}] quét DƯ (Lên ${targetItem.scannedQty}/${targetItem.expectedQty}).` });
      } else {
        playSound('success'); // Bíp đơn báo đúng
        if (targetItem.scannedQty === targetItem.expectedQty) {
          setAlertMessage({ type: 'success', text: `✅ Mã [${targetItem.name}] đã ĐỦ SỐ LƯỢNG!` });
        }
      }

      setChecklist(updatedChecklist);
    } else {
      playSound('error'); // Kêu rè rè báo lỗi mã lạ
      const existingSurplusIndex = scannedSurplus.findIndex(item => item.code === actualCodeToMatch);
      if (existingSurplusIndex !== -1) {
        const updatedSurplus = [...scannedSurplus];
        updatedSurplus[existingSurplusIndex].scannedQty += 1;
        setScannedSurplus(updatedSurplus);
      } else {
        setScannedSurplus(prev => [...prev, {
          code: actualCodeToMatch !== code ? actualCodeToMatch : code,
          name: dbMatch ? dbMatch.product_name : 'Mã vạch lạ không rõ trên hệ thống',
          scannedQty: 1
        }]);
      }
      setAlertMessage({ type: 'danger', text: `🚨 BÁO ĐỘNG ĐỎ: Quét trúng mã lạ hoặc dư thừa ngoài danh sách!` });
    }

    setInputCode(''); 
  };

  const totalExpected = checklist.reduce((sum, item) => sum + item.expectedQty, 0);
  const totalScannedValid = checklist.reduce((sum, item) => sum + item.scannedQty, 0);
  const totalSurplus = scannedSurplus.reduce((sum, item) => sum + item.scannedQty, 0);

  const resetAudit = () => {
    if(confirm("Bạn có chắc muốn làm trống toàn bộ dữ liệu kiểm hàng hiện tại?")) {
      setChecklist([]);
      setScannedSurplus([]);
      setFileName('');
      setAlertMessage(null);
    }
  };

  const exportFinalReport = () => {
    let csvContent = "\uFEFF"; 
    csvContent += "Mã Sản Phẩm,Tên Sản Phẩm,Số Lượng Hoàn,Thực Tế,Trạng Thái Chênh Lệch\n";

    checklist.forEach(item => {
      const diff = item.scannedQty - item.expectedQty;
      let statusText = diff === 0 ? 'Khớp đủ' : (diff > 0 ? `Dư ${diff}` : `Thiếu ${Math.abs(diff)}`);
      csvContent += `"${item.code || item.id}","${item.name}","${item.expectedQty}","${item.scannedQty}","${statusText}"\n`;
    });

    if (scannedSurplus.length > 0) {
      csvContent += "\n--- DANH SÁCH SẢN PHẨM LẠ KHÔNG CÓ TRONG LIST HOÀN---\n";
      scannedSurplus.forEach(item => {
        csvContent += `"${item.code}","${item.name}","0","${item.scannedQty}","Sản phẩm dư"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Chot_So_Hoan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><ScanBarcode size={22} /></span>
            Kiểm tra và Chốt số lượng Hoàn
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">Đối chiếu lại số lượng sản phẩm hoàn</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className={`px-3 py-2 text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center cursor-pointer ${
              soundEnabled ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {checklist.length > 0 && (
            <>
              <button onClick={resetAudit} className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                <RotateCcw size={14} /> Bắt đầu lại
              </button>
              <button onClick={exportFinalReport} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer">
                <Download size={14} /> Tải biên bản
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-4 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl flex justify-center items-center gap-2 border border-blue-100">
          <Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu tồn kho (có thể mất vài giây vì kho lớn)...
        </div>
      )}

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
              <input type="file" accept=".csv, .txt" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Súng quét Barcode / SKU</label>
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <input 
                  ref={inputRef}
                  type="text"
                  placeholder="Tạch tạch mã vạch vào đây..."
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
                      <th className="py-3 px-4 text-center">Số lượng hoàn theo báo cáo</th>
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
                <h3 className="text-xs font-black text-red-700 uppercase tracking-wide">Sản phẩm không có trong danh sách hoàn ({scannedSurplus.length})</h3>
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
    </div>
  );
}