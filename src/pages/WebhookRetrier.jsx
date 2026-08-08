import React, { useState } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase'; // Tận dụng cấu hình sẵn có của bạn

export default function WebhookRetrier() {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filterNoTracking, setFilterNoTracking] = useState(false);

  // Hàm tạo độ trễ
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleStart = async () => {
    // Tách các ID từ textarea
    const rawIds = inputText
      .split(/[\n, ]+/)
      .map(id => id.trim())
      .filter(id => id !== '');

    if (rawIds.length === 0) return;

    setIsProcessing(true);
    setResults([]);
    
    let idsToProcess = rawIds;

    // 1. GỌI EDGE FUNCTION QUA SUPABASE CLIENT ĐỂ LỌC DATABASE
    if (filterNoTracking) {
      try {
        // Dùng invoke thay cho fetch thuần
        const { data, error } = await supabase.functions.invoke('smart-service', {
          body: { ids: rawIds }
        });
        
        if (error) throw error;
        
        idsToProcess = data?.filteredIds || [];
      } catch (error) {
        console.error("Lỗi filter:", error);
        alert(`Lỗi lọc dữ liệu từ Supabase: ${error.message}`);
        setIsProcessing(false);
        return;
      }
    }

    if (idsToProcess.length === 0) {
      alert("Tất cả các đơn bạn nhập đều đã có mã vận đơn, không có ID nào cần cập nhật!");
      setIsProcessing(false);
      return;
    }

    setProgress({ current: 0, total: idsToProcess.length });

    // 2. CHẠY VÒNG LẶP WEBHOOK CHO CÁC ID ĐÃ ĐƯỢC LỌC
    for (let i = 0; i < idsToProcess.length; i++) {
      const orderId = idsToProcess[i];
      const targetUrl = `https://nhanh.vn/auto/posevent/orderupdate?id=${orderId}&businessId=176023`;

      try {
        await fetch(targetUrl, {
          method: 'GET',
          mode: 'no-cors',
        });

        setResults((prev) => [
          ...prev,
          { id: orderId, status: 'success' }
        ]);
      } catch (error) {
        setResults((prev) => [
          ...prev,
          { id: orderId, status: 'error', message: error.message }
        ]);
      }

      setProgress({ current: i + 1, total: idsToProcess.length });
      
      // Delay 200ms trước khi bắn ID tiếp theo
      await delay(200);
    }

    setIsProcessing(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans animate-fade-in mt-8">
      <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide mb-6">
        Công cụ chạy lại Webhook (Nhanh.vn)
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cột 1: Nhập liệu */}
        <div className="flex flex-col bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <label className="font-bold mb-3 flex justify-between text-slate-700">
            <span>Danh sách ID Đơn hàng</span>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">Mỗi ID một dòng</span>
          </label>
          <textarea
            className="flex-1 w-full p-4 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 font-mono text-sm shadow-inner bg-slate-50"
            rows="12"
            placeholder="800305288&#10;800305289&#10;800305290"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing}
          ></textarea>
          
          {/* Tuỳ chọn lọc Database */}
          <div className="flex items-center mb-4 p-3 border border-slate-200 rounded-xl bg-blue-50/30">
            <input
              type="checkbox"
              id="filterNoTracking"
              checked={filterNoTracking}
              onChange={(e) => setFilterNoTracking(e.target.checked)}
              disabled={isProcessing}
              className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            />
            <label htmlFor="filterNoTracking" className="ml-3 text-sm font-bold text-slate-700 cursor-pointer select-none">
              Chỉ cập nhật những đơn chưa có mã vận đơn
            </label>
          </div>

          <button
            onClick={handleStart}
            disabled={isProcessing || !inputText.trim()}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all shadow-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang xử lý ({progress.current}/{progress.total})...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" fill="currentColor" />
                Bắt đầu chạy lại
              </>
            )}
          </button>
        </div>

        {/* Cột 2: Kết quả */}
        <div className="flex flex-col bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[550px]">
          <div className="font-bold mb-4 flex justify-between items-center text-slate-700">
            <span>Lịch sử xử lý</span>
            <span className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Thành công: {results.filter(r => r.status === 'success').length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 shadow-inner">
            {results.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-medium text-sm">
                Chưa có dữ liệu xử lý
              </div>
            ) : (
              <ul className="space-y-2">
                {results.map((item, index) => (
                  <li 
                    key={index} 
                    className={`flex items-center p-3 rounded-lg bg-white border-l-4 shadow-sm ${
                      item.status === 'success' ? 'border-green-500' : 'border-red-500'
                    }`}
                  >
                    {item.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500 mr-3 shrink-0" />
                    )}
                    <span className="font-mono text-sm font-medium text-slate-700">{item.id}</span>
                    {item.status === 'error' && (
                      <span className="ml-auto text-xs text-red-500 font-medium truncate pl-2">{item.message}</span>
                    )}
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