import React, { useState, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { BrowserMultiFormatReader } from '@zxing/library';
import { supabase } from '../lib/supabase'; // Đảm bảo đường dẫn này đúng với project của bạn
import { 
  FileText, UploadCloud, Settings, Download, Loader2, 
  AlertCircle, CheckCircle2, Play, LayoutTemplate, X
} from 'lucide-react';

// Cấu hình Worker cho pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
const codeReader = new BrowserMultiFormatReader();

export default function AWBProcessor() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // Cấu hình tọa độ - Giao diện Settings
  const [config, setConfig] = useState({
    x: 20,
    y: 120,
    fontSize: 11,
    lineHeight: 16
  });

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setDownloadUrl(null);
      setLogs([]);
      setProgress({ current: 0, total: 0 });
    }
  };

  const removeFile = () => {
    setFile(null);
    setDownloadUrl(null);
    setLogs([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date() }]);
  };

  // Hàm quét mã vạch
  const extractBarcodeFromPage = async (pdfDocument, pageNum) => {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const canvasContext = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext, viewport }).promise;
      const result = await codeReader.decodeFromCanvas(canvas);
      return result.getText();
    } catch (error) {
      return null;
    }
  };

  // Kéo dữ liệu từ Supabase
  const fetchOrderDetails = async (trackingCode) => {
    if (!trackingCode) return [];
    try {
      const { data, error } = await supabase.rpc('get_awb_products', {
        p_tracking_code: trackingCode
      });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Lỗi lấy dữ liệu Supabase:", err);
      return [];
    }
  };

  // Logic xử lý chính
  const processPDF = async () => {
    if (!file) return;
    setIsProcessing(true);
    setLogs([]);
    setDownloadUrl(null);
    addLog('Bắt đầu đọc file PDF...', 'info');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pdfLibDoc = await PDFDocument.load(arrayBuffer);
      const font = await pdfLibDoc.embedFont(StandardFonts.HelveticaBold);
      
      const totalPages = pdfjsDoc.numPages;
      setProgress({ current: 0, total: totalPages });
      addLog(`Tổng số đơn hàng (trang): ${totalPages}`, 'info');

      for (let i = 1; i <= totalPages; i++) {
        const barcodeText = await extractBarcodeFromPage(pdfjsDoc, i);
        
        if (barcodeText) {
          const productsInfo = await fetchOrderDetails(barcodeText);
          
          if (productsInfo.length > 0) {
            const page = pdfLibDoc.getPage(i - 1);
            let currentY = Number(config.y);

            productsInfo.forEach((item) => {
              const textToDraw = `${item.product_name} -- ${item.location_code}`;
              page.drawText(textToDraw, {
                x: Number(config.x),
                y: currentY,
                size: Number(config.fontSize),
                font: font,
                color: rgb(0, 0, 0),
              });
              currentY -= Number(config.lineHeight);
            });
            addLog(`Trang ${i}: [${barcodeText}] - Đã chèn ${productsInfo.length} SP`, 'success');
          } else {
            addLog(`Trang ${i}: [${barcodeText}] - Không tìm thấy SP trong kho`, 'warning');
          }
        } else {
          addLog(`Trang ${i}: Không quét được mã vạch!`, 'error');
        }
        setProgress({ current: i, total: totalPages });
      }

      addLog(`Đang xuất file PDF hoàn chỉnh...`, 'info');
      const modifiedPdfBytes = await pdfLibDoc.save();
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      setDownloadUrl(URL.createObjectURL(blob));
      addLog(`Xử lý hoàn tất!`, 'success');

    } catch (error) {
      console.error(error);
      addLog(`Lỗi hệ thống: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12 mt-8 font-sans">
      
      {/* HEADER */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm border border-blue-100">
            <LayoutTemplate size={26} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">In Vị Trí Lên AWB</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Tự động quét mã vạch và chèn vị trí nhặt hàng lên phiếu in</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CỘT TRÁI: UPLOAD & LOGS (Chiếm 2 phần) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Khu vực Upload */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
                <UploadCloud size={16} /> Tải file PDF vận đơn
              </h3>
            </div>
            <div className="p-6">
              {!file ? (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <input 
                    type="file" 
                    accept="application/pdf"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 mx-auto mb-4">
                    <FileText size={28} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Click để chọn hoặc kéo thả file PDF vào đây</p>
                  <p className="text-xs text-slate-400 mt-2 font-medium">Hỗ trợ file xuất từ Shopee, TikTok, GHTK...</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between bg-blue-50/50 border border-blue-100 p-4 rounded-xl gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white text-blue-500 rounded-lg shadow-sm border border-slate-200">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={removeFile} disabled={isProcessing} className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50">
                    <X size={20} />
                  </button>
                </div>
              )}

              {/* Thanh Tiến Trình & Button Xử lý */}
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
                {isProcessing ? (
                  <div className="flex-1 w-full bg-slate-100 h-12 rounded-xl border border-slate-200 flex items-center px-4 gap-3">
                    <Loader2 size={18} className="animate-spin text-blue-500 shrink-0" />
                    <div className="flex-1">
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300 rounded-full" 
                          style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={processPDF}
                    disabled={!file}
                    className="flex-1 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <Play size={18} fill="currentColor" /> Xử lý file PDF
                  </button>
                )}

                {downloadUrl && !isProcessing && (
                  <a
                    href={downloadUrl}
                    download={`AWB_Da_Xu_Ly_${new Date().getTime()}.pdf`}
                    className="w-full sm:w-auto bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Download size={18} /> Tải file hoàn thành
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Console Log Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[300px]">
            <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Tiến trình hệ thống</h3>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2 font-mono text-[11px]">
              {logs.length === 0 ? (
                <div className="text-slate-500 h-full flex items-center justify-center">Chưa có hoạt động nào...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`flex items-start gap-2 ${
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'success' ? 'text-green-400' : 
                    log.type === 'warning' ? 'text-amber-400' : 'text-blue-300'
                  }`}>
                    <span className="text-slate-600 shrink-0">
                      [{log.time.toLocaleTimeString('vi-VN', { hour12: false })}]
                    </span>
                    {log.type === 'error' && <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                    {log.type === 'success' && <CheckCircle2 size={14} className="shrink-0 mt-0.5" />}
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* CỘT PHẢI: SETTINGS (Chiếm 1 phần) */}
        <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl shadow-sm p-6 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl shadow-sm border border-orange-100">
              <Settings size={20} />
            </div>
            <h3 className="text-sm font-black text-slate-700 uppercase">Cấu hình tọa độ in</h3>
          </div>

          <div className="bg-orange-50/50 border border-orange-100 text-orange-800 text-xs font-medium p-3.5 rounded-xl mb-6 leading-relaxed">
            <p>Tọa độ (X, Y) được tính từ <strong>góc dưới cùng bên trái</strong>. Hãy thử in 1 file vài trang để căn chỉnh tọa độ cho khớp với khổ giấy A6 của bạn.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Trục X (Cách lề trái)</label>
              <div className="relative">
                <input
                  type="number"
                  value={config.x}
                  onChange={(e) => setConfig({...config, x: e.target.value})}
                  className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">px</span>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Trục Y (Cách lề dưới)</label>
              <div className="relative">
                <input
                  type="number"
                  value={config.y}
                  onChange={(e) => setConfig({...config, y: e.target.value})}
                  className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">px</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Cỡ chữ</label>
                <input
                  type="number"
                  value={config.fontSize}
                  onChange={(e) => setConfig({...config, fontSize: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Dãn dòng</label>
                <input
                  type="number"
                  value={config.lineHeight}
                  onChange={(e) => setConfig({...config, lineHeight: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}