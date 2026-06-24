import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MapPin, UploadCloud, Loader2, CheckCircle2, AlertCircle, 
  LayoutTemplate, Trash2, Plus, Save, Search, Edit3
} from 'lucide-react';
import * as Papa from 'papaparse';

export default function UpdateWarehouseMap() {
  const [activeTab, setActiveTab] = useState('map'); 
  
  // ==========================================
  const [csvFile, setCsvFile] = useState(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [locationMessage, setLocationMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  // ==========================================
  const [manualSearchCode, setManualSearchCode] = useState('');
  const [searchProductResult, setSearchProductResult] = useState(null);
  const [manualLocation, setManualLocation] = useState('');
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [isUpdatingManual, setIsUpdatingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState({ text: '', type: '' });

  // ==========================================
  const [racks, setRacks] = useState([]);
  const [draggingRack, setDraggingRack] = useState(null);
  const [isSavingMap, setIsSavingMap] = useState(false);
  const [mapMessage, setMapMessage] = useState('');
  const mapContainerRef = useRef(null);

  useEffect(() => {
    fetchMapConfig();
  }, []);

  const fetchMapConfig = async () => {
    const { data } = await supabase.from('system_configs').select('value').eq('key', 'warehouse_layout_map').single();
    if (data && data.value) {
      try { setRacks(JSON.parse(data.value)); } catch (e) { console.error("Lỗi parse map:", e); }
    }
  };

  const handleAddRack = () => {
    const newId = `RACK-${Date.now()}`;
    setRacks([...racks, { id: newId, name: `Kệ ${racks.length + 1}`, x: 50, y: 50, w: 100, h: 60 }]);
  };

  const handleRemoveRack = (idToRemove) => {
    if(confirm("Bạn có chắc muốn xóa kệ này khỏi bản đồ?")) setRacks(racks.filter(r => r.id !== idToRemove));
  };

  const handleUpdateRackName = (id, newName) => {
    setRacks(racks.map(r => r.id === id ? { ...r, name: newName } : r));
  };

  const handleMouseDown = (e, id) => {
    e.stopPropagation(); 
    setDraggingRack({ id, startX: e.clientX, startY: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!draggingRack) return;
    const dx = e.clientX - draggingRack.startX;
    const dy = e.clientY - draggingRack.startY;
    
    setRacks(prevRacks => prevRacks.map(rack => {
      if (rack.id === draggingRack.id) {
         return { ...rack, x: Math.max(0, rack.x + dx), y: Math.max(0, rack.y + dy) };
      }
      return rack;
    }));
    
    setDraggingRack({ id: draggingRack.id, startX: e.clientX, startY: e.clientY });
  };

  const handleMouseUp = () => setDraggingRack(null);

  const handleSaveMap = async () => {
    setIsSavingMap(true); setMapMessage('');
    try {
      const { error } = await supabase.from('system_configs').upsert({ key: 'warehouse_layout_map', value: JSON.stringify(racks) }, { onConflict: 'key' });
      if (error) throw error;
      setMapMessage('✅ Đã lưu cấu hình bản đồ thành công!');
      setTimeout(() => setMapMessage(''), 3000);
    } catch (err) { setMapMessage('❌ Lỗi: ' + err.message); } 
    finally { setIsSavingMap(false); }
  };

  // ⚡️ LUỒNG UPLOAD CSV (ĐÃ VÁ LỖI NGÁO: TÌM ĐÚNG BẰNG TÊN SẢN PHẨM)
  const handleUploadLocationCsv = () => {
    if (!csvFile) {
        setLocationMessage({ text: 'Vui lòng chọn một file CSV trước.', type: 'error' });
        return;
    }
    
    setIsUploadingCsv(true);
    setLocationMessage({ text: 'Đang ráp dữ liệu dựa theo Tên Sản Phẩm (Vui lòng không tắt trang)...', type: 'processing' });

    Papa.parse(csvFile, {
        header: true, skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            let successCount = 0; let errorCount = 0;
            const CHUNK_SIZE = 50;
            
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                
                const promises = chunk.map(async (row) => {
                    // ⚡️ LẤY ĐÚNG TÊN SẢN PHẨM VÀ MÃ VỊ TRÍ THEO Ý ÔNG
                    const productName = String(row['Tên sản phẩm'] || row['Ten san pham'] || row['product_name'] || '').trim();
                    const location = String(row['Mã vị trí'] || row['Vị trí'] || row['location_code'] || '').trim();

                    if (productName && location) {
                        const { data: updatedData, error } = await supabase
                            .from('product_inventories')
                            .update({ location_code: location })
                            .eq('product_name', productName) // ⚡️ CHỐT TÌM BẰNG TÊN TRONG DATABASE
                            .select('product_id');
                        
                        return (!error && updatedData && updatedData.length > 0) ? true : false;
                    } else {
                        return false; 
                    }
                });

                const results = await Promise.all(promises);
                results.forEach(isSuccess => {
                    if (isSuccess) successCount++;
                    else errorCount++;
                });
            }

            setIsUploadingCsv(false);
            if (successCount > 0) {
                setLocationMessage({ text: `🎉 Hoàn tất! Đã lưu vị trí cho ${successCount} tên sản phẩm. (Bỏ qua/Sai tên: ${errorCount} dòng).`, type: 'success' });
            } else {
                setLocationMessage({ text: '❌ Lỗi: Không tìm thấy bất kỳ Tên Sản Phẩm nào khớp trong Database. (Kiểm tra lại dữ liệu file).', type: 'error' });
            }
            setCsvFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        },
        error: (error) => {
            setIsUploadingCsv(false);
            setLocationMessage({ text: `❌ Lỗi đọc file: ${error.message}`, type: 'error' });
        }
    });
  };

  // ⚡️ TÌM KIẾM MANUAL: BỔ SUNG TÌM BẰNG TÊN SẢN PHẨM LUÔN CHO TIỆN
  const handleSearchProduct = async (e) => {
    e.preventDefault();
    const searchTerm = manualSearchCode.trim();
    if (!searchTerm) return;
    
    setIsSearchingProduct(true);
    setManualMessage({ text: '', type: '' });
    setSearchProductResult(null);

    // Mở rộng bộ lọc: Ưu tiên tìm đúng Tên SP trước, sau đó mới tìm ID/Mã vạch
    const { data, error } = await supabase
        .from('product_inventories')
        .select('product_id, product_code, product_name, location_code')
        .or(`product_name.ilike.%${searchTerm}%,product_code.eq.${searchTerm},product_id.eq.${searchTerm}`)
        .limit(1);

    setIsSearchingProduct(false);

    if (error || !data || data.length === 0) {
        setManualMessage({ text: '❌ Không tìm thấy sản phẩm nào có Tên/Mã khớp với từ khóa!', type: 'error' });
    } else {
        setSearchProductResult(data[0]);
        setManualLocation(data[0].location_code || '');
    }
  };

  const handleUpdateManualLocation = async (e) => {
    e.preventDefault();
    if (!searchProductResult) return;
    
    setIsUpdatingManual(true);
    setManualMessage({ text: '', type: '' });
    const newLoc = manualLocation.trim();

    const { data, error } = await supabase
        .from('product_inventories')
        .update({ location_code: newLoc })
        .eq('product_id', searchProductResult.product_id) 
        .select(); 

    setIsUpdatingManual(false);

    if (error) {
        setManualMessage({ text: `❌ Lỗi hệ thống: ${error.message}`, type: 'error' });
    } else if (!data || data.length === 0) {
        setManualMessage({ text: `❌ Lỗi ảo: Database từ chối ghi dữ liệu (Vui lòng thử lại)!`, type: 'error' });
    } else {
        setManualMessage({ text: `✅ Đã lưu cứng Mã Vị Trí "${newLoc}" cho sản phẩm ${searchProductResult.product_name}!`, type: 'success' });
        setSearchProductResult(data[0]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 mt-4 animate-in fade-in duration-300">
      
      {/* KHỐI TIÊU ĐỀ & CHUYỂN TAB */}
      <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner">
            <MapPin size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Sơ đồ & Vị trí Kho</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Dựng sơ đồ thực tế hoặc nạp vị trí sản phẩm hàng loạt</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 overflow-x-auto">
          <button onClick={() => setActiveTab('map')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <LayoutTemplate size={16} /> Dựng Sơ Đồ
          </button>
          <button onClick={() => setActiveTab('csv')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'csv' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <UploadCloud size={16} /> Nạp file CSV
          </button>
          <button onClick={() => { setActiveTab('manual'); setManualMessage({text:'', type:''}); setSearchProductResult(null); setManualSearchCode(''); }} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <Edit3 size={16} /> Cập nhật Lẻ
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: BẢN ĐỒ KÉO THẢ TRỰC QUAN */}
      {/* ========================================== */}
      {activeTab === 'map' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="font-bold text-gray-800">Mô phỏng mặt bằng Kho</h3>
              <p className="text-xs text-gray-500 mt-1">Bấm "Thêm Kệ mới" sau đó dùng chuột nắm kéo thả vị trí các kệ cho giống với thực tế.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={handleAddRack} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition">
                    <Plus size={16} /> Thêm Kệ mới
                </button>
                <button onClick={handleSaveMap} disabled={isSavingMap} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-md disabled:opacity-50">
                    {isSavingMap ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu Bản Đồ
                </button>
            </div>
          </div>

          {mapMessage && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${mapMessage.includes('✅') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {mapMessage}
            </div>
          )}

          <div 
            ref={mapContainerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative w-full h-[600px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden"
            style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          >
            {racks.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
                    <LayoutTemplate size={48} className="mb-4 opacity-50" />
                    <p className="font-medium text-sm">Chưa có kệ hàng nào. Bấm "Thêm Kệ mới" để bắt đầu.</p>
                </div>
            )}

            {racks.map(rack => (
              <div 
                key={rack.id}
                onMouseDown={(e) => handleMouseDown(e, rack.id)}
                className={`absolute flex flex-col items-center justify-center border-2 shadow-lg rounded-lg cursor-move select-none transition-shadow ${draggingRack?.id === rack.id ? 'border-blue-500 bg-blue-100 shadow-xl z-50 ring-4 ring-blue-500/20' : 'border-slate-400 bg-white hover:border-blue-400'}`}
                style={{ left: rack.x, top: rack.y, width: rack.w, height: rack.h }}
              >
                <div className="absolute -top-3 right-0 opacity-0 hover:opacity-100 transition-opacity">
                    <button onMouseDown={(e) => { e.stopPropagation(); handleRemoveRack(rack.id); }} className="bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600">
                        <Trash2 size={12} />
                    </button>
                </div>
                
                <input 
                    type="text" 
                    value={rack.name}
                    onChange={(e) => handleUpdateRackName(rack.id, e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()} 
                    className="w-[90%] text-center text-sm font-black text-slate-700 bg-transparent outline-none border-b border-transparent focus:border-blue-400"
                />
              </div>
            ))}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-700 px-8 py-2 rounded-t-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                Cửa Chính Xuất / Nhập
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: UPLOAD CSV IMPORT VỊ TRÍ (ĐÃ CẬP NHẬT GIAO DIỆN HƯỚNG DẪN) */}
      {/* ========================================== */}
      {activeTab === 'csv' && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <UploadCloud size={20} className="text-blue-500"/> Cập nhật Vị trí bằng File (Hàng loạt)
                </h2>
            </div>
            
            <p className="text-sm text-gray-600 font-medium leading-relaxed bg-blue-50 p-4 rounded-xl border border-blue-100">
                Tính năng này cho phép bạn tải lên 1 file Excel (đuôi <b>.csv</b>) để thiết lập vị trí cho hàng ngàn sản phẩm trong kho cùng lúc. <br/>
                File yêu cầu bắt buộc phải có dòng tiêu đề với 2 cột: <b>"Tên sản phẩm"</b> và <b>"Mã vị trí"</b> <i>(Mã vị trí nhập vào phải khớp với tên Kệ ở Sơ đồ)</i>.
            </p>

            <div className="bg-slate-50 p-8 rounded-2xl border-2 border-slate-200 border-dashed text-center space-y-6">
                <input 
                    type="file" 
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer max-w-sm mx-auto bg-white border border-slate-200 rounded-xl shadow-sm"
                />
                
                <button 
                    onClick={handleUploadLocationCsv} 
                    disabled={isUploadingCsv || !csvFile}
                    className="mx-auto flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                >
                    {isUploadingCsv ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />} 
                    {isUploadingCsv ? 'Đang ráp Data vào hệ thống...' : 'Bắt đầu Import'}
                </button>
            </div>

            {locationMessage.text && (
                <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 border ${
                    locationMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
                    locationMessage.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
                    'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
                }`}>
                    {locationMessage.type === 'success' && <CheckCircle2 size={18} />}
                    {locationMessage.type === 'error' && <AlertCircle size={18} />}
                    {locationMessage.text}
                </div>
            )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: CẬP NHẬT LẺ (ĐÃ MỞ RỘNG TÌM BẰNG TÊN) */}
      {/* ========================================== */}
      {activeTab === 'manual' && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 space-y-6 max-w-3xl mx-auto">
            <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Edit3 size={20} className="text-blue-500"/> Chỉnh sửa Vị trí thủ công
                </h2>
                <p className="text-sm text-gray-500 mt-1">Dành cho việc điều chỉnh nhanh vị trí của 1 vài sản phẩm cụ thể mà không cần up file.</p>
            </div>

            <form onSubmit={handleSearchProduct} className="flex gap-3">
                <input 
                    type="text" 
                    placeholder="Gõ Tên sản phẩm, Mã Nhanh hoặc Mã Vạch..." 
                    value={manualSearchCode}
                    onChange={(e) => setManualSearchCode(e.target.value)}
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-700"
                />
                <button 
                    type="submit" 
                    disabled={isSearchingProduct || !manualSearchCode.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition shadow-sm disabled:opacity-50"
                >
                    {isSearchingProduct ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} Tìm kiếm
                </button>
            </form>

            {manualMessage.text && (
                <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 border ${
                    manualMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {manualMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {manualMessage.text}
                </div>
            )}

            {searchProductResult && (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col gap-1 pb-4 border-b border-slate-200/60">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thông tin Sản phẩm</span>
                        <h3 className="text-lg font-black text-slate-800">{searchProductResult.product_name || 'Đang cập nhật tên...'}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                                Mã/Barcode: {searchProductResult.product_code || searchProductResult.product_id}
                            </span>
                            <span className={`px-2.5 py-1 border rounded-lg text-xs font-bold ${searchProductResult.location_code ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                Vị trí hiện tại: {searchProductResult.location_code || 'Chưa thiết lập'}
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleUpdateManualLocation} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Mã Vị trí mới (Tên Kệ)</label>
                            <input 
                                type="text" 
                                placeholder="Nhập mã vị trí mới (Ví dụ: Kệ A1)..." 
                                value={manualLocation}
                                onChange={(e) => setManualLocation(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-800 bg-white"
                            />
                        </div>
                        <div className="flex justify-end pt-2">
                            <button 
                                type="submit"
                                disabled={isUpdatingManual || !manualLocation.trim()}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {isUpdatingManual ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                                Xác nhận Lưu Vị Trí
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
      )}

    </div>
  );
}