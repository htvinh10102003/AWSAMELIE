import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Target, Settings2, FilePlus, Plus, Trash2, Save, Loader2, CheckCircle2 } from 'lucide-react';

const DEPARTMENTS = ['Đóng hàng', 'Vận đơn', 'Lead kho'];

export default function KPI_Management() {
  const [activeTab, setActiveTab] = useState('config_error'); // config_error, config_kpi, log_error
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Dữ liệu chung
  const [errorsDb, setErrorsDb] = useState([]);
  const [kpisDb, setKpisDb] = useState([]);

  // Form State
  const [errorForm, setErrorForm] = useState({ department: 'Đóng hàng', error_name: '', severity: 'normal' });
  const [kpiForm, setKpiForm] = useState({ department: 'Đóng hàng', kpi_name: '', kpi_type: 'ratio', formula: '', target_green: 1, target_yellow: 3, target_red: 5 });
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().split('T')[0], tracking_code: '', department: 'Đóng hàng', error_id: '', note: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: errs }, { data: kpis }] = await Promise.all([
      supabase.from('error_categories').select('*').order('id', { ascending: false }),
      supabase.from('kpi_configs').select('*').order('id', { ascending: false })
    ]);
    if (errs) setErrorsDb(errs);
    if (kpis) setKpisDb(kpis);
  };

  const showMsg = (text) => { setMessage(text); setTimeout(() => setMessage(''), 3000); };

  // --- ACTIONS CHO LỖI (ERRORS) ---
  const handleAddError = async (e) => {
    e.preventDefault();
    setLoading(true);
    await supabase.from('error_categories').insert([errorForm]);
    await fetchData();
    setErrorForm({ ...errorForm, error_name: '' });
    setLoading(false);
    showMsg('✅ Thêm lỗi mới thành công!');
  };
  const handleDeleteError = async (id) => {
    if(!confirm('Xóa lỗi này sẽ xóa luôn lịch sử vi phạm liên quan. Tiếp tục?')) return;
    await supabase.from('error_categories').delete().eq('id', id);
    fetchData();
  };

  // --- ACTIONS CHO KPI (CÔNG THỨC) ---
  const handleInsertVariable = (variable) => {
    setKpiForm({ ...kpiForm, formula: kpiForm.formula + variable });
  };
  const handleAddKpi = async (e) => {
    e.preventDefault();
    setLoading(true);
    await supabase.from('kpi_configs').insert([kpiForm]);
    await fetchData();
    setKpiForm({ ...kpiForm, kpi_name: '', formula: '' });
    setLoading(false);
    showMsg('✅ Đã lưu cấu hình KPI mới!');
  };
  const handleDeleteKpi = async (id) => {
    if(!confirm('Chắc chắn xóa cấu hình KPI này?')) return;
    await supabase.from('kpi_configs').delete().eq('id', id);
    fetchData();
  };

  // --- ACTIONS CHO GHI SỔ LỖI (LOGS) ---
  const handleLogAction = async (e) => {
    e.preventDefault();
    if(!logForm.error_id) return alert('Vui lòng chọn loại lỗi!');
    setLoading(true);
    const { error } = await supabase.from('order_errors').insert([logForm]);
    setLoading(false);
    if(error) showMsg('❌ Lỗi lưu dữ liệu!');
    else {
      showMsg('✅ Kê khai lỗi thành công!');
      setLogForm({ ...logForm, tracking_code: '', note: '' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 mt-4 p-4 animate-in fade-in">

      {/* HEADER & TABS */}
      <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Target size={24} /></div>
          <div><h2 className="text-xl font-black text-slate-800 uppercase">Quản trị KPI & Lỗi</h2></div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 overflow-x-auto w-full md:w-auto">
                  <button onClick={() => setActiveTab('log_error')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'log_error' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
            <FilePlus size={16} /> Kê khai
          </button>
          <button onClick={() => setActiveTab('config_error')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'config_error' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
            <Settings2 size={16} /> DS Lỗi
          </button>
          <button onClick={() => setActiveTab('config_kpi')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'config_kpi' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
            <Settings2 size={16} /> Luật KPI
          </button>
        </div>
      </div>

      {message && <div className="p-3 bg-green-50 text-green-700 font-bold border border-green-200 rounded-xl flex items-center gap-2"><CheckCircle2 size={18}/> {message}</div>}
{/* --- TAB 3: KÊ KHAI LỖI --- */}
      {activeTab === 'log_error' && (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
          <form onSubmit={handleLogAction} className="space-y-5 text-sm font-medium">
             <div className="grid grid-cols-2 gap-4">
                <div><label>Ngày xảy ra</label><input type="date" value={logForm.date} onChange={e=>setLogForm({...logForm, date: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border rounded-xl" /></div>
                <div><label>Bộ phận vi phạm</label><select value={logForm.department} onChange={e=>{setLogForm({...logForm, department: e.target.value, error_id: ''})}} className="w-full mt-1 p-3 bg-slate-50 border rounded-xl"><option>Đóng hàng</option><option>Vận đơn</option><option>Lead kho</option></select></div>
             </div>
             <div><label>Mã vận đơn (Chính xác)</label><input required placeholder="SPX..." value={logForm.tracking_code} onChange={e=>setLogForm({...logForm, tracking_code: e.target.value})} className="w-full mt-1 p-3 bg-white border-2 border-indigo-100 rounded-xl font-bold uppercase" /></div>
             <div>
               <label>Chọn lỗi vi phạm</label>
               <select required value={logForm.error_id} onChange={e=>setLogForm({...logForm, error_id: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border rounded-xl cursor-pointer">
                 <option value="">-- Click để chọn --</option>
                 {errorsDb.filter(e => e.department === logForm.department).map(err => (
                   <option key={err.id} value={err.id}>{err.error_name}</option>
                 ))}
               </select>
             </div>
             <div><label>Ghi chú / Bằng chứng</label><textarea rows="2" value={logForm.note} onChange={e=>setLogForm({...logForm, note: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border rounded-xl"></textarea></div>
             <button disabled={loading} className="w-full bg-slate-900 text-white font-black p-4 rounded-xl shadow-lg hover:bg-black">GHI NHẬN VÀO SỔ</button>
          </form>
        </div>
      )}
      {/* --- TAB 1: DANH MỤC LỖI ĐỘNG --- */}
      {activeTab === 'config_error' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold border-b pb-3 mb-4 flex items-center gap-2"><Plus size={18}/> Tạo loại lỗi mới</h3>
            <form onSubmit={handleAddError} className="space-y-4 text-sm font-medium">
              <div><label>Bộ phận</label><select value={errorForm.department} onChange={e => setErrorForm({...errorForm, department: e.target.value})} className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl"><option>Đóng hàng</option><option>Vận đơn</option><option>Lead kho</option></select></div>
              <div><label>Tên lỗi (Vd: Quên dán tem)</label><input required value={errorForm.error_name} onChange={e => setErrorForm({...errorForm, error_name: e.target.value})} className="w-full mt-1 p-2.5 bg-white border rounded-xl" /></div>
              <div><label>Mức độ</label><select value={errorForm.severity} onChange={e => setErrorForm({...errorForm, severity: e.target.value})} className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl"><option value="minor">Nhẹ</option><option value="normal">Thường</option><option value="major">Nghiêm trọng</option></select></div>
              <button disabled={loading} className="w-full bg-indigo-600 text-white font-bold p-3 rounded-xl hover:bg-indigo-700">Thêm lỗi</button>
            </form>
          </div>
          <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold border-b pb-3 mb-4">Danh sách lỗi hệ thống</h3>
            <div className="overflow-y-auto max-h-96 space-y-2">
              {errorsDb.map(err => (
                <div key={err.id} className="flex justify-between p-3 bg-slate-50 rounded-xl border">
                  <div>
                    <span className="text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded-full mr-2">{err.department}</span>
                    <span className="font-bold text-sm text-slate-800">{err.error_name}</span>
                  </div>
                  <button onClick={() => handleDeleteError(err.id)} className="text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: CÔNG THỨC KPI --- */}
      {activeTab === 'config_kpi' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <h3 className="font-bold border-b pb-3 mb-4 flex items-center gap-2"><Plus size={18}/> Soạn thảo công thức KPI</h3>
             <form onSubmit={handleAddKpi} className="space-y-4 text-sm font-medium">
                <div className="grid grid-cols-2 gap-4">
                  <div><label>Bộ phận</label><select value={kpiForm.department} onChange={e => setKpiForm({...kpiForm, department: e.target.value})} className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl"><option>Đóng hàng</option><option>Vận đơn</option><option>Lead kho</option></select></div>
                  <div><label>Loại báo cáo</label><select value={kpiForm.kpi_type} onChange={e => setKpiForm({...kpiForm, kpi_type: e.target.value})} className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl"><option value="ratio">Tỉ lệ (%)</option><option value="count">Số đếm</option></select></div>
                </div>
                <div><label>Tên KPI (Vd: Tỉ lệ đóng sai)</label><input required value={kpiForm.kpi_name} onChange={e => setKpiForm({...kpiForm, kpi_name: e.target.value})} className="w-full mt-1 p-2.5 bg-white border rounded-xl" /></div>
                
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <label className="text-indigo-800 font-bold mb-2 block text-xs">Chèn biến số tự động:</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button type="button" onClick={() => handleInsertVariable('[TONG_IN]')} className="text-[10px] bg-white border border-indigo-200 px-2 py-1 rounded shadow-sm font-bold text-indigo-600">+ TỔNG IN</button>
                    <button type="button" onClick={() => handleInsertVariable('[TONG_DI]')} className="text-[10px] bg-white border border-indigo-200 px-2 py-1 rounded shadow-sm font-bold text-indigo-600">+ TỔNG ĐI</button>
                    <button type="button" onClick={() => handleInsertVariable('[TONG_DONG]')} className="text-[10px] bg-white border border-indigo-200 px-2 py-1 rounded shadow-sm font-bold text-indigo-600">+ TỔNG ĐÓNG GÓI</button>
                  </div>
                  <label className="text-indigo-800 font-bold mb-2 block text-xs">Chèn biến lỗi cụ thể:</label>
                  <div className="flex flex-wrap gap-2 mb-3 max-h-24 overflow-y-auto">
                     {errorsDb.filter(e => e.department === kpiForm.department).map(err => (
                        <button key={err.id} type="button" onClick={() => handleInsertVariable(`[LOI_ID_${err.id}]`)} className="text-[10px] bg-red-50 border border-red-200 px-2 py-1 rounded shadow-sm font-bold text-red-600">+ {err.error_name}</button>
                     ))}
                  </div>
                  <label>Công thức tính toán (Dùng phép toán + - * /)</label>
                  <textarea required value={kpiForm.formula} onChange={e => setKpiForm({...kpiForm, formula: e.target.value})} rows="3" placeholder="Ví dụ: ([LOI_ID_1] / [TONG_DI]) * 100" className="w-full mt-1 p-2.5 bg-white border rounded-xl font-mono text-indigo-900 font-bold outline-none"></textarea>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border">
                  <div><label className="text-[10px] font-bold text-emerald-600">Mức Xanh &lt;=</label><input type="number" step="0.1" value={kpiForm.target_green} onChange={e=>setKpiForm({...kpiForm, target_green: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" /></div>
                  <div><label className="text-[10px] font-bold text-amber-600">Mức Vàng &lt;=</label><input type="number" step="0.1" value={kpiForm.target_yellow} onChange={e=>setKpiForm({...kpiForm, target_yellow: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" /></div>
                  <div><label className="text-[10px] font-bold text-red-600">Mức Đỏ &gt;</label><input type="number" step="0.1" value={kpiForm.target_red} onChange={e=>setKpiForm({...kpiForm, target_red: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" /></div>
                </div>

                <button disabled={loading} className="w-full bg-indigo-600 text-white font-bold p-3 rounded-xl hover:bg-indigo-700">Lưu Công Thức</button>
             </form>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <h3 className="font-bold border-b pb-3 mb-4">Danh sách Luật KPI</h3>
             <div className="space-y-3 overflow-y-auto max-h-[600px]">
               {kpisDb.map(kpi => (
                 <div key={kpi.id} className="p-4 bg-slate-50 border rounded-2xl relative group">
                    <button onClick={() => handleDeleteKpi(kpi.id)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    <span className="text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded-full mb-2 inline-block">{kpi.department}</span>
                    <h4 className="font-black text-sm text-slate-800">{kpi.kpi_name} ({kpi.kpi_type === 'ratio' ? '%' : 'SL'})</h4>
                    <div className="text-[11px] font-mono text-indigo-600 bg-indigo-50 p-2 mt-2 rounded border border-indigo-100">{kpi.formula}</div>
                    <div className="flex gap-2 mt-2 text-[10px] font-bold">
                      <span className="text-emerald-600">Xanh: &lt;= {kpi.target_green}</span>
                      <span className="text-amber-600">Vàng: &lt;= {kpi.target_yellow}</span>
                      <span className="text-red-600">Đỏ: &gt; {kpi.target_red}</span>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}