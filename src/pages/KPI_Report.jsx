import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Activity, Loader2, CalendarDays, Target, BarChart3, 
  TrendingDown, CheckCircle2, AlertTriangle, FileWarning, 
  HelpCircle, ChevronDown, ChevronUp, User, Users, Award, ShieldAlert
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

  const generateReport = async () => {
    setLoading(true);
    setExpandedStaff(null);
    try {
      // 1. Fetch Danh sách Chỉ tiêu & Xác định Bộ phận
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
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // 3. Fetch Data đồng loạt
      const [ 
        { data: deptStaffs },
        { data: errorDefs },
        { data: errorLogs }, 
        { data: varLogs },
        { count: tongDong },
        { count: tongDi },
        { count: tongIn }
      ] = await Promise.all([
        supabase.from('warehouse_staff').select('*').eq('role', currentDept),
        supabase.from('kpi_errors').select('*').eq('department', currentDept),
        supabase.from('kpi_error_logs').select('*').eq('department', currentDept).gte('error_date', startDate).lte('error_date', endDate),
        supabase.from('kpi_variable_logs').select('*').gte('record_date', startDate).lte('record_date', endDate),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', [40, 42]).gte('packed_at', `${startDate}T00:00:00Z`).lte('packed_at', `${endDate}T23:59:59Z`),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('carrier_date', `${startDate}T00:00:00Z`).lte('carrier_date', `${endDate}T23:59:59Z`),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('printed_at', `${startDate}T00:00:00Z`).lte('printed_at', `${endDate}T23:59:59Z`)
      ]);

      if (!deptStaffs || deptStaffs.length === 0) {
        setStaffReports([]); setLoading(false); return;
      }

      // Tách sẵn Lỗi Tập Thể để tính nhanh
      const deptErrorLogs = (errorLogs || []).filter(log => {
         const def = errorDefs?.find(e => e.id === log.error_id);
         return !def || def.apply_to === 'department';
      });

      let totalScoreSum = 0;
      let highestScore = -1;
      let topStaffName = '';

      // 4. TÍNH TOÁN KPI CHO TỪNG NHÂN VIÊN
      const reports = deptStaffs.map(staff => {
        let totalWeightAccum = 0;
        let totalScoreAccum = 0;
        let totalPenaltyAccum = 0;

        // Lỗi Cá nhân của nhân viên này
        const individualErrorLogs = (errorLogs || []).filter(log => log.staff_id === staff.id);
        const staffTotalErrors = deptErrorLogs.length + individualErrorLogs.length; // Tổng lỗi NV phải chịu = Lỗi chung + Lỗi riêng

        const criteriaDetails = deptCriteria.map(crit => {
          let mathStr = crit.formula || '';
          let rawValue = 0;
          const weight = Number(crit.weight) || 0;

          // Xử lý Thay biến
          if (crit.variables && Array.isArray(crit.variables)) {
            crit.variables.forEach(v => {
              let vValue = 0;
              if (v.source === 'fixed') vValue = Number(v.value) || 0;
              else if (v.source === 'error_count') {
                const isIndividual = errorDefs?.find(e => e.id === v.error_id)?.apply_to === 'individual';
                if (isIndividual) {
                   // Chỉ đếm lỗi của chính nhân viên này
                   vValue = individualErrorLogs.filter(log => log.error_id === v.error_id).length;
                } else {
                   // Đếm lỗi tập thể
                   vValue = deptErrorLogs.filter(log => log.error_id === v.error_id).length;
                }
              }
              else if (v.source === 'daily_manual' || v.source === 'monthly_manual') {
                vValue = (varLogs || []).filter(log => log.variable_code === v.code).reduce((sum, log) => sum + Number(log.value), 0);
              }
              else if (v.source.includes('auto_packed')) vValue = tongDong || 0;
              else if (v.source.includes('auto_shipped')) vValue = tongDi || 0;
              else if (v.source.includes('auto_printed')) vValue = tongIn || 0;

              const regex = new RegExp(`\\[${v.code}\\]`, 'g');
              mathStr = mathStr.replace(regex, vValue);
            });
          }

          mathStr = mathStr.replace(/\[TONG_LOI\]/g, staffTotalErrors);

          // Tính toán công thức
          if (mathStr.trim() !== '') {
            try {
              rawValue = new Function('return ' + mathStr)();
              if (!isFinite(rawValue) || isNaN(rawValue)) rawValue = 0; 
            } catch (e) { rawValue = 0; }
          } else {
            // Default nếu không ghi công thức
            rawValue = crit.variables.filter(v => v.source === 'error_count').reduce((sum, v) => {
               const isIndividual = errorDefs?.find(e => e.id === v.error_id)?.apply_to === 'individual';
               if (isIndividual) return sum + individualErrorLogs.filter(l => l.error_id === v.error_id).length;
               return sum + deptErrorLogs.filter(l => l.error_id === v.error_id).length;
            }, 0);
          }

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

        // Chốt điểm nhân viên
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

      // Sort by highest score
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
      
      {/* HEADER TÙY CHỈNH THÁNG & BỘ PHẬN */}
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
          {/* TAB ĐIỀU HƯỚNG BỘ PHẬN */}
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

          {/* KHỐI OVERVIEW NHÂN SỰ */}
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

          {/* BẢNG XẾP HẠNG & CHI TIẾT */}
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
                          {/* DÒNG NHÂN SỰ CHÍNH */}
                          <tr 
                            onClick={() => toggleExpand(staff.id)} 
                            className={`transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'} ${idx === 0 ? 'bg-amber-50/20' : ''}`}
                          >
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
                            <td className="py-5 px-6 text-center">
                              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm font-black">{staff.totalWeight}</span>
                            </td>
                            <td className="py-5 px-6 text-center">
                              {staff.totalPenalty > 0 ? (
                                <span className="inline-block px-2.5 py-1 bg-red-50 border border-red-100 text-red-600 rounded-md text-xs font-black">-{staff.totalPenalty}</span>
                              ) : (
                                <span className="text-slate-300 text-sm font-bold">-</span>
                              )}
                            </td>
                            <td className="py-5 px-6 text-center">
                              <span className={`text-xl font-black ${scoreColor}`}>
                                {staff.totalScore}
                              </span>
                            </td>
                            <td className="py-5 px-6 text-right">
                              <button className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                              </button>
                            </td>
                          </tr>

                          {/* KHUNG HIỂN THỊ CHI TIẾT DƯỚI DẠNG ACCORDION */}
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
                                              {crit.penalty > 0 ? (
                                                <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">-{crit.penalty}</span>
                                              ) : <span className="text-slate-300">-</span>}
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