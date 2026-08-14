import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Activity, Loader2, CalendarDays, Target, BarChart3, 
  TrendingDown, CheckCircle2, AlertTriangle, FileWarning, 
  HelpCircle, ChevronDown, ChevronUp, User, Users, Award, Download
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
  const [rawExportLogs, setRawExportLogs] = useState([]);
  const [rawExportVars, setRawExportVars] = useState([]);

  useEffect(() => {
    generateReport();
  }, [selectedMonth, reportDept]);

  const safeEvalFormula = (formulaStr) => {
    if (!formulaStr || !formulaStr.trim()) return 0;
    try {
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

      const [ 
        { data: deptStaffs }, { data: allErrors }, { data: allErrorLogs }, { data: varLogs }, { data: globalVarsData }
      ] = await Promise.all([
        supabase.from('warehouse_staff').select('*').eq('role', currentDept),
        supabase.from('kpi_errors').select('*'), // Lấy toàn bộ lỗi để map ID cho đúng
        supabase.from('kpi_error_logs').select('*').gte('error_date', daysInMonth[0]).lte('error_date', daysInMonth[daysInMonth.length-1]),
        supabase.from('kpi_variable_logs').select('*').gte('record_date', daysInMonth[0]).lte('record_date', daysInMonth[daysInMonth.length-1]),
        supabase.from('kpi_global_variables').select('*')
      ]);

      if (!deptStaffs || deptStaffs.length === 0) {
        setStaffReports([]); setLoading(false); return;
      }

      // 1. Phân tách Lỗi Toàn Kho và Lỗi Tập thể
      const warehouseErrorLogs = (allErrorLogs || []).filter(log => {
        const def = allErrors?.find(e => e.id === log.error_id);
        return def?.apply_to === 'warehouse';
      });

      const deptErrorLogs = (allErrorLogs || []).filter(log => {
        const def = allErrors?.find(e => e.id === log.error_id);
        return def?.apply_to === 'department' && log.department === currentDept;
      });

      // LƯU RAW DATA ĐỂ XUẤT EXCEL
      const allExportLogs = [...warehouseErrorLogs, ...deptErrorLogs, ...(allErrorLogs || []).filter(log => log.department === currentDept && log.staff_id)];
      const enrichedErrorLogs = allExportLogs.map(log => {
        const errDef = allErrors?.find(e => e.id === log.error_id);
        const staffDef = deptStaffs?.find(s => s.id === log.staff_id);
        return {
            date: log.error_date,
            dept: log.department,
            staffName: staffDef ? staffDef.full_name : errDef?.apply_to === 'warehouse' ? 'Toàn bộ kho' : 'Tập thể bộ phận',
            errorName: errDef ? errDef.name : 'Unknown',
            applyTo: errDef ? errDef.apply_to : 'department',
            tracking: log.tracking_code || '',
            note: log.note || ''
        };
      });
      setRawExportLogs(enrichedErrorLogs);

      const enrichedVarLogs = (varLogs || []).map(v => {
        const varDef = globalVarsData?.find(gv => gv.code === v.variable_code);
        return {
           date: v.record_date,
           name: varDef ? varDef.name : v.variable_code,
           code: v.variable_code,
           value: v.value
        }
      });
      setRawExportVars(enrichedVarLogs);

      // Tính biến Auto
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

      // Lõi tính toán
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

                  allErrors?.forEach(e => {
                      const countErrDay = targetErrLogs.filter(l => l.error_date === day && l.error_id === e.id).length;
                      mathStrDay = mathStrDay.replace(new RegExp(`\\[LOI_${e.id}\\]`, 'g'), countErrDay);
                  });
                  const errsToday = targetErrLogs.filter(l => l.error_date === day).length;
                  mathStrDay = mathStrDay.replace(/\[TONG_LOI\]/g, errsToday);

                  let dayRaw = 0;
                  if (mathStrDay.trim() !== '') {
                      dayRaw = safeEvalFormula(mathStrDay);
                  } else { dayRaw = errsToday; }
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

              allErrors?.forEach(e => {
                  const countErrMonth = targetErrLogs.filter(l => l.error_id === e.id).length;
                  mathStr = mathStr.replace(new RegExp(`\\[LOI_${e.id}\\]`, 'g'), countErrMonth);
              });
              mathStr = mathStr.replace(/\[TONG_LOI\]/g, targetTotalErrs);

              let rawValue = 0;
              if (mathStr.trim() !== '') {
                  rawValue = safeEvalFormula(mathStr);
              } else { rawValue = targetTotalErrs; }
              return rawValue;
          }
      };

      let totalScoreSum = 0;
      let highestScore = -1;
      let topStaffName = '';

      const reports = deptStaffs.map(staff => {
        let totalWeightAccum = 0;
        let totalScoreAccum = 0;
        let totalPenaltyAccum = 0;

        const individualErrorLogs = (allErrorLogs || []).filter(log => log.staff_id === staff.id);
        const staffErrorLogs = [...warehouseErrorLogs, ...deptErrorLogs, ...individualErrorLogs];
        const staffTotalErrors = staffErrorLogs.length;

        const criteriaDetails = deptCriteria.map(crit => {
          const weight = Number(crit.weight) || 0;
          let rawValue = computeCrit(crit, staffErrorLogs, staffTotalErrors);
          rawValue = Math.round(rawValue * 100) / 100;

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
        totalIssues: allErrorLogs ? allErrorLogs.length : 0
      });

    } catch (err) { console.error("Lỗi tạo báo cáo KPI:", err); }
    setLoading(false);
  };

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const stringified = String(str);
    return `"${stringified.replace(/"/g, '""')}"`;
  };

  const handleExportExcel = () => {
    if (staffReports.length === 0) return alert('Không có dữ liệu để xuất!');
    
    let csvContent = "";
    
    csvContent += "--- PHAN 1: TONG HOP DIEM KPI ---\n";
    csvContent += "Thang,Bo phan,Nhan vien,Chi tieu,Chu ky tinh,Ket qua do luong,Diem phat,Diem chot,Diem toi da\n";
    
    staffReports.forEach(staff => {
      staff.criteriaDetails.forEach(crit => {
        csvContent += [
          escapeCSV(selectedMonth),
          escapeCSV(reportDept),
          escapeCSV(staff.full_name),
          escapeCSV(crit.name),
          escapeCSV(crit.eval_mode === 'daily_average' ? 'Trung binh Ngay' : 'Cong don ca Thang'),
          escapeCSV(crit.rawValue),
          escapeCSV(crit.penalty),
          escapeCSV(crit.score),
          escapeCSV(crit.weight)
        ].join(",") + "\n";
      });
      csvContent += [
        escapeCSV(selectedMonth),
        escapeCSV(reportDept),
        escapeCSV(staff.full_name + " (TONG KET)"),
        '""', '""', '""',
        escapeCSV("-" + staff.totalPenalty),
        escapeCSV(staff.totalScore),
        escapeCSV(staff.totalWeight)
      ].join(",") + "\n";
    });

    csvContent += "\n\n--- PHAN 2: RAW DATA - LICH SU VI PHAM THEO NGAY ---\n";
    csvContent += "Ngay,Bo phan,Nhan vien,Ten loi,Phan loai,Ma don hang,Ghi chu\n";
    
    rawExportLogs.forEach(log => {
      csvContent += [
        escapeCSV(log.date),
        escapeCSV(log.dept),
        escapeCSV(log.staffName),
        escapeCSV(log.errorName),
        escapeCSV(log.applyTo === 'individual' ? 'Ca nhan' : log.applyTo === 'warehouse' ? 'Toan kho' : 'Tap the'),
        escapeCSV(log.tracking),
        escapeCSV(log.note)
      ].join(",") + "\n";
    });

    csvContent += "\n\n--- PHAN 3: RAW DATA - CHI SO BIEN THU CONG THEO NGAY ---\n";
    csvContent += "Ngay,Ma bien,Ten bien,Gia tri\n";
    rawExportVars.forEach(v => {
      csvContent += [
        escapeCSV(v.date),
        escapeCSV(v.code),
        escapeCSV(v.name),
        escapeCSV(v.value)
      ].join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_KPI_${reportDept}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    <div className="max-w-7xl mx-auto space-y-6 pb-12 p-4 md:p-6 lg:p-8 mt-4 animate-in fade-in duration-300">
      
      <div className="bg-white p-5 md:p-8 border border-slate-200 rounded-3xl shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">
            <BarChart3 size={28} strokeWidth={2.5}/>
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight">BẢNG THỐNG KÊ KPI NHÂN SỰ</h2>
            <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">Đánh giá hiệu suất chi tiết tới từng cá nhân</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <button onClick={handleExportExcel} disabled={loading} className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2">
            <Download size={18} /> Xuất Excel
          </button>

          <div className="flex items-center w-full sm:w-auto bg-slate-50 p-2 rounded-2xl border border-slate-200/60 shadow-inner">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-200 w-full lg:w-auto">
              <CalendarDays size={18} className="text-indigo-600 shrink-0" />
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)} 
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-full" 
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center text-slate-400 font-bold bg-white rounded-3xl shadow-sm border border-slate-200">
          <Loader2 className="animate-spin mb-4 text-indigo-500" size={40}/>
          <p className="text-sm md:text-base text-center px-6">Hệ thống đang nội suy công thức và tính điểm cho từng người...</p>
        </div>
      ) : activeDepartments.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-center bg-white rounded-3xl shadow-sm border border-slate-200">
          <Target size={56} className="text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-700 mb-2">Hệ thống chưa thiết lập KPI</h3>
          <p className="text-sm font-medium text-slate-500 max-w-md px-6">Vui lòng chuyển sang mục <b className="text-indigo-600">Quản lý KPI & Lỗi</b> để cài đặt cấu trúc thưởng phạt.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {activeDepartments.map(dept => (
              <button 
                key={dept} 
                onClick={() => setReportDept(dept)} 
                className={`px-4 md:px-6 py-2.5 md:py-3 rounded-2xl text-xs md:text-sm font-black whitespace-nowrap transition-all border shadow-sm ${
                  reportDept === dept 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Nhân sự {dept}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-blue-50 opacity-50"><Users size={100}/></div>
              <p className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 relative z-10">TỔNG NHÂN SỰ</p>
              <div className="flex items-baseline gap-2 relative z-10">
                <span className="text-4xl md:text-5xl font-black tracking-tighter text-blue-600">{staffReports.length}</span>
                <span className="text-base md:text-lg font-bold text-slate-400">người</span>
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-emerald-50 opacity-50"><Activity size={100}/></div>
              <p className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 relative z-10">ĐIỂM TB KHO</p>
              <div className="flex items-baseline gap-2 relative z-10">
                <span className="text-4xl md:text-5xl font-black tracking-tighter text-emerald-600">{summary.avgScore}</span>
                <span className="text-base md:text-lg font-bold text-slate-400">điểm</span>
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-amber-200 bg-amber-50 shadow-sm relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-amber-100 opacity-50"><Award size={100}/></div>
              <p className="text-xs md:text-sm font-bold text-amber-600 uppercase tracking-wider mb-2 relative z-10">XUẤT SẮC NHẤT</p>
              <div className="text-xl md:text-2xl font-black text-amber-800 relative z-10 line-clamp-2 mt-2">{summary.topStaff || 'Chưa có'}</div>
            </div>
          </div>

          <div className="hidden md:block bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
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
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider w-1/3">Nhân sự</th>
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Tỉ trọng<br/><span className="text-[10px] font-medium normal-case">(Base)</span></th>
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Tổng Phạt<br/><span className="text-[10px] font-medium normal-case">(Penalty)</span></th>
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Điểm Đạt<br/><span className="text-[10px] font-medium normal-case">(Chốt)</span></th>
                      <th className="py-4 px-6 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffReports.map((staff, idx) => {
                      const isExpanded = expandedStaff === staff.id;
                      const scoreColor = getScoreColor(staff.totalScore, staff.totalWeight);

                      return (
                        <React.Fragment key={staff.id}>
                          <tr 
                            onClick={() => toggleExpand(staff.id)} 
                            className={`transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'} ${idx === 0 ? 'bg-amber-50/20' : ''}`}
                          >
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm border ${
                                  idx === 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
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
                              {staff.totalPenalty > 0 
                                ? <span className="inline-block px-2.5 py-1 bg-red-50 border border-red-100 text-red-600 rounded-md text-xs font-black">-{staff.totalPenalty}</span> 
                                : <span className="text-slate-300 text-sm font-bold">-</span>}
                            </td>
                            <td className="py-5 px-6 text-center">
                              <span className={`text-xl font-black ${scoreColor}`}>{staff.totalScore}</span>
                            </td>
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
                                    <table className="w-full text-left text-sm min-w-[600px]">
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
                                                <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                                                  <HelpCircle size={10}/> {crit.formula}
                                                </div>
                                              ) : (
                                                <div className="text-[10px] text-slate-400 mt-1">Đếm lỗi vi phạm trực tiếp</div>
                                              )}
                                            </td>
                                            <td className="py-4 px-5 text-center font-bold text-slate-600">
                                              {crit.rawValue} <span className="text-[10px] font-normal">{crit.calc_type === 'ratio' ? '%' : 'lượt'}</span>
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                              {crit.penalty > 0 
                                                ? <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">-{crit.penalty}</span> 
                                                : <span className="text-slate-300">-</span>}
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

          <div className="md:hidden space-y-4">
            {staffReports.length === 0 ? (
              <div className="py-16 text-center text-slate-500 font-bold bg-white rounded-2xl border border-slate-200">
                Chưa có nhân sự nào được khai báo trong bộ phận này.
              </div>
            ) : (
              staffReports.map((staff, idx) => {
                const isExpanded = expandedStaff === staff.id;
                const scoreColor = getScoreColor(staff.totalScore, staff.totalWeight);

                return (
                  <div 
                    key={staff.id} 
                    className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${
                      idx === 0 ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
                    }`}
                  >
                    <button 
                      onClick={() => toggleExpand(staff.id)} 
                      className="w-full p-4 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm border ${
                          idx === 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {idx === 0 ? <Award size={18}/> : staff.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            {staff.full_name}
                            {idx === 0 && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wider">Top 1</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium uppercase mt-0.5">{staff.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-lg font-black ${scoreColor}`}>{staff.totalScore}</div>
                          <div className="text-[10px] text-slate-400 font-medium">/ {staff.totalWeight}</div>
                        </div>
                        {isExpanded ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/80 p-4 animate-in slide-in-from-top-2 duration-300">
                        <h4 className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <FileWarning size={14}/> Bóc tách chỉ tiêu
                        </h4>
                        <div className="space-y-2">
                          {staff.criteriaDetails.map(crit => (
                            <div key={crit.id} className="bg-white rounded-xl border border-slate-200 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-bold text-sm text-slate-700">{crit.name}</div>
                                <div className={`font-black text-sm shrink-0 ${getScoreColor(crit.score, crit.weight)}`}>
                                  {crit.score}/{crit.weight}
                                </div>
                              </div>
                              {crit.formula ? (
                                <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                                  <HelpCircle size={10}/> {crit.formula}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 mt-1">Đếm lỗi vi phạm trực tiếp</div>
                              )}
                              <div className="flex items-center justify-between mt-2 text-xs">
                                <span className="text-slate-500">
                                  Kết quả: <span className="font-bold text-slate-700">{crit.rawValue} {crit.calc_type === 'ratio' ? '%' : 'lượt'}</span>
                                </span>
                                <span className="text-slate-500">
                                  Phạt: {crit.penalty > 0 
                                    ? <span className="text-red-500 font-bold">-{crit.penalty}</span> 
                                    : <span className="text-slate-300">-</span>}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}