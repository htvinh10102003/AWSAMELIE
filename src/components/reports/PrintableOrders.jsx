import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function PrintableOrders() {
    const [orders, setOrders] = useState({ printable: [], holding: [], outOfStock: [], invalidCount: 0 });
    const [loading, setLoading] = useState(true);
    const [statusDict, setStatusDict] = useState({});

    useEffect(() => {
        fetchStatusDict();
        fetchAllocation();
    }, []);

    const fetchStatusDict = async () => {
        const { data } = await supabase.from('order_statuses').select('*');
        const dict = {};
        data?.forEach(s => dict[s.id] = s.name);
        setStatusDict(dict);
    };

    const fetchAllocation = async () => {
        setLoading(true);
        try {
            // GỌI THẲNG XUỐNG BACKEND, ĐỂ SERVER LO HẾT!
            const { data, error } = await supabase.functions.invoke('wms-allocation');
            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            setOrders(data);
        } catch (error) {
            console.error("Lỗi Backend Allocation:", error);
            alert("Có lỗi xảy ra khi chia tồn kho: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 font-semibold animate-pulse">Đang yêu cầu Backend xử lý chia tồn kho...</div>;

    const OrderCard = ({ order, type }) => (
        <div className="p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <span className="font-bold text-blue-700 block">#{order.id}</span>
                    <span className="text-[11px] text-gray-400">{new Date(order.created_at).toLocaleString('vi-VN')}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${['40', '42'].includes(String(order.status)) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {statusDict[order.status] || `Mã ${order.status}`}
                </span>
            </div>

            {type !== 'printable' && order.debug_shortItems?.length > 0 && (
                <div className="mt-2 bg-red-50 p-2 rounded-lg border border-red-100">
                    <p className="text-[10px] font-bold text-red-600 mb-1">⚠️ Nợ hàng:</p>
                    <ul className="text-[10px] text-red-600 space-y-1">
                        {order.debug_shortItems.map((item, idx) => (
                            <li key={idx} className="flex flex-col border-b border-red-100 last:border-0 pb-1">
                                <span className="font-semibold truncate">- {item.name}</span>
                                <span className="ml-2 mt-0.5">Cần: <b>{item.req}</b> | Xí: <b className="text-orange-500">{item.allocated}</b> | Nợ: <b>{item.missing}</b></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mt-3 pt-3 border-t flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium truncate max-w-[120px]">{order.carrier_name || 'Chưa rõ hãng VC'}</span>
                <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">{order.order_products?.length || 0} SP</span>
            </div>
        </div>
    );

    return (
        <div className="bg-white p-6 rounded-xl border shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Phân Bổ Tồn Kho</h3>
                    {orders.invalidCount > 0 && <p className="text-sm text-red-500 mt-1 font-medium">⚠️ Ẩn {orders.invalidCount} đơn mất dữ liệu sản phẩm.</p>}
                </div>
                <button onClick={fetchAllocation} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-100 transition">
                    🔄 Đồng bộ Backend
                </button>
            </div>

            <div className="grid grid-cols-3 gap-6">
                <div className="border-t-4 border-t-green-500 rounded-b-xl bg-gray-50/50 p-4">
                    <h4 className="font-bold text-green-700 mb-4 border-b pb-2 flex justify-between">Đủ hàng (In ngay) <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">{orders.printable?.length || 0}</span></h4>
                    <div className="space-y-3 h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {orders.printable?.map(o => <OrderCard key={o.id} order={o} type="printable" />)}
                    </div>
                </div>

                <div className="border-t-4 border-t-yellow-500 rounded-b-xl bg-gray-50/50 p-4">
                    <h4 className="font-bold text-yellow-700 mb-4 border-b pb-2 flex justify-between">Tạm giữ (Chờ hàng) <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">{orders.holding?.length || 0}</span></h4>
                    <div className="space-y-3 h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {orders.holding?.map(o => <OrderCard key={o.id} order={o} type="holding" />)}
                    </div>
                </div>

                <div className="border-t-4 border-t-red-500 rounded-b-xl bg-gray-50/50 p-4">
                    <h4 className="font-bold text-red-700 mb-4 border-b pb-2 flex justify-between">Hết sạch (Chờ hàng) <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">{orders.outOfStock?.length || 0}</span></h4>
                    <div className="space-y-3 h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {orders.outOfStock?.map(o => <OrderCard key={o.id} order={o} type="outOfStock" />)}
                    </div>
                </div>
            </div>
        </div>
    );
}