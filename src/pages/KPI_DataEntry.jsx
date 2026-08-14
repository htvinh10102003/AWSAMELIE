import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  CalendarDays, Target, CheckCircle2, AlertCircle, FileEdit, 
  Trash2, Plus, Loader2, FileWarning, Hash, BookOpen, UserX
} from 'lucide-react';

const DEPARTMENTS = ['Đóng hàng', 'Vận đơn', 'Lead kho'];

export default function KPI_DataEntry() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [activeTab, setActiveTab] = useState('errors');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [errorDict, setErrorDict] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [globalVars, setGlobalVars] = useState([]);

  const [errorLogs, setErrorLogs] = useState([]);
  const [variableValues, setVariableValues] = useState({});

  const [errorForm, setErrorForm] = useState({ error_id: '', staff_id: '', tracking_code: '', note: '' });

  useEffect(() => {
    fetchDictionary();
  }, [selectedDept]);

  useEffect(() => {
    fetchLogs();
  }, [selectedDept, selectedDate, activeTab]);

  const showMsg = (text, type = 'success') => { 
    setMessage({ text, type }); 
    setTimeout(() => setMessage({ text: '', type: '' }), 3000); 
  };

  const fetchDictionary = async () => {
    const [{ data: errs }, { data: staffs }, { data: vars }] = await Promise.all([
      // Lấy lỗi của bộ phận này HOẶC lỗi toàn kho
      supabase.from('kpi_errors').select('*').or(`department.eq.${selectedDept},apply_to.eq.warehouse`),
      supabase.from('warehouse_staff').select('*').eq('role', selectedDept),
      supabase.from('kpi_global_variables').select('*').in('source', ['daily_manual', 'monthly_manual'])
    ]);
    if (errs) setErrorDict(errs);
    if (staffs) setStaffList(staffs);
    if (vars) setGlobalVars(vars);
  };

  const fetchLogs = async () => {
    setLoading(true);
    if (activeTab === 'errors') {
      const { data } = await supabase
        .from('kpi_error_logs')
        .select('*, kpi_errors(name, apply_to), warehouse_staff(full_name)')
        .eq('department', selectedDept)
        .eq('error_date', selectedDate)
        .order('created_at', { ascending: false });
      if (data) setErrorLogs(data);
    } 
    else if (activeTab === 'variables') {
      const { data } = await supabase
        .from('kpi_variable_logs')
        .select('*')
        .eq('record_date', selectedDate);
      
      if (data) {
        const valMap = {};
        data.forEach(d => {
          valMap[d.variable_code] = d.value;
        });
        setVariableValues(valMap);
      } else {
        setVariableValues({});
      }
    }
    setLoading(false);
  };

  const selectedErrorDef = errorDict.find(e => e.id === errorForm.error_id);
  const isIndividualError = selectedErrorDef?.apply_to === 'individual';

  const handleLogError = async (e) => {
    e.preventDefault();
    if (!errorForm.error_id) return alert('Vui lòng chọn loại lỗi!');
    if (isIndividualError && !errorForm.staff_id) return alert('Lỗi này là lỗi cá nhân, vui lòng chọn tên nhân viên vi phạm!');
    
    setLoading(true);
    try {
      const { error } = await supabase.from('kpi_error_logs').insert([{
        department: selectedDept,
        error_date: selectedDate,
        error_id: errorForm.error_id,
        staff_id: isIndividualError ? errorForm.staff_id : null,
        tracking_code: errorForm.tracking_code,
        note: errorForm.note
      }]);
      if (error) throw error;
      
      showMsg('Ghi nhận vi phạm thành công!');
      setErrorForm({ error_id: '', staff_id: '', tracking_code: '', note: '' });
      fetchLogs();
    } catch (err) {
      showMsg(`Lỗi: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  const handleDeleteErrorLog = async (id) => {
    if(!confirm('Bạn có chắc muốn xóa bản ghi vi phạm này?')) return;
    await supabase.from('kpi_error_logs').delete().eq('id', id);
    fetchLogs();
  };

  const handleSaveVariables = async () => {
    setLoading(true);
    try {
      const upsertPayload = [];
      
      globalVars.forEach(v => {
        const val = variableValues[v.code];
        if (val !== undefined && val !== '') {
          upsertPayload.push({
            variable_code: v.code,
            record_date: selectedDate,
            value: Number(val)
          });
        }
      });

      if (upsertPayload.length > 0) {
        const { error } = await supabase.from('kpi_variable_logs').upsert(upsertPayload, {
          onConflict: 'variable_code, record_date'
        });
        if (error) throw error;
        showMsg('Đã lưu các số liệu thủ công thành công!');
      } else {
        showMsg('Không có dữ liệu mới để lưu.', 'error');
      }
    } catch (err) {
      showMsg(`Lỗi lưu biến: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 mt-4 p-4 animate-in fade-in duration-300">

      <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><FileEdit size={24} strokeWidth={2.5}/></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nhập liệu KPI Hàng ngày</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">Ghi nhận lỗi vi phạm cá nhân/tập thể và số liệu dùng chung</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 overflow-x-auto w-full md:w-auto shadow-inner">
          <button onClick={() => setActiveTab('errors')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'errors' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <AlertCircle size={16} /> Ghi sổ Lỗi
          </button>
          <button onClick={() => setActiveTab('variables')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'variables' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Hash size={16} /> Nhập số liệu Biến
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {activeTab === 'errors' ? (
            <>
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wider hidden sm:block">Bộ phận:</span>
              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                {DEPARTMENTS.map(dept => (
                  <button key={dept} onClick={() => setSelectedDept(dept)} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${selectedDept === dept ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {dept}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <span className="text-sm font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-200">
              💡 Biến số áp dụng chung cho toàn hệ thống
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto bg-slate-50 border border-slate-200 p-2 rounded-xl">
          <CalendarDays size={18} className="text-indigo-600 ml-2" />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer flex-1" />
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-sm animate-in slide-in-from-top-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18}/>} {message.text}
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
            <h3 className="font-black text-slate-800 uppercase text-sm mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Plus size={18} className="text-red-500"/> Kê khai vi phạm
            </h3>
            
            <form onSubmit={handleLogError} className="space-y-4 text-sm font-bold text-slate-700">
              <div>
                <label className="block mb-1.5 text-slate-500 uppercase text-xs">Loại lỗi vi phạm <span className="text-red-500">*</span></label>
                <select required value={errorForm.error_id} onChange={e=>{ setErrorForm({...errorForm, error_id: e.target.value, staff_id: ''}); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer focus:bg-white focus:ring-2 focus:ring-indigo-100 transition">
                  <option value="">-- Chọn lỗi --</option>
                  {errorDict.map(err => <option key={err.id} value={err.id}>{err.name} {err.apply_to === 'individual' ? '(Cá nhân)' : err.apply_to === 'warehouse' ? '(Toàn kho)' : '(Tập thể)'}</option>)}
                </select>
              </div>

              {isIndividualError && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block mb-1.5 text-amber-600 uppercase text-xs flex items-center gap-1"><UserX size={14}/> Nhân viên mắc lỗi <span className="text-red-500">*</span></label>
                  <select required value={errorForm.staff_id} onChange={e=>setErrorForm({...errorForm, staff_id: e.target.value})} className="w-full px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl outline-none cursor-pointer focus:bg-white transition shadow-sm">
                    <option value="">-- Chọn nhân viên vi phạm --</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block mb-1.5 text-slate-500 uppercase text-xs">Mã đơn hàng / Vận đơn (Nếu có)</label>
                <input value={errorForm.tracking_code} onChange={e=>setErrorForm({...errorForm, tracking_code: e.target.value})} placeholder="VD: SPXVN1234567..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 shadow-sm uppercase placeholder:normal-case" />
              </div>

              <div>
                <label className="block mb-1.5 text-slate-500 uppercase text-xs">Ghi chú / Link Bằng chứng</label>
                <textarea rows="3" value={errorForm.note} onChange={e=>setErrorForm({...errorForm, note: e.target.value})} placeholder="Nhập chi tiết hoặc dán link ảnh..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 shadow-sm font-medium"></textarea>
              </div>

              <button disabled={loading} className="w-full py-3.5 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />} GHI VÀO SỔ
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  Lịch sử vi phạm ngày <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm">{selectedDate.split('-').reverse().join('/')}</span>
                </h4>
                <span className="text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-full text-xs">Tổng: {errorLogs.length}</span>
              </div>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {loading && errorLogs.length === 0 ? (
                  <div className="py-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Đang tải dữ liệu...</div>
                ) : errorLogs.length === 0 ? (
                  <div className="py-10 text-center">
                    <FileWarning size={48} className="mx-auto text-emerald-300 mb-4" />
                    <p className="font-bold text-slate-500">Quá tuyệt! Không có vi phạm nào được ghi nhận trong ngày này.</p>
                  </div>
                ) : (
                  errorLogs.map(log => {
                    const isIndividual = log.kpi_errors?.apply_to === 'individual';
                    const isWarehouse = log.kpi_errors?.apply_to === 'warehouse';

                    return (
                      <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group hover:border-slate-300 transition">
                        <button onClick={() => handleDeleteErrorLog(log.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition"><Trash2 size={18}/></button>
                        <div className="pr-8">
                          <h5 className="font-bold text-slate-800 text-sm mb-1">
                            {log.kpi_errors?.name || 'Lỗi không xác định'}
                          </h5>
                          {isIndividual ? (
                            <p className="text-xs font-bold text-amber-700 bg-amber-100 inline-block px-2.5 py-0.5 rounded-md mb-2">👤 Cá nhân: {log.warehouse_staff?.full_name || 'Không xác định'}</p>
                          ) : isWarehouse ? (
                            <p className="text-xs font-bold text-purple-700 bg-purple-100 inline-block px-2.5 py-0.5 rounded-md mb-2">🏢 Lỗi toàn kho (Phạt tất cả)</p>
                          ) : (
                            <p className="text-xs font-bold text-blue-700 bg-blue-100 inline-block px-2.5 py-0.5 rounded-md mb-2">👥 Lỗi tập thể bộ phận</p>
                          )}
                          <br/>
                          {log.tracking_code && <p className="text-xs font-bold text-indigo-600 bg-white inline-block px-2 py-0.5 rounded border border-indigo-100 mb-1">Mã: {log.tracking_code}</p>}
                          {log.note && <p className="text-xs text-slate-500 font-medium italic mt-1">Ghi chú: {log.note}</p>}
                          <p className="text-[10px] text-slate-400 font-bold mt-3">Ghi nhận lúc: {new Date(log.created_at).toLocaleTimeString('vi-VN')}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'variables' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-3xl mx-auto">
          <div className="mb-6 pb-4 border-b border-slate-100">
             <h3 className="font-black text-slate-800 uppercase text-base flex items-center gap-2 mb-1">
               <FileEdit size={20} className="text-indigo-600"/> Nhập số liệu Thủ công
             </h3>
             <p className="text-sm text-slate-500 font-medium">Các biến số dưới đây áp dụng chung cho <b className="text-slate-700">TOÀN HỆ THỐNG</b>. Nhập 1 lần, các bộ phận có chèn biến này sẽ tự động lấy dữ liệu.</p>
          </div>

          {loading ? (
             <div className="py-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Đang tải dữ liệu...</div>
          ) : globalVars.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-2xl border border-slate-100">
               <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
               <p className="font-bold text-slate-600 text-lg">Không có biến thủ công nào!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {globalVars.map(v => (
                <div key={v.code} className="flex items-center justify-between gap-4 bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{v.name}</p>
                    <p className="text-[10px] font-mono font-bold text-slate-400 mt-1 uppercase">Mã biến: {v.code} | Chu kỳ: {v.source === 'daily_manual' ? 'Hàng ngày' : 'Cuối tháng'}</p>
                  </div>
                  <input 
                    type="number" 
                    value={variableValues[v.code] !== undefined ? variableValues[v.code] : ''} 
                    onChange={e => setVariableValues({...variableValues, [v.code]: e.target.value})}
                    placeholder="0" 
                    className="w-32 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-lg font-black text-indigo-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 text-center shadow-inner transition" 
                  />
                </div>
              ))}

              <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                <button onClick={handleSaveVariables} disabled={loading} className="px-8 py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-50">
                   LƯU TẤT CẢ SỐ LIỆU NÀY
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  CalendarDays, Target, CheckCircle2, AlertCircle, FileEdit, 
  Trash2, Plus, Loader2, FileWarning, Hash, BookOpen, UserX, Save
} from 'lucide-react';

const DEPARTMENTS = ['Đóng hàng', 'Vận đơn', 'Lead kho'];

export default function KPI_DataEntry() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [activeTab, setActiveTab] = useState('errors');

  const [loading, setLoading] = useState(false);
  const [savingVar, setSavingVar] = useState(null); // Trạng thái loading riêng cho từng nút lưu biến
  const [message, setMessage] = useState({ text: '', type: '' });

  const [errorDict, setErrorDict] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [globalVars, setGlobalVars] = useState([]);

  const [errorLogs, setErrorLogs] = useState([]);
  const [variableValues, setVariableValues] = useState({});

  const [errorForm, setErrorForm] = useState({ error_id: '', staff_id: '', tracking_code: '', note: '' });

  useEffect(() => {
    fetchDictionary();
  }, [selectedDept]);

  useEffect(() => {
    fetchLogs();
  }, [selectedDept, selectedDate, activeTab]);

  const showMsg = (text, type = 'success') => { 
    setMessage({ text, type }); 
    setTimeout(() => setMessage({ text: '', type: '' }), 3000); 
  };

  const fetchDictionary = async () => {
    const [{ data: errs }, { data: staffs }, { data: vars }] = await Promise.all([
      supabase.from('kpi_errors').select('*').or(`department.eq.${selectedDept},apply_to.eq.warehouse`),
      supabase.from('warehouse_staff').select('*').eq('role', selectedDept),
      supabase.from('kpi_global_variables').select('*').in('source', ['daily_manual', 'monthly_manual'])
    ]);
    if (errs) setErrorDict(errs);
    if (staffs) setStaffList(staffs);
    if (vars) setGlobalVars(vars);
  };

  const fetchLogs = async () => {
    setLoading(true);
    if (activeTab === 'errors') {
      const { data } = await supabase
        .from('kpi_error_logs')
        .select('*, kpi_errors(name, apply_to), warehouse_staff(full_name)')
        .eq('department', selectedDept)
        .eq('error_date', selectedDate)
        .order('created_at', { ascending: false });
      if (data) setErrorLogs(data);
    } 
    else if (activeTab === 'variables') {
      const { data } = await supabase
        .from('kpi_variable_logs')
        .select('*')
        .eq('record_date', selectedDate);
      
      if (data) {
        const valMap = {};
        data.forEach(d => {
          valMap[d.variable_code] = d.value;
        });
        setVariableValues(valMap);
      } else {
        setVariableValues({});
      }
    }
    setLoading(false);
  };

  const selectedErrorDef = errorDict.find(e => e.id === errorForm.error_id);
  const isIndividualError = selectedErrorDef?.apply_to === 'individual';

  const handleLogError = async (e) => {
    e.preventDefault();
    if (!errorForm.error_id) return alert('Vui lòng chọn loại lỗi!');
    if (isIndividualError && !errorForm.staff_id) return alert('Lỗi này là lỗi cá nhân, vui lòng chọn tên nhân viên vi phạm!');
    
    setLoading(true);
    try {
      const { error } = await supabase.from('kpi_error_logs').insert([{
        department: selectedDept,
        error_date: selectedDate,
        error_id: errorForm.error_id,
        staff_id: isIndividualError ? errorForm.staff_id : null,
        tracking_code: errorForm.tracking_code,
        note: errorForm.note
      }]);
      if (error) throw error;
      
      showMsg('Ghi nhận vi phạm thành công!');
      setErrorForm({ error_id: '', staff_id: '', tracking_code: '', note: '' });
      fetchLogs();
    } catch (err) {
      showMsg(`Lỗi: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  const handleDeleteErrorLog = async (id) => {
    if(!confirm('Bạn có chắc muốn xóa bản ghi vi phạm này?')) return;
    await supabase.from('kpi_error_logs').delete().eq('id', id);
    fetchLogs();
  };

  // LƯU RIÊNG LẺ TỪNG BIẾN
  const handleSaveSingleVariable = async (variableCode) => {
    const val = variableValues[variableCode];
    if (val === undefined || val === '') {
      return showMsg(`Vui lòng nhập số liệu cho biến [${variableCode}] trước khi lưu!`, 'error');
    }

    setSavingVar(variableCode);
    try {
      const { error } = await supabase.from('kpi_variable_logs').upsert({
        variable_code: variableCode,
        record_date: selectedDate,
        value: Number(val)
      }, {
        onConflict: 'variable_code, record_date'
      });

      if (error) throw error;
      showMsg(`Đã lưu số liệu cho biến [${variableCode}] thành công!`);
    } catch (err) {
      showMsg(`Lỗi lưu biến: ${err.message}`, 'error');
    }
    setSavingVar(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 mt-4 p-4 animate-in fade-in duration-300">

      <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><FileEdit size={24} strokeWidth={2.5}/></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nhập liệu KPI Hàng ngày</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">Ghi nhận lỗi vi phạm cá nhân/tập thể và số liệu dùng chung</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 overflow-x-auto w-full md:w-auto shadow-inner">
          <button onClick={() => setActiveTab('errors')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'errors' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <AlertCircle size={16} /> Ghi sổ Lỗi
          </button>
          <button onClick={() => setActiveTab('variables')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'variables' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Hash size={16} /> Nhập số liệu Biến
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {activeTab === 'errors' ? (
            <>
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wider hidden sm:block">Bộ phận:</span>
              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                {DEPARTMENTS.map(dept => (
                  <button key={dept} onClick={() => setSelectedDept(dept)} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${selectedDept === dept ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {dept}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <span className="text-sm font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-200">
              💡 Biến số áp dụng chung cho toàn hệ thống
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto bg-slate-50 border border-slate-200 p-2 rounded-xl">
          <CalendarDays size={18} className="text-indigo-600 ml-2" />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer flex-1" />
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-sm animate-in slide-in-from-top-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18}/>} {message.text}
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
            <h3 className="font-black text-slate-800 uppercase text-sm mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Plus size={18} className="text-red-500"/> Kê khai vi phạm
            </h3>
            
            <form onSubmit={handleLogError} className="space-y-4 text-sm font-bold text-slate-700">
              <div>
                <label className="block mb-1.5 text-slate-500 uppercase text-xs">Loại lỗi vi phạm <span className="text-red-500">*</span></label>
                <select required value={errorForm.error_id} onChange={e=>{ setErrorForm({...errorForm, error_id: e.target.value, staff_id: ''}); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer focus:bg-white focus:ring-2 focus:ring-indigo-100 transition">
                  <option value="">-- Chọn lỗi --</option>
                  {errorDict.map(err => <option key={err.id} value={err.id}>{err.name} {err.apply_to === 'individual' ? '(Cá nhân)' : err.apply_to === 'warehouse' ? '(Toàn kho)' : '(Tập thể)'}</option>)}
                </select>
              </div>

              {isIndividualError && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block mb-1.5 text-amber-600 uppercase text-xs flex items-center gap-1"><UserX size={14}/> Nhân viên mắc lỗi <span className="text-red-500">*</span></label>
                  <select required value={errorForm.staff_id} onChange={e=>setErrorForm({...errorForm, staff_id: e.target.value})} className="w-full px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl outline-none cursor-pointer focus:bg-white transition shadow-sm">
                    <option value="">-- Chọn nhân viên vi phạm --</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block mb-1.5 text-slate-500 uppercase text-xs">Mã đơn hàng / Vận đơn (Nếu có)</label>
                <input value={errorForm.tracking_code} onChange={e=>setErrorForm({...errorForm, tracking_code: e.target.value})} placeholder="VD: SPXVN1234567..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 shadow-sm uppercase placeholder:normal-case" />
              </div>

              <div>
                <label className="block mb-1.5 text-slate-500 uppercase text-xs">Ghi chú / Link Bằng chứng</label>
                <textarea rows="3" value={errorForm.note} onChange={e=>setErrorForm({...errorForm, note: e.target.value})} placeholder="Nhập chi tiết hoặc dán link ảnh..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 shadow-sm font-medium"></textarea>
              </div>

              <button disabled={loading} className="w-full py-3.5 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />} GHI VÀO SỔ
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  Lịch sử vi phạm ngày <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm">{selectedDate.split('-').reverse().join('/')}</span>
                </h4>
                <span className="text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-full text-xs">Tổng: {errorLogs.length}</span>
              </div>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {loading && errorLogs.length === 0 ? (
                  <div className="py-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Đang tải dữ liệu...</div>
                ) : errorLogs.length === 0 ? (
                  <div className="py-10 text-center">
                    <FileWarning size={48} className="mx-auto text-emerald-300 mb-4" />
                    <p className="font-bold text-slate-500">Quá tuyệt! Không có vi phạm nào được ghi nhận trong ngày này.</p>
                  </div>
                ) : (
                  errorLogs.map(log => {
                    const isIndividual = log.kpi_errors?.apply_to === 'individual';
                    const isWarehouse = log.kpi_errors?.apply_to === 'warehouse';

                    return (
                      <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group hover:border-slate-300 transition">
                        <button onClick={() => handleDeleteErrorLog(log.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition"><Trash2 size={18}/></button>
                        <div className="pr-8">
                          <h5 className="font-bold text-slate-800 text-sm mb-1">
                            {log.kpi_errors?.name || 'Lỗi không xác định'}
                          </h5>
                          {isIndividual ? (
                            <p className="text-xs font-bold text-amber-700 bg-amber-100 inline-block px-2.5 py-0.5 rounded-md mb-2">👤 Cá nhân: {log.warehouse_staff?.full_name || 'Không xác định'}</p>
                          ) : isWarehouse ? (
                            <p className="text-xs font-bold text-purple-700 bg-purple-100 inline-block px-2.5 py-0.5 rounded-md mb-2">🏢 Lỗi toàn kho (Phạt tất cả)</p>
                          ) : (
                            <p className="text-xs font-bold text-blue-700 bg-blue-100 inline-block px-2.5 py-0.5 rounded-md mb-2">👥 Lỗi tập thể bộ phận</p>
                          )}
                          <br/>
                          {log.tracking_code && <p className="text-xs font-bold text-indigo-600 bg-white inline-block px-2 py-0.5 rounded border border-indigo-100 mb-1">Mã: {log.tracking_code}</p>}
                          {log.note && <p className="text-xs text-slate-500 font-medium italic mt-1">Ghi chú: {log.note}</p>}
                          <p className="text-[10px] text-slate-400 font-bold mt-3">Ghi nhận lúc: {new Date(log.created_at).toLocaleTimeString('vi-VN')}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'variables' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-4xl mx-auto">
          <div className="mb-6 pb-4 border-b border-slate-100">
             <h3 className="font-black text-slate-800 uppercase text-base flex items-center gap-2 mb-1">
               <FileEdit size={20} className="text-indigo-600"/> Nhập số liệu Thủ công
             </h3>
             <p className="text-sm text-slate-500 font-medium">Các biến số dưới đây áp dụng chung cho <b className="text-slate-700">TOÀN HỆ THỐNG</b>. Các biến được lưu riêng rẽ theo từng dòng để tiện quản lý.</p>
          </div>

          {loading ? (
             <div className="py-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Đang tải dữ liệu...</div>
          ) : globalVars.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-2xl border border-slate-100">
               <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
               <p className="font-bold text-slate-600 text-lg">Không có biến thủ công nào!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {globalVars.map(v => (
                <div key={v.code} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{v.name}</p>
                    <p className="text-[10px] font-mono font-bold text-slate-400 mt-1 uppercase">Mã: {v.code} | Chu kỳ: {v.source === 'daily_manual' ? 'Hàng ngày' : 'Cuối tháng'}</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input 
                      type="number" 
                      value={variableValues[v.code] !== undefined ? variableValues[v.code] : ''} 
                      onChange={e => setVariableValues({...variableValues, [v.code]: e.target.value})}
                      placeholder="0" 
                      className="w-full sm:w-32 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-lg font-black text-indigo-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 text-center shadow-inner transition" 
                    />
                    <button 
                      onClick={() => handleSaveSingleVariable(v.code)} 
                      disabled={savingVar === v.code} 
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center shrink-0"
                      title="Lưu số liệu này"
                    >
                      {savingVar === v.code ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}