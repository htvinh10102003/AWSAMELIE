import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Calendar, Package, Gauge, Users, 
    TrendingUp, Loader2, AlertCircle, Download, Table,
    ChevronRight, CheckCircle2
} from 'lucide-react';

const formatDateToInput = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const getLocalDateStr = (isoString) => {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function PackingSpeed() {
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [selectedDate, setSelectedDate] = useState(() => formatDateToInput(new Date()));
    const [viewType, setViewType] = useState('daily');
    
    // Data State (chứa dữ liệu của cả 1 tháng để filter local)
    const [monthRawData, setMonthRawData] = useState([]);
    const [monthSchedulesData, setMonthSchedulesData] = useState([]);
    const [loadedMonth, setLoadedMonth] = useState('');

    const ALLOWED_STATUSES = [40, 43, 59, 60, 61, 71, 72, 74];

    // ==========================================
    // 1. DATA FETCHING (Tối ưu: Chỉ tải khi đổi tháng)
    // ==========================================
    useEffect(() => {
        if (!selectedDate) return;
        const currentMonth = selectedDate.substring(0, 7); // Format: YYYY-MM
        
        // Nếu đã tải dữ liệu của tháng này rồi thì bỏ qua, tận dụng cache
        if (currentMonth !== loadedMonth) {
            fetchMonthData(currentMonth);
        }
    }, [selectedDate]);

    const fetchMonthData = async (yyyyMm) => {
        setLoading(true);
        try {
            const parts = yyyyMm.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            
            // Tính toán ISO bounds theo timezone local để query chính xác
            const startIso = new Date(y, m, 1, 0, 0, 0).toISOString();
            const endIso = new Date(y, m + 1, 0, 23, 59, 59, 999).toISOString();

            let allMonthOrders = [];
            let page = 0;
            const pageSize = 1000;

            // Kéo toàn bộ đơn hàng trong tháng
            while (true) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, packed_at, packed_by_name, status, sale_channel')
                    .not('packed_at', 'is', null)
                    .in('status', ALLOWED_STATUSES)
                    .gte('packed_at', startIso)
                    .lte('packed_at', endIso)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;
                
                allMonthOrders = allMonthOrders.concat(data);
                if (data.length < pageSize) break;
                page++;
            }

            // Kéo toàn bộ lịch trực trong tháng
            const { data: monthScheds, error: schedError } = await supabase
                .from('working_schedules')
                .select(`shift, work_date, warehouse_staff(full_name, role)`)
                .gte('work_date', `${yyyyMm}-01`)
                .lte('work_date', `${yyyyMm}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`)
                .not('shift', 'eq', 'Nghỉ');

            if (schedError) throw schedError;

            // Lọc ra nhân sự đóng hàng
            const filteredPackerScheds = (monthScheds || []).filter(s => {
                const staff = s.warehouse_staff;
                const role = Array.isArray(staff) ? staff[0]?.role : staff?.role;
                return role === 'Đóng hàng';
            });

            setMonthRawData(allMonthOrders);
            setMonthSchedulesData(filteredPackerScheds);
            setLoadedMonth(yyyyMm);
            
        } catch (error) {
            console.error("Lỗi tải dữ liệu đóng gói:", error);
            alert("Gặp sự cố khi tải dữ liệu. Vui lòng tải lại trang.");
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // 2. DATA PROCESSING (Sử dụng useMemo để tính toán tức thời)
    // ==========================================

    // Lọc dữ liệu của ngày đang chọn (Instant Switch)
    const dayData = useMemo(() => {
        return monthRawData.filter(o => getLocalDateStr(o.packed_at) === selectedDate);
    }, [monthRawData, selectedDate]);

    const dayScheds = useMemo(() => {
        return monthSchedulesData.filter(s => s.work_date === selectedDate);
    }, [monthSchedulesData, selectedDate]);

    const dayMetrics = useMemo(() => {
        let hours = 0;
        const staffList = [];
        
        dayScheds.forEach(s => {
            const name = Array.isArray(s.warehouse_staff) ? s.warehouse_staff[0]?.full_name : s.warehouse_staff?.full_name;
            staffList.push(`${name || 'Ẩn danh'} (${s.shift})`);
            
            if (s.shift === 'Cả ngày') hours += 7.5;
            else if (s.shift === 'Sáng' || s.shift === 'Chiều') hours += 3.75;
        });

        const totalOrders = dayData.length;
        const speed = hours > 0 ? (totalOrders / hours) : 0;

        return { hours, staffCount: dayScheds.length, staffList, totalOrders, speed };
    }, [dayData, dayScheds]);

    const monthMetrics = useMemo(() => {
        let hours = 0;
        monthSchedulesData.forEach(s => {
            if (s.shift === 'Cả ngày') hours += 7.5;
            else if (s.shift === 'Sáng' || s.shift === 'Chiều') hours += 3.75;
        });

        const totalOrders = monthRawData.length;
        const avgSpeed = hours > 0 ? (totalOrders / hours) : 0;
        
        const uniqueDays = new Set(monthSchedulesData.map(s => s.work_date)).size || 1;
        const avgOrdersPerDay = totalOrders / uniqueDays;

        return { totalOrders, hours, avgSpeed, avgOrdersPerDay };
    }, [monthRawData, monthSchedulesData]);

    const monthlySummaryData = useMemo(() => {
        const summaryMap = {};
        
        monthSchedulesData.forEach(s => {
            if (!summaryMap[s.work_date]) {
                summaryMap[s.work_date] = { date: s.work_date, orders: 0, staffDetailsSet: new Set() };
            }
            const name = Array.isArray(s.warehouse_staff) ? s.warehouse_staff[0]?.full_name : s.warehouse_staff?.full_name;
            if (name && s.shift) summaryMap[s.work_date].staffDetailsSet.add(`${name} (${s.shift})`);
        });

        monthRawData.forEach(o => {
            const dStr = getLocalDateStr(o.packed_at);
            if (!summaryMap[dStr]) summaryMap[dStr] = { date: dStr, orders: 0, staffDetailsSet: new Set() };
            summaryMap[dStr].orders += 1;
        });

        return Object.values(summaryMap).map(item => ({
            date: item.date,
            orders: item.orders,
            staffDetails: Array.from(item.staffDetailsSet)
        })).sort((a, b) => a.date.localeCompare(b.date));
    }, [monthRawData, monthSchedulesData]);

    // Các phép so sánh tăng/giảm phần trăm
    const ordersComparePercent = monthMetrics.avgOrdersPerDay > 0 ? ((dayMetrics.totalOrders - monthMetrics.avgOrdersPerDay) / monthMetrics.avgOrdersPerDay) * 100 : 0;
    const speedComparePercent = monthMetrics.avgSpeed > 0 ? ((dayMetrics.speed - monthMetrics.avgSpeed) / monthMetrics.avgSpeed) * 100 : 0;

    // ==========================================
    // 3. HANDLERS (Xuất Excel Instant - Không gọi API)
    // ==========================================
    const handleExportDailyExcel = () => {
        if (dayData.length === 0) return alert('Không có dữ liệu đơn hàng nào được đóng gói trong ngày này!');
        
        let csvContent = "\uFEFFMã đơn hàng (ID),Thời gian đóng gói,Nhân sự thực hiện\n";
        
        // Sắp xếp dữ liệu local theo thời gian
        const sortedData = [...dayData].sort((a, b) => new Date(a.packed_at) - new Date(b.packed_at));

        sortedData.forEach(row => {
            const timeStr = new Date(row.packed_at).toLocaleTimeString('vi-VN');
            const staffName = row.packed_by_name || 'Chưa xác định';
            csvContent += `"${row.id}","${timeStr}","${staffName}"\n`;
        });
        
        downloadCSV(csvContent, `Amelie_Raw_Orders_${selectedDate}.csv`);
    };

    const handleExportMonthlyExcel = () => {
        if (monthlySummaryData.length === 0) return alert('Không có dữ liệu trong tháng này!');

        let csvContent = "\uFEFFNgày,Số lượng đơn đóng được,Chi tiết nhân sự trực\n";
        
        monthlySummaryData.forEach(row => {
            const dateVN = row.date.split('-').reverse().join('/');
            const staffString = row.staffDetails.length > 0 ? row.staffDetails.join(' | ') : 'Chưa xếp lịch';
            csvContent += `"${dateVN}","${row.orders}","${staffString}"\n`;
        });
        
        downloadCSV(csvContent, `Amelie_Monthly_Summary_${loadedMonth}.csv`);
    };

    const downloadCSV = (csvContent, fileName) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // UI Helper Component
    const renderComparisonBadge = (percent) => {
        const isUp = percent >= 0;
        return (
            <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded mt-1.5 border transition-all ${
                isUp ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200' : 'bg-rose-50/80 text-rose-700 border-rose-200'
            }`}>
                <span>{isUp ? '↑' : '↓'}</span>
                <span>{Math.abs(percent).toFixed(1)}%</span>
                <span className="font-medium opacity-80">so với TB tháng</span>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans text-slate-800 animate-fade-in relative">
            
            {/* OVERLAY LOADING MƯỢT MÀ */}
            {loading && (
                <div className="absolute inset-0 z-50 bg-slate-50/60 backdrop-blur-[2px] flex items-center justify-center rounded-3xl">
                    <div className="flex flex-col items-center justify-center gap-3 bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                        <Loader2 size={32} className="animate-spin text-blue-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Đang tải dữ liệu...</span>
                    </div>
                </div>
            )}

            {/* HEADER & CONTROLS */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><Package size={18} /></div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Tốc độ đóng gói kho</h2>
                    </div>
                    <p className="text-sm text-slate-500 font-medium ml-10">Phân tích hiệu suất xử lý đơn hàng chung toàn kho</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                        <button 
                            onClick={() => setViewType('daily')}
                            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${viewType === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Ngày
                        </button>
                        <button 
                            onClick={() => setViewType('monthly')}
                            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${viewType === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Tháng
                        </button>
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-100 transition-colors cursor-pointer group">
                        <Calendar size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors mr-2.5" />
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                            className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer w-full sm:w-auto"
                        />
                    </div>
                    
                    {/* Export Button */}
                    <button
                        onClick={viewType === 'daily' ? handleExportDailyExcel : handleExportMonthlyExcel}
                        disabled={loading || (viewType === 'daily' ? dayData.length === 0 : monthlySummaryData.length === 0)}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <Download size={16} className="group-hover:-translate-y-0.5 transition-transform" /> 
                        Xuất Excel
                    </button>
                </div>
            </div>

            {/* CẢNH BÁO THIẾU LỊCH TRỰC */}
            {viewType === 'daily' && dayMetrics.staffCount === 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start gap-3 text-sm font-medium shadow-sm animate-slide-down">
                    <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <strong className="block font-bold text-amber-900 mb-0.5">Phát hiện thiếu dữ liệu lịch làm việc!</strong>
                        Hệ thống ghi nhận chưa có lịch trực của bộ phận Đóng hàng trong ngày <b>{new Date(selectedDate).toLocaleDateString('vi-VN')}</b>. Hãy bổ sung để hệ thống tính toán tốc độ chính xác.
                    </div>
                </div>
            )}
            
            {/* MAIN CONTENT AREA */}
            <div className="space-y-6 min-h-[400px]">
                
                {/* ---------------- CHẾ ĐỘ XEM NGÀY ---------------- */}
                {viewType === 'daily' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* 3 KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4 group">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-105 transition-transform"><Package size={26} /></div>
                                <div className="flex-1">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng số đơn</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-slate-800">{dayMetrics.totalOrders.toLocaleString('vi-VN')}</span>
                                        <span className="text-sm font-bold text-slate-400">đơn</span>
                                    </div>
                                    {renderComparisonBadge(ordersComparePercent)}
                                </div>
                            </div>
                            
                            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4 group">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner group-hover:scale-105 transition-transform"><Gauge size={26} /></div>
                                <div className="flex-1">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tốc độ trung bình</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-emerald-600">{dayMetrics.speed.toFixed(1)}</span>
                                        <span className="text-sm font-bold text-slate-400">đơn/giờ</span>
                                    </div>
                                    {renderComparisonBadge(speedComparePercent)}
                                </div>
                            </div>

                            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4 group">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-105 transition-transform"><Users size={26} /></div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nhân sự thực hiện</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-slate-800">{dayMetrics.staffCount}</span>
                                        <span className="text-sm font-bold text-slate-400">người</span>
                                    </div>
                                    <div className="text-[11px] font-semibold text-slate-500 truncate mt-2 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 inline-block max-w-full" title={dayMetrics.staffList.join(', ')}>
                                        {dayMetrics.staffList.length > 0 ? dayMetrics.staffList.join(', ') : 'Chưa có lịch trực'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Banner Thống Kê Tháng Context */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-lg border border-slate-700/50 p-6 md:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                            {/* Decorative Blur */}
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
                            
                            <div className="flex items-start gap-4 z-10 max-w-sm">
                                <div className="p-3 bg-white/10 text-white rounded-2xl backdrop-blur-md shadow-inner"><TrendingUp size={24} /></div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                                        Thống kê toàn tháng {loadedMonth.split('-')[1]} <CheckCircle2 size={16} className="text-emerald-400"/>
                                    </h4>
                                    <p className="text-xs text-slate-300 font-medium mt-1.5 leading-relaxed opacity-90">
                                        Báo cáo tổng hợp từ ngày 01 đến ngày cuối cùng của tháng, giúp bạn so sánh và nhìn nhận được tổng quan hiệu suất trong chu kỳ.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full lg:w-auto z-10">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng lượng đơn</span>
                                    <span className="text-xl font-black text-white">{monthMetrics.totalOrders.toLocaleString('vi-VN')}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Trung bình/ngày</span>
                                    <span className="text-xl font-black text-amber-400">{monthMetrics.avgOrdersPerDay.toFixed(1)}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng giờ công</span>
                                    <span className="text-xl font-black text-white">{monthMetrics.hours.toLocaleString('vi-VN')}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tốc độ TB tháng</span>
                                    <span className="text-xl font-black text-emerald-400">{monthMetrics.avgSpeed.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------- CHẾ ĐỘ XEM THÁNG ---------------- */}
                {viewType === 'monthly' && (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-fade-in flex flex-col">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><Table size={16} /></div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Bảng nhật ký năng suất chi tiết tháng {loadedMonth}
                            </h4>
                        </div>
                        
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="py-4 px-6">Ngày</th>
                                        <th className="py-4 px-6 text-center">Số lượng đơn</th>
                                        <th className="py-4 px-6">Trạng thái nhân sự</th>
                                        <th className="py-4 px-6 text-right">Tác vụ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {monthlySummaryData.length > 0 ? monthlySummaryData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="py-4 px-6 font-bold text-slate-800 whitespace-nowrap">
                                                {row.date.split('-').reverse().join('/')}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className="inline-block px-3 py-1 bg-slate-100 font-black text-slate-700 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                                                    {row.orders.toLocaleString('vi-VN')}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                {row.staffDetails.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {row.staffDetails.map((staff, i) => (
                                                            <span key={i} className="inline-block bg-white text-[11px] font-bold text-slate-600 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
                                                                {staff}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic font-medium text-xs">Chưa cập nhật lịch</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedDate(row.date);
                                                        setViewType('daily');
                                                    }}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100"
                                                >
                                                    Xem ngày <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="4" className="py-16 text-center text-slate-500 bg-slate-50/50">
                                                <Package size={40} className="mx-auto text-slate-300 mb-3" />
                                                <p className="font-semibold text-sm">Chưa có dữ liệu đóng gói trong tháng này</p>
                                                <p className="text-xs text-slate-400 mt-1">Dữ liệu sẽ xuất hiện khi có đơn hàng được chuyển sang trạng thái "Đã đóng gói".</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}