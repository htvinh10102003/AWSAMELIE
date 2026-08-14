import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Activity, Loader2, CalendarDays, Target, BarChart3, 
  TrendingDown, CheckCircle2, AlertTriangle, FileWarning, 
  HelpCircle, ChevronDown, ChevronUp, User, Users, Award
} from 'lucide-react';

export default function KPI_Report() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [reportDept, setReportDept] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [activeDepartments, setActiveDepartments] = useState([]);
  const [staffReports, setStaffReports] = useState([]);
  const [expandedStaff, setExpandedStaff] = useState(null);

  const [summary, setSummary] = useState({ avgScore: 0, topStaff: null, totalIssues: 0 });

  useEffect(() => {
    generateReport();
  }, [selectedMonth, reportDept]);

  // ⚡️ BỘ BIÊN DỊCH TOÁN HỌC AN TOÀN (Hỗ trợ IF, ABS, MAX, MIN)
  const safeEvalFormula = (formulaStr) => {
    if (!formulaStr || !formulaStr.trim()) return 0;
    try {
      // Định nghĩa hàm IF chuẩn Excel
      const IF = (condition, valueIfTrue, valueIfFalse) => condition ? valueIfTrue : valueIfFalse;
      const ABS = Math.abs;
      const MAX = Math.max;
      const MIN = Math.min;
      const ROUND = (val, decimals = 2) => Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);

      const fn = new Function('IF', 'ABS', 'MAX', 'MIN', 'ROUND', 'return ' + formulaStr);
      const res = fn(IF, ABS, MAX, MIN, ROUND);
      
      if (!isFinite(res) || isNaN(res)) return 0;
      return res;
    } catch (e) {
      console.error("Lỗi tính toán công thức:", formulaStr, e);
      return 0;
    }
  };

  const generateReport = async () => {
    setLoading(true);
    setExpandedStaff(null);
    try {
      // 1. Fetch Criteria
      const { data: allCriteria } = await supabase.from('kpi_criteria').select('*');
      if (!allCriteria || allCriteria.length === 0) {
        setActiveDepartments([]); setStaffReports([]); setLoading(false); return;
      }

      const depts = [...new Set(allCriteria.map(c => c.department))];
      setActiveDepartments(depts);

      let currentDept = reportDept;
      if (!depts.includes(currentDept)) {
        currentDept = depts[0];
        setReportDept(currentDept);
      }

      const deptCriteria = allCriteria.filter(c => c.department === currentDept);

      // 2. Mốc thời gian
      const [year, month] = selectedMonth.split('-');
      const startD = new Date(`${selectedMonth}-01`);
      const endOfMonth = new Date(year, month, 0);
      const today = new Date();
      const actualEndD = (endOfMonth > today) ? today : endOfMonth;

      const daysInMonth = [];
      for (let d = new Date(startD); d <= actualEndD; d.setDate(d.getDate() + 1)) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          daysInMonth.push(`${yyyy}-${mm}-${dd}`);
      }
      const numValidDays = daysInMonth.length || 1;

      // 3. Fetch Data
      const [ 
        { data: deptStaffs }, { data: errorDefs }, { data: errorLogs }, { data: varLogs }, { data: globalVarsData }
      ] = await Promise.all([
        supabase.from('warehouse_staff').select('*').eq('role', currentDept),
        supabase.from('kpi_errors').select('*').eq('department', currentDept),
        supabase.from('kpi_error_logs').select('*').eq('department', currentDept).gte('error_date', daysInMonth[0]).lte('error_date', daysInMonth[daysInMonth.length-1]),
        supabase.from('kpi_variable_logs').select('*').gte('record_date', daysInMonth[0]).lte('record_date', daysInMonth[daysInMonth.length-1]),
        supabase.from('kpi_global_variables').select('*')
      ]);

      if (!deptStaffs || deptStaffs.length === 0) {
        setStaffReports([]); setLoading(false); return;
      }

      // Xử lý đếm đơn hàng tự động
      const isDailyAutoRequired = globalVarsData?.some(v => v.source.startsWith('auto_'));
      const dailyCounts = {};
      let tongDongThang = 0, tongDiThang = 0, tongInThang = 0;

      if (isDailyAutoRequired) {
          const promises = [];
          daysInMonth.forEach(day => {
              dailyCounts[day] = { packed: 0, shipped: 0, printed: 0 };
              promises.push(
                  supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', [40, 42]).gte('packed_at', `${day}T00:00:00Z`).lte('packed_at', `${day}T23:59:59Z`).then(({count}) => { dailyCounts[day].packed = count || 0; tongDongThang += count || 0; }),
                  supabase.from('orders').select('*', { count: 'exact', head: true }).gte('carrier_date', `${day}T00:00:00Z`).lte('carrier_date', `${day}T23:59:59Z`).then(({count}) => { dailyCounts[day].shipped = count || 0; tongDiThang += count || 0; }),
                  supabase.from('orders').select('*', { count: 'exact', head: true }).gte('printed_at', `${day}T00:00:00Z`).lte('printed_at', `${day}T23:59:59Z`).then(({count}) => { dailyCounts[day].printed = count || 0; tongInThang += count || 0; })
              );
          });
          await Promise.all(promises);
      }

      // 4. Lõi tính toán
      const computeCrit = (crit, targetErrLogs, targetTotalErrs) => {
          let mathStr = crit.formula || '';

          if (crit.eval_mode === 'daily_average') {
              let sumRaw = 0;
              daysInMonth.forEach(day => {
                  let mathStrDay = mathStr;
                  
                  globalVarsData?.forEach(v => {
                      let vVal = 0;
                      if (v.source === 'fixed') vVal = Number(v.fixed_value) || 0;
                      else if (v.source === 'daily_manual' || v.source === 'monthly_manual') {
                          vVal = (varLogs || []).filter(l => l.record_date === day && l.variable_code === v.code).reduce((s,l) => s + Number(l.value), 0);
                      }
                      else if (v.source === 'auto_packed_day') vVal = dailyCounts[day]?.packed || 0;
                      else if (v.source === 'auto_shipped_day') vVal = dailyCounts[day]?.shipped || 0;
                      else if (v.source === 'auto_printed_day') vVal = dailyCounts[day]?.printed || 0;
                      mathStrDay = mathStrDay.replace(new RegExp(`\\[${v.code}\\]`, 'g'), vVal);
                  });

                  errorDefs?.forEach(e => {
                      const countErrDay = targetErrLogs.filter(l => l.error_date === day && l.error_id === e.id).length;
                      mathStrDay = mathStrDay.replace(new RegExp(`\\[LOI_${e.id}\\]`, 'g'), countErrDay);
                  });
                  const errsToday = targetErrLogs.filter(l => l.error_date === day).length;
                  mathStrDay = mathStrDay.replace(/\[TONG_LOI\]/g, errsToday);

                  let dayRaw = 0;
                  if (mathStrDay.trim() !== '') {
                      dayRaw = safeEvalFormula(mathStrDay);
                  } else { 
                      dayRaw = errsToday; 
                  }
                  
                  sumRaw += dayRaw;
              });
              return sumRaw / numValidDays;
          } else {
              globalVarsData?.forEach(v => {
                  let vVal = 0;
                  if (v.source === 'fixed') vVal = Number(v.fixed_value) || 0;
                  else if (v.source === 'daily_manual' || v.source === 'monthly_manual') {
                      vVal = (varLogs || []).filter(l => l.variable_code === v.code).reduce((s,l) => s + Number(l.value), 0);
                  }
                  else if (v.source === 'auto_packed_day') vVal = tongDongThang;
                  else if (v.source === 'auto_shipped_day') vVal = tongDiThang;
                  else if (v.source === 'auto_printed_day') vVal = tongInThang;
                  mathStr = mathStr.replace(new RegExp(`\\[${v.code}\\]`, 'g'), vVal);
              });

              errorDefs?.forEach(e => {
                  const countErrMonth = targetErrLogs.filter(l => l.error_id === e.id).length;
                  mathStr = mathStr.replace(new RegExp(`\\[LOI_${e.id}\\]`, 'g'), countErrMonth);
              });
              mathStr = mathStr.replace(/\[TONG_LOI\]/g, targetTotalErrs);

              let rawValue = 0;
              if (mathStr.trim() !== '') {
                  rawValue = safeEvalFormula(mathStr);
              } else { 
                  rawValue = targetTotalErrs; 
              }
              return rawValue;
          }
      };

      const deptErrorLogs = (errorLogs || []).filter(log => errorDefs?.find(e => e.id === log.error_id)?.apply_to === 'department');

      let totalScoreSum = 0;
      let highestScore = -1;
      let topStaffName = '';

      // 5. Tính điểm từng Nhân viên
      const reports = deptStaffs.map(staff => {
        let totalWeightAccum = 0;
        let totalScoreAccum = 0;
        let totalPenaltyAccum = 0;

        const individualErrorLogs = (errorLogs || []).filter(log => log.staff_id === staff.id);
        const staffErrorLogs = [...deptErrorLogs, ...individualErrorLogs];
        const staffTotalErrors = staffErrorLogs.length;

        const criteriaDetails = deptCriteria.map(crit => {
          const weight = Number(crit.weight) || 0;
          let rawValue = computeCrit(crit, staffErrorLogs, staffTotalErrors);
          rawValue = Math.round(rawValue * 100) / 100;

          // Bộ lọc Luật Trừ Điểm
          let penalty = 0;
          if (crit.scoring_rules && Array.isArray(crit.scoring_rules)) {
            crit.scoring_rules.forEach(rule => {
              const min = Number(rule.min) || 0; const max = Number(rule.max) || 0;
              const rulePenalty = Number(rule.penalty) || 0; const step = Number(rule.step) || 0;

              if (rule.type === 'fixed_penalty' && rawValue > min && rawValue <= max) penalty += rulePenalty;
              else if (rule.type === 'linear_penalty' && rawValue > min && step > 0) {
                 const stepsOver = Math.floor((rawValue - min) / step);
                 if (stepsOver > 0) penalty += (stepsOver * rulePenalty);
              } 
              else if (rule.type === 'per_error') penalty += (rawValue * rulePenalty);
            });
          }

          let score = weight - penalty;
          if (score < 0) score = 0;

          totalWeightAccum += weight;
          totalScoreAccum += score;
          totalPenaltyAccum += penalty;

          return { ...crit, rawValue, penalty, score };
        });

        const finalTotalScore = Math.round(totalScoreAccum * 100) / 100;
        totalScoreSum += finalTotalScore;
        if (finalTotalScore > highestScore) { highestScore = finalTotalScore; topStaffName = staff.full_name; }

        return {
          ...staff,
          totalWeight: totalWeightAccum,
          totalScore: finalTotalScore,
          totalPenalty: Math.round(totalPenaltyAccum * 100) / 100,
          criteriaDetails
        };
      });

      reports.sort((a, b) => b.totalScore - a.totalScore);
      setStaffReports(reports);

      setSummary({
        avgScore: reports.length > 0 ? Math.round((totalScoreSum / reports.length) * 100) / 100 : 0,
        topStaff: topStaffName,
        totalIssues: errorLogs ? errorLogs.length : 0
      });

    } catch (err) { console.error("Lỗi tạo báo cáo KPI:", err); }
    setLoading(false);
  };

  const getScoreColor = (score, weight) => {
    if (weight === 0) return 'text-slate-400';
    const ratio = score / weight;
    if (ratio >= 0.9) return 'text-emerald-600';
    if (ratio >= 0.7) return 'text-amber-600';
    return 'text-red-600';
  };

  const toggleExpand = (staffId) => {
    setExpandedStaff(expandedStaff === staffId ? null : staffId);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 p-4 mt-4 animate-in fade-in duration-300">
      
      <div className="bg-white p-6 md:p-8 border border-slate-200 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm"><BarChart3 size={28} strokeWidth={2.5}/></div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">BẢNG LƯƠNG KPI NHÂN SỰ</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Đánh giá hiệu suất chi tiết tới từng cá nhân</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto bg-slate-50 p-2.5 rounded-2xl border border-slate-200/60 shadow-inner">
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200 w-full sm:w-auto">
            <CalendarDays size={18} className="text-indigo-600" />
            <input 
              type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} 
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-full" 
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center text-slate-400 font-bold bg-white rounded-3xl shadow-sm border border-slate-200">
          <Loader2 className="animate-spin mb-4 text-indigo-500" size={40}/>
          <p>Hệ thống đang nội suy công thức và tính điểm cho từng người...</p>
        </div>
      ) : activeDepartments.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-center bg-white rounded-3xl shadow-sm border border-slate-200">
          <Target size={56} className="text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-700 mb-2">Hệ thống chưa thiết lập KPI</h3>
          <p className="text-sm font-medium text-slate-500 max-w-md">Vui lòng chuyển sang mục <b className="text-indigo-600">Quản lý KPI & Lỗi</b> để cài đặt cấu trúc thưởng phạt.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {activeDepartments.map(dept => (
              <button 
                key={dept} onClick={() => setReportDept(dept)} 
                className={`px-6 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all border shadow-sm ${reportDept === dept ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                Nhân sự {dept}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-blue-50 opacity-50"><Users size={100}/></div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 relative z-10">TỔNG NHÂN SỰ</p>
              <div className="flex items-baseline gap-2 relative z-10">
                <span className="text-5xl font-black tracking-tighter text-blue-600">{staffReports.length}</span>
                <span className="text-lg font-bold text-slate-400">người</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-emerald-50 opacity-50"><Activity size={100}/></div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 relative z-10">ĐIỂM TRUNG BÌNH KHO</p>
              <div className="flex items-baseline gap-2 relative z-10">
                <span className="text-5xl font-black tracking-tighter text-emerald-600">{summary.avgScore}</span>
                <span className="text-lg font-bold text-slate-400">điểm</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-amber-200 bg-amber-50 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-amber-100 opacity-50"><Award size={100}/></div>
              <p className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-2 relative z-10">NHÂN SỰ XUẤT SẮC NHẤT</p>
              <div className="text-2xl font-black text-amber-800 relative z-10 line-clamp-2 mt-3">{summary.topStaff || 'Chưa có'}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800">BẢNG ĐIỂM CHI TIẾT TỪNG NHÂN VIÊN</h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Bấm vào tên nhân viên để xem bóc tách các lỗi và công thức trừ điểm.</p>
              </div>
            </div>

            {staffReports.length === 0 ? (
              <div className="py-20 text-center text-slate-500 font-bold">Chưa có nhân sự nào được khai báo trong bộ phận này.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider w-1/3">Nhân sự</th>
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Tỉ trọng <br/><span className="text-[10px] font-medium normal-case">(Base)</span></th>
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Tổng Phạt <br/><span className="text-[10px] font-medium normal-case">(Penalty)</span></th>
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Điểm Đạt <br/><span className="text-[10px] font-medium normal-case">(Chốt)</span></th>
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffReports.map((staff, idx) => {
                      const isExpanded = expandedStaff === staff.id;
                      const scoreColor = getScoreColor(staff.totalScore, staff.totalWeight);

                      return (
                        <React.Fragment key={staff.id}>
                          <tr onClick={() => toggleExpand(staff.id)} className={`transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'} ${idx === 0 ? 'bg-amber-50/20' : ''}`}>
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm border ${idx === 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {idx === 0 ? <Award size={18}/> : staff.full_name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    {staff.full_name} 
                                    {idx === 0 && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wider">Top 1</span>}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">{staff.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-center"><span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm font-black">{staff.totalWeight}</span></td>
                            <td className="py-5 px-6 text-center">
                              {staff.totalPenalty > 0 ? <span className="inline-block px-2.5 py-1 bg-red-50 border border-red-100 text-red-600 rounded-md text-xs font-black">-{staff.totalPenalty}</span> : <span className="text-slate-300 text-sm font-bold">-</span>}
                            </td>
                            <td className="py-5 px-6 text-center"><span className={`text-xl font-black ${scoreColor}`}>{staff.totalScore}</span></td>
                            <td className="py-5 px-6 text-right">
                              <button className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/80 border-b-2 border-indigo-100">
                              <td colSpan="5" className="p-0">
                                <div className="p-6 pt-2 pb-8 animate-in slide-in-from-top-2 duration-300">
                                  <h4 className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <FileWarning size={14}/> Bóc tách Chỉ tiêu của {staff.full_name}
                                  </h4>
                                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                      <thead className="bg-slate-100 border-b border-slate-200">
                                        <tr>
                                          <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Tên Chỉ Tiêu</th>
                                          <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase text-center">Kết Quả Báo Cáo</th>
                                          <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase text-center">Phạt</th>
                                          <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase text-center">Điểm Đạt</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {staff.criteriaDetails.map(crit => (
                                          <tr key={crit.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 px-5">
                                              <div className="font-bold text-slate-700">{crit.name}</div>
                                              {crit.formula ? (
                                                <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1"><HelpCircle size={10}/> {crit.formula}</div>
                                              ) : (
                                                <div className="text-[10px] text-slate-400 mt-1">Đếm lỗi vi phạm trực tiếp</div>
                                              )}
                                            </td>
                                            <td className="py-4 px-5 text-center font-bold text-slate-600">
                                              {crit.rawValue} <span className="text-[10px] font-normal">{crit.calc_type === 'ratio' ? '%' : 'lượt'}</span>
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                              {crit.penalty > 0 ? <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">-{crit.penalty}</span> : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                              <span className={`font-black ${getScoreColor(crit.score, crit.weight)}`}>{crit.score} / {crit.weight}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}