import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getXmasEnabled } from '../lib/xmas';
import { 
  Boxes, Search, RefreshCw, ChevronLeft, ChevronRight, FileX, Package, 
  Truck, Home, Printer, FileSpreadsheet, UploadCloud, Download, Plus, Trash2, X, Settings2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Vị trí góc tem cho Số lệnh (dùng chung cho bản xem trước và bản in thật)
const ORDER_CORNER_STYLE = {
  'top-left': { top: '0.5mm', left: '1mm' },
  'top-right': { top: '0.5mm', right: '1mm' },
  'bottom-left': { bottom: '0.5mm', left: '1mm' },
  'bottom-right': { bottom: '0.5mm', right: '1mm' },
};

// Một tem mẫu trong dải xem trước: cùng bố cục với bản in thật (35mm x 20mm),
// chỉ khác là vẽ mã vạch/QR bằng thư viện JS ngay trong trang để xem trực tiếp.
function PreviewLabel({ item, config }) {
  const svgRef = useRef(null);
  const [qrUrl, setQrUrl] = useState('');
  const [xmasOn, setXmasOn] = useState(true);
  useEffect(() => {
    let alive = true;
    getXmasEnabled().then(v => { if (alive) setXmasOn(v); });
    return () => { alive = false; };
  }, []);
  const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  useEffect(() => {
    if (config.codeType !== 'barcode' || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, item.barcode, {
        format: 'CODE128', width: config.barcodeWidth, height: config.barcodeHeight,
        displayValue: false, margin: 0,
      });
    } catch { /* mã lỗi thì vẫn hiện chữ mã bên dưới */ }
  }, [item.barcode, config.codeType, config.barcodeWidth, config.barcodeHeight]);

  useEffect(() => {
    if (config.codeType !== 'qrcode') return;
    let alive = true;
    QRCode.toDataURL(item.barcode, { width: config.qrSize * 2, margin: 0 })
      .then(url => { if (alive) setQrUrl(url); })
      .catch(() => { if (alive) setQrUrl(''); });
    return () => { alive = false; };
  }, [item.barcode, config.codeType, config.qrSize]);

  const showOrder = config.showOrderNumber && config.orderNumber.trim() !== '';
  return (
    <div style={{ position: 'relative', width: '35mm', height: '20mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', textAlign: 'center', boxSizing: 'border-box', padding: '0 1mm', background: 'white', border: '1px dashed #cbd5e1' }}>
      {config.showShopName && <div style={{ fontSize: 7, fontWeight: 'bold', marginBottom: '0.5mm', textTransform: 'uppercase', overflowWrap: 'anywhere', width: '100%' }}>{config.shopName}</div>}
      <div style={{ transform: `scale(${config.codeScale / 100})`, transformOrigin: 'center center', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {config.codeType === 'barcode' ? (
          <>
            <svg ref={svgRef} style={{ width: '100%', maxHeight: '12mm' }} />
            <div style={{ fontSize: 8, fontWeight: 'bold', width: '100%', wordBreak: 'break-all', overflowWrap: 'anywhere', lineHeight: 1.2 }}>{item.barcode}</div>
          </>
        ) : (
          <>
            {qrUrl ? <img src={qrUrl} alt="" style={{ width: config.qrSize, height: config.qrSize }} /> : <div style={{ width: config.qrSize, height: config.qrSize, background: '#f1f5f9' }} />}
            <div style={{ fontSize: 8, fontWeight: 'bold', marginTop: 2, letterSpacing: '0.5px', width: '100%', wordBreak: 'break-all', overflowWrap: 'anywhere', lineHeight: 1.2 }}>{item.barcode}</div>
          </>
        )}
      </div>
      {config.showProductName && <div style={{ fontSize: 8.5, fontWeight: 'bold', lineHeight: 1.2, width: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word', marginTop: '0.5mm' }}>{item.name}</div>}
      {config.showPrintDate && <div style={{ position: 'absolute', bottom: '0.5mm', right: '1mm', fontSize: 4, color: '#333' }}>{today}</div>}
      {showOrder && <div style={{ position: 'absolute', fontWeight: 'bold', lineHeight: 1, zIndex: 2, fontSize: config.orderFontSize, ...ORDER_CORNER_STYLE[config.orderCorner] }}>{config.orderNumber}</div>}
    </div>
  );
}

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

  // STATE CHO SETTINGS IN ẤN (Bổ sung cấu hình Scale)
  const [printConfig, setPrintConfig] = useState({
    shopName: 'AMELIE',
    showShopName: true,
    showProductName: true,
    showPrintDate: false,
    codeType: 'barcode', 
    barcodeWidth: 1.2,   
    barcodeHeight: 26,   
    qrSize: 45,
    codeScale: 100,      // Tỷ lệ scale tổng thể (%)
    orderNumber: '',     // Số lệnh in ở góc tem (để trống = không in)
    showOrderNumber: true,
    orderCorner: 'top-right', // top-left | top-right | bottom-left | bottom-right
    orderFontSize: 7,    // Cỡ chữ số lệnh (px)
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
      console.error(" Lỗi tải báo cáo tồn kho:", err.message);
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
      .replace(/[\u2013\u2014]/g, '-')
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

        let nameIdx = 0;
        let qtyIdx = 1;
        let barcodeIdx = -1;

        if (rows[0] && Array.isArray(rows[0])) {
          const headers = rows[0].map(h => String(h).toLowerCase().trim());
          
          const foundNameIdx = headers.findIndex(h => h.includes('tên') || h.includes('name') || h.includes('sản phẩm'));
          if (foundNameIdx !== -1) nameIdx = foundNameIdx;

          const foundQtyIdx = headers.findIndex(h => h.includes('số lượng') || h.includes('sl') || h.includes('qty') || h.includes('quantity') || h.includes('in'));
          if (foundQtyIdx !== -1) qtyIdx = foundQtyIdx;

          const foundBarcodeIdx = headers.findIndex(h => h.includes('vạch') || h.includes('barcode') || h.includes('mã sản phẩm') || h.includes('code'));
          if (foundBarcodeIdx !== -1) barcodeIdx = foundBarcodeIdx;
        }

        const parsedMap = new Map();

        // Định dạng file kế toán (ma trận size): 1 dòng = 1 mẫu, số lượng
        // rải theo từng cột size, tên mẫu kèm mã màu (vd 'AMARA 768-BE').
        // Khớp theo TÊN (chuẩn nhất): tên gốc + màu + size -> tên trong kho
        // (vd 'AMARA 768 - Beige - S'). Mã SKU trong file không dùng để khớp
        // vì khác mã trong kho; mã vạch in ra lấy từ sản phẩm đã khớp tên.
        const lowerHeaders = (rows[0] && Array.isArray(rows[0]))
          ? rows[0].map(h => String(h ?? '').toLowerCase().trim())
          : [];
        const isAccountingFile = lowerHeaders.some(h => h.includes('tên vật tư'))
          && lowerHeaders.some(h => h.includes('màu'))
          && ['xs', 's', 'm', 'l', 'xl'].some(sz => lowerHeaders.includes(sz));

        if (isAccountingFile) {
          const SIZE_LIST = ['XS', 'S', 'M', 'L', 'XL'];
          const accNameIdx = lowerHeaders.findIndex(h => h.includes('tên vật tư'));
          const accColorIdx = lowerHeaders.findIndex(h => h.includes('màu'));
          // Cột số lượng theo size = lần xuất hiện ĐẦU TIÊN của mỗi nhãn size
          // (khối cột size sau là mã SKU, không dùng ở đây).
          const qtyColBySize = {};
          SIZE_LIST.forEach(sz => {
            const idx = lowerHeaders.findIndex(h => h === sz.toLowerCase());
            if (idx !== -1) qtyColBySize[sz] = idx;
          });
          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (!cols || cols.length === 0) continue;
            const rawName = cols[accNameIdx] ? String(cols[accNameIdx]).trim() : '';
            if (!rawName) continue;
            // Tên gốc: bỏ đoạn mã màu sau dấu '-' cuối cùng.
            const dashIdx = rawName.lastIndexOf('-');
            const baseName = dashIdx > 0 ? rawName.slice(0, dashIdx).trim() : rawName;
            const colorName = accColorIdx !== -1 && cols[accColorIdx] ? String(cols[accColorIdx]).trim() : '';
            SIZE_LIST.forEach(sz => {
              const qIdx = qtyColBySize[sz];
              if (qIdx === undefined) return;
              const qty = parseInt(cols[qIdx], 10) || 0;
              if (qty <= 0) return;
              const composite = colorName ? `${baseName} - ${colorName} - ${sz}` : `${baseName} - ${sz}`;
              const key = normalizeString(composite);
              if (parsedMap.has(key)) {
                parsedMap.get(key).qty += qty;
              } else {
                parsedMap.set(key, { originalName: composite, fileBarcode: '', qty });
              }
            });
          }
        } else {
          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if (!cols || cols.length === 0) continue;

            const name = cols[nameIdx] ? String(cols[nameIdx]).trim() : '';
            const qty = parseInt(cols[qtyIdx], 10) || 1;
            const fileBarcode = barcodeIdx !== -1 && cols[barcodeIdx] ? String(cols[barcodeIdx]).trim().toUpperCase() : '';

            if (!name && !fileBarcode) continue;

            const pivotKey = fileBarcode || normalizeString(name);

            if (parsedMap.has(pivotKey)) {
              parsedMap.get(pivotKey).qty += qty;
            } else {
              parsedMap.set(pivotKey, { originalName: name, fileBarcode: fileBarcode, qty: qty });
            }
          }
        }

        let currentDB = [];
        let fetchPage = 0;
        let hasMoreDB = true;

        while (hasMoreDB) {
          const { data: chunk, error } = await supabase
            .from('product_inventories')
            .select('product_code, product_name')
            .order('product_code', { ascending: true })
            .range(fetchPage * 1000, (fetchPage + 1) * 1000 - 1);

          if (error) throw error;

          if (chunk && chunk.length > 0) {
            currentDB = [...currentDB, ...chunk]; 
            fetchPage++;
            if (chunk.length < 1000) hasMoreDB = false; 
          } else {
            hasMoreDB = false;
          }
        }

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

        // Đếm tên trùng trong kho: khớp theo tên mà có 2 sản phẩm cùng tên
        // chuẩn hóa thì không được tự chọn bừa, phải để lại cho người rà.
        const nameCounts = new Map();
        currentDB.forEach(item => {
          if (item.product_name) {
            const k = normalizeString(item.product_name);
            nameCounts.set(k, (nameCounts.get(k) || 0) + 1);
          }
        });

        const newPrintItems = [];

        parsedMap.forEach((val) => {
          let match = null;

          if (val.fileBarcode) {
            match = dbByBarcode.get(val.fileBarcode);
          }

          if (!match && val.originalName) {
            match = dbByNameStandard.get(normalizeString(val.originalName));
          }

          if (!match && val.originalName) {
            match = dbByNameStripped.get(stripToCompare(val.originalName));
          }

          if (match && match.product_code) {
            const dupCount = nameCounts.get(normalizeString(match.product_name)) || 0;
            if (!val.fileBarcode && dupCount > 1) {
              newPrintItems.push({
                name: `${val.originalName} (trùng tên trong kho)`,
                barcode: 'KHÔNG TÌM THẤY',
                qty: val.qty,
                status: 'error'
              });
            } else {
              newPrintItems.push({
                name: match.product_name,
                barcode: match.product_code,
                qty: val.qty,
                status: 'ok'
              });
            }
          } else {
            newPrintItems.push({
              name: val.originalName || `Mã vạch: ${val.fileBarcode}`,
              barcode: 'KHÔNG TÌM THẤY',
              qty: val.qty,
              status: 'error'
            });
          }
        });

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
        alert(' Lỗi đọc file: ' + err.message);
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
      alert("Không có mã vạch/QR hợp lệ nào để in!");
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
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In Tem Mã Vạch</title>
        <!-- Import JSBarcode (Cho mã vạch) và QRCodeJS (Cho mã QR) -->
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
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
            width: 100%;
            overflow-wrap: anywhere;
          }
          .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
          }
          .barcode-container svg {
            width: 100%;
            max-height: 12mm;
          }
          .qrcode-wrapper {
             display: flex;
             flex-direction: column;
             align-items: center;
             justify-content: center;
          }
          .code-text {
             font-size: 8px;
             font-weight: bold;
             width: 100%;
             text-align: center;
             line-height: 1.2;
             word-break: break-all;
             overflow-wrap: anywhere;
          }
          .qr-text {
             font-size: 8px;
             font-weight: bold;
             margin-top: 2px;
             letter-spacing: 0.5px;
             width: 100%;
             word-break: break-all;
             overflow-wrap: anywhere;
             line-height: 1.2;
          }
          .product-name {
            font-size: 8.5px;
            font-weight: bold;
            line-height: 1.2;
            width: 100%;
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: anywhere;
            word-break: break-word;
            margin-top: 0.5mm;
          }
          .order-number {
            position: absolute;
            font-weight: bold;
            line-height: 1;
            z-index: 2;
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

    // Vị trí góc tem cho Số lệnh (in HTML, cùng quy ước với bản xem trước)
    const orderCornerStyle = {
      'top-left': 'top:0.5mm;left:1mm;',
      'top-right': 'top:0.5mm;right:1mm;',
      'bottom-left': 'bottom:0.5mm;left:1mm;',
      'bottom-right': 'bottom:0.5mm;right:1mm;',
    }[printConfig.orderCorner] || 'top:0.5mm;right:1mm;';
    const orderNumberHTML = (printConfig.showOrderNumber && printConfig.orderNumber.trim())
      ? `<div class="order-number" style="${orderCornerStyle}font-size:${printConfig.orderFontSize}px;">${escapeHtml(printConfig.orderNumber)}</div>`
      : '';

    chunks.forEach(chunk => {
      htmlContent += `<div class="row">`;
      chunk.forEach(item => {
        let renderCodeHTML = '';

        if (printConfig.codeType === 'barcode') {
          // Chữ mã vẽ bằng HTML (không dùng chữ của JsBarcode) để mã dài tự xuống dòng trong khổ tem
          renderCodeHTML = `
            <svg class="barcode"
                 jsbarcode-value="${escapeHtml(item.barcode)}"
                 jsbarcode-displayvalue="false"
                 jsbarcode-fontsize="08"
                 jsbarcode-height="${printConfig.barcodeHeight}"
                 jsbarcode-width="${printConfig.barcodeWidth}"
                 jsbarcode-margin="0"
                 jsbarcode-textmargin="2">
            </svg>
            <div class="code-text">${escapeHtml(item.barcode)}</div>
          `;
        } else {
          renderCodeHTML = `
            <div class="qrcode-wrapper">
               <div class="qrcode" data-value="${escapeHtml(item.barcode)}"></div>
               <div class="qr-text">${escapeHtml(item.barcode)}</div>
            </div>
          `;
        }

        // ️ SỬ DỤNG transform: scale ĐỂ PHÓNG TO/THU NHỎ TOÀN BỘ CODE
        htmlContent += `
          <div class="label">
            ${printConfig.showShopName ? `<div class="shop-name">${escapeHtml(printConfig.shopName)}</div>` : ''}

            <div class="barcode-container" style="transform: scale(${printConfig.codeScale / 100}); transform-origin: center center;">
              ${renderCodeHTML}
            </div>

            ${printConfig.showProductName ? `<div class="product-name">${escapeHtml(item.name)}</div>` : ''}
            ${printConfig.showPrintDate ? `<div class="print-date">${today}</div>` : ''}
            ${orderNumberHTML}
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
          if ('${printConfig.codeType}' === 'barcode') {
            JsBarcode(".barcode").init();
          } else {
            // Khởi tạo QRCode cho từng phần tử
            document.querySelectorAll('.qrcode').forEach(function(el) {
              new QRCode(el, {
                text: el.getAttribute('data-value'),
                width: ${printConfig.qrSize},
                height: ${printConfig.qrSize},
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L
              });
            });
          }
          
          // Đợi render hoàn tất
          setTimeout(() => { window.print(); }, 800);
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Hàng tem xem trước: 3 tem hợp lệ đầu tiên, chưa có thì dùng 1 tem mẫu + 2 ô trống
  const previewRow = (() => {
    const valid = printItems.filter(i => i.status === 'ok' && i.qty > 0);
    const base = valid.length > 0 ? valid.slice(0, 3) : [{ name: 'SẢN PHẨM MẪU', barcode: '1234567890123' }];
    while (base.length < 3) base.push({ name: '', barcode: '' });
    return base;
  })();

  return (
    <div className="space-y-6 provinces pb-10 animate-in fade-in duration-300">
      
      {/* 1. HEADER */}
      <div className={`sticky top-0 z-30 flex flex-col md:flex-row justify-between items-start md:items-center p-6 ${xmasOn ? 'bg-gradient-to-r from-[#DFF4FF] via-[#EFF8FF] to-[#DFF4FF] border border-[#BFE3F7]' : 'bg-white border border-slate-200'} rounded-2xl shadow-sm gap-4`}>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg"><Boxes size={20} /></span>
            BÁO CÁO TỒN KHO
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Theo dõi tồn kho</p>
        </div>

        <div className="text-sm font-bold text-slate-600 bg-emerald-50 border border-emerald-200 px-5 py-2.5 rounded-full">
          Tổng số mặt hàng (SKU): <span className="text-emerald-700 font-bold text-base">{totalCount}</span> mã
        </div>
      </div>

      {/* 2. THANH TÌM KIẾM & NÚT IN MÃ VẠCH */}
      <div className="sticky top-[106px] z-30 bg-slate-50 w-full flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm theo tên sản phẩm hoặc mã SKU..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-sm font-semibold pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15 transition shadow-sm"
            />
          </div>
          <button type="submit" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition cursor-pointer shadow-md flex-shrink-0">
            Tìm kiếm
          </button>
        </form>

        <button 
          onClick={() => setShowPrintModal(true)}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
        >
          <Printer size={16} /> In mã vạch (Tem 105x22mm)
        </button>
      </div>

      {/* 3. BẢNG HIỂN THỊ DỮ LIỆU TỒN KHO */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="sticky top-[200px] z-10 bg-slate-50 border-b border-slate-200 px-5 py-4 w-44">Mã vạch</th>
                <th className="sticky top-[200px] z-10 bg-slate-50 border-b border-slate-200 px-5 py-4">Tên sản phẩm</th>
                <th className="sticky top-[200px] z-10 bg-slate-50 border-b border-slate-200 px-5 py-4 w-32 text-center">Tổng tồn</th>
                <th className="sticky top-[200px] z-10 bg-slate-50 border-b border-slate-200 px-5 py-4 w-32 text-center">Đang chuyển</th>
                <th className="sticky top-[200px] z-10 bg-slate-50 border-b border-slate-200 px-5 py-4 w-36 text-center">Tồn trong kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-400 animate-pulse font-bold">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-slate-500" />
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
                  <tr key={item.product_code} className="hover:bg-slate-100 transition">
                    <td className="px-5 py-4 font-bold text-slate-900 tracking-wide font-mono text-sm">{item.product_code}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-slate-100 text-slate-500 rounded-md"><Package size={12} /></div>
                        <span className="font-bold text-slate-800 text-sm truncate max-w-sm" title={item.product_name}>{item.product_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold min-w-[56px] justify-center">
                        {item.remain}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold min-w-[56px] justify-center border ${Number(item.shipping) > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400 font-medium'}`}>
                        {Number(item.shipping) > 0 && <Truck size={10} />} {item.shipping}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold min-w-[64px] justify-center border ${Number(item.on_hand) > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600 text-sm' : 'bg-red-50 border-red-100 text-red-500'}`}>
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
      {/* ️ MODAL IN MÃ VẠCH */}
      {/* ========================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-7xl flex flex-col h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-xl"><Printer size={20}/></div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">In mã vạch / QR sản phẩm</h3>
                  <p className="text-xs text-slate-500 font-medium">Khổ giấy cuộn: 105x22mm (3 tem/hàng)</p>
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
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">1. Tìm và Thêm thủ công</label>
                    <form onSubmit={searchProductForPrint} className="relative flex gap-2">
                      
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                        <input 
                          ref={searchInputRef}
                          type="text" placeholder="Gõ tên hoặc mã..." value={printSearchTerm}
                          onChange={e => setPrintSearchTerm(e.target.value)}
                          className="w-full text-xs font-bold pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-700 focus:bg-white transition"
                        />

                        {printSearchResults.length > 0 && (
                          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto z-50">
                            {printSearchResults.map(prod => (
                              <div key={prod.product_code} className="p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition" onClick={() => addManualPrintItem(prod)}>
                                <div className="flex flex-col overflow-hidden pr-2">
                                  <span className="text-xs font-bold text-slate-800 truncate">{prod.product_name}</span>
                                </div>
                                <Plus size={14} className="text-slate-600 flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button type="submit" disabled={isSearchingPrint} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer flex-shrink-0">
                        Tìm
                      </button>
                    </form>
                  </div>

                  {/* Cục Upload */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
                    {fileLoading && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-slate-600 font-bold gap-2 text-xs rounded-2xl"><RefreshCw size={20} className="animate-spin" /> Xử lý...</div>}
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">2. Upload Excel / CSV (Pivot tự động)</label>
                    <div className="flex gap-2 h-8">
                      <button onClick={downloadPrintTemplate} type="button" className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1">
                        <Download size={12} /> File Mẫu
                      </button>
                      <label className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer flex items-center justify-center gap-1">
                        <UploadCloud size={12} /> Tải file lên
                        <input type="file" accept=".csv, .txt, .xlsx, .xls" className="hidden" onChange={handlePrintFileUpload} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Dòng 2: Danh sách in */}
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <span className="font-bold text-xs text-slate-700 uppercase tracking-wide">Danh sách chờ in ({printItems.length} mã)</span>
                    {printItems.length > 0 && <button onClick={() => setPrintItems([])} className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer flex items-center gap-1"><Trash2 size={12}/> Xóa tất cả</button>}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
                    {printItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        <FileSpreadsheet size={32} className="text-slate-300" />
                        <span className="text-xs font-bold">Chưa có sản phẩm nào được chọn.</span>
                      </div>
                    ) : (
                      printItems.map((item, idx) => (
                        <div key={idx} className={`p-3 rounded-xl flex items-center gap-3 border transition ${item.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'}`}>
                          <div className="flex-1 overflow-hidden">
                            <div className={`text-xs font-bold truncate ${item.status === 'error' ? 'text-red-800 line-through' : 'text-slate-800'}`} title={item.name}>{item.name}</div>
                            <div className={`text-xs font-mono tracking-widest mt-0.5 ${item.status === 'error' ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{item.barcode}</div>
                          </div>
                          
                          {item.status === 'ok' ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-bold text-slate-400 uppercase">SL:</span>
                              <input 
                                type="number" min="1" value={item.qty} 
                                onChange={(e) => updatePrintQty(idx, e.target.value)}
                                className="w-14 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-700"
                              />
                              <button onClick={() => removePrintItem(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"><X size={14}/></button>
                            </div>
                          ) : (
                            <button onClick={() => removePrintItem(idx)} className="px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition cursor-pointer text-xs font-bold uppercase flex-shrink-0">
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
                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">Cài đặt in ấn</h3>
                  </div>

                  {/* CHỌN LOẠI MÃ */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Định dạng mã</span>
                      <select 
                        value={printConfig.codeType} 
                        onChange={e => setPrintConfig({...printConfig, codeType: e.target.value})}
                        className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 outline-none focus:border-slate-700 cursor-pointer"
                      >
                        <option value="barcode">Mã vạch (Barcode 1D)</option>
                        <option value="qrcode">Mã vuông (QR Code)</option>
                      </select>
                    </div>

                    {/* CẤU HÌNH TỶ LỆ SCALE CHUNG */}
                    <div className="pt-2 border-t border-slate-200/60 mt-2">
                      <div className="flex justify-between mb-1">
                        <label className="text-xs font-bold text-slate-600">Tỷ lệ khung mã (Scale)</label>
                        <span className="text-xs font-bold text-slate-900">{printConfig.codeScale}%</span>
                      </div>
                      <input 
                        type="range" min="50" max="150" step="5" 
                        value={printConfig.codeScale} 
                        onChange={e => setPrintConfig({...printConfig, codeScale: Number(e.target.value)})} 
                        className="w-full accent-slate-700 cursor-pointer" 
                      />
                    </div>

                    {/* CẤU HÌNH BARCODE */}
                    {printConfig.codeType === 'barcode' && (
                      <>
                        <div className="pt-2 border-t border-slate-200/60">
                          <div className="flex justify-between mb-1">
                            <label className="text-xs font-bold text-slate-600">Độ đậm nét vạch</label>
                            <span className="text-xs font-bold text-slate-900">{printConfig.barcodeWidth}</span>
                          </div>
                          <input 
                            type="range" min="1" max="4" step="0.1" 
                            value={printConfig.barcodeWidth} 
                            onChange={e => setPrintConfig({...printConfig, barcodeWidth: Number(e.target.value)})} 
                            className="w-full accent-slate-700 cursor-pointer" 
                          />
                        </div>
                        <div className="pt-2 border-t border-slate-200/60">
                          <div className="flex justify-between mb-1">
                            <label className="text-xs font-bold text-slate-600">Chiều cao vạch</label>
                            <span className="text-xs font-bold text-slate-900">{printConfig.barcodeHeight}px</span>
                          </div>
                          <input 
                            type="range" min="15" max="60" step="1" 
                            value={printConfig.barcodeHeight} 
                            onChange={e => setPrintConfig({...printConfig, barcodeHeight: Number(e.target.value)})} 
                            className="w-full accent-slate-700 cursor-pointer" 
                          />
                        </div>
                      </>
                    )}

                    {/* CẤU HÌNH QR CODE */}
                    {printConfig.codeType === 'qrcode' && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <div className="flex justify-between mb-1">
                          <label className="text-xs font-bold text-slate-600">Kích thước mã QR</label>
                          <span className="text-xs font-bold text-slate-900">{printConfig.qrSize}px</span>
                        </div>
                        <input 
                          type="range" min="30" max="80" step="1" 
                          value={printConfig.qrSize} 
                          onChange={e => setPrintConfig({...printConfig, qrSize: Number(e.target.value)})} 
                          className="w-full accent-slate-700 cursor-pointer" 
                        />
                      </div>
                    )}
                  </div>

                  {/* CẤU HÌNH HIỂN THỊ TEXT */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Hiển thị Tên Shop</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={printConfig.showShopName} onChange={() => setPrintConfig({...printConfig, showShopName: !printConfig.showShopName})} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-700"></div>
                      </label>
                    </div>
                    {printConfig.showShopName && (
                      <input 
                        type="text" 
                        value={printConfig.shopName}
                        onChange={(e) => setPrintConfig({...printConfig, shopName: e.target.value})}
                        placeholder="Nhập tên shop..."
                        className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-700 transition uppercase"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-700">Hiển thị Tên Sản Phẩm</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={printConfig.showProductName} onChange={() => setPrintConfig({...printConfig, showProductName: !printConfig.showProductName})} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-700"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Ghi chú Ngày in lô</span>
                      <span className="text-xs text-slate-400 mt-0.5">Hiển thị nhỏ ở góc phải tem</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={printConfig.showPrintDate} onChange={() => setPrintConfig({...printConfig, showPrintDate: !printConfig.showPrintDate})} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-700"></div>
                    </label>
                  </div>

                  {/* CẤU HÌNH SỐ LỆNH (in ở góc tem) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">Hiển thị Số lệnh</span>
                        <span className="text-xs text-slate-400 mt-0.5">In ở góc tem, xem trước ngay bên dưới</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={printConfig.showOrderNumber} onChange={() => setPrintConfig({...printConfig, showOrderNumber: !printConfig.showOrderNumber})} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-700"></div>
                      </label>
                    </div>
                    {printConfig.showOrderNumber && (
                      <>
                        <input
                          type="text"
                          value={printConfig.orderNumber}
                          onChange={(e) => setPrintConfig({...printConfig, orderNumber: e.target.value})}
                          placeholder="Nhập số lệnh, VD: 65-LD (để trống = không in)"
                          className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-700 transition"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-600">Góc tem</span>
                          <select
                            value={printConfig.orderCorner}
                            onChange={e => setPrintConfig({...printConfig, orderCorner: e.target.value})}
                            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 outline-none focus:border-slate-700 cursor-pointer"
                          >
                            <option value="top-left">Trái trên</option>
                            <option value="top-right">Phải trên</option>
                            <option value="bottom-left">Trái dưới</option>
                            <option value="bottom-right">Phải dưới</option>
                          </select>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <label className="text-xs font-bold text-slate-600">Cỡ chữ số lệnh</label>
                            <span className="text-xs font-bold text-slate-900">{printConfig.orderFontSize}px</span>
                          </div>
                          <input
                            type="range" min="5" max="12" step="0.5"
                            value={printConfig.orderFontSize}
                            onChange={e => setPrintConfig({...printConfig, orderFontSize: Number(e.target.value)})}
                            className="w-full accent-slate-700 cursor-pointer"
                          />
                        </div>
                        <p className="text-xs text-slate-400">Nếu trùng góc ngày in, 2 chữ sẽ chồng nhau — chọn góc khác là hết.</p>
                      </>
                    )}
                  </div>
                </div>

                {/* XEM TRƯỚC TEM (cập nhật trực tiếp khi chỉnh cài đặt) */}
                <div className="pt-6 mt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-700 uppercase tracking-wide">Xem trước tem</span>
                    <span className="text-xs font-bold text-slate-400">{printItems.filter(i => i.status === 'ok' && i.qty > 0).length > 0 ? '3 tem đầu tiên' : 'Tem mẫu'}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Chỉnh góc, cỡ chữ, cỡ mã ở trên — tem mẫu đổi theo ngay, chưa in gì cả.</p>
                  <div className="overflow-x-auto bg-slate-100 rounded-xl p-3">
                    <div style={{ width: '105mm', height: '18mm', transform: 'scale(0.9)', transformOrigin: 'top left' }}>
                      <div style={{ display: 'flex', width: '105mm', height: '20mm' }}>
                        {previewRow.map((it, i) => it.barcode ? (
                          <PreviewLabel key={i} item={it} config={printConfig} />
                        ) : (
                          <div key={i} style={{ width: '35mm', height: '20mm', background: 'white', border: '1px dashed #cbd5e1', boxSizing: 'border-box' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100">
                  <button 
                    onClick={generatePrintJob}
                    disabled={printItems.filter(i => i.status === 'ok' && i.qty > 0).length === 0}
                    className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:translate-y-0 disabled:shadow-none"
                  >
                    <Printer size={18} /> Tạo bản in
                  </button>
                  <p className="text-center text-xs text-slate-400 font-medium mt-3">Hệ thống sẽ mở Tab mới để in. Vui lòng tắt chặn Pop-up trình duyệt nếu có.</p>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}