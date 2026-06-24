import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Loader2, CheckCircle2, AlertTriangle, XCircle, Target } from 'lucide-react';

export default function KPI_Report() {
  const getFirstDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
  
  const [startDate, setStartDate] = useState(getFirstDay());
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDept, setReportDept] = useState(''); // Không code cứng nữa, sẽ tự động gán
  const [loading, setLoading] = useState(false);
  
  // States mới để quản lý động các Tab bộ phận
  const [activeDepartments, setActiveDepartments] = useState([]);
  const [kpiResults, setKpiResults] = useState([]);

  useEffect(() => {
    generateReport();
  }, [startDate, endDate, reportDept]);

  const generateReport = async () => {
    setLoading(true);
    try {
      // 1. Lấy TẤT CẢ công thức KPI trong hệ thống để xem bộ phận nào đang có luật
      const { data: allConfigs } = await supabase.from('kpi_configs').select('*');
      
      // NẾU HỆ THỐNG TRẮNG TRƠN (CHƯA CÓ KPI NÀO)
      if (!allConfigs || allConfigs.length === 0) {
        setActiveDepartments([]);
        setKpiResults([]);
        setLoading(false);
        return;
      }

      // 2. Lọc ra danh sách các bộ phận ĐÃ CÓ CÀI KPI (Xóa trùng lặp)
      const depts = [...new Set(allConfigs.map(c => c.department))];
      setActiveDepartments(depts);

      // Nếu bộ phận đang chọn không có trong danh sách (hoặc load lần đầu), tự nhảy sang bộ phận đầu tiên có KPI
      let currentDept = reportDept;
      if (!depts.includes(currentDept)) {
        currentDept = depts[0];
        setReportDept(currentDept);
      }

      // Lọc ra các công thức KPI chỉ thuộc về bộ phận đang chọn
      const deptConfigs = allConfigs.filter(c => c.department === currentDept);
      
      // 3. Chọc DB đếm các biến số thực tế (Variables)
      const { count: tongIn } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('printed_at', `${startDate}T00:00:00Z`).lte('printed_at', `${endDate}T23:59:59Z`);
      const { count: tongDi } = await supabase.from('orders').select('*', { count: 'exact', head: true }).gte('carrier_date', `${startDate}T00:00:00Z`).lte('carrier_date', `${endDate}T23:59:59Z`);
      const { count: tongDong } = await supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', [40, 42]).gte('created_at', `${startDate}T00:00:00Z`).lte('created_at', `${endDate}T23:59:59Z`);

      // Đếm tất cả các lỗi xảy ra trong kỳ
      const { data: errorLogs } = await supabase.from('order_errors').select('error_id').gte('error_date', startDate).lte('error_date', endDate);
      
      // Nhóm lỗi lại thành object { id_1: 5, id_2: 10 }
      const errorCounts = {};
      (errorLogs || []).forEach(log => {
          errorCounts[log.error_id] = (errorCounts[log.error_id] || 0) + 1;
      });

      // 4. Tiến hành lắp ráp biến số vào từng công thức và tính toán (Processor)
      const results = (deptConfigs || []).map(kpi => {
        let mathStr = kpi.formula;
        
        // Thay biến gốc
        mathStr = mathStr.replace(/\[TONG_IN\]/g, tongIn || 0);
        mathStr = mathStr.replace(/\[TONG_DI\]/g, tongDi || 1); // Tránh chia cho 0
        mathStr = mathStr.replace(/\[TONG_DONG\]/g, tongDong || 1);

        // Thay biến lỗi động bằng Regex
        mathStr = mathStr.replace(/\[LOI_ID_(\d+)\]/g, (match, idStr) => {
            return errorCounts[parseInt(idStr, 10)] || 0;
        });

        // Cỗ máy toán học (Thực thi chuỗi phép tính)
        let finalValue = 0;
        try {
            finalValue = new Function('return ' + mathStr)();
        } catch (e) { console.error("Lỗi công thức:", kpi.kpi_name); }

        // Định dạng làm tròn 2 chữ số thập phân
        finalValue = Math.round(finalValue * 100) / 100;

        // Đánh giá Trạng thái (Status)
        let status = 'green';
        if (finalValue > kpi.target_green && finalValue <= kpi.target_yellow) status = 'yellow';
        if (finalValue > kpi.target_yellow) status = 'red';

        return { ...kpi, finalValue, status };
      });

      setKpiResults(results);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 p-4 mt-4 animate-in fade-in">
      {/* HEADER BÁO CÁO */}
      <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Activity className="text-indigo-600"/> Báo Cáo KPI Tổng Hợp
          </h2>
          <p className="text-xs text-slate-500 mt-1">Dữ liệu được bóc tách và tính toán hoàn toàn tự động bằng công thức động.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border w-full md:w-auto">
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full md:w-auto" />
          <span className="text-slate-400">-</span>
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full md:w-auto" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center text-slate-400 font-bold bg-white rounded-3xl shadow-sm border border-slate-200">
          <Loader2 className="animate-spin mb-2 text-indigo-500" size={32}/> Hệ thống đang tính toán công thức...
        </div>
      ) : activeDepartments.length === 0 ? (
        /* MÀN HÌNH TRỐNG: KHI CHƯA CÓ BẤT KỲ KPI NÀO TRONG HỆ THỐNG */
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-3xl shadow-sm border border-slate-200 border-dashed">
          <div className="p-5 bg-indigo-50 rounded-full mb-4">
            <Target size={48} className="text-indigo-300" />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Hệ thống chưa thiết lập KPI</h3>
          <p className="text-sm font-medium text-slate-500 max-w-md">
            Hiện tại chưa có bất kỳ công thức KPI nào được cài đặt. Vui lòng chuyển sang mục <b className="text-indigo-600">Hệ thống &gt; Quản lý KPI & Lỗi</b> để thiết lập luật đo lường cho các bộ phận.
          </p>
        </div>
      ) : (
        <>
          {/* CHỈ HIỆN TAB CHO CÁC BỘ PHẬN ĐÃ CÓ KPI */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeDepartments.map(dept => (
              <button 
                key={dept} 
                onClick={() => setReportDept(dept)} 
                className={`px-6 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all border ${reportDept === dept ? 'bg-indigo-600 text-white shadow-md border-indigo-600' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                Báo cáo {dept}
              </button>
            ))}
          </div>

          {/* LƯỚI KẾT QUẢ ĐỘNG */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kpiResults.map(kpi => {
              const isRatio = kpi.kpi_type === 'ratio';
              const isGreen = kpi.status === 'green';
              const isYellow = kpi.status === 'yellow';

              return (
                <div key={kpi.id} className={`bg-white p-5 rounded-3xl shadow-sm border-y border-r border-l-8 hover:-translate-y-1 transition-transform ${isGreen ? 'border-l-emerald-500' : isYellow ? 'border-l-amber-500' : 'border-l-red-500'}`}>
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kpi.kpi_name}</div>
                    <div className={`p-1.5 rounded-lg ${isGreen ? 'bg-emerald-50 text-emerald-600' : isYellow ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                      {isGreen ? <CheckCircle2 size={16}/> : isYellow ? <AlertTriangle size={16}/> : <XCircle size={16}/>}
                    </div>
                  </div>
                  
                  <div className="text-4xl font-black text-slate-800 my-3 flex items-baseline gap-1">
                    {kpi.finalValue} <span className="text-sm font-medium text-slate-400">{isRatio ? '%' : 'lượt'}</span>
                  </div>
                  
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Công thức thực thi:</div>
                    <div className="text-[11px] font-mono text-indigo-700 font-bold break-words">{kpi.formula}</div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-[11px] font-bold text-slate-500">
                      Mốc đánh giá: Xanh(&le;{kpi.target_green}) | Đỏ(&gt;{kpi.target_yellow})
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isGreen ? 'bg-emerald-100 text-emerald-700' : isYellow ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {isGreen ? 'Tốt' : isYellow ? 'Chú ý' : 'Vi phạm'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}