import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjsLib from 'pdfjs-dist';
import Papa from 'papaparse'; // Thư viện parse file CSV

// BẢN SỬA LỖI WORKER: Dùng unpkg đảm bảo luôn chạy trên Vite/Next.js/React CRA
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

import { BrowserMultiFormatReader } from '@zxing/library';
import { supabase } from '../lib/supabase'; // Đường dẫn tới file supabase của bạn
import { 
  FileText, UploadCloud, Settings, Download, Loader2, 
  LayoutTemplate, X, MousePointerClick, Maximize, FileSpreadsheet, Printer
} from 'lucide-react';

const codeReader = new BrowserMultiFormatReader();

export default function AWBProcessor() {
  const [file, setFile] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [csvOrders, setCsvOrders] = useState(null); // Lưu dữ liệu đơn hàng từ file upload
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // Trạng thái cho hệ thống Preview
  const [previewImg, setPreviewImg] = useState(null);
  const [pdfDim, setPdfDim] = useState({ width: 0, height: 0 }); 
  const [previewScale, setPreviewScale] = useState(1);
  const previewContainerRef = useRef(null);

  // Cấu hình linh hoạt
  const [config, setConfig] = useState({
    x: 20,
    y: 150,
    boxWidth: 200,         
    fontSize: 12,
    lineHeight: 16,
    textFormat: '{product} x{qty} -- {location}',
    autoFillEmptyRows: true, // Tự động lặp lại ID & Mã HVC cho dòng trống
    optimizeName: false,     // Rút gọn tên sản phẩm chỉ lấy mã số
    autoPrint: false         // Tự động in sau khi hoàn thành
  });

  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);

  // Dữ liệu giả lập cho Preview
  const mockProducts = [
    { product_name: 'CLAIRE 412 - Màu da đậm - S', location_code: 'KỆ A1', qty: '1' },
    { product_name: 'QUẦN MẪU 02 - L', location_code: 'KỆ B2', qty: '2' }
  ];

  // ==========================================
  // LẮNG NGHE KÍCH THƯỚC CONTAINER ĐỂ SCALE CHUẨN XÁC
  // ==========================================
  useEffect(() => {
    if (!previewContainerRef.current || pdfDim.width === 0) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const currentScale = entry.contentRect.width / pdfDim.width;
        setPreviewScale(currentScale);
      }
    });
    resizeObserver.observe(previewContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [pdfDim.width]);

  // ==========================================
  // HỆ THỐNG LOG
  // ==========================================
  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date() }]);
  };

  // ==========================================
  // XỬ LÝ UPLOAD PDF & TẠO PREVIEW
  // ==========================================
  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setDownloadUrl(null);
      setLogs([]);
      setProgress({ current: 0, total: 0 });
      addLog(`Đã tải PDF: ${selectedFile.name}`, 'info');

      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdfjsDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        setPdfDim({ width: viewport.width / 1.5, height: viewport.height / 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        
        setPreviewImg(canvas.toDataURL('image/jpeg', 0.8));
        addLog(`Đã tạo preview thành công. Click vào ảnh để chọn vị trí in!`, 'success');
      } catch (err) {
        addLog(`Lỗi tạo preview: ${err.message}`, 'error');
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewImg(null);
    setDownloadUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==========================================
  // TẢI FILE CSV MẪU
  // ==========================================
  const downloadSampleCSV = () => {
    const csvContent = "ID,Mã sản phẩm,Số lượng,Mã đơn hãng vận chuyển\n"
                     + "834366779,26AD2-JU488P-WH-S,1,SPXVN060413516178\n"
                     + ",26AD2-JU488P-WH-M,2,\n"
                     + "834366780,CLAIRE 412 - Màu da đậm - S,1,SPXVN060413516179";
                     
    // Dùng Uint8Array([0xEF, 0xBB, 0xBF]) để tạo BOM giúp Excel đọc đúng font Tiếng Việt
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Mau_Danh_Sach_Don_Hang.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`Đã tải file CSV mẫu`, 'info');
  };

  // ==========================================
  // XỬ LÝ UPLOAD DANH SÁCH ĐƠN HÀNG (CSV)
  // ==========================================
  const handleCsvChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setCsvFile(selectedFile);
      
      Papa.parse(selectedFile, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data;
          let startIndex = 0;
          
          if (rows[0] && (String(rows[0][0]).toLowerCase().includes('id') || String(rows[0][1]).toLowerCase().includes('mã'))) {
            startIndex = 1;
          }

          const orders = {};
          let currentId = '';
          let currentTracking = '';

          for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            let id = row[0]?.trim();
            let product = row[1]?.trim();
            let qty = row[2]?.trim();
            let tracking = row[3]?.trim();

            if (config.autoFillEmptyRows) {
              if (id) currentId = id; else id = currentId;
              if (tracking) currentTracking = tracking; else tracking = currentTracking;
            }

            if (tracking && product) {
              if (!orders[tracking]) orders[tracking] = [];
              orders[tracking].push({
                product_name: product,
                qty: qty || '1',
                location_code: '' 
              });
            }
          }
          
          setCsvOrders(orders);
          addLog(`Đã nạp CSV: Nhận diện được ${Object.keys(orders).length} mã HVC`, 'success');
        },
        error: (error) => {
          addLog(`Lỗi đọc CSV: ${error.message}`, 'error');
        }
      });
    }
  };

  const removeCsv = () => {
    setCsvFile(null);
    setCsvOrders(null);
    if (csvInputRef.current) csvInputRef.current.value = '';
    addLog(`Đã gỡ bỏ file danh sách đơn hàng. Hệ thống sẽ lọc từ Database.`, 'info');
  };

  // ==========================================
  // XỬ LÝ IN PDF TRỰC TIẾP TỪ TRÌNH DUYỆT
  // ==========================================
  const printPDF = (pdfUrl) => {
    if (!pdfUrl) return;
    addLog('Đang chuẩn bị lệnh in...', 'info');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);
    
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        addLog('Đã gửi lệnh in thành công', 'success');
      }, 500); // Đợi 500ms cho file load hoàn thiện
    };
  };

  const handlePreviewClick = (e) => {
    if (!previewContainerRef.current || !pdfDim.width) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const scaleX = pdfDim.width / rect.width;
    const scaleY = pdfDim.height / rect.height;
    setConfig({
      ...config,
      x: Math.round(clickX * scaleX),
      y: Math.round(clickY * scaleY)
    });
  };

  const fetchOrderDetails = async (trackingCode) => {
    if (!trackingCode) return [];
    try {
      const { data, error } = await supabase.rpc('get_awb_products', { p_tracking_code: trackingCode });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const formatProductName = (name) => {
    if (!config.optimizeName) return name;
    const match = name.match(/\d+/);
    return match ? match[0] : name;
  };

  const processPDF = async () => {
    if (!file) return;
    setIsProcessing(true);
    setDownloadUrl(null);
    addLog('Bắt đầu đọc quét mã hàng loạt...', 'info');

    try {
      const baseBuffer = await file.arrayBuffer();
      const bufferForPdfJs = baseBuffer.slice(0);
      const bufferForPdfLib = baseBuffer.slice(0);

      const pdfjsDoc = await pdfjsLib.getDocument({ data: bufferForPdfJs }).promise;
      const pdfLibDoc = await PDFDocument.load(bufferForPdfLib);
      pdfLibDoc.registerFontkit(fontkit);
      
      const fontUrl = '/Roboto-Bold.ttf';
      const fontResponse = await fetch(fontUrl);
      const fontBytes = await fontResponse.arrayBuffer();
      const font = await pdfLibDoc.embedFont(fontBytes);
      
      const totalPages = pdfjsDoc.numPages;
      setProgress({ current: 0, total: totalPages });

      const processedCodes = new Set();

      for (let i = 1; i <= totalPages; i++) {
        const pageJS = await pdfjsDoc.getPage(i);
        let barcodeText = null;

        try {
          const textContent = await pageJS.getTextContent();
          const fullText = textContent.items.map(item => item.str).join(' ');
          const trackingRegex = /(SPX[A-Z0-9]+|SPEVN[A-Z0-9]+|JT[0-9]+|VN[A-Z0-9]+|S[0-9A-Z]+\.[0-9A-Z\.]+|8[0-9]{9,20}|[A-Z0-9]{10,25})/g;
          let matches = fullText.match(trackingRegex);

          if (matches && matches.length > 0) {
            let uniqueMatches = [...new Set(matches)];
            const priorityPrefixes = ['SPX', 'SPEVN', 'JT', 'VN', 'S', '8'];
            uniqueMatches.sort((a, b) => {
              const aHasPrefix = priorityPrefixes.some(p => a.startsWith(p));
              const bHasPrefix = priorityPrefixes.some(p => b.startsWith(p));
              if (aHasPrefix && !bHasPrefix) return -1;
              if (!aHasPrefix && bHasPrefix) return 1;
              return b.length - a.length; 
            });
            barcodeText = uniqueMatches[0].toUpperCase();
          }
        } catch (e) {
          console.warn(`Lỗi đọc text trang ${i}:`, e);
        }

        if (!barcodeText) {
          const scales = [2.0, 3.0, 1.5, 4.0];
          for (const scale of scales) {
            try {
              const viewport = pageJS.getViewport({ scale });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width; 
              canvas.height = viewport.height;
              await pageJS.render({ canvasContext: canvas.getContext('2d', { willReadFrequently: true }), viewport }).promise;
              const result = await codeReader.decodeFromCanvas(canvas);
              barcodeText = result.getText();
              if (barcodeText) break; 
            } catch (e) { }
          }
        }

        if (barcodeText) {
          if (processedCodes.has(barcodeText)) {
            addLog(`Trang ${i}: Bỏ qua mã [${barcodeText}] do trùng lặp!`, 'warning');
            setProgress({ current: i, total: totalPages });
            continue; 
          }
          processedCodes.add(barcodeText);

          let productsInfo = [];
          if (csvOrders && csvOrders[barcodeText]) {
            productsInfo = csvOrders[barcodeText];
          } else {
            productsInfo = await fetchOrderDetails(barcodeText);
          }
          
          if (productsInfo.length > 0) {
            const pageLib = pdfLibDoc.getPage(i - 1);
            const padding = 6;
            let allLines = [];
            const safeBoxWidth = Number(config.boxWidth);
            const usableWidth = safeBoxWidth - (padding * 2);

            productsInfo.forEach(p => {
              const finalProductName = formatProductName(p.product_name || '');
              const rawString = config.textFormat
                .replace('{product}', finalProductName)
                .replace('{location}', p.location_code || '')
                .replace('{qty}', p.qty || '1');
              
              const words = rawString.split(' ');
              let currentLine = words[0] || '';
              
              for (let w = 1; w < words.length; w++) {
                const word = words[w];
                const width = font.widthOfTextAtSize(currentLine + " " + word, Number(config.fontSize));
                if (width < usableWidth) {
                  currentLine += " " + word;
                } else {
                  allLines.push(currentLine);
                  currentLine = word;
                }
              }
              if (currentLine) allLines.push(currentLine);
            });
            
            const boxHeight = (allLines.length * Number(config.lineHeight)) + (padding * 2);
            const pdfY_BottomLeft = pageLib.getHeight() - config.y - boxHeight;

            pageLib.drawRectangle({
              x: Number(config.x),
              y: pdfY_BottomLeft,
              width: safeBoxWidth,
              height: boxHeight,
              color: rgb(1, 1, 1),
            });

            let textY = pageLib.getHeight() - config.y - padding - Number(config.fontSize);
            allLines.forEach((textLine) => {
              pageLib.drawText(textLine, {
                x: Number(config.x) + padding,
                y: textY,
                size: Number(config.fontSize),
                font: font,
                color: rgb(0, 0, 0),
              });
              textY -= Number(config.lineHeight);
            });

            addLog(`Trang ${i}: [${barcodeText}] - Chèn ${productsInfo.length} SP`, 'success');
          } else {
            addLog(`Trang ${i}: [${barcodeText}] - Không có dữ liệu SP`, 'warning');
          }
        } else {
          addLog(`Trang ${i}: Không quét được mã vận đơn!`, 'error');
        }
        
        setProgress({ current: i, total: totalPages });
      }

      const modifiedPdfBytes = await pdfLibDoc.save();
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setDownloadUrl(objectUrl);
      addLog(`Xử lý hoàn tất! File đã sẵn sàng.`, 'success');

      // Tự động IN nếu người dùng cấu hình
      if (config.autoPrint) {
        printPDF(objectUrl);
      }

    } catch (error) {
      addLog(`Lỗi: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-12 mt-8 font-sans">
      
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm border border-blue-100">
          <LayoutTemplate size={26} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Chèn vị trí sản phẩm vào AWB</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Tự động lót nền trắng, quét mã và chèn vị trí hàng hóa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* UPLOAD KHU VỰC CHÍNH */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
            
            {/* Upload PDF */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">1. File PDF Vận Đơn (Bắt buộc)</label>
              {!file ? (
                <div 
                  className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  <UploadCloud size={28} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-600">Tải lên file PDF vận đơn</p>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 truncate w-48">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={removeFile} disabled={isProcessing} className="p-2 text-slate-400 hover:text-red-500">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>

            {/* Upload CSV */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  2. Danh sách đơn hàng <span className="text-slate-400 font-normal text-[10px]">(Tuỳ chọn)</span>
                </label>
                <button onClick={downloadSampleCSV} className="text-xs font-bold text-blue-500 hover:text-blue-700 hover:underline">
                  Tải file CSV mẫu
                </button>
              </div>
              
              {!csvFile ? (
                <div 
                  className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer" 
                  onClick={() => csvInputRef.current?.click()}
                >
                  <input type="file" accept=".csv" className="hidden" ref={csvInputRef} onChange={handleCsvChange} />
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet size={20} className="text-slate-400" />
                    <p className="text-sm font-bold text-slate-600">Tải file CSV đơn hàng lên</p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-green-50/50 border border-green-100 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet size={20} className="text-green-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 truncate w-48">{csvFile.name}</p>
                      <p className="text-xs text-slate-500">{csvOrders ? `${Object.keys(csvOrders).length} đơn hàng` : 'Đang xử lý...'}</p>
                    </div>
                  </div>
                  <button onClick={removeCsv} disabled={isProcessing} className="p-2 text-slate-400 hover:text-red-500">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={processPDF}
                disabled={!file || isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:bg-slate-300 transition-all shadow-sm"
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <LayoutTemplate size={18} />}
                {isProcessing ? `Đang xử lý ${progress.current}/${progress.total}` : 'Bắt đầu Xử Lý PDF'}
              </button>
              
              {/* CỤM NÚT IN VÀ TẢI SAU KHI XỬ LÝ */}
              {downloadUrl && !isProcessing && (
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => printPDF(downloadUrl)}
                    className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Printer size={18} /> In PDF
                  </button>
                  <a 
                    href={downloadUrl} 
                    download={`AWB_Hoan_Thanh.pdf`} 
                    className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Download size={18} /> Tải Xuất PDF
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* BOX CẤU HÌNH & HIỂN THỊ */}
          <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2 mb-4">
              <Settings size={18} /> Cấu hình xử lý & Hiển thị
            </h3>
            
            <div className="space-y-4">
              {/* Tùy chọn xử lý danh sách đơn */}
              <div className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={config.autoFillEmptyRows}
                    onChange={(e) => setConfig({...config, autoFillEmptyRows: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Tự động lặp lại ID & Mã HVC cho các dòng trống phía dưới</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={config.optimizeName}
                    onChange={(e) => setConfig({...config, optimizeName: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Rút gọn tên sản phẩm (Chỉ lấy mã số)</span>
                </label>

                <hr className="my-1 border-slate-100" />
                
                {/* Tùy chọn in ấn tự động */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={config.autoPrint}
                    onChange={(e) => setConfig({...config, autoPrint: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-amber-600">Tự động mở cửa sổ IN sau khi hoàn tất xử lý PDF</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Định dạng hiển thị <span className="font-normal text-slate-400">({'{product}'}, {'{location}'}, {'{qty}'})</span>
                </label>
                <input 
                  type="text" 
                  value={config.textFormat} 
                  onChange={e => setConfig({...config, textFormat: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500 font-mono" 
                  placeholder="VD: {product} x{qty} - {location}"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Chiều rộng khung</label>
                  <input type="number" value={config.boxWidth} onChange={e => setConfig({...config, boxWidth: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Cỡ chữ</label>
                  <input type="number" value={config.fontSize} onChange={e => setConfig({...config, fontSize: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Dãn dòng</label>
                  <input type="number" value={config.lineHeight} onChange={e => setConfig({...config, lineHeight: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[200px]">
            <div className="p-3 bg-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider shrink-0">Trạng thái hệ thống</div>
            <div className="p-3 overflow-y-auto flex-1 space-y-1 font-mono text-[11px]">
              {logs.map((log, idx) => (
                <div key={idx} className={`flex items-start gap-1.5 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-amber-400' : 'text-blue-300'}`}>
                  <span>[{log.time.toLocaleTimeString('vi-VN')}]</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* CỘT PREVIEW */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm h-full overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
                <Maximize size={16} /> Bản xem trước (Preview)
              </h3>
              <span className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1">
                <MousePointerClick size={14} /> Click vào ảnh để đổi vị trí
              </span>
            </div>
            
            <div className="p-6 flex-1 bg-slate-100 overflow-y-auto flex justify-center items-start">
              {!previewImg ? (
                <div className="text-slate-400 text-sm font-bold flex flex-col items-center justify-center h-full gap-3">
                  <LayoutTemplate size={48} className="opacity-20" />
                  Vui lòng tải file PDF lên để xem trước
                </div>
              ) : (
                <div 
                  ref={previewContainerRef}
                  className="relative bg-white shadow-xl cursor-crosshair group max-w-full"
                  onClick={handlePreviewClick}
                >
                  <img src={previewImg} alt="PDF Preview" className="max-w-full h-auto block select-none pointer-events-none" />
                  
                  <div 
                    className="absolute z-10 pointer-events-none transition-all"
                    style={{
                      left: `${(config.x / pdfDim.width) * 100}%`,
                      top: `${(config.y / pdfDim.height) * 100}%`,
                      width: `${config.boxWidth * previewScale}px`, 
                      transform: 'translate(0, 0)'
                    }}
                  >
                    <div 
                      className="bg-white border border-red-500 shadow-md p-[4px] break-words" 
                      style={{
                         fontSize: `${config.fontSize * previewScale}px`, 
                         lineHeight: `${config.lineHeight * previewScale}px`
                      }}
                    >
                      {mockProducts.map((p, idx) => (
                        <div key={idx} className="font-bold text-black" style={{ wordBreak: 'break-word' }}>
                          {config.textFormat
                            .replace('{product}', formatProductName(p.product_name))
                            .replace('{location}', p.location_code)
                            .replace('{qty}', p.qty)}
                        </div>
                      ))}
                    </div>
                    <div className="absolute top-0 left-0 w-2 h-2 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}