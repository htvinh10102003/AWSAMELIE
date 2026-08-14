import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Target, Plus, Trash2, Save, Loader2, CheckCircle2, 
  Edit, ChevronLeft, Calculator, AlertTriangle, FileWarning,
  Users, Variable, UserPlus, FileDigit
} from 'lucide-react';

const DEPARTMENTS = ['Đóng hàng', 'Vận đơn', 'Lead kho'];

const VAR_SOURCES = [
  { id: 'daily_manual', name: 'Nhập tay hàng ngày' },
  { id: 'monthly_manual', name: 'Nhập tay cuối tháng' },
  { id: 'auto_packed_day', name: 'Auto: Đơn đã đóng / Ngày' },
  { id: 'auto_printed_day', name: 'Auto: Đơn đã in / Ngày' },
  { id: 'auto_shipped_day', name: 'Auto: Đơn đã đi / Ngày' },
  { id: 'fixed', name: 'Giá trị cố định (Hằng số)' }
];

const RULE_TYPES = [
  { id: 'no_penalty', name: 'Không phạt (Ngưỡng an toàn)' },
  { id: 'fixed_penalty', name: 'Phạt điểm cố định (Khoảng)' },
  { id: 'linear_penalty', name: 'Phạt tuyến tính (Vượt ngưỡng)' },
  { id: 'per_error', name: 'Phạt điểm trên MỖI lỗi' }
];

export default function KPI_Management() {
  const [activeTab, setActiveTab] = useState('criteria'); // criteria, errors, variables, staff
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);

  // Data States
  const [criteriaList, setCriteriaList] = useState([]);
  const [errorList, setErrorList] = useState([]);
  const [globalVars, setGlobalVars] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // Form States
  const [editingCriteria, setEditingCriteria] = useState(null);
  const [errorForm, setErrorForm] = useState({ name: '', apply_to: 'individual' });
  const [varForm, setVarForm] = useState({ code: '', name: '', source: 'daily_manual', fixed_value: 0 });
  const [staffForm, setStaffForm] = useState({ full_name: '', role: DEPARTMENTS[0] });

  useEffect(() => {
    fetchData();
  }, [selectedDept, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    const [ 
      { data: crits }, { data: errs }, { data: vars }, { data: staffs }
    ] = await Promise.all([
      supabase.from('kpi_criteria').select('*').eq('department', selectedDept).order('created_at', { ascending: true }),
      supabase.from('kpi_errors').select('*').eq('department', selectedDept).order('created_at', { ascending: false }),
      supabase.from('kpi_global_variables').select('*').order('created_at', { ascending: true }),
      supabase.from('warehouse_staff').select('*').order('role', { ascending: true })
    ]);
    
    if (crits) setCriteriaList(crits);
    if (errs) setErrorList(errs);
    if (vars) setGlobalVars(vars);
    if (staffs) setStaffList(staffs);
    setLoading(false);
  };

  const showMsg = (text) => { setMessage(text); setTimeout(() => setMessage(''), 3000); };

  // ==========================================
  // TAB 1: LOGIC CHỈ TIÊU
  // ==========================================
  const totalWeight = criteriaList.reduce((sum, item) => sum + Number(item.weight), 0);

  const handleCreateNewCriteria = () => setEditingCriteria({ department: selectedDept, name: '', weight: 0, calc_type: 'count', formula: '', scoring_rules: [] });

  const handleSaveCriteria = async () => {
    if (!editingCriteria.name) return alert('Tên chỉ tiêu không được để trống!');
    setLoading(true);
    try {
      if (editingCriteria.id) await supabase.from('kpi_criteria').update(editingCriteria).eq('id', editingCriteria.id);
      else await supabase.from('kpi_criteria').insert([editingCriteria]);
      
      showMsg('✅ Đã lưu cấu hình Chỉ tiêu!');
      setEditingCriteria(null);
      fetchData();
    } catch (err) { alert(err.message); }
    setLoading(false);
  };

  const handleDeleteCriteria = async (id) => {
    if(!confirm('🚨 Xóa chỉ tiêu này?')) return;
    await supabase.from('kpi_criteria').delete().eq('id', id);
    fetchData();
  };

  const addRule = () => setEditingCriteria(prev => ({ ...prev, scoring_rules: [...prev.scoring_rules, { id: Date.now().toString(), type: 'no_penalty', min: 0, max: 0, penalty: 0, step: 0 }] }));
  const updateRule = (id, field, val) => setEditingCriteria(prev => ({ ...prev, scoring_rules: prev.scoring_rules.map(r => r.id === id ? { ...r, [field]: val } : r) }));
  const removeRule = (id) => setEditingCriteria(prev => ({ ...prev, scoring_rules: prev.scoring_rules.filter(r => r.id !== id) }));
  const insertToFormula = (str) => setEditingCriteria(prev => ({ ...prev, formula: prev.formula + str }));

  // ==========================================
  // TAB 2: LOGIC TỪ ĐIỂN LỖI
  // ==========================================
  const handleAddError = async (e) => {
    e.preventDefault();
    if (!errorForm.name.trim()) return;
    setLoading(true);
    await supabase.from('kpi_errors').insert([{ department: selectedDept, name: errorForm.name, apply_to: errorForm.apply_to }]);
    setErrorForm({ name: '', apply_to: 'individual' });
    fetchData();
    showMsg('✅ Thêm Lỗi thành công!');
  };

  const handleDeleteError = async (id) => {
    if(!confirm('🚨 Bạn có chắc muốn xóa lỗi này?')) return;
    await supabase.from('kpi_errors').delete().eq('id', id);
    fetchData();
  };

  // ==========================================
  // TAB 3: LOGIC BIẾN SỐ CHUNG
  // ==========================================
  const handleAddVariable = async (e) => {
    e.preventDefault();
    if (!varForm.code.trim() || !varForm.name.trim()) return;
    setLoading(true);
    
    // Auto format code
    const cleanCode = varForm.code.toUpperCase().replace(/\s+/g, '_');
    try {
      await supabase.from('kpi_global_variables').insert([{ ...varForm, code: cleanCode }]);
      setVarForm({ code: '', name: '', source: 'daily_manual', fixed_value: 0 });
      fetchData();
      showMsg('✅ Đã khởi tạo Biến số chung!');
    } catch(err) {
      alert("Lỗi: Có thể mã biến này đã tồn tại!");
    }
    setLoading(false);
  };

  const handleDeleteVariable = async (id) => {
    if(!confirm('🚨 Xóa biến này sẽ xóa luôn dữ liệu nhập liệu cũ của nó. Chắc chắn xóa?')) return;
    await supabase.from('kpi_global_variables').delete().eq('id', id);
    fetchData();
  };

  // ==========================================
  // TAB 4: LOGIC NHÂN SỰ
  // ==========================================
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.full_name.trim()) return;
    setLoading(true);
    await supabase.from('warehouse_staff').insert([staffForm]);
    setStaffForm({ ...staffForm, full_name: '' });
    fetchData();
    showMsg('✅ Thêm nhân sự thành công!');
  };

  const handleDeleteStaff = async (id) => {
    if(!confirm('🚨 Xóa nhân sự này? Các log lỗi của họ sẽ bị ảnh hưởng.')) return;
    await supabase.from('warehouse_staff').delete().eq('id', id);
    fetchData();
  };


  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 mt-4 p-4 animate-in fade-in duration-300">

      {/* HEADER & TABS */}
      <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Target size={24} strokeWidth={2.5}/></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Cấu trúc KPI & Lỗi</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">Hệ thống Biến số, Chỉ tiêu và Nhân sự</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 overflow-x-auto w-full md:w-auto shadow-inner">
          <button onClick={() => {setActiveTab('criteria'); setEditingCriteria(null);}} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'criteria' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Calculator size={16} /> Chỉ tiêu
          </button>
          <button onClick={() => {setActiveTab('errors'); setEditingCriteria(null);}} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'errors' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <FileWarning size={16} /> Từ điển Lỗi
          </button>
          <button onClick={() => {setActiveTab('variables'); setEditingCriteria(null);}} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'variables' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Variable size={16} /> Biến số chung
          </button>
          <button onClick={() => {setActiveTab('staff'); setEditingCriteria(null);}} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Users size={16} /> Nhân sự
          </button>
        </div>
      </div>

      {/* CHỌN BỘ PHẬN GLOBAL (Chỉ hiện ở Tab Chỉ tiêu và Lỗi) */}
      {!editingCriteria && ['criteria', 'errors'].includes(activeTab) && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Đang thao tác bộ phận:</span>
            <div className="flex gap-2">
              {DEPARTMENTS.map(dept => (
                <button key={dept} onClick={() => setSelectedDept(dept)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedDept === dept ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {dept}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {message && <div className="p-4 bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 rounded-2xl flex items-center gap-2 shadow-sm"><CheckCircle2 size={18}/> {message}</div>}

      {/* ========================================================================= */}
      {/* TAB 1: CHỈ TIÊU & BUILDER                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'criteria' && (
        <>
          {!editingCriteria ? (
            <div className="space-y-6 animate-in fade-in">
              <div className={`p-6 rounded-3xl border shadow-sm flex items-center justify-between ${totalWeight === 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${totalWeight === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    Tổng tỉ trọng KPI ({selectedDept})
                  </h3>
                  <p className="text-xs font-medium text-slate-600 mt-1">Tổng các chỉ tiêu bắt buộc phải đạt 100%.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-black tracking-tight" style={{color: totalWeight === 100 ? '#059669' : '#d97706'}}>{totalWeight}%</div>
                  {totalWeight !== 100 && <AlertTriangle size={24} className="text-amber-500 animate-pulse" />}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <h3 className="font-bold text-slate-800 text-lg">Phân bổ Chỉ tiêu</h3>
                  <button onClick={handleCreateNewCriteria} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition">
                    <Plus size={16} /> Thêm Chỉ tiêu
                  </button>
                </div>

                <div className="space-y-4">
                  {criteriaList.map(crit => (
                    <div key={crit.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-slate-50 border border-slate-200 rounded-2xl gap-4 hover:border-blue-300 transition">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 font-black rounded-lg text-xs">{crit.weight}%</span>
                          <h4 className="font-bold text-slate-800 text-base">{crit.name}</h4>
                        </div>
                        <p className="text-xs font-mono text-slate-500 bg-white p-2 rounded-lg border border-slate-100 mt-2 inline-block">
                          Công thức: {crit.formula || '(Luật trực tiếp từ số lượng vi phạm)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button onClick={() => setEditingCriteria(crit)} className="px-4 py-2 bg-white border border-slate-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 shadow-sm flex items-center gap-2">
                          <Edit size={14} /> Sửa
                        </button>
                        <button onClick={() => handleDeleteCriteria(crit.id)} className="px-3 py-2 bg-white border border-slate-200 text-red-500 font-bold rounded-xl hover:bg-red-50 shadow-sm"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // BỘ BUILDER CHỈ TIÊU (FORM)
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-8 animate-in slide-in-from-bottom-4">
              <div className="flex justify-between border-b border-slate-100 pb-4">
                <button onClick={() => setEditingCriteria(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold"><ChevronLeft size={20}/> Quay lại</button>
                <h3 className="text-lg font-black text-slate-800 uppercase">{editingCriteria.id ? 'Hiệu chỉnh Chỉ Tiêu' : 'Tạo mới Chỉ Tiêu'}</h3>
              </div>

              {/* 1. Basic Info */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2"><span className="w-6 h-6 bg-blue-100 text-blue-700 flex items-center justify-center rounded-full text-xs">1</span> Cấu hình cơ bản</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên Chỉ tiêu</label>
                    <input type="text" value={editingCriteria.name} onChange={e=>setEditingCriteria({...editingCriteria, name: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tỉ trọng (%)</label>
                    <input type="number" value={editingCriteria.weight} onChange={e=>setEditingCriteria({...editingCriteria, weight: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-blue-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Đơn vị đo (kết quả CT)</label>
                    <select value={editingCriteria.calc_type} onChange={e=>setEditingCriteria({...editingCriteria, calc_type: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700">
                      <option value="count">Số lượng (Đơn, Lỗi)</option>
                      <option value="ratio">Tỉ lệ (%)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Công thức */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2"><span className="w-6 h-6 bg-blue-100 text-blue-700 flex items-center justify-center rounded-full text-xs">2</span> Công thức tính toán</h4>
                <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-xs font-bold text-slate-500 mr-2 mt-1">Chèn nhanh:</span>
                    <button onClick={()=>insertToFormula('[TONG_LOI]')} className="text-[10px] font-black bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded shadow-sm hover:bg-blue-50">LỖI THUỘC BỘ PHẬN</button>
                    {errorList.map(e => (
                       <button key={e.id} onClick={()=>insertToFormula(`[LOI_${e.id}]`)} className="text-[10px] font-black bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded shadow-sm hover:bg-red-100">LỖI: {e.name}</button>
                    ))}
                    {globalVars.map(v => (
                       <button key={v.id} onClick={()=>insertToFormula(`[${v.code}]`)} className="text-[10px] font-black bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded shadow-sm hover:bg-blue-50">BIẾN: {v.name}</button>
                    ))}
                  </div>
                  <textarea 
                    value={editingCriteria.formula} 
                    onChange={e=>setEditingCriteria({...editingCriteria, formula: e.target.value})} 
                    rows="2" 
                    placeholder="VD: ( [LOI_123] / [V_TONG_DI] ) * 100" 
                    className="w-full p-4 bg-white border border-indigo-200 rounded-xl font-mono text-indigo-900 font-bold outline-none"
                  ></textarea>
                </div>
              </div>

              {/* 3. Scoring Rules */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2"><span className="w-6 h-6 bg-blue-100 text-blue-700 flex items-center justify-center rounded-full text-xs">3</span> Luật trừ điểm</h4>
                  <button onClick={addRule} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 flex items-center gap-1"><Plus size={14}/> Thêm luật</button>
                </div>
                
                <div className="space-y-3">
                  {editingCriteria.scoring_rules.map(rule => (
                    <div key={rule.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm relative group">
                      <button onClick={()=>removeRule(rule.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Loại Luật Phạt</label>
                          <select value={rule.type} onChange={e=>updateRule(rule.id, 'type', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                            {RULE_TYPES.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                          </select>
                        </div>
                        
                        {rule.type === 'no_penalty' && (
                           <div className="flex-1"><label className="block text-[10px] font-bold text-emerald-500 uppercase mb-1">Ngưỡng an toàn &lt;=</label><input type="number" step="0.01" value={rule.max} onChange={e=>updateRule(rule.id, 'max', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-emerald-50 border-emerald-200 text-emerald-700"/></div>
                        )}
                        {rule.type === 'fixed_penalty' && (
                          <div className="grid grid-cols-3 gap-2">
                             <div><label className="block text-[10px] font-bold text-amber-500 uppercase mb-1">Từ &gt;</label><input type="number" step="0.01" value={rule.min} onChange={e=>updateRule(rule.id, 'min', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-amber-50 border-amber-200"/></div>
                             <div><label className="block text-[10px] font-bold text-amber-500 uppercase mb-1">Đến &lt;=</label><input type="number" step="0.01" value={rule.max} onChange={e=>updateRule(rule.id, 'max', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-amber-50 border-amber-200"/></div>
                             <div><label className="block text-[10px] font-bold text-red-500 uppercase mb-1">Trừ Điểm</label><input type="number" step="0.1" value={rule.penalty} onChange={e=>updateRule(rule.id, 'penalty', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-black bg-red-50 border-red-200 text-red-600"/></div>
                          </div>
                        )}
                        {rule.type === 'linear_penalty' && (
                          <div className="grid grid-cols-3 gap-2">
                             <div><label className="block text-[10px] font-bold text-amber-500 uppercase mb-1">Bắt đầu &gt;</label><input type="number" step="0.01" value={rule.min} onChange={e=>updateRule(rule.id, 'min', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-amber-50 border-amber-200"/></div>
                             <div><label className="block text-[10px] font-bold text-amber-500 uppercase mb-1">Mỗi bước vượt</label><input type="number" step="0.01" value={rule.step} onChange={e=>updateRule(rule.id, 'step', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-bold bg-amber-50 border-amber-200"/></div>
                             <div><label className="block text-[10px] font-bold text-red-500 uppercase mb-1">Phạt thêm</label><input type="number" step="0.1" value={rule.penalty} onChange={e=>updateRule(rule.id, 'penalty', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-black bg-red-50 border-red-200 text-red-600"/></div>
                          </div>
                        )}
                        {rule.type === 'per_error' && (
                           <div className="flex-1"><label className="block text-[10px] font-bold text-red-500 uppercase mb-1">Mỗi lỗi trừ (Điểm)</label><input type="number" step="0.1" value={rule.penalty} onChange={e=>updateRule(rule.id, 'penalty', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs font-black bg-red-50 border-red-200 text-red-600"/></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button onClick={handleSaveCriteria} disabled={loading} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 flex items-center gap-2">
                   <Save size={18} /> Lưu Toàn Bộ Cấu Hình
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TỪ ĐIỂN LỖI                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'errors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
            <h3 className="font-black text-slate-800 uppercase text-sm mb-5 pb-3 border-b flex items-center gap-2"><Plus size={18} className="text-emerald-600"/> Thêm Lỗi Mới</h3>
            <form onSubmit={handleAddError} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tên lỗi hiển thị</label>
                <input required value={errorForm.name} onChange={e=>setErrorForm({...errorForm, name: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-blue-500 shadow-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Áp dụng xử phạt cho</label>
                <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                    <input type="radio" name="apply" checked={errorForm.apply_to === 'individual'} onChange={() => setErrorForm({...errorForm, apply_to: 'individual'})} className="accent-blue-600" />
                    Cá nhân (Nhân viên)
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                    <input type="radio" name="apply" checked={errorForm.apply_to === 'department'} onChange={() => setErrorForm({...errorForm, apply_to: 'department'})} className="accent-blue-600" />
                    Tập thể bộ phận
                  </label>
                </div>
              </div>
              <button disabled={loading} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700">Lưu vào hệ thống</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 pb-2 border-b">Danh sách lỗi ({errorList.length})</h4>
            <div className="space-y-2">
              {errorList.map(err => (
                <div key={err.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="font-bold text-sm text-slate-700">{err.name}</span>
                    <span className={`ml-3 px-2 py-0.5 rounded text-[10px] font-bold ${err.apply_to === 'individual' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {err.apply_to === 'individual' ? 'Lỗi Cá Nhân' : 'Lỗi Tập Thể'}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteError(err.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BIẾN SỐ CHUNG                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'variables' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
            <h3 className="font-black text-slate-800 uppercase text-sm mb-5 pb-3 border-b flex items-center gap-2"><Plus size={18} className="text-blue-600"/> Khai báo Biến dùng chung</h3>
            <form onSubmit={handleAddVariable} className="space-y-4 text-sm font-bold text-slate-600">
              <div><label className="block mb-1">Mã biến (Không dấu)</label><input required value={varForm.code} onChange={e=>setVarForm({...varForm, code: e.target.value})} placeholder="VD: V_TONG_DON" className="w-full px-4 py-2.5 border rounded-xl uppercase" /></div>
              <div><label className="block mb-1">Tên mô tả</label><input required value={varForm.name} onChange={e=>setVarForm({...varForm, name: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl" /></div>
              <div>
                <label className="block mb-1">Phương thức lấy dữ liệu</label>
                <select value={varForm.source} onChange={e=>setVarForm({...varForm, source: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 cursor-pointer">
                  {VAR_SOURCES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {varForm.source === 'fixed' && <div><label className="block mb-1">Giá trị cố định</label><input type="number" value={varForm.fixed_value} onChange={e=>setVarForm({...varForm, fixed_value: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl bg-amber-50 text-amber-700" /></div>}
              <button disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 mt-2">Tạo Biến</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 pb-2 border-b">Kho Biến Số Hệ Thống</h4>
            <div className="space-y-3">
              {globalVars.map(v => (
                <div key={v.id} className="flex justify-between items-center p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                  <div>
                    <span className="font-mono text-xs bg-slate-800 text-white px-2 py-1 rounded font-black mr-3">[{v.code}]</span>
                    <span className="font-bold text-sm text-slate-800">{v.name}</span>
                    <p className="text-xs text-slate-500 mt-1">Nguồn: {VAR_SOURCES.find(s => s.id === v.source)?.name} {v.source === 'fixed' && <strong className="text-amber-600">(= {v.fixed_value})</strong>}</p>
                  </div>
                  <button onClick={() => handleDeleteVariable(v.id)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: NHÂN SỰ                                                            */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
            <h3 className="font-black text-slate-800 uppercase text-sm mb-5 pb-3 border-b flex items-center gap-2"><UserPlus size={18} className="text-indigo-600"/> Thêm Nhân sự</h3>
            <form onSubmit={handleAddStaff} className="space-y-4 text-sm font-bold text-slate-600">
              <div><label className="block mb-1">Họ và tên</label><input required value={staffForm.full_name} onChange={e=>setStaffForm({...staffForm, full_name: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl" /></div>
              <div>
                <label className="block mb-1">Trực thuộc bộ phận</label>
                <select value={staffForm.role} onChange={e=>setStaffForm({...staffForm, role: e.target.value})} className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 cursor-pointer">
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 mt-2">Xác nhận Thêm</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 pb-2 border-b">Danh sách Nhân sự vận hành</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {staffList.map(s => (
                <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <div className="font-bold text-sm text-slate-800">{s.full_name}</div>
                    <div className="text-[10px] text-indigo-600 font-black uppercase mt-0.5">{s.role}</div>
                  </div>
                  <button onClick={() => handleDeleteStaff(s.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}