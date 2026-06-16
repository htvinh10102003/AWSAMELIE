import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Calendar, Package, Gauge, Clock, Users, User as UserIcon, 
    Clock3, TrendingUp, Loader2, AlertCircle, Download,
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    LineChart, Line 
} from 'recharts';

const formatDateToInput = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export default function PackingSpeed({ mode }) {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState([]); 
    const [totalHoursFromSchedule, setTotalHoursFromSchedule] = useState(0); 
    
    const [generalDate, setGeneralDate] = useState(() => formatDateToInput(new Date()));
    const [monthRawData, setMonthRawData] = useState([]);
    const [monthSchedulesData, setMonthSchedulesData] = useState([]);

    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7); 
        return formatDateToInput(date);
    });
    const [endDate, setEndDate] = useState(() => formatDateToInput(new Date()));

    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedDate, setSelectedDate] = useState(''); 
    const [employeeList, setEmployeeList] = useState([]);
    const [availableDates, setAvailableDates] = useState([]);

    useEffect(() => {
        if (mode === 'general') {
            fetchGeneralMonthData();
        } else {
            fetchPackingAndScheduleData();
        }
    }, [generalDate, startDate, endDate, mode]);

    // Danh sách trạng thái HỢP LỆ (Chỉ tính các đơn đã đóng gói xong hoặc đang đi đường)
    const ALLOWED_STATUSES = [40, 43, 59, 60, 61, 71, 72, 74];

    // ==========================================
    // ⚡ ISO 1: ĐÓNG GÓI CHUNG (ĐỌC THẲNG TỪ BẢNG ORDERS)
    // ==========================================
    const fetchGeneralMonthData = async () => {
        if (!generalDate) return;
        setLoading(true);
        try {
            const dateObj = new Date(generalDate);
            const y = dateObj.getFullYear();
            const m = dateObj.getMonth();
            const yyyyMm = generalDate.substring(0, 7);
            
            const startOfMonthIso = `${yyyyMm}-01T00:00:00.000Z`;
            const lastDay = new Date(y, m + 1, 0).getDate();
            const endOfMonthIso = `${yyyyMm}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

            let monthLogs = [];
            let page = 0;
            const pageSize = 1000;

            // ⚡️ THAY ĐỔI: Đọc trực tiếp từ bảng orders thay vì bảng packing_logs để tránh bẫy Relation lỗi
            while (true) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, packed_at, packed_by_name, status')
                    .not('packed_at', 'is', null)
                    .in('status', ALLOWED_STATUSES) // Lọc cứng Whitelist trạng thái ngay trên máy chủ
                    .gte('packed_at', startOfMonthIso)
                    .lte('packed_at', endOfMonthIso)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                
                monthLogs = monthLogs.concat(data);
                
                if (data.length < pageSize) break;
                page++;
            }

            const { data: monthScheds, error: schedError } = await supabase
                .from('working_schedules')
                .select(`
                    shift, 
                    work_date,
                    warehouse_staff(full_name, role)
                `)
                .gte('work_date', `${yyyyMm}-01`)
                .lte('work_date', `${yyyyMm}-${String(lastDay).padStart(2, '0')}`)
                .not('shift', 'eq', 'Nghỉ');

            if (schedError) throw schedError;

            const filteredPackerScheds = (monthScheds || []).filter(s => {
                const staff = s.warehouse_staff;
                const role = Array.isArray(staff) ? staff[0]?.role : staff?.role;
                return role === 'Đóng hàng';
            });

            setMonthRawData(monthLogs);
            setMonthSchedulesData(filteredPackerScheds);

            const dayLogs = monthLogs.filter(o => o.packed_at.startsWith(generalDate));
            setRawData(dayLogs);

        } catch (error) {
            console.error("Lỗi tổng hợp dữ liệu đóng gói chung:", error);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // ⚡ ISO 2: ĐÓNG GÓI THEO NHÂN SỰ
    // ==========================================
    const fetchPackingAndScheduleData = async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        try {
            const startIso = new Date(startDate); startIso.setHours(0, 0, 0, 0);
            const endIso = new Date(endDate); endIso.setHours(23, 59, 59, 999);

            let allData = [];
            let page = 0;
            const pageSize = 1000;

            while (true) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, packed_at, packed_by_name, status')
                    .not('packed_at', 'is', null)
                    .in('status', ALLOWED_STATUSES)
                    .gte('packed_at', startIso.toISOString())
                    .lte('packed_at', endIso.toISOString())
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                
                allData = allData.concat(data);
                if (data.length < pageSize) break;
                page++;
            }
            setRawData(allData);

            const { data: schedules } = await supabase
                .from('working_schedules')
                .select('shift, warehouse_staff(role)')
                .gte('work_date', startDate)
                .lte('work_date', endDate)
                .not('shift', 'eq', 'Nghỉ');

            const filteredPackerScheds = (schedules || []).filter(s => {
                const staff = s.warehouse_staff;
                const role = Array.isArray(staff) ? staff[0]?.role : staff?.role;
                return role === 'Đóng hàng';
            });

            let calculatedHours = 0;
            filteredPackerScheds.forEach(s => {
                if (s.shift === 'Cả ngày') calculatedHours += 7.5;
                else if (s.shift === 'Sáng' || s.shift === 'Chiều') calculatedHours += 3.75;
            });
            setTotalHoursFromSchedule(calculatedHours || 1);

            const employees = [...new Set(allData.map(o => o.packed_by_name).filter(Boolean))];
            setEmployeeList(employees);
            
            if (employees.length > 0 && (!selectedEmployee || !employees.includes(selectedEmployee))) {
                setSelectedEmployee(employees[0]);
            }
        } catch (error) {
            console.error("Lỗi kéo dữ liệu nhân sự:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mode !== 'employee' || !selectedEmployee) return;
        const empOrders = rawData.filter(o => o.packed_by_name === selectedEmployee);

        const dateMap = new Map();
        empOrders.forEach(o => {
            const dateObj = new Date(o.packed_at);
            const sortKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            dateMap.set(sortKey, `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`);
        });

        const sortedKeys = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
        const dates = sortedKeys.map(key => dateMap.get(key));
        
        setAvailableDates(dates);
        if (dates.length > 0 && (!selectedDate || !dates.includes(selectedDate))) {
            setSelectedDate(dates[0]);
        }
    }, [selectedEmployee, rawData, mode]);

    const handleExportRawOrdersExcel = async () => {
        try {
            const startOfDay = `${generalDate}T00:00:00.000Z`;
            const endOfDay = `${generalDate}T23:59:59.999Z`;
            
            const { data, error } = await supabase
                .from('orders')
                .select('id, packed_at, packed_by_name, status') 
                .not('packed_at', 'is', null)
                .in('status', ALLOWED_STATUSES)
                .gte('packed_at', startOfDay)
                .lte('packed_at', endOfDay)
                .order('packed_at', { ascending: true });
                
            if (error) throw error;
            
            if (!data || data.length === 0) {
                alert('Không có dữ liệu đơn hàng nào được đóng gói để xuất trong ngày này!');
                return;
            }
            
            let csvContent = "\uFEFF"; 
            csvContent += "Mã đơn hàng (ID),Thời gian đóng gói,Nhên sự thực hiện\n";
            
            data.forEach(row => {
                const timeStr = new Date(row.packed_at).toLocaleTimeString('vi-VN');
                const staffName = row.packed_by_name || 'Chưa gán / Miss';
                csvContent += `"${row.id}","${timeStr}","${staffName}"\n`;
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Amelie_Raw_Orders_${generalDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert('Gặp sự cố khi xuất file báo cáo: ' + err.message);
        }
    };

    const getGeneralHourlyDistribution = () => {
        const hourMap = {};
        for (let i = 8; i <= 22; i++) hourMap[i] = { hour: `${i}h`, 'Tổng đơn': 0 };
        rawData.forEach(o => {
            const h = new Date(o.packed_at).getHours();
            if (hourMap[h]) hourMap[h]['Tổng đơn'] += 1;
        });
        return Object.values(hourMap);
    };

    // ==========================================
    // BÓC TÁCH MA TRẬN ĐỂ HIỂN THỊ
    // ==========================================
    let dayHours = 0;
    let dayStaffCount = 0;
    let dutyStaffList = [];

    const dayScheds = monthSchedulesData.filter(s => s.work_date === generalDate);
    dayStaffCount = dayScheds.length;
    
    dutyStaffList = dayScheds.map(s => {
        const staff = s.warehouse_staff;
        const name = Array.isArray(staff) ? staff[0]?.full_name : staff?.full_name;
        return `${name || 'Ẩn danh'} (${s.shift})`;
    });

    dayScheds.forEach(s => {
        if (s.shift === 'Cả ngày') dayHours += 7.5;
        else if (s.shift === 'Sáng' || s.shift === 'Chiều') dayHours += 3.75;
    });

    const dayTotalOrders = rawData.length;
    const daySpeed = dayHours > 0 ? (dayTotalOrders / dayHours) : 0;

    let monthHours = 0;
    monthSchedulesData.forEach(s => {
        if (s.shift === 'Cả ngày') monthHours += 7.5;
        else if (s.shift === 'Sáng' || s.shift === 'Chiều') monthHours += 3.75;
    });
    const monthTotalOrders = monthRawData.length;
    const monthAvgSpeed = monthHours > 0 ? (monthTotalOrders / monthHours) : 0;
    
    const uniqueMonthDays = new Set(monthSchedulesData.map(s => s.work_date)).size || 1;
    const monthAvgOrdersPerDay = monthTotalOrders / uniqueMonthDays;

    const ordersComparePercent = monthAvgOrdersPerDay > 0 ? ((dayTotalOrders - monthAvgOrdersPerDay) / monthAvgOrdersPerDay) * 100 : 0;
    const speedComparePercent = monthAvgSpeed > 0 ? ((daySpeed - monthAvgSpeed) / monthAvgSpeed) * 100 : 0;

    const renderComparisonBadge = (percent) => {
        const isUp = percent >= 0;
        return (
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md mt-1 inline-block ${
                isUp ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
            }`}>
                {isUp ? `↑ +${percent.toFixed(1)}%` : `↓ ${percent.toFixed(1)}%`} so với TB đóng hàng/tháng
            </span>
        );
    };

    const empSpecificData = rawData.filter(o => {
        if (o.packed_by_name !== selectedEmployee) return false;
        const dObj = new Date(o.packed_at);
        return `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}` === selectedDate;
    });

    // ⚡️ BƯỚC 2: CHẠY HÀM TÍNH TOÁN THEO GIỜ DỰA TRÊN BIẾN TRÊN
    const getEmployeeHourlyTable = () => {
        const hourMap = {};
        for(let i = 8; i <= 22; i++) hourMap[i] = { hour: `${i}:00 - ${i}:59`, total: 0 };
        
        empSpecificData.forEach(o => {
            const h = new Date(o.packed_at).getHours();
            if (hourMap[h]) {
                hourMap[h].total += 1;
            }
        });
        return Object.values(hourMap).filter(h => h.total > 0).map(h => ({
            ...h, speedMin: +(h.total / 60).toFixed(2) 
        }));
    };

    // ⚡️ BƯỚC 3: ĐỔ RA BIẾN SCOPE CHUẨN ĐỂ RENDER XUỐNG JSX
    const employeeHourlyData = getEmployeeHourlyTable();

    return (
        <div className="space-y-6 animate-fade-in pb-12 font-sans text-slate-800">
            {/* BỘ LỌC HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                        {mode === 'general' ? 'Thống kê đóng gói chung' : 'Hiệu suất theo nhân sự'}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Dữ liệu phân tích hiệu suất đóng gói chung toàn kho</p>
                </div>
                
                {mode === 'general' ? (
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                            <Calendar size={16} className="text-slate-400 mr-2" />
                            <input 
                                type="date" 
                                value={generalDate} 
                                onChange={e => setGeneralDate(e.target.value)} 
                                className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
                            />
                        </div>
                        <button
                            onClick={handleExportRawOrdersExcel}
                            disabled={loading || rawData.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Download size={14} /> Xuất Excel đơn RAW
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                        <div className="flex items-center gap-1.5 px-2 py-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Từ:</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"/>
                        </div>
                        <div className="h-4 w-[1px] bg-slate-200" />
                        <div className="flex items-center gap-1.5 px-2 py-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Đến:</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"/>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs font-bold bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <Loader2 size={28} className="animate-spin text-blue-500" />
                    Đang tính toán phân phối hiệu suất...
                </div>
            ) : (
                <>
                    {/* KHỐI 1: HIỂN THỊ ĐÓNG GÓI CHUNG */}
                    {mode === 'general' && (
                        <div className="space-y-6">
                            
                            {/* BANNER THÔNG BÁO NẾU CHƯA CẬP NHẬT LỊCH LÀM VIỆC */}
                            {dayStaffCount === 0 && (
                                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm animate-pulse">
                                    <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
                                    <span>⚠️ Hệ thống phát hiện chưa cập nhật lịch làm việc cho ngày {new Date(generalDate).toLocaleDateString('vi-VN')}. Vui lòng bổ sung lịch trình của bộ phận Đóng hàng để tính toán KPI chính xác!</span>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Package size={22} /></div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Số đơn đóng gói trong ngày</div>
                                        <div className="text-2xl font-black text-slate-800">{dayTotalOrders.toLocaleString('vi-VN')} <span className="text-xs text-slate-400 font-medium">đơn</span></div>
                                        {renderComparisonBadge(ordersComparePercent)}
                                    </div>
                                </div>
                                
                                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><Gauge size={22} /></div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tốc độ đóng gói trung bình</div>
                                        <div className="text-2xl font-black text-emerald-600">{daySpeed.toFixed(1)} <span className="text-xs font-bold text-slate-400">đơn/giờ</span></div>
                                        {renderComparisonBadge(speedComparePercent)}
                                    </div>
                                </div>

                                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600"><Users size={22} /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nhân sự đóng gói</div>
                                        <div className="text-2xl font-black text-slate-800">{dayStaffCount} <span className="text-xs text-slate-400 font-medium">người</span></div>
                                        <div className="text-[10px] font-bold text-slate-500 truncate mt-1 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 block" title={dutyStaffList.join(', ') || 'Chưa xếp lịch'}>
                                            {dutyStaffList.length > 0 ? dutyStaffList.join(', ') : '❌ Chưa có lịch trực'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DÒNG HIỂN THỊ TRUNG BÌNH THÁNG TÍCH LŨY */}
                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-700/50 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/10 text-amber-400 rounded-xl"><TrendingUp size={20} /></div>
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Hiệu suất tháng</h4>
                                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">Thống kê từ ngày 01 đến hết tháng {new Date(generalDate).toLocaleDateString('vi-VN', {month: '2-digit', year: 'numeric'})}. Cần cập nhật đúng đủ lịch làm việc để có kết quả chính xác!</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 w-full md:w-auto text-center md:text-left">
                                    <div className="border-r border-slate-700/60 pr-4 last:border-0">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng đơn tháng</span>
                                        <span className="text-base font-black text-white mt-0.5 block">{monthTotalOrders.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">đơn</span></span>
                                    </div>
                                    <div className="border-r border-slate-700/60 pr-4 last:border-0">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">TB sản lượng/ngày</span>
                                        <span className="text-base font-black text-amber-400 mt-0.5 block">{monthAvgOrdersPerDay.toFixed(1)} <span className="text-xs font-normal text-slate-400">đ/ngày</span></span>
                                    </div>
                                    <div className="border-r border-slate-700/60 pr-4 last:border-0">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng giờ công đóng gói</span>
                                        <span className="text-base font-black text-white mt-0.5 block">{monthHours.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">giờ</span></span>
                                    </div>
                                    <div className="pr-4 last:border-0">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tốc độ TB tháng</span>
                                        <span className="text-base font-black text-emerald-400 mt-0.5 block">{monthAvgSpeed.toFixed(1)} <span className="text-xs font-normal text-slate-400">đ/giờ</span></span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Clock3 size={14}/> Sơ đồ phân phối sản lượng đóng gói theo khung giờ trong ngày</h4>
                                <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={getGeneralHourlyDistribution()}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 700}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 700}} />
                                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 'bold' }} />
                                            <Bar dataKey="Tổng đơn" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ======================================================= */}
                    {/* KHỐI 2: HIỂN THỊ ĐÓNG GÓI THEO NHÂN SỰ */}
                    {/* ======================================================= */}
                    {mode === 'employee' && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-center gap-4">
                                <div className="w-56">
                                    <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Chọn nhân viên</label>
                                    <div className="relative">
                                        <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-white font-bold text-slate-700 appearance-none cursor-pointer">
                                            <option value="">-- Chọn nhân viên --</option>
                                            {employeeList.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                        <UserIcon size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                    </div>
                                </div>
                                <div className="w-56">
                                    <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Chọn ngày báo cáo</label>
                                    <div className="relative">
                                        <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} disabled={availableDates.length === 0} className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-white font-bold text-slate-700 appearance-none disabled:opacity-50 cursor-pointer">
                                            {availableDates.length === 0 ? <option value="">Không có dữ liệu</option> : null}
                                            {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {selectedEmployee && availableDates.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="lg:col-span-2 bg-slate-50/30 p-5 rounded-xl border border-slate-100 shadow-sm">
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5"><TrendingUp size={14}/> Diễn tiến năng suất đóng gói theo giờ</h4>
                                            <div className="h-60 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={employeeHourlyData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 700}} dy={10} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 700}} />
                                                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 'bold' }} formatter={(value) => [value, 'Sản lượng đơn']} />
                                                        <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center shadow-sm">
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-2xl shadow-md mb-3 ring-4 ring-blue-50 uppercase">{selectedEmployee.charAt(0)}</div>
                                            <h3 className="text-base font-black text-slate-800 mb-0.5">{selectedEmployee}</h3>
                                            <p className="text-[10px] text-slate-400 font-bold mb-5 tracking-wide">BÁO CÁO CA NGÀY: {selectedDate}</p>
                                            <div className="w-full grid grid-cols-2 gap-3">
                                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Đã hoàn thành</div>
                                                    <div className="text-xl font-black text-blue-600">{empSpecificData.length} <span className="text-[10px] text-slate-400 font-bold">đơn</span></div>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tốc độ TB ca</div>
                                                    <div className="text-xl font-black text-emerald-600">{(empSpecificData.length / 7.5).toFixed(1)} <span className="text-[10px] text-slate-400 font-bold">đ/h</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="p-3.5 border-b border-slate-100 bg-slate-50/50"><h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Chi tiết cơ cấu sản phẩm đóng gói từng giờ</h4></div>
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase">
                                                <tr>
                                                    <th className="py-3 px-4">Khung giờ thao tác</th>
                                                    <th className="py-3 px-4 text-center">Tổng đơn</th>
                                                    <th className="py-3 px-4 text-center text-emerald-600">Tốc độ thực tế (đơn/phút)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                                {employeeHourlyData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-3 px-4 font-bold text-slate-600 flex items-center gap-2"><Clock3 size={14} className="text-slate-400"/> {row.hour}</td>
                                                        <td className="py-3 px-4 text-center font-black text-slate-800">{row.total}</td>
                                                        <td className="py-3 px-4 text-center font-bold text-emerald-600">~ {row.speedMin} đ/phút</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-14 text-xs font-bold text-slate-400 italic bg-slate-50/50 rounded-xl border border-slate-200/60 border-dashed">
                                    💡 Vui lòng lựa chọn nhân viên và ngày công tác ở thanh trên để bóc tách báo cáo chi tiết.
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}