import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  PackageSearch, Pencil, FileSpreadsheet, UploadCloud, Search, 
  ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle, X, Save
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function UpdateProduct() {
  const [activeTab, setActiveTab] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState(''); 
  
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({ product_code: '', product_name: '' });

  const [diffList, setDiffList] = useState([]); 
  const [bulkLoading, setBulkLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const PAGE_SIZE = 50;

  const fetchProducts = async (pageIndex = 0, search = '') => {
    setLoading(true);
    try {
      let query = supabase
        .from('product_inventories')
        .select('product_id, product_code, product_name', { count: 'exact' });

      if (search) {
        query = query.or(`product_code.ilike.%${search}%,product_name.ilike.%${search}%`);
      }

      const { data, count, error } = await query
        .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1)
        .order('product_name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
      if (count !== null) setTotalCount(count);
    } catch (err) {
      showMessage('danger', 'Lỗi tải dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'manual') {
      fetchProducts(page, searchQuery);
    }
  }, [page, searchQuery, activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0); 
    setSearchQuery(searchInput.trim());
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setEditForm({
      product_code: prod.product_code || '', 
      product_name: prod.product_name || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('product_inventories')
        .update({
          product_code: editForm.product_code.trim(),
          product_name: editForm.product_name.trim()
        })
        .eq('product_id', editingProduct.product_id);

      if (error) throw error;

      showMessage('success', '✅ Đã cập nhật thông tin sản phẩm thành công!');
      setEditingProduct(null);
      fetchProducts(page, searchQuery); 
    } catch (err) {
      showMessage('danger', '❌ Lỗi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ⚡️ VÁ LỖI CHÍ MẠNG: Dùng normalize('NFC') để gộp bảng mã Unicode tiếng Việt
  const normalizeString = (str) => {
    if (!str) return '';
    return String(str).normalize('NFC').replace(/\s+/g, ' ').trim().toUpperCase();
  };

  // ==========================================
  // ⚡️ LUỒNG XỬ LÝ FILE MỚI: TẠO CHECKBOX ĐỂ CHỌN
  // ==========================================
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setBulkLoading(true);
    
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const uploadedItems = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length === 0) continue; 
          
          const barcode = cols[0] ? String(cols[0]).trim() : '';
          const name = cols[1] ? String(cols[1]).trim() : '';
          
          if (barcode && name) uploadedItems.push({ barcode, name });
        }

        const { data: currentDB, error } = await supabase.from('product_inventories').select('product_id, product_code, product_name');
        if (error) throw error;

        const dbByBarcode = new Map();
        const dbByName = new Map();

        currentDB.forEach(item => {
          if (item.product_code) dbByBarcode.set(normalizeString(item.product_code), item);
          if (item.product_name) dbByName.set(normalizeString(item.product_name), item);
        });

        const differences = [];

        uploadedItems.forEach((item, index) => {
          const normExcelBarcode = normalizeString(item.barcode);
          const normExcelName = normalizeString(item.name);

          const matchByBarcode = dbByBarcode.get(normExcelBarcode);

          if (matchByBarcode) {
            if (normalizeString(matchByBarcode.product_name) !== normExcelName) {
              differences.push({
                uid: `diff_${index}`,
                product_id: matchByBarcode.product_id, 
                type: 'UPDATE_NAME',
                barcode: item.barcode,
                name: item.name,
                old_val: matchByBarcode.product_name,
                new_val: item.name,
                selected: true // Mặc định tự động chọn
              });
            }
          } else {
            const matchByName = dbByName.get(normExcelName);
            
            if (matchByName) {
              if (normalizeString(matchByName.product_code) !== normExcelBarcode) {
                differences.push({
                  uid: `diff_${index}`,
                  product_id: matchByName.product_id, 
                  type: 'UPDATE_BARCODE',
                  barcode: item.barcode,
                  name: matchByName.product_name,
                  old_val: matchByName.product_code || 'Chưa có',
                  new_val: item.barcode,
                  selected: true // Mặc định tự động chọn
                });
              }
            } else {
              differences.push({
                uid: `diff_${index}`,
                product_id: null,
                type: 'NOT_FOUND',
                barcode: item.barcode,
                name: item.name,
                selected: false // Mã lạ thì không cho chọn
              });
            }
          }
        });

        setDiffList(differences);
      } catch (err) {
        showMessage('danger', '❌ Lỗi phân tích file: ' + err.message);
      } finally {
        setBulkLoading(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // ⚡️ XỬ LÝ TICK CHỌN CHECKBOX
  const handleToggleSelect = (uid) => {
    setDiffList(prev => prev.map(item => {
      if (item.uid === uid && item.type !== 'NOT_FOUND') {
        return { ...item, selected: !item.selected };
      }
      return item;
    }));
  };

  const handleToggleSelectAll = (e) => {
    const isChecked = e.target.checked;
    setDiffList(prev => prev.map(item => ({
      ...item,
      selected: item.type !== 'NOT_FOUND' ? isChecked : false
    })));
  };

  const executeBulkUpdate = async () => {
    // ⚡️ Chỉ lấy những sản phẩm đã được Tick chọn
    const validUpdates = diffList.filter(item => item.product_id && item.type !== 'NOT_FOUND' && item.selected);
    
    if (validUpdates.length === 0) {
      alert("Bạn chưa tick chọn sản phẩm hợp lệ nào để cập nhật!");
      return;
    }
    if (!confirm(`Xác nhận GHI ĐÈ dữ liệu cho ${validUpdates.length} sản phẩm đang được tick chọn?`)) return;

    setBulkLoading(true);
    try {
      const promises = validUpdates.map(item => {
        const updatePayload = {};
        if (item.type === 'UPDATE_NAME') updatePayload.product_name = item.new_val;
        if (item.type === 'UPDATE_BARCODE') updatePayload.product_code = item.new_val;

        return supabase.from('product_inventories')
          .update(updatePayload)
          .eq('product_id', item.product_id);
      });

      await Promise.all(promises);

      showMessage('success', `🎉 Đại thành công! Đã chuẩn hóa ${validUpdates.length} sản phẩm.`);
      setDiffList([]);
      setFileName('');
    } catch (err) {
      showMessage('danger', '❌ Cập nhật thất bại: ' + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  
  // Tính tổng số mục đang được tick
  const selectedCount = diffList.filter(i => i.selected && i.type !== 'NOT_FOUND').length;
  // Kiểm tra xem có phải tất cả các mục hợp lệ đều đang được tick không
  const isAllSelected = diffList.filter(i => i.type !== 'NOT_FOUND').length > 0 && 
                        diffList.filter(i => i.type !== 'NOT_FOUND').every(i => i.selected);

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><PackageSearch size={22} /></span>
            Hiệu chỉnh Sản phẩm (Master Data)
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">Đồng bộ chéo Tên Sản Phẩm và Mã Vạch (Barcode)</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          <button onClick={() => { setActiveTab('manual'); setDiffList([]); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 cursor-pointer'}`}>
            ✏️ Chỉnh sửa Thủ công
          </button>
          <button onClick={() => setActiveTab('bulk')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'bulk' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 cursor-pointer'}`}>
            ⚡️ Cập nhật Hàng loạt
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 font-black text-sm rounded-2xl shadow-md flex items-center gap-3 animate-in slide-in-from-top-2 ${message.type === 'danger' ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'}`}>
          {message.type === 'danger' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* ========================================== */}
      {/* GIAO DIỆN 1: HIỆU CHỈNH THỦ CÔNG */}
      {/* ========================================== */}
      {activeTab === 'manual' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[600px]">
          
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Tổng quan: <span className="text-blue-600">{totalCount}</span> sản phẩm
            </span>
            
            <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
              <input 
                type="text" 
                placeholder="Tìm Barcode hoặc Tên SP..." 
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition shadow-sm"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            </form>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-xs font-bold text-slate-400 gap-2">
                <Loader2 size={28} className="animate-spin text-blue-500" /> Đang tải từ điển kho...
              </div>
            ) : (
              <table className="w-full text-left text-xs font-semibold">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-6">Tên sản phẩm</th>
                    <th className="py-3 px-4">Mã Vạch (Barcode)</th>
                    <th className="py-3 px-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {products.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-10 text-slate-400">Không tìm thấy sản phẩm nào.</td></tr>
                  ) : (
                    products.map(prod => (
                      <tr key={prod.product_id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-6 font-bold text-slate-800">{prod.product_name}</td>
                        <td className="py-3 px-4 font-black tracking-widest text-blue-600">{prod.product_code || '---'}</td>
                        <td className="py-3 px-6 text-right">
                          <button onClick={() => handleOpenEdit(prod)} className="px-3 py-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg shadow-sm hover:bg-blue-50 transition cursor-pointer flex items-center gap-1.5 ml-auto">
                            <Pencil size={12}/> Sửa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-500">
            <div>Hiển thị trang <span className="text-blue-600">{page + 1}</span> / {totalPages || 1}</div>
            <div className="flex gap-2">
              <button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"><ChevronLeft size={16}/></button>
              <button disabled={page >= totalPages - 1 || loading} onClick={() => setPage(p => p + 1)} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"><ChevronRight size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* GIAO DIỆN 2: HIỆU CHỈNH HÀNG LOẠT (BULK) */}
      {/* ========================================== */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-white p-8 md:p-10 border border-slate-200 border-dashed rounded-3xl text-center shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
            {bulkLoading && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-blue-600 font-bold gap-2"><Loader2 size={32} className="animate-spin" /> Đang phân tích so sánh 2 chiều...</div>}
            
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-lg">
              <FileSpreadsheet size={28} className="text-blue-500" />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Tải File Excel (.xlsx) / CSV</h3>
            <p className="text-xs text-slate-500 font-medium mt-2 max-w-md mx-auto leading-relaxed">
              Cấu trúc file chuẩn: Cột 1 là <strong className="text-slate-800">Mã Vạch</strong>, Cột 2 là <strong className="text-blue-600">Tên Sản Phẩm</strong>. Hệ thống sẽ quét chéo để cập nhật Tên bị lệch hoặc Barcode bị sai.
            </p>
            
            <label className="mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition cursor-pointer flex items-center gap-2">
              <UploadCloud size={18} /> Chọn file đối soát
              <input type="file" accept=".csv, .txt, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>
            {fileName && <div className="mt-3 text-[11px] font-bold text-slate-400">File đang chọn: <span className="text-slate-700">{fileName}</span></div>}
          </div>

          {/* Bảng Hiển thị sự khác biệt */}
          {diffList.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
              <div className="p-4 border-b border-amber-100 bg-amber-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black text-amber-800 uppercase tracking-wide flex items-center gap-2">
                    <AlertCircle size={16}/> Phát hiện {diffList.length} sản phẩm bị lệch Dữ liệu gốc
                  </h3>
                  <p className="text-[10px] text-amber-600/70 font-medium mt-0.5">Tick chọn các ô bên dưới để đồng bộ dữ liệu vào hệ thống.</p>
                </div>
                <button onClick={executeBulkUpdate} disabled={bulkLoading || selectedCount === 0} className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white disabled:bg-slate-300 text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-2">
                  <Save size={14}/> Xác nhận Cập nhật ({selectedCount} SP)
                </button>
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs font-semibold">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider bg-slate-50">
                      <th className="py-3 px-4 w-10 text-center">
                        <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={isAllSelected} onChange={handleToggleSelectAll} />
                      </th>
                      <th className="py-3 px-4 w-24 text-center">Hành động</th>
                      <th className="py-3 px-4">Thông tin Sản phẩm</th>
                      <th className="py-3 px-4">Thay đổi (Cũ ➜ Mới)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {diffList.map((item) => (
                      <tr key={item.uid} className={`transition-colors ${item.selected ? 'bg-amber-50/30' : 'hover:bg-slate-50'}`}>
                        <td className="py-3 px-4 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 cursor-pointer" 
                            checked={item.selected} 
                            disabled={item.type === 'NOT_FOUND'}
                            onChange={() => handleToggleSelect(item.uid)} 
                          />
                        </td>
                        
                        <td className="py-3 px-4 text-center">
                          {item.type === 'NOT_FOUND' && <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded font-black uppercase">Mã lạ</span>}
                          {item.type === 'UPDATE_NAME' && <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-black uppercase border border-blue-200">Sửa Tên</span>}
                          {item.type === 'UPDATE_BARCODE' && <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-black uppercase border border-emerald-200">Sửa Mã</span>}
                        </td>

                        <td className="py-3 px-4">
                          {item.type === 'UPDATE_BARCODE' ? (
                            <div className="font-bold text-slate-800">{item.name}</div>
                          ) : (
                            <div className="font-black tracking-widest text-slate-800">{item.barcode}</div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {item.type === 'NOT_FOUND' ? (
                            <div className="text-slate-500 font-medium">Lấy từ file: <span className="text-slate-800 font-bold">{item.name}</span></div>
                          ) : (
                            <>
                              <div className="text-[10px] text-red-400 line-through truncate max-w-sm">{item.old_val}</div>
                              <div className="text-emerald-600 font-bold truncate max-w-sm mt-0.5">➜ {item.new_val}</div>
                            </>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* ⚡️ MODAL SỬA THÔNG TIN THỦ CÔNG */}
      {/* ========================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md p-6 transform transition-all animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl"><Pencil size={16}/></div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Chỉnh sửa Sản Phẩm</h3>
              </div>
              <button onClick={() => setEditingProduct(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition cursor-pointer"><X size={16} /></button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-bold text-slate-600">
              <div>
                <label className="block mb-1 text-blue-600">Mã Vạch / Barcode</label>
                <input 
                  type="text" 
                  value={editForm.product_code} 
                  onChange={e => setEditForm({...editForm, product_code: e.target.value})}
                  className="w-full px-4 py-2 border border-blue-200 rounded-xl bg-blue-50/30 outline-none focus:bg-white focus:border-blue-500 font-black text-slate-800 tracking-wider" 
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-700">Tên sản phẩm hiển thị</label>
                <textarea 
                  value={editForm.product_name} 
                  onChange={e => setEditForm({...editForm, product_name: e.target.value})}
                  rows="2"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white focus:border-blue-500 font-bold resize-none" 
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <button type="button" onClick={() => setEditingProduct(null)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition cursor-pointer">Hủy</button>
                <button type="submit" disabled={loading} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md cursor-pointer flex items-center gap-1">
                  {loading && <Loader2 size={12} className="animate-spin" />} Lưu cập nhật
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}