import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  UploadCloud, Settings, Loader2, X, Video, FileVideo, 
  CheckCircle2, AlertCircle, Database, PackageSearch,
  Search, Plus, Minus, Trash2, Box
} from 'lucide-react';

export default function UploadVideoHoan() {
  const [formData, setFormData] = useState({
    nhanhId: '',
    orderId: '',
    hvcCode: ''
  });

  const [packingVideo, setPackingVideo] = useState(null);
  const [returnVideo, setReturnVideo] = useState(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState([]);

  // === STATE QUẢN LÝ SẢN PHẨM ===
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  
  const searchTimeoutRef = useRef(null);
  const packingInputRef = useRef(null);
  const returnInputRef = useRef(null);
  const searchDropdownRef = useRef(null);

  // Xử lý click ra ngoài để đóng dropdown tìm kiếm
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
        setProductResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==========================================
  // HỆ THỐNG LOG
  // ==========================================
  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date() }]);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ==========================================
  // TÌM KIẾM & CHỌN SẢN PHẨM
  // ==========================================
  const handleSearchProduct = async (query) => {
    setProductSearch(query);
    
    if (!query.trim()) {
      setProductResults([]);
      return;
    }

    // Debounce: Đợi người dùng gõ xong mới gọi DB để tránh spam request
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingProduct(true);
      try {
        const { data, error } = await supabase
          .from('product_inventories')
          .select('product_code, product_name')
          .or(`product_code.ilike.%${query}%,product_name.ilike.%${query}%`)
          .limit(10);
        
        if (error) throw error;
        setProductResults(data || []);
      } catch (err) {
        console.error('Lỗi tìm sản phẩm:', err);
      } finally {
        setIsSearchingProduct(false);
      }
    }, 400);
  };

  const addProduct = (prod) => {
    setSelectedProducts(prev => {
      const existing = prev.find(p => p.product_code === prod.product_code);
      if (existing) {
        // Nếu đã có trong danh sách thì tăng số lượng lên 1
        return prev.map(p => 
          p.product_code === prod.product_code 
            ? { ...p, quantity: p.quantity + 1 } 
            : p
        );
      }
      // Chưa có thì thêm mới với số lượng là 1
      return [...prev, { ...prod, quantity: 1 }];
    });
    setProductSearch('');
    setProductResults([]);
  };

  const updateQuantity = (code, delta) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.product_code === code) {
        const newQ = p.quantity + delta;
        return { ...p, quantity: newQ > 0 ? newQ : 1 }; // Ít nhất là 1
      }
      return p;
    }));
  };

  const removeProduct = (code) => {
    setSelectedProducts(prev => prev.filter(p => p.product_code !== code));
  };

  // ==========================================
  // XỬ LÝ CHỌN FILE VIDEO
  // ==========================================
  const handleFileChange = (e, type) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 500 * 1024 * 1024) {
        addLog(`File ${file.name} quá lớn (>500MB)`, 'error');
        return;
      }

      if (type === 'packing') {
        setPackingVideo(file);
        addLog(`Đã chọn video đóng hàng: ${file.name}`, 'info');
      } else {
        setReturnVideo(file);
        addLog(`Đã chọn video bóc hoàn: ${file.name}`, 'info');
      }
    }
  };

  const removeFile = (type) => {
    if (type === 'packing') {
      setPackingVideo(null);
      if (packingInputRef.current) packingInputRef.current.value = '';
    } else {
      setReturnVideo(null);
      if (returnInputRef.current) returnInputRef.current.value = '';
    }
  };

  // ==========================================
  // XỬ LÝ UPLOAD LÊN GOOGLE DRIVE
  // ==========================================
  const uploadToDrive = async (file, fileType) => {
    addLog(`Đang xin Token xác thực cho ${fileType}...`, 'info');
    
    const { data, error: funcErr } = await supabase.functions.invoke('get-upload-url');
    if (funcErr || !data?.accessToken) {
      throw new Error(`Không lấy được Token: ${funcErr?.message}`);
    }

    const { accessToken, folderId } = data;
    const filename = `${formData.nhanhId || formData.hvcCode}_${fileType}_${Date.now()}.mp4`;

    addLog(`Đang khởi tạo luồng upload an toàn...`, 'info');

    const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': file.type,
      },
      body: JSON.stringify({
        name: filename,
        parents: [folderId]
      })
    });

    if (!initRes.ok) {
       const errBody = await initRes.text();
       throw new Error(`Lỗi khởi tạo Drive API: ${errBody}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) throw new Error('Không lấy được link upload từ Google');

    addLog(`Đang đẩy video ${fileType} lên Google Drive...`, 'warning');

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const errBody = await uploadResponse.text();
      console.error("Lỗi 403 chi tiết từ Google:", errBody);
      throw new Error(`Upload thất bại (Status ${uploadResponse.status}): ${errBody}`);
    }

    const driveFile = await uploadResponse.json();
    return `https://drive.google.com/file/d/${driveFile.id}/view`;
  };

  // ==========================================
  // SUBMIT FORM VÀ LƯU DATABASE
  // ==========================================
  const handleSubmit = async () => {
    if (!formData.nhanhId && !formData.hvcCode) {
      addLog('Vui lòng nhập ID Nhanh hoặc Mã HVC để tra cứu!', 'error');
      return;
    }
    if (!packingVideo && !returnVideo) {
      addLog('Vui lòng chọn ít nhất 1 video để upload!', 'error');
      return;
    }

    setIsUploading(true);
    addLog('Bắt đầu tiến trình xử lý...', 'info');

    try {
      let packingUrl = null;
      let returnUrl = null;

      if (packingVideo) {
        packingUrl = await uploadToDrive(packingVideo, 'DongHang');
        addLog('Tải lên video Đóng Hàng thành công!', 'success');
      }

      if (returnVideo) {
        returnUrl = await uploadToDrive(returnVideo, 'BocHoan');
        addLog('Tải lên video Bóc Hoàn thành công!', 'success');
      }

      addLog('Đang lưu thông tin vào Database...', 'info');
      
      const { error: dbError } = await supabase
        .from('order_complaints')
        .insert([
          { 
            nhanh_id: formData.nhanhId, 
            order_id: formData.orderId,
            hvc_code: formData.hvcCode,
            packing_video_url: packingUrl,
            return_video_url: returnUrl,
            products: selectedProducts // Truyền mảng sản phẩm đã chọn vào cột JSONB
          }
        ]);

      if (dbError) throw dbError;

      addLog('LƯU TRỮ THÀNH CÔNG! Đã cập nhật vào hệ thống.', 'success');
      
      // Reset form sau khi thành công
      setFormData({ nhanhId: '', orderId: '', hvcCode: '' });
      setSelectedProducts([]);
      removeFile('packing');
      removeFile('return');

    } catch (error) {
      addLog(`Lỗi xử lý: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-12 mt-8 font-sans">
      
      {/* HEADER TÍNH NĂNG */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm border border-indigo-100">
          <UploadCloud size={26} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Upload Video Khiếu Nại / Hàng Hoàn</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Lưu trữ video bóc hàng, đóng hàng trực tiếp lên Google Drive</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CỘT NHẬP LIỆU VÀ UPLOAD */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-8">
            
            {/* BƯỚC 1: THÔNG TIN ĐƠN HÀNG */}
            <div>
              <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2 mb-4">
                <PackageSearch size={18} /> 1. Thông tin tra cứu
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ID Nhanh <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    name="nhanhId"
                    value={formData.nhanhId}
                    onChange={handleInputChange}
                    placeholder="VD: 123456789"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Mã HVC</label>
                  <input 
                    type="text" 
                    name="hvcCode"
                    value={formData.hvcCode}
                    onChange={handleInputChange}
                    placeholder="VD: SPXVN..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ID Đơn hàng (Kênh bán)</label>
                  <input 
                    type="text" 
                    name="orderId"
                    value={formData.orderId}
                    onChange={handleInputChange}
                    placeholder="Tiktok, Shopee..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all" 
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* BƯỚC 2: CHỌN SẢN PHẨM KHIẾU NẠI */}
            <div>
              <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2 mb-4">
                <Box size={18} /> 2. Sản phẩm khiếu nại <span className="text-slate-400 font-medium normal-case text-xs">(Không bắt buộc)</span>
              </h3>
              
              <div className="relative" ref={searchDropdownRef}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {isSearchingProduct ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Search size={18} className="text-slate-400" />}
                  </div>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => handleSearchProduct(e.target.value)}
                    onFocus={() => { if(productSearch) handleSearchProduct(productSearch) }}
                    placeholder="Gõ mã hoặc tên sản phẩm để tra cứu..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Dropdown Kết quả */}
                {productResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-hidden">
                    {productResults.map((prod, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => addProduct(prod)}
                        className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center group"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800 line-clamp-1">{prod.product_name}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{prod.product_code}</p>
                        </div>
                        <Plus size={18} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danh sách đã chọn */}
              {selectedProducts.length > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedProducts.map((prod, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex-1 pr-3">
                        <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight mb-1">{prod.product_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono bg-slate-100 inline-block px-1.5 py-0.5 rounded">{prod.product_code}</p>
                      </div>
                      <div className="flex items-center gap-3 border-l border-slate-100 pl-3">
                        <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                          <button type="button" onClick={() => updateQuantity(prod.product_code, -1)} className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-sm font-black text-slate-800 select-none">{prod.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(prod.product_code, 1)} className="p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                            <Plus size={14} />
                          </button>
                        </div>
                        <button type="button" onClick={() => removeProduct(prod.product_code)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* BƯỚC 3: UPLOAD VIDEO */}
            <div>
              <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2 mb-4">
                <Video size={18} /> 3. File Video Lưu Trữ
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Khu vực Video Đóng Hàng */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Video đóng hàng</label>
                  {!packingVideo ? (
                    <div 
                      className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer flex flex-col items-center justify-center h-40" 
                      onClick={() => packingInputRef.current?.click()}
                    >
                      <input type="file" accept="video/*" className="hidden" ref={packingInputRef} onChange={(e) => handleFileChange(e, 'packing')} />
                      <div className="p-3 bg-blue-50 text-blue-500 rounded-full mb-3">
                        <FileVideo size={24} />
                      </div>
                      <p className="text-sm font-bold text-slate-600">Chọn video đóng hàng</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-1">MP4, MOV (Tối đa 500MB)</p>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center h-40 bg-blue-50/50 border border-blue-200 p-4 rounded-2xl relative group">
                      <div className="absolute top-2 right-2">
                        <button onClick={() => removeFile('packing')} disabled={isUploading} className="p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-sm">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex flex-col items-center text-center gap-2">
                        <CheckCircle2 size={32} className="text-blue-500" />
                        <div>
                          <p className="text-sm font-bold text-slate-800 line-clamp-1 break-all">{packingVideo.name}</p>
                          <p className="text-xs font-medium text-slate-500">{(packingVideo.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Khu vực Video Bóc Hoàn */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Video bóc hoàn</label>
                  {!returnVideo ? (
                    <div 
                      className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer flex flex-col items-center justify-center h-40" 
                      onClick={() => returnInputRef.current?.click()}
                    >
                      <input type="file" accept="video/*" className="hidden" ref={returnInputRef} onChange={(e) => handleFileChange(e, 'return')} />
                      <div className="p-3 bg-rose-50 text-rose-500 rounded-full mb-3">
                        <FileVideo size={24} />
                      </div>
                      <p className="text-sm font-bold text-slate-600">Chọn video bóc hoàn</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-1">MP4, MOV (Tối đa 500MB)</p>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center h-40 bg-rose-50/50 border border-rose-200 p-4 rounded-2xl relative group">
                      <div className="absolute top-2 right-2">
                        <button onClick={() => removeFile('return')} disabled={isUploading} className="p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full shadow-sm">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex flex-col items-center text-center gap-2">
                        <CheckCircle2 size={32} className="text-rose-500" />
                        <div>
                          <p className="text-sm font-bold text-slate-800 line-clamp-1 break-all">{returnVideo.name}</p>
                          <p className="text-xs font-medium text-slate-500">{(returnVideo.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* ACTION UPLOAD */}
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handleSubmit}
                disabled={isUploading || (!packingVideo && !returnVideo)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:bg-slate-300 transition-all shadow-sm"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                {isUploading ? 'Hệ thống đang xử lý, vui lòng không tắt trang...' : 'Tải lên & Lưu hệ thống'}
              </button>
            </div>

          </div>
        </div>

        {/* CỘT TRẠNG THÁI & LOG */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* LƯU Ý */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-black text-amber-800 flex items-center gap-2 mb-2">
              <AlertCircle size={18} /> Hướng dẫn & Lưu ý
            </h3>
            <ul className="text-xs font-medium text-amber-700 space-y-2 list-disc pl-4">
              <li>Mã ID Nhanh là thông tin quan trọng nhất để đồng bộ, vui lòng nhập chính xác.</li>
              <li>Có thể gõ tên hoặc mã sản phẩm để hệ thống tự động gọi dữ liệu từ kho.</li>
              <li>Video sẽ được đẩy thẳng lên thư mục Google Drive của Hệ thống. Database chỉ lưu đường link để giảm tải máy chủ.</li>
            </ul>
          </div>

          {/* BOX LOG TERMINAL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-[300px]">
            <div className="p-3 bg-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-2">
              <Settings size={14} /> Trạng thái tiến trình
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2 font-mono text-[11px] bg-slate-950">
              {logs.length === 0 ? (
                <div className="text-slate-600 h-full flex items-center justify-center">Chưa có tiến trình nào...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`flex items-start gap-2 ${
                    log.type === 'error' ? 'text-rose-400' : 
                    log.type === 'success' ? 'text-emerald-400' : 
                    log.type === 'warning' ? 'text-amber-400' : 'text-blue-300'
                  }`}>
                    <span className="shrink-0 opacity-50">[{log.time.toLocaleTimeString('vi-VN')}]</span>
                    <span className="break-words">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}