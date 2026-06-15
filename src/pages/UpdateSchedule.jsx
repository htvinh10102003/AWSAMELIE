import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, Users, UserPlus, Loader2, CheckCircle2, AlertCircle, Save, RefreshCw, Clock, Sun, Moon, Sunrise, Sunset, UserCheck, UserX } from 'lucide-react';

export default function UpdateSchedule() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // States của Tab Nhân viên
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Đóng hàng');

  // States của Tab Xếp lịch
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyShifts, setDailyShifts] = useState({});

  // States của Bảng Thống kê 7 ngày phía dưới
  const [statsDays, setStatsDays] = useState([]);
  const [statsMatrix, setStatsMatrix] = useState({});

  useEffect(() => {
    loadStaffData();
  }, []);

  useEffect(() => {
    if (activeTab === 'schedule') {
      loadDailySchedule();
      generate7DaysStats();
    }
  }, [activeTab, scheduleDate]);

  const loadStaffData = async () => {
    const { data, error } = await supabase.from('warehouse_staff').select('*').order('full_name');
    if (!error && data) setStaff(data);
  };

  const loadDailySchedule = async () => {
    if (staff.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('working_schedules')
        .select('staff_id, shift')
        .eq('work_date', scheduleDate);

      if (error) throw error;
      
      const shiftMap = {};
      staff.forEach(s => { shiftMap[s.id] = 'Nghỉ'; });
      data?.forEach(item => { shiftMap[item.staff_id] = item.shift; });
      setDailyShifts(shiftMap);
    } catch (err) { console.error(err); }
  };

  const generate7DaysStats = async () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    setStatsDays(dates);

    try {
      const { data, error } = await supabase
        .from('working_schedules')
        .select('staff_id, work_date, shift')
        .gte('work_date', dates[0])
        .lte('work_date', dates[6]);

      if (error) throw error;

      const matrix = {};
      data?.forEach(item => {
        if (!matrix[item.staff_id]) matrix[item.staff_id] = {};
        matrix[item.staff_id][item.work_date] = item.shift;
      });
      setStatsMatrix(matrix);
    } catch (err) { console.error(err); }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('warehouse_staff')
        .insert([{ full_name: newStaffName.trim(), role: newStaffRole }]);

      if (error) throw error;
      setMessage('✅ Thêm nhân viên thành công!');
      setNewStaffName('');
      await loadStaffData();
    } catch (err) {
      setMessage(`❌ Lỗi: ${err.message}`);
    } finally { setLoading(false); }
  };

  const handleSaveSchedule = async () => {
    setLoading(true);
    setMessage('');
    try {
      const records = Object.keys(dailyShifts).map(staffId => ({
        staff_id: Number(staffId),
        work_date: scheduleDate,
        shift: dailyShifts[staffId]
      }));

      const { error } = await supabase
        .from('working_schedules')
        .upsert(records, { onConflict: 'staff_id,work_date' });

      if (error) throw error;
      setMessage('✅ Lưu lịch làm việc hôm nay thành công!');
      await generate7DaysStats();
    } catch (err) {
      setMessage(`❌ Lỗi lưu lịch: ${err.message}`);
    } finally { setLoading(false); }
  };

  // Tính thống kê nhanh cho ngày hiện tại
  const shiftCount = {
    'Cả ngày': Object.values(dailyShifts).filter(s => s === 'Cả ngày').length,
    'Sáng': Object.values(dailyShifts).filter(s => s === 'Sáng').length,
    'Chiều': Object.values(dailyShifts).filter(s => s === 'Chiều').length,
    'Nghỉ': Object.values(dailyShifts).filter(s => s === 'Nghỉ').length,
  };

  const today = new Date(scheduleDate).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER CHUYÊN NGHIỆP */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <CalendarDays size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Quản lý lịch làm việc</h1>
                <p className="text-indigo-100 text-sm mt-1">Phân ca & theo dõi chấm công nhân sự kho vận</p>
              </div>
            </div>
            
            {/* TAB CHUYỂN ĐỔI */}
            <div className="flex bg-white/15 p-1 rounded-xl backdrop-blur-sm">
              <button 
                onClick={() => setActiveTab('schedule')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'schedule' 
                    ? 'bg-white text-indigo-600 shadow-md' 
                    : 'text-white/80 hover:text-white hover:bg-white/10 cursor-pointer'
                }`}
              >
                <Clock size={16} />
                Lịch làm việc
              </button>
              <button 
                onClick={() => setActiveTab('staff')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'staff' 
                    ? 'bg-white text-indigo-600 shadow-md' 
                    : 'text-white/80 hover:text-white hover:bg-white/10 cursor-pointer'
                }`}
              >
                <Users size={16} />
                Nhân viên
              </button>
            </div>
          </div>

          {/* STATS BAR */}
          {activeTab === 'schedule' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50/80">
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Users size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Tổng nhân viên</p>
                  <p className="text-lg font-bold text-slate-800">{staff.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Sunrise size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Ca sáng</p>
                  <p className="text-lg font-bold text-emerald-600">{shiftCount['Sáng']}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Sunset size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Ca chiều</p>
                  <p className="text-lg font-bold text-amber-600">{shiftCount['Chiều']}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
                <div className="p-2 bg-slate-200 rounded-lg">
                  <Moon size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Nghỉ</p>
                  <p className="text-lg font-bold text-slate-500">{shiftCount['Nghỉ']}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* THÔNG BÁO */}
        {message && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium animate-fadeIn ${
            message.includes('✅') 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.includes('✅') ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-red-500" />}
            {message}
          </div>
        )}

        {/* NỘI DUNG TAB 1: XẾP LỊCH LÀM VIỆC */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* KHUNG PHÂN CA THEO NGÀY */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Phân ca làm việc</h2>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <CalendarDays size={14} className="text-indigo-500" />
                    {today}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="date" 
                    value={scheduleDate} 
                    onChange={(e) => setScheduleDate(e.target.value)} 
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  />
                  <button 
                    onClick={handleSaveSchedule} 
                    disabled={loading || staff.length === 0}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Lưu lịch
                  </button>
                </div>
              </div>

              {staff.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-slate-100 rounded-full">
                    <UserX size={32} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Chưa có nhân viên nào trong hệ thống</p>
                  <p className="text-xs text-slate-400">Vui lòng chuyển sang tab "Nhân viên" để thêm mới</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {staff.map(member => (
                    <div key={member.id} className="group p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all bg-white">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                          <UserPlus size={18} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{member.full_name}</p>
                          <p className="text-xs text-slate-500">{member.role}</p>
                        </div>
                      </div>
                      <select 
                        value={dailyShifts[member.id] || 'Nghỉ'} 
                        onChange={(e) => setDailyShifts({ ...dailyShifts, [member.id]: e.target.value })} 
                        className="w-full py-2 px-3 rounded-xl text-sm font-medium border outline-none transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-700 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Nghỉ">Nghỉ</option>
                        <option value="Sáng">Ca sáng (8h-12h)</option>
                        <option value="Chiều">Ca chiều (13h30-18h)</option>
                        <option value="Cả ngày">Cả ngày</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BẢNG MA TRẬN THỐNG KÊ 7 NGÀY */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                <Clock size={18} className="text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Thống kê lịch sử 7 ngày gần đây</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 pl-6 pr-4 sticky left-0 bg-slate-50">Nhân viên</th>
                      {statsDays.map(date => (
                        <th key={date} className="py-3.5 px-4 text-center">
                          {new Date(date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staff.map(member => (
                      <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 pl-6 pr-4 sticky left-0 bg-white font-medium text-sm text-slate-800">
                          {member.full_name}
                          <span className="text-xs text-slate-400 ml-2">({member.role})</span>
                        </td>
                        {statsDays.map(date => {
                          const shift = statsMatrix[member.id]?.[date] || 'Nghỉ';
                          let bgColor, textColor, icon;
                          switch (shift) {
                            case 'Cả ngày': bgColor = 'bg-emerald-100'; textColor = 'text-emerald-700'; break;
                            case 'Sáng': bgColor = 'bg-amber-100'; textColor = 'text-amber-700'; break;
                            case 'Chiều': bgColor = 'bg-blue-100'; textColor = 'text-blue-700'; break;
                            default: bgColor = 'bg-slate-100'; textColor = 'text-slate-400'; break;
                          }
                          return (
                            <td key={date} className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${bgColor} ${textColor}`}>
                                {icon} {shift}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* NỘI DUNG TAB 2: QUẢN LÝ DANH MỤC NHÂN VIÊN */}
        {activeTab === 'staff' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* FORM THÊM NHÂN VIÊN */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-fit">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus size={18} className="text-indigo-500" />
                  Thêm nhân sự mới
                </h3>
              </div>
              <form onSubmit={handleAddStaff} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Họ và tên</label>
                  <input 
                    type="text" 
                    value={newStaffName} 
                    onChange={e => setNewStaffName(e.target.value)} 
                    placeholder="Nhập tên nhân viên..." 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Chức danh / Vị trí</label>
                  <select 
                    value={newStaffRole} 
                    onChange={e => setNewStaffRole(e.target.value)} 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    <option value="Lead kho">Lead kho</option>
                    <option value="Vận đơn">Vận đơn</option>
                    <option value="Đóng hàng">Đóng hàng</option>
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {loading ? 'Đang thêm...' : 'Kích hoạt nhân viên'}
                </button>
              </form>
            </div>

            {/* DANH SÁCH NHÂN VIÊN */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-2">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users size={18} className="text-indigo-500" />
                  Biên chế kho ({staff.length} người)
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {staff.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3">
                    <div className="p-4 bg-slate-100 rounded-full">
                      <Users size={32} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Danh sách nhân viên trống</p>
                    <p className="text-xs text-slate-400">Thêm nhân viên mới bằng form bên trái</p>
                  </div>
                ) : (
                  staff.map(member => (
                    <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                          <span className="text-sm font-bold text-indigo-600">
                            {member.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{member.full_name}</p>
                          <p className="text-xs text-slate-500">ID: {member.id}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${
                        member.role === 'Lead kho' 
                          ? 'bg-purple-100 text-purple-700' 
                          : member.role === 'Vận đơn' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {member.role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}