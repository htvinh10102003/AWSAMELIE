import React, { useState } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function WebhookRetrier() {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Hàm tạo độ trễ
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleStart = async () => {
    // Tách các ID từ textarea (xuống dòng, dấu phẩy hoặc khoảng trắng)
    const ids = inputText
      .split(/[\n, ]+/)
      .map(id => id.trim())
      .filter(id => id !== '');

    if (ids.length === 0) return;

    setIsProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: ids.length });

    for (let i = 0; i < ids.length; i++) {
      const orderId = ids[i];
      const targetUrl = `https://nhanh.vn/auto/posevent/orderupdate?id=${orderId}&businessId=176023`;

      try {
        // Fetch dữ liệu (Lưu ý vấn đề CORS bên dưới)
        const response = await fetch(targetUrl, {
          method: 'GET',
          // mode: 'no-cors', // Mở comment dòng này nếu chạy trực tiếp trên trình duyệt bị chặn CORS
        });

        // Cập nhật state list thành công
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

      setProgress({ current: i + 1, total: ids.length });
      
      // Delay 200ms trước khi bắn ID tiếp theo
      await delay(200);
    }

    setIsProcessing(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Công cụ chạy lại Webhook (Nhanh.vn)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cột 1: Nhập liệu */}
        <div className="flex flex-col bg-white p-4 rounded-lg shadow border">
          <label className="font-semibold mb-2 flex justify-between">
            <span>Danh sách ID Đơn hàng</span>
            <span className="text-sm text-gray-500">Mỗi ID một dòng</span>
          </label>
          <textarea
            className="flex-1 w-full p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 font-mono text-sm"
            rows="15"
            placeholder="800305288&#10;800305289&#10;800305290"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessing}
          ></textarea>
          
          <button
            onClick={handleStart}
            disabled={isProcessing || !inputText.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang xử lý ({progress.current}/{progress.total})...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Bắt đầu chạy lại
              </>
            )}
          </button>
        </div>

        {/* Cột 2: Kết quả */}
        <div className="flex flex-col bg-white p-4 rounded-lg shadow border h-[550px]">
          <div className="font-semibold mb-4 flex justify-between items-center">
            <span>Lịch sử xử lý</span>
            <span className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded-full">
              Thành công: {results.filter(r => r.status === 'success').length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto border rounded-md p-2 bg-gray-50">
            {results.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                Chưa có dữ liệu xử lý
              </div>
            ) : (
              <ul className="space-y-2">
                {results.map((item, index) => (
                  <li 
                    key={index} 
                    className={`flex items-center p-3 rounded-md bg-white border-l-4 shadow-sm ${
                      item.status === 'success' ? 'border-green-500' : 'border-red-500'
                    }`}
                  >
                    {item.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500 mr-3 shrink-0" />
                    )}
                    <span className="font-mono">{item.id}</span>
                    {item.status === 'error' && (
                      <span className="ml-auto text-xs text-red-500 truncate">{item.message}</span>
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