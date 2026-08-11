import React, { useState } from 'react';
import { Printer, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase'; 

export default function SpxPrinter() {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStart = async () => {
    const rawIds = inputText
      .split(/[\n, ]+/)
      .map(id => id.trim())
      .filter(id => id !== '');

    if (rawIds.length === 0) return;

    setIsProcessing(true);
    setResults([]); 

    try {
      // Gọi Edge Function, đổi tên param truyền lên là trackingNumbers
      const { data, error } = await supabase.functions.invoke('spx-printer', {
        body: { trackingNumbers: rawIds }
      });
      
      if (error) throw error;

      if (data && data.code === 0) {
        const taskId = data.data?.task_id;
        const report = data._custom_report; // Lấy report từ Deno trả về
        
        let detailMsg = `Đã gửi in ${report.success_count} đơn hàng.`;
        if (report.failed_tracks.length > 0) {
          detailMsg += ` Thất bại ${report.failed_tracks.length} mã: ${report.failed_tracks.join(', ')}`;
        }

        setResults((prev) => [
          { 
            time: new Date().toLocaleTimeString(), 
            status: report.failed_tracks.length > 0 ? 'warning' : 'success', 
            message: `Tạo lệnh in thành công! Task ID: ${taskId}`,
            details: detailMsg
          },
          ...prev
        ]);
      } else {
        throw new Error(data.message || 'Lỗi không xác định từ hệ thống SPX');
      }

    } catch (error) {
      console.error("Lỗi khi in đơn:", error);
      setResults((prev) => [
        { 
          time: new Date().toLocaleTimeString(), 
          status: 'error', 
          message: `Lỗi: ${error.message}`,
          details: `Không thể xử lý yêu cầu in.`
        },
        ...prev
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans animate-fade-in mt-8">
      <h2 className="text-2xl font-black text-orange-600 uppercase tracking-wide mb-6">
        Công cụ In Đơn Hàng SPX Express
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cột 1: Nhập liệu */}
        <div className="flex flex-col bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <label className="font-bold mb-3 flex justify-between text-slate-700">
            <span>Danh sách Mã Vận Đơn (Tracking No.)</span>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">Mỗi mã một dòng</span>
          </label>
          <textarea
            className="flex-1 w-full p-4 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 mb-6 font-mono text-sm shadow-inner bg-slate-50"
            rows="12"
            placeholder="SPXVN064251903358&#10;SPXVN064251903359..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing}
          ></textarea>

          <button
            onClick={handleStart}
            disabled={isProcessing || !inputText.trim()}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all shadow-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang dịch mã & Gửi lệnh in...
              </>
            ) : (
              <>
                <Printer className="w-5 h-5" fill="currentColor" />
                Bắt đầu tạo File PDF
              </>
            )}
          </button>
        </div>

        {/* Cột 2: Kết quả */}
        <div className="flex flex-col bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[550px]">
          <div className="font-bold mb-4 flex justify-between items-center text-slate-700">
            <span>Lịch sử xử lý hệ thống</span>
            <span className="text-xs px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full flex items-center gap-1.5">
              <Printer size={14} />
              Trạng thái API
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 shadow-inner">
            {results.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-medium text-sm">
                Đang chờ lệnh in...
              </div>
            ) : (
              <ul className="space-y-3">
                {results.map((item, index) => (
                  <li 
                    key={index} 
                    className={`flex flex-col p-4 rounded-xl bg-white border-l-4 shadow-sm ${
                      item.status === 'success' ? 'border-green-500' : 
                      item.status === 'warning' ? 'border-yellow-500' : 'border-red-500'
                    }`}
                  >
                    <div className="flex items-center">
                      {item.status === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                      ) : item.status === 'warning' ? (
                        <AlertCircle className="w-5 h-5 text-yellow-500 mr-3 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500 mr-3 shrink-0" />
                      )}
                      <span className="font-semibold text-sm text-slate-800">{item.message}</span>
                      <span className="ml-auto text-xs text-slate-400">{item.time}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500 mt-2 ml-8">
                      {item.details}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}