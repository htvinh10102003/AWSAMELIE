import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Save, AlertCircle, Plus, LayoutGrid } from 'lucide-react';

export default function SetupZone() {
  const [locationZones, setLocationZones] = useState({});
  const [availableZones, setAvailableZones] = useState([]);
  const [newZoneName, setNewZoneName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 1. Tải dữ liệu Location Code từ bảng Tồn kho và Dãy từ bảng Node
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Lấy tất cả các mã vị trí đang có trong tồn kho
        const { data: inventoryData, error: invError } = await supabase
          .from('product_inventories')
          .select('location_code');
        
        // Lấy các Dãy đã được setup trước đó (nếu có)
        const { data: nodesData, error: nodeError } = await supabase
          .from('location_nodes')
          .select('location_code, zone');

        if (invError) throw invError;
        
        const locMap = {};
        const zonesSet = new Set(); 

        // Đổ dữ liệu từ location_nodes vào trước (để lấy zone đã setup)
        if (nodesData) {
          nodesData.forEach(item => {
            if (item.location_code) {
              locMap[item.location_code.trim()] = item.zone || '';
            }
            if (item.zone) {
              zonesSet.add(item.zone.toUpperCase());
            }
          });
        }

        // Đổ tiếp dữ liệu từ inventory (chỉ lấy mã vị trí chưa có trong locMap)
        if (inventoryData) {
          inventoryData.forEach(item => {
            const code = item.location_code?.trim();
            // Nếu có mã vị trí mà chưa có trong locMap thì gán mặc định là rỗng (chưa phân dãy)
            if (code && locMap[code] === undefined) {
              locMap[code] = '';
            }
          });
        }

        setLocationZones(locMap);
        setAvailableZones(Array.from(zonesSet).sort());
      } catch (err) {
        console.error('Lỗi khi lấy vị trí:', err);
      }
    };

    fetchLocations();
  }, []);

  // 2. Thêm một Dãy mới vào danh sách Dropdown
  const handleAddZone = (e) => {
    e.preventDefault(); 
    const zone = newZoneName.trim().toUpperCase();
    
    if (!zone) return;
    
    if (!availableZones.includes(zone)) {
      setAvailableZones(prev => [...prev, zone].sort());
    }
    setNewZoneName('');
  };

  // 3. Xử lý khi chọn Dãy cho Vị trí
  const handleZoneChange = (locCode, value) => {
    setLocationZones(prev => ({ ...prev, [locCode]: value }));
  };

  // 4. Lưu toàn bộ cấu hình vào DB (Dùng UPSERT)
  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      // Chuyển object locationZones thành mảng để Upsert vào database
      const rowsToUpsert = Object.entries(locationZones).map(([locCode, zone]) => ({
        location_code: locCode,
        zone: zone || null // Nếu trống thì đưa về null
      }));

      // Dùng lệnh upsert: Nếu location_code đã có thì update 'zone', nếu chưa có thì insert dòng mới
      const { error } = await supabase
        .from('location_nodes')
        .upsert(rowsToUpsert, { onConflict: 'location_code' });

      if (error) throw error;

      setMessage('Lưu cấu hình dãy kệ thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setMessage('Có lỗi xảy ra khi lưu.');
    } finally {
      setLoading(false);
    }
  };

  // Sắp xếp mã vị trí ra Array để render cho đẹp (thứ tự A-Z)
  const sortedLocations = Object.entries(locationZones).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><MapPin size={24} /></div>
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Quy định Dãy cho Kệ</h2>
          <p className="text-sm text-gray-500 font-medium">Quản lý danh sách các Dãy và phân bổ Vị trí kệ vào Dãy để tối ưu lấy hàng.</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.includes('lỗi') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          <AlertCircle size={18} /> {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cột trái: Quản lý danh sách Dãy */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl sticky top-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <LayoutGrid size={18} className="text-blue-600"/> Quản lý Dãy (Zone)
            </h3>
            
            <form onSubmit={handleAddZone} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Tên dãy (VD: A)"
                maxLength={5}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-bold text-sm"
              />
              <button
                type="submit"
                disabled={!newZoneName.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                <Plus size={20} />
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {availableZones.length === 0 ? (
                <span className="text-sm text-gray-400 italic">Chưa có dãy nào</span>
              ) : (
                availableZones.map((zone) => (
                  <span key={zone} className="px-3 py-1 bg-white border border-gray-200 shadow-sm rounded-lg text-sm font-bold text-gray-700">
                    Dãy {zone}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cột phải: Danh sách Kệ (Vị trí) */}
        <div className="lg:col-span-2">
          <div className="p-6 bg-white border border-gray-200 shadow-sm rounded-3xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800 text-lg">Gán Dãy cho Vị trí hiện tại</h3>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-50"
              >
                <Save size={18} /> {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
              {sortedLocations.length === 0 ? (
                <div className="col-span-full py-8 text-center text-gray-400 text-sm">
                  Không tìm thấy Vị trí nào trong tồn kho.
                </div>
              ) : (
                sortedLocations.map(([locCode, currentZone]) => (
                  <div key={locCode} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-2 hover:border-blue-200 transition-colors">
                    <label className="text-sm font-bold text-gray-600">
                      Vị trí: <span className="text-gray-900">{locCode}</span>
                    </label>
                    <select
                      value={currentZone || ''}
                      onChange={(e) => handleZoneChange(locCode, e.target.value)}
                      className="px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 cursor-pointer bg-white text-sm"
                    >
                      <option value="" className="text-gray-400 font-normal">-- Chưa phân --</option>
                      {availableZones.map((zone) => (
                        <option key={zone} value={zone}>
                          Dãy {zone}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 font-medium text-right">
              Tổng số vị trí: {sortedLocations.length}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}