import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Boxes, Search, RefreshCw, ChevronLeft, ChevronRight, FileX, Package, 
  Truck, Home, Printer, FileSpreadsheet, UploadCloud, Download, Plus, Trash2, X, Settings2
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function InventoryReport() {
  // ==========================================
  // STATES BÁO CÁO TỒN KHO GỐC
  // ==========================================
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // ==========================================
  // STATES CHO MODAL IN MÃ VẠCH
  // ==========================================
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printItems, setPrintItems] = useState([]); 
  const [printSearchTerm, setPrintSearchTerm] = useState('');
  const [printSearchResults, setPrintSearchResults] = useState([]);
  const [isSearchingPrint, setIsSearchingPrint] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  // STATE CHO SETTINGS IN ẤN
  const [printConfig, setPrintConfig] = useState({
    shopName: 'AMELIE',
    showShopName: true,
    showProductName: true,
    showPrintDate: false
  });

  const searchInputRef = useRef(null);

  // --- HÀM KÉO DATA BÁO CÁO TỒN KHO ---
  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('product_inventories')
        .select('product_code, product_name, remain, shipping, on_hand', { count: 'exact' });

      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        query = query.or(`product_name.ilike.%${term}%,product_code.ilike.%${term}%`);
      }

      const from = currentPage * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('remain', { ascending: false }) 
        .range(from, to);

      if (error) throw error;

      setInventory(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("❌ Lỗi tải báo cáo tồn kho:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [currentPage]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(0); 
    fetchInventoryData();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // ==========================================
  // LUỒNG XỬ LÝ CHỨC NĂNG IN MÃ VẠCH
  // ==========================================

const normalizeString = (str) => {
    if (!str) return '';
    return String(str)
      .normalize('NFC')
      .replace(/[\u2013\u2014]/g, '-') // Ép En-dash và Em-dash về dấu gạch ngang chuẩn
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  };
  const stripToCompare = (str) => {
    return normalizeString(str).replace(/[\s-]/g, '');
  };
  const downloadPrintTemplate = () => {
    const csvContent = "\uFEFFTên sản phẩm,Số lượng in\nPRISCA 610 - Beige - S,5\nLULLABY 133 - Trắng - M,3";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Mau_In_Ma_Vach.csv";
    link.click();
  };

  const searchProductForPrint = async (e) => {
    e.preventDefault();
    if (!printSearchTerm.trim()) return;
    setIsSearchingPrint(true);
    try {
      const { data, error } = await supabase
        .from('product_inventories')
        .select('product_code, product_name')
        .or(`product_name.ilike.%${printSearchTerm.trim()}%,product_code.ilike.%${printSearchTerm.trim()}%`)
        .limit(5);

      if (error) throw error;
      setPrintSearchResults(data || []);
    } catch (err) {
      console.error("Lỗi tìm sản phẩm in:", err);
    } finally {
      setIsSearchingPrint(false);
    }
  };

  const addManualPrintItem = (prod) => {
    if (!prod.product_code) {
      alert(`Sản phẩm ${prod.product_name} chưa có Mã vạch (Barcode)!`);
      return;
    }
    setPrintItems(prev => {
      const existing = prev.find(i => i.barcode === prod.product_code);
      if (existing) {
        return prev.map(i => i.barcode === prod.product_code ? { ...i, qty: i.qty + 1 } : i);
      }
      return [{ name: prod.product_name, barcode: prod.product_code, qty: 1, status: 'ok' }, ...prev];
    });
    setPrintSearchTerm('');
    setPrintSearchResults([]);
    if(searchInputRef.current) searchInputRef.current.focus();
  };

  const handlePrintFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileLoading(true);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length <= 1) {
          throw new Error("File không có dòng dữ liệu nào ngoài tiêu đề.");
        }

        // --- 🧠 TRÍ TUỆ NHÂN TẠO: ĐỊNH VỊ CỘT THEO TÊN HEADER ---
        let nameIdx = 0;
        let qtyIdx = 1;
        let barcodeIdx = -1;

        if (rows[0] && Array.isArray(rows[0])) {
          const headers = rows[0].map(h => String(h).toLowerCase().trim());
          
          // Dò tìm cột Tên sản phẩm
          const foundNameIdx = headers.findIndex(h => h.includes('tên') || h.includes('name') || h.includes('sản phẩm'));
          if (foundNameIdx !== -1) nameIdx = foundNameIdx;

          // Dò tìm cột Số lượng
          const foundQtyIdx = headers.findIndex(h => h.includes('số lượng') || h.includes('sl') || h.includes('qty') || h.includes('quantity') || h.includes('in'));
          if (foundQtyIdx !== -1) qtyIdx = foundQtyIdx;

          // Dò tìm cột Mã vạch / Barcode (Nếu dùng file xuất của Nhanh)
          const foundBarcodeIdx = headers.findIndex(h => h.includes('vạch') || h.includes('barcode') || h.includes('mã sản phẩm') || h.includes('code'));
          if (foundBarcodeIdx !== -1) barcodeIdx = foundBarcodeIdx;
        }

        const parsedMap = new Map();

        // Đọc dữ liệu từ dòng 1 (bỏ qua dòng tiêu đề)
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length === 0) continue; 
          
          const name = cols[nameIdx] ? String(cols[nameIdx]).trim() : '';
          const qty = parseInt(cols[qtyIdx], 10) || 1;
          const fileBarcode = barcodeIdx !== -1 && cols[barcodeIdx] ? String(cols[barcodeIdx]).trim().toUpperCase() : '';
          
          if (!name && !fileBarcode) continue;
          
          // Dùng Barcode làm khóa gộp ưu tiên, nếu không có thì gộp theo Tên chuẩn hóa
          const pivotKey = fileBarcode || normalizeString(name);
          
          if (parsedMap.has(pivotKey)) {
            parsedMap.get(pivotKey).qty += qty;
          } else {
            parsedMap.set(pivotKey, { originalName: name, fileBarcode: fileBarcode, qty: qty });
          }
        }

        let currentDB = [];
        let fetchPage = 0;
        let hasMoreDB = true;

        while (hasMoreDB) {
          const { data: chunk, error } = await supabase
            .from('product_inventories')
            .select('product_code, product_name')
            .range(fetchPage * 1000, (fetchPage + 1) * 1000 - 1);

          if (error) throw error;

          if (chunk && chunk.length > 0) {
            currentDB = [...currentDB, ...chunk]; // Gộp cục data mới vào rổ
            fetchPage++;
            if (chunk.length < 1000) hasMoreDB = false; // Nếu cục cuối cùng < 1000 dòng tức là đã vét sạch kho
          } else {
            hasMoreDB = false;
          }
        }
        // ========================================================

        // Xây dựng 3 tầng từ điển từ toàn bộ currentDB vừa vét được
        const dbByBarcode = new Map();
        const dbByNameStandard = new Map();
        const dbByNameStripped = new Map();

        currentDB.forEach(item => {
          if (item.product_code) {
            dbByBarcode.set(String(item.product_code).trim().toUpperCase(), item);
          }
          if (item.product_name) {
            dbByNameStandard.set(normalizeString(item.product_name), item);
            dbByNameStripped.set(stripToCompare(item.product_name), item);
          }
        });

        // Tiến hành quét Cross-match bảo vệ 3 tầng
        const newPrintItems = [];
        
        parsedMap.forEach((val) => {
          let match = null;

          // Tầng 1: Khớp bằng Barcode có sẵn trong file (Nếu có)
          if (val.fileBarcode) {
            match = dbByBarcode.get(val.fileBarcode);
          }

          // Tầng 2: Khớp bằng Tên chuẩn hóa NFC tiếng Việt
          if (!match && val.originalName) {
            match = dbByNameStandard.get(normalizeString(val.originalName));
          }

          // Tầng 3: Khớp mù (Xóa sạch khoảng trắng và gạch ngang)
          if (!match && val.originalName) {
            match = dbByNameStripped.get(stripToCompare(val.originalName));
          }

          if (match && match.product_code) {
            newPrintItems.push({
              name: match.product_name,
              barcode: match.product_code,
              qty: val.qty,
              status: 'ok'
            });
          } else {
            newPrintItems.push({
              name: val.originalName || `Mã vạch: ${val.fileBarcode}`,
              barcode: 'KHÔNG TÌM THẤY',
              qty: val.qty,
              status: 'error'
            });
          }
        });

        // Trộn dữ liệu vào danh sách chờ in
        setPrintItems(prev => {
          const merged = [...prev];
          newPrintItems.forEach(newItem => {
            if (newItem.status === 'ok') {
              const existing = merged.find(i => i.barcode === newItem.barcode);
              if (existing) existing.qty += newItem.qty;
              else merged.push(newItem);
            } else {
              merged.push(newItem);
            }
          });
          return merged;
        });

      } catch (err) {
        alert('❌ Lỗi đọc file: ' + err.message);
      } finally {
        setFileLoading(false);
        e.target.value = null; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updatePrintQty = (index, newQty) => {
    const val = parseInt(newQty, 10) || 0;
    setPrintItems(prev => prev.map((item, i) => i === index ? { ...item, qty: val } : item));
  };

  const removePrintItem = (index) => {
    setPrintItems(prev => prev.filter((_, i) => i !== index));
  };

  const generatePrintJob = () => {
    const validItems = printItems.filter(i => i.status === 'ok' && i.qty > 0);
    if (validItems.length === 0) {
      alert("Không có mã vạch hợp lệ nào để in!");
      return;
    }

    const flatItems = [];
    validItems.forEach(item => {
      for (let i = 0; i < item.qty; i++) {
        flatItems.push(item);
      }
    });

    const chunks = [];
    for (let i = 0; i < flatItems.length; i += 3) {
      chunks.push(flatItems.slice(i, i + 3));
    }

    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    let barcodeHeight = 40;
    if (printConfig.showShopName && printConfig.showProductName) barcodeHeight = 30; 
    else if (!printConfig.showShopName && !printConfig.showProductName) barcodeHeight = 55; 
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In Tem Mã Vạch</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page {
            size: 105mm 22mm;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            width: 105mm;
            background: white;
          }
          .row {
            display: flex;
            width: 105mm;
            height: 22mm;
            page-break-after: always;
            box-sizing: border-box;
            padding: 1mm 0;
          }
          .label {
            position: relative;
            width: 35mm;
            height: 20mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            text-align: center;
            box-sizing: border-box;
            padding: 0 1mm;
          }
          .shop-name {
            font-size: 7px;
            font-weight: bold;
            margin-bottom: 0.5mm;
            text-transform: uppercase;
          }
          .barcode-container {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
          }
          .barcode-container svg {
            width: 100%;
            max-height: 12mm;
          }
          .product-name {
            font-size: 6px;
            line-height: 1.2;
            width: 100%;
            height: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-top: 0.5mm;
          }
          .print-date {
            position: absolute;
            bottom: 0.5mm;
            right: 1mm;
            font-size: 4px;
            color: #333;
          }
        </style>
      </head>
      <body>
    `;

    chunks.forEach(chunk => {
      htmlContent += `<div class="row">`;
      chunk.forEach(item => {
        htmlContent += `
          <div class="label">
            ${printConfig.showShopName ? `<div class="shop-name">${printConfig.shopName}</div>` : ''}
            
            <div class="barcode-container">
              <svg class="barcode" 
                   jsbarcode-value="${item.barcode}"
                   jsbarcode-displayvalue="true"
                   jsbarcode-fontsize="16"
                   jsbarcode-height="${barcodeHeight}"
                   jsbarcode-width="1.8"
                   jsbarcode-margin="0"
                   jsbarcode-textmargin="0">
              </svg>
            </div>
            
            ${printConfig.showProductName ? `<div class="product-name">${item.name}</div>` : ''}
            ${printConfig.showPrintDate ? `<div class="print-date">${today}</div>` : ''}
          </div>
        `;
      });
      for(let i = chunk.length; i < 3; i++) {
        htmlContent += `<div class="label"></div>`;
      }
      htmlContent += `</div>`;
    });

    htmlContent += `
        <script>
          JsBarcode(".barcode").init();
          setTimeout(() => { window.print(); }, 500);
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 provinces pb-10 animate-in fade-in duration-300">
      
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Boxes size={18} /></span>
            BÁO CÁO TỒN KHO
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Theo dõi tồn kho</p>
        </div>

        <div className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-4 py-2.5 rounded-xl shadow-inner">
          Tổng số mặt hàng (SKU): <span className="text-blue-600 font-black text-sm">{totalCount}</span> mã
        </div>
      </div>

      {/* 2. THANH TÌM KIẾM & NÚT IN MÃ VẠCH */}
      <div className="w-full flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm theo tên sản phẩm hoặc mã SKU..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition shadow-sm"
            />
          </div>
          <button type="submit" className="px-5 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm flex-shrink-0">
            Tìm kiếm
          </button>
        </form>

        <button 
          onClick={() => setShowPrintModal(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
        >
          <Printer size={16} /> In mã vạch (Tem 105x22mm)
        </button>
      </div>

      {/* 3. BẢNG HIỂN THỊ DỮ LIỆU TỒN KHO */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 font-bold uppercase border-b border-slate-200/80">
                <th className="p-4 w-44">Mã vạch</th>
                <th className="p-4">Tên sản phẩm</th>
                <th className="p-4 w-32 text-center">Tổng tồn</th>
                <th className="p-4 w-32 text-center">Đang chuyển</th>
                <th className="p-4 w-36 text-center">Tồn trong kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400 animate-pulse font-bold">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Đang bốc tách dữ liệu kho hàng...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400 font-medium">
                    <FileX size={36} className="mx-auto mb-2 text-slate-300" />
                    Không tìm thấy sản phẩm nào.
                  </td>
                </tr>
              ) : (
                inventory.map(item => (
                  <tr key={item.product_code} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-black text-slate-900 tracking-wide font-mono text-[11px]">{item.product_code}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 text-slate-500 rounded-md"><Package size={12} /></div>
                        <span className="font-bold text-slate-800 text-xs truncate max-w-sm" title={item.product_name}>{item.product_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-black min-w-[56px] justify-center">
                        {item.remain}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black min-w-[56px] justify-center border ${Number(item.shipping) > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400 font-medium'}`}>
                        {Number(item.shipping) > 0 && <Truck size={10} />} {item.shipping}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black min-w-[64px] justify-center border ${Number(item.on_hand) > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600 text-sm' : 'bg-red-50 border-red-100 text-red-500'}`}>
                        {Number(item.on_hand) > 0 && <Home size={10} />} {item.on_hand}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Trang {currentPage + 1} / {totalPages}</span>
            <div className="flex gap-1.5">
              <button onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))} disabled={currentPage === 0 || loading} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"><ChevronLeft size={16} /></button>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))} disabled={currentPage === totalPages - 1 || loading} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* ⚡️ MODAL IN MÃ VẠCH */}
      {/* ========================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl"><Printer size={20}/></div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">In mã vạch sản phẩm</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Khổ giấy cuộn: 105x22mm (3 tem/hàng)</p>
                </div>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition cursor-pointer"><X size={18} /></button>
            </div>

            {/* Body Modal - Chia 3 Cột (2 Cột Trái : 1 Cột Phải) */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 bg-slate-50/30">
              
              {/* KHU VỰC TRÁI (2/3): NHẬP LIỆU VÀ DANH SÁCH */}
              <div className="lg:col-span-2 flex flex-col border-r border-slate-200/60 p-6 h-full overflow-hidden">
                
                {/* Dòng 1: Tìm tay & Upload */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Cục Tìm tay */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">1. Tìm và Thêm thủ công</label>
                    <form onSubmit={searchProductForPrint} className="relative flex gap-2">
                      
                      {/* ⚡️ VÁ LỖI TRÀN MÀN HÌNH: Bao bọc Dropdown bên trong thẻ relative của Input */}
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                        <input 
                          ref={searchInputRef}
                          type="text" placeholder="Gõ tên hoặc mã..." value={printSearchTerm}
                          onChange={e => setPrintSearchTerm(e.target.value)}
                          className="w-full text-xs font-bold pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:bg-white transition"
                        />

                        {/* Thẻ Dropdown được đặt absolute ngay bên dưới và bám chặt theo width của Input */}
                        {printSearchResults.length > 0 && (
                          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto z-50">
                            {printSearchResults.map(prod => (
                              <div key={prod.product_code} className="p-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition" onClick={() => addManualPrintItem(prod)}>
                                <div className="flex flex-col overflow-hidden pr-2">
                                  <span className="text-[10.5px] font-bold text-slate-800 truncate">{prod.product_name}</span>
                                </div>
                                <Plus size={14} className="text-blue-500 flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button type="submit" disabled={isSearchingPrint} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition cursor-pointer flex-shrink-0">
                        Tìm
                      </button>
                    </form>
                  </div>

                  {/* Cục Upload */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
                    {fileLoading && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-blue-600 font-bold gap-2 text-xs rounded-2xl"><RefreshCw size={20} className="animate-spin" /> Xử lý...</div>}
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">2. Upload Excel / CSV (Pivot tự động)</label>
                    <div className="flex gap-2 h-8">
                      <button onClick={downloadPrintTemplate} type="button" className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1">
                        <Download size={12} /> File Mẫu
                      </button>
                      <label className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition cursor-pointer flex items-center justify-center gap-1">
                        <UploadCloud size={12} /> Tải file lên
                        <input type="file" accept=".csv, .txt, .xlsx, .xls" className="hidden" onChange={handlePrintFileUpload} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Dòng 2: Danh sách in (Flex-1 để tự động chiếm hết chiều cao còn lại) */}
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <span className="font-black text-xs text-slate-700 uppercase tracking-wide">Danh sách chờ in ({printItems.length} mã)</span>
                    {printItems.length > 0 && <button onClick={() => setPrintItems([])} className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer flex items-center gap-1"><Trash2 size={12}/> Xóa tất cả</button>}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
                    {printItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        <FileSpreadsheet size={32} className="text-slate-300" />
                        <span className="text-xs font-bold">Chưa có sản phẩm nào được chọn.</span>
                      </div>
                    ) : (
                      printItems.map((item, idx) => (
                        <div key={idx} className={`p-3 rounded-xl flex items-center gap-3 border transition ${item.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200 shadow-sm hover:border-blue-300'}`}>
                          <div className="flex-1 overflow-hidden">
                            <div className={`text-xs font-bold truncate ${item.status === 'error' ? 'text-red-800 line-through' : 'text-slate-800'}`} title={item.name}>{item.name}</div>
                            <div className={`text-[10px] font-mono tracking-widest mt-0.5 ${item.status === 'error' ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{item.barcode}</div>
                          </div>
                          
                          {item.status === 'ok' ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">SL:</span>
                              <input 
                                type="number" min="1" value={item.qty} 
                                onChange={(e) => updatePrintQty(idx, e.target.value)}
                                className="w-14 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                              />
                              <button onClick={() => removePrintItem(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"><X size={14}/></button>
                            </div>
                          ) : (
                            <button onClick={() => removePrintItem(idx)} className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition cursor-pointer text-[10px] font-black uppercase flex-shrink-0">
                              Xóa lỗi
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* KHU VỰC PHẢI (1/3): CÀI ĐẶT IN ẤN & NÚT PRINT */}
              <div className="lg:col-span-1 bg-white p-6 h-full flex flex-col justify-between overflow-y-auto">
                
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Settings2 size={18} className="text-slate-700" />
                    <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide">Cài đặt</h3>
                  </div>

                  {/* Tùy chọn 1: Tên Shop */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Hiển thị Tên Shop</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={printConfig.showShopName} onChange={() => setPrintConfig({...printConfig, showShopName: !printConfig.showShopName})} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {printConfig.showShopName && (
                      <input 
                        type="text" 
                        value={printConfig.shopName}
                        onChange={(e) => setPrintConfig({...printConfig, shopName: e.target.value})}
                        placeholder="Nhập tên shop..."
                        className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition uppercase"
                      />
                    )}
                  </div>

                  {/* Tùy chọn 2: Tên Sản Phẩm */}
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-700">Hiển thị Tên Sản Phẩm</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={printConfig.showProductName} onChange={() => setPrintConfig({...printConfig, showProductName: !printConfig.showProductName})} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Tùy chọn 3: Ngày In */}
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Ghi chú Ngày in lô</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">Hiển thị nhỏ ở góc phải tem</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={printConfig.showPrintDate} onChange={() => setPrintConfig({...printConfig, showPrintDate: !printConfig.showPrintDate})} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Khối Button Print (Luôn dính dưới đáy cột Setting) */}
                <div className="pt-6 mt-6 border-t border-slate-100">
                  <button 
                    onClick={generatePrintJob}
                    disabled={printItems.filter(i => i.status === 'ok' && i.qty > 0).length === 0}
                    className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-black shadow-lg shadow-blue-500/30 transition cursor-pointer flex items-center justify-center gap-2 hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none"
                  >
                    <Printer size={18} /> Tạo bản in
                  </button>
                  <p className="text-center text-[10px] text-slate-400 font-medium mt-3">Hệ thống sẽ mở Tab mới để in. Vui lòng tắt chặn Pop-up trình duyệt nếu có.</p>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}