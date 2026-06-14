import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Calendar, Package, Gauge, Clock, Users, User as UserIcon 
} from 'lucide-react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

// Hàm helper định dạng ngày YYYY-MM-DD để nhét vào thẻ input HTML5
const formatDateToInput = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export default function PackingSpeed() {
    const [activeTab, setActiveTab] = useState('general'); 
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState([]);
    
    // === BỘ LỌC ĐỘNG KHỎANG THỜI GIAN ===
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7); // Mặc định lùi 7 ngày
        return formatDateToInput(date);
    });
    const [endDate, setEndDate] = useState(() => formatDateToInput(new Date()));

    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedDate, setSelectedDate] = useState(''); 
    
    const [employeeList, setEmployeeList] = useState([]);
    const [availableDates, setAvailableDates] = useState([]);

    useEffect(() => {
        fetchPackingData();
    }, [startDate, endDate]);

    const fetchPackingData = async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        try {
            const startIso = new Date(startDate); startIso.setHours(0, 0, 0, 0);
            const endIso = new Date(endDate); endIso.setHours(23, 59, 59, 999);

            let allData = [];
            let page = 0;
            const pageSize = 1000;

            // ĐỌC DỮ LIỆU TỪ BẢNG LOG SIÊU NHẸ packing_logs
            while (true) {
                const { data, error } = await supabase
                    .from('packing_logs')
                    .select('order_id, packed_at, packed_by_name, is_multi_product')
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
            
            const employees = [...new Set(allData.map(o => o.packed_by_name))];
            setEmployeeList(employees);
            
            if (employees.length > 0 && (!selectedEmployee || !employees.includes(selectedEmployee))) {
                setSelectedEmployee(employees[0]);
            }
        } catch (error) {
            console.error("Lỗi kéo dữ liệu log đóng gói:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedEmployee) return;
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
    }, [selectedEmployee, rawData]);

    // ==========================================
    // ⚡️ THUẬT TOÁN BÁO CÁO CHUNG
    // ==========================================
    const generalStats = () => {
        const totalOrders = rawData.length;
        if (!totalOrders) return { totalOrders: 0, avgSpeedHour: 0, avgSpeedMin: 0, totalHours: 0, empCount: 0 };
        
        const uniqueDays = new Set(rawData.map(o => new Date(o.packed_at).toLocaleDateString('vi-VN'))).size || 1;
        const totalHours = uniqueDays * 8; 
        
        return { 
            totalOrders, 
            avgSpeedHour: (totalOrders / totalHours).toFixed(1), 
            avgSpeedMin: (totalOrders / totalHours / 60).toFixed(2),
            totalHours, 
            empCount: new Set(rawData.map(o => o.packed_by_name)).size 
        };
    };

    const stats = generalStats();

    const getTrendData = () => {
        const trendMap = {};
        rawData.forEach(o => {
            const dObj = new Date(o.packed_at);
            const sortKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
            if (!trendMap[sortKey]) trendMap[sortKey] = { sortKey, date: `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}`, count: 0 };
            trendMap[sortKey].count += 1;
        });

        return Object.values(trendMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(item => ({
            date: item.date,
            speedHour: +(item.count / 8).toFixed(1)
        }));
    };

    const getEmployeeTable = () => {
        const empMap = {};
        rawData.forEach(o => {
            const emp = o.packed_by_name;
            if (!empMap[emp]) empMap[emp] = { name: emp, orders: 0, workDays: new Set() };
            empMap[emp].orders += 1;
            empMap[emp].workDays.add(new Date(o.packed_at).toLocaleDateString('vi-VN'));
        });

        return Object.values(empMap).map(emp => ({
            ...emp,
            speedHour: +(emp.orders / (emp.workDays.size * 8)).toFixed(1)
        })).sort((a, b) => b.orders - a.orders); 
    };

    const empTableData = getEmployeeTable();

    // ==========================================
    // ⚡️ THUẬT TOÁN BÁO CÁO NHÂN VIÊN
    // ==========================================
    const empSpecificData = rawData.filter(o => {
        const name = o.packed_by_name || 'Hệ thống / Chưa rõ';
        if (name !== selectedEmployee) return false;
        const dObj = new Date(o.packed_at);
        return `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}` === selectedDate;
    });

    const getHourlyTable = () => {
        const hourMap = {};
        for(let i=8; i<=22; i++) hourMap[i] = { hour: `${i}:00 - ${i}:59`, total: 0, single: 0, multi: 0 };

        empSpecificData.forEach(o => {
            const h = new Date(o.packed_at).getHours();
            if (hourMap[h]) {
                hourMap[h].total += 1;
                if (!o.is_multi_product) hourMap[h].single += 1;
                else hourMap[h].multi += 1;
            }
        });
        
        return Object.values(hourMap).filter(h => h.total > 0).map(h => ({
            ...h, speedMin: +(h.total / 60).toFixed(2) 
        }));
    };

    // ⚡️ KHAI BÁO BIẾN CHUẨN SCOPE ĐỂ TRÁNH LỖI UNCAUGHT REFERENCEERROR
    const hourlyData = getHourlyTable();
    const totalEmpOrdersToday = empSpecificData.length;

    return (
        <div className="space-y-6 animate-fade-in pb-12 font-sans text-slate-800">
            {/* BỘ LỌC HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Báo cáo tốc độ đóng gói</h2>
                    <p className="text-sm text-slate-500 mt-1">Ghi vết sự kiện đóng gói chuẩn xác theo thời gian thực (Trạng thái 40)</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-1.5 px-2 py-1">
                        <span className="text-xs font-bold text-slate-400 uppercase">Từ:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer"/>
                    </div>
                    <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
                    <div className="flex items-center gap-1.5 px-2 py-1">
                        <span className="text-xs font-bold text-slate-400 uppercase">Đến:</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer"/>
                    </div>
                </div>
            </div>

            {/* TABS SWITCHER */}
            <div className="flex border-b border-slate-200">
                <button onClick={() => setActiveTab('general')} className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'general' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Báo cáo chung</button>
                <button onClick={() => setActiveTab('employee')} className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'employee' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Báo cáo nhân viên</button>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center text-slate-500 animate-pulse font-semibold">Đang tổng hợp dữ liệu đóng gói...</div>
            ) : (
                <>
                    {/* BÁO CÁO CHUNG */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            {/* 4 CARDS TỔNG QUAN */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Package size={24} /></div>
                                    <div><div className="text-sm font-semibold text-slate-500">Tổng đơn đã đóng</div><div className="text-2xl font-black text-slate-800">{stats.totalOrders.toLocaleString('vi-VN')}</div></div>
                                </div>
                                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><Gauge size={24} /></div>
                                    <div><div className="text-sm font-semibold text-slate-500">Tốc độ theo ca</div><div className="text-2xl font-black text-slate-800">{stats.avgSpeedHour} <span className="text-xs font-bold text-slate-400">Đơn/giờ</span></div><div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 inline-block px-1.5 py-0.5 rounded mt-1">~ {stats.avgSpeedMin} đơn/phút</div></div>
                                </div>
                                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Clock size={24} /></div>
                                    <div><div className="text-sm font-semibold text-slate-500">Quy đổi ca làm việc</div><div className="text-2xl font-black text-slate-800">{stats.totalHours} <span className="text-xs font-bold text-slate-400">Giờ</span></div></div>
                                </div>
                                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600"><Users size={24} /></div>
                                    <div><div className="text-sm font-semibold text-slate-500">Nhân viên kho</div><div className="text-2xl font-black text-slate-800">{stats.empCount} <span className="text-xs font-bold text-slate-400">Người</span></div></div>
                                </div>
                            </div>

                            {/* LINE CHART FULL WIDTH */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm w-full">
                                <h3 className="font-bold text-slate-800 mb-6">Tốc độ đóng gói trung bình theo ngày</h3>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={getTrendData()}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} />
                                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value) => [`${value} đơn/giờ`, 'Tốc độ TB']} />
                                            <Line type="monotone" dataKey="speedHour" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* BẢNG THỐNG KÊ NHÂN VIÊN */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 bg-slate-50/50"><h3 className="font-bold text-slate-800">Hiệu suất đóng gói theo nhân viên</h3></div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="py-3 px-4 w-12 text-center">#</th>
                                            <th className="py-3 px-4">Nhân viên</th>
                                            <th className="py-3 px-4 text-center">Tổng đơn</th>
                                            <th className="py-3 px-4 text-center">Tốc độ (Đơn/giờ)</th>
                                            <th className="py-3 px-4 text-center">Xếp loại</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {empTableData.map((emp, index) => (
                                            <tr key={emp.name} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                                                <td className="py-3 px-4 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{emp.name.charAt(0)}</div>
                                                    <div className="font-bold text-slate-800">{emp.name}</div>
                                                </td>
                                                <td className="py-3 px-4 text-center font-black text-slate-700">{emp.orders}</td>
                                                <td className="py-3 px-4 text-center font-bold text-blue-600">{emp.speedHour}</td>
                                                <td className="py-3 px-4 text-center">
                                                    {emp.name === 'Hệ thống / Chưa rõ' ? <span className="text-[10px] uppercase font-bold px-2 py-1 bg-red-100 text-red-700 rounded-md">Cần rà soát</span> : 
                                                     emp.speedHour >= 40 ? <span className="text-[10px] uppercase font-bold px-2 py-1 bg-green-100 text-green-700 rounded-md">Xuất sắc</span> : 
                                                     emp.speedHour >= 25 ? <span className="text-[10px] uppercase font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-md">Khá</span> : 
                                                     <span className="text-[10px] uppercase font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">Chậm</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* BÁO CÁO NHÂN VIÊN */}
                    {activeTab === 'employee' && (
                        <div className="space-y-6">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
                                <div className="w-64">
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Chọn nhân viên</label>
                                    <div className="relative">
                                        <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-700 appearance-none bg-slate-50">
                                            <option value="">-- Chọn nhân viên --</option>
                                            {employeeList.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                        <UserIcon size={16} className="absolute left-3 top-3 text-slate-400" />
                                    </div>
                                </div>
                                <div className="w-64">
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Chọn ngày báo cáo</label>
                                    <div className="relative">
                                        <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} disabled={availableDates.length === 0} className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-700 appearance-none bg-slate-50 disabled:opacity-50">
                                            {availableDates.length === 0 ? <option value="">Không có dữ liệu</option> : null}
                                            {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {selectedEmployee && availableDates.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-6">Hiệu suất theo giờ (Ngày {selectedDate})</h3>
                                            <div className="h-64 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={hourlyData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} />
                                                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value) => [value, 'Tổng đơn']} />
                                                        <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden">
                                            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-3xl shadow-lg mb-4 ring-4 ring-blue-50">{selectedEmployee.charAt(0)}</div>
                                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedEmployee}</h3>
                                            <p className="text-sm text-slate-500 font-bold mb-6">Báo cáo ngày: {selectedDate}</p>
                                            <div className="w-full grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Đã đóng</div>
                                                    <div className="text-2xl font-black text-blue-600">{totalEmpOrdersToday}</div>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">TB theo ca</div>
                                                    <div className="text-2xl font-black text-emerald-600">{(totalEmpOrdersToday / 8).toFixed(1)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BẢNG CHI TIẾT THEO GIỜ ĐƠN 1 SP / NHIỀU SP */}
                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                        <div className="p-4 border-b border-slate-200 bg-slate-50/50"><h3 className="font-bold text-slate-800">Chi tiết danh sách đóng gói theo giờ</h3></div>
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="py-3 px-4">Khung giờ</th>
                                                    <th className="py-3 px-4 text-center">Tổng đơn (<span className="text-blue-600">Đơn/giờ</span>)</th>
                                                    <th className="py-3 px-4 text-center text-emerald-600">Tốc độ (Đơn/phút)</th>
                                                    <th className="py-3 px-4 text-center text-blue-600">Đơn 1 SP</th>
                                                    <th className="py-3 px-4 text-center text-orange-600">Đơn nhiều SP</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {hourlyData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-3 px-4 font-bold text-slate-700 flex items-center gap-2"><Clock size={16} className="text-slate-400"/> {row.hour}</td>
                                                        <td className="py-3 px-4 text-center font-black text-slate-800">{row.total}</td>
                                                        <td className="py-3 px-4 text-center font-bold text-emerald-600">~ {row.speedMin}</td>
                                                        <td className="py-3 px-4 text-center font-bold text-blue-600 bg-blue-50/30">{row.single}</td>
                                                        <td className="py-3 px-4 text-center font-bold text-orange-600 bg-orange-50/30">{row.multi}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-20 text-slate-400 italic font-medium bg-white rounded-xl border border-slate-200 border-dashed">Vui lòng chọn nhân viên và ngày để xem báo cáo chi tiết.</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}