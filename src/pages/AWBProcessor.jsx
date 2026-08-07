import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// BẢN SỬA LỖI WORKER: Dùng unpkg đảm bảo luôn chạy trên Vite/Next.js/React CRA
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

import { BrowserMultiFormatReader } from '@zxing/library';
import { supabase } from '../lib/supabase'; // Đường dẫn tới file supabase của bạn
import { 
  FileText, UploadCloud, Settings, Download, Loader2, 
  AlertCircle, CheckCircle2, Play, LayoutTemplate, X,
  MousePointerClick, Maximize
} from 'lucide-react';

const codeReader = new BrowserMultiFormatReader();

export default function AWBProcessor() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // Trạng thái cho hệ thống Preview
  const [previewImg, setPreviewImg] = useState(null);
  const [pdfDim, setPdfDim] = useState({ width: 0, height: 0 }); // Kích thước PDF (Point)
  const previewContainerRef = useRef(null);

  // Cấu hình (Tọa độ X, Y giờ tính từ Góc Trái - Trên cùng (Top-Left) cho dễ hình dung)
  const [config, setConfig] = useState({
    x: 20,
    y: 150,
    fontSize: 12,
    lineHeight: 16
  });

  const fileInputRef = useRef(null);

  // ==========================================
  // HỆ THỐNG LOG
  // ==========================================
  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date() }]);
  };

  // ==========================================
  // XỬ LÝ UPLOAD & TẠO PREVIEW
  // ==========================================
  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setDownloadUrl(null);
      setLogs([]);
      setProgress({ current: 0, total: 0 });
      addLog(`Đã tải file: ${selectedFile.name}`, 'info');

      // TẠO PREVIEW TRANG 1
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdfjsDoc.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.5 }); // Tăng nét
        setPdfDim({ width: viewport.width / 1.5, height: viewport.height / 1.5 }); // Lưu kích thước gốc

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
    setLogs([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==========================================
  // LOGIC CLICK ĐỂ CHỌN TỌA ĐỘ
  // ==========================================
  const handlePreviewClick = (e) => {
    if (!previewContainerRef.current || !pdfDim.width) return;
    
    // Lấy kích thước thực tế của vùng hiển thị trên màn hình
    const rect = previewContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Quy đổi tỷ lệ từ màn hình sang đơn vị Point của PDF
    const scaleX = pdfDim.width / rect.width;
    const scaleY = pdfDim.height / rect.height;

    setConfig({
      ...config,
      x: Math.round(clickX * scaleX),
      y: Math.round(clickY * scaleY)
    });
  };

  // ==========================================
  // XỬ LÝ CỐT LÕI (QUÉT MÃ & GHI PDF)
  // ==========================================
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

  const processPDF = async () => {
    if (!file) return;
    setIsProcessing(true);
    setDownloadUrl(null);
    addLog('Bắt đầu đọc quét mã hàng loạt...', 'info');

    try {
    const baseBuffer = await file.arrayBuffer();

// Nhân bản bộ nhớ thành 2 luồng độc lập để tránh lỗi Detached ArrayBuffer
const bufferForPdfJs = baseBuffer.slice(0);
const bufferForPdfLib = baseBuffer.slice(0);

const pdfjsDoc = await pdfjsLib.getDocument({ data: bufferForPdfJs }).promise;
const pdfLibDoc = await PDFDocument.load(bufferForPdfLib);
      const font = await pdfLibDoc.embedFont(StandardFonts.HelveticaBold);
      
      const totalPages = pdfjsDoc.numPages;
      setProgress({ current: 0, total: totalPages });

      for (let i = 1; i <= totalPages; i++) {
        // Quét mã vạch (Render ảnh nhỏ -> ZXing)
        const pageJS = await pdfjsDoc.getPage(i);
        const viewport = pageJS.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await pageJS.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        
        let barcodeText = null;
        try {
          const result = await codeReader.decodeFromCanvas(canvas);
          barcodeText = result.getText();
        } catch (e) { /* Bỏ qua nếu ko thấy mã */ }
        
        if (barcodeText) {
          const productsInfo = await fetchOrderDetails(barcodeText);
          
          if (productsInfo.length > 0) {
            const pageLib = pdfLibDoc.getPage(i - 1);
            
            // 1. TÍNH TOÁN KHUNG NỀN TRẮNG
            const padding = 6; // Đệm px
            const textsToDraw = productsInfo.map(p => `${p.product_name} -- ${p.location_code}`);
            
            // Tìm chuỗi dài nhất
            const maxTextWidth = Math.max(...textsToDraw.map(t => font.widthOfTextAtSize(t, Number(config.fontSize))));
            const boxWidth = maxTextWidth + (padding * 2);
            const boxHeight = (textsToDraw.length * Number(config.lineHeight)) + padding;
            
            // pdf-lib có trục Y từ Dưới-lên. Cần đảo ngược lại trục Y của người dùng (Trên-xuống)
            const pdfY_BottomLeft = pageLib.getHeight() - config.y - boxHeight;

            // 2. VẼ NỀN TRẮNG
            pageLib.drawRectangle({
              x: Number(config.x),
              y: pdfY_BottomLeft,
              width: boxWidth,
              height: boxHeight,
              color: rgb(1, 1, 1), // Màu trắng
            });

            // 3. VẼ CHỮ LÊN NỀN
            let textY = pdfY_BottomLeft + boxHeight - padding - Number(config.fontSize);
            textsToDraw.forEach((text) => {
              pageLib.drawText(text, {
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
          addLog(`Trang ${i}: Không quét được mã vạch!`, 'error');
        }
        setProgress({ current: i, total: totalPages });
      }

      const modifiedPdfBytes = await pdfLibDoc.save();
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      setDownloadUrl(URL.createObjectURL(blob));
      addLog(`Xử lý hoàn tất! File đã sẵn sàng tải xuống.`, 'success');

    } catch (error) {
      addLog(`Lỗi: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-12 mt-8 font-sans">
      
      {/* HEADER */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm border border-blue-100">
          <LayoutTemplate size={26} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">In Vị Trí Lên AWB (Bản Cao Cấp)</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Tự động lót nền trắng, quét mã và chèn vị trí hàng hóa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ==================================
            CỘT TRÁI: UPLOAD, SETTINGS, LOGS
        ================================== */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Box Upload */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6">
            {!file ? (
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:bg-slate-50 transition-colors cursor-pointer" 
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                <UploadCloud size={36} className="text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">Tải lên file PDF vận đơn</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText size={24} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 truncate w-48">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={removeFile} disabled={isProcessing} className="p-2 text-slate-400 hover:text-red-500">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={processPDF}
                    disabled={isProcessing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:bg-slate-300 transition-all shadow-sm"
                  >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                    {isProcessing ? `Đang xử lý ${progress.current}/${progress.total}` : 'Bắt đầu Xử Lý'}
                  </button>
                  {downloadUrl && !isProcessing && (
                    <a href={downloadUrl} download={`AWB_Hoan_Thanh.pdf`} className="flex-1 bg-green-50 text-green-700 border border-green-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                      <Download size={18} /> Tải PDF Mới
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Box Settings */}
          <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2 mb-4">
              <Settings size={18} /> Thông số (Có thể Click bên hình)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Trục X (Trái-qua)</label>
                <input type="number" value={config.x} onChange={e => setConfig({...config, x: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Trục Y (Trên-xuống)</label>
                <input type="number" value={config.y} onChange={e => setConfig({...config, y: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
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

          {/* Box Logs */}
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

        {/* ==================================
            CỘT PHẢI: KHU VỰC PREVIEW PDF
        ================================== */}
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
                  
                  {/* CỤM MÔ PHỎNG HIỂN THỊ (Mock Box) */}
                  <div 
                    className="absolute z-10 pointer-events-none transition-all"
                    style={{
                      // Ánh xạ tọa độ PDF (Point) sang tọa độ hiển thị (Phần trăm của box cha)
                      left: `${(config.x / pdfDim.width) * 100}%`,
                      top: `${(config.y / pdfDim.height) * 100}%`,
                      transform: 'translate(0, 0)'
                    }}
                  >
                    {/* Bảng nền trắng + viền chỉ đỏ báo hiệu */}
                    <div className="bg-white border border-red-500 shadow-md whitespace-nowrap p-[4px]" style={{
                       // Scale font size giả lập trên màn hình
                       fontSize: `${(config.fontSize / pdfDim.width) * 100}cqw`, 
                       lineHeight: `${config.lineHeight}px`
                    }}>
                      <div className="font-bold text-black text-[12px] md:text-sm">ÁO MẪU 01 - Đen - M -- KỆ A1</div>
                      <div className="font-bold text-black text-[12px] md:text-sm">QUẦN MẪU 02 - L -- KỆ B2</div>
                    </div>
                    {/* Chấm neo tại tọa độ X, Y */}
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