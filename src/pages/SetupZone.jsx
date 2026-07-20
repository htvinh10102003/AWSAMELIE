import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Save, AlertCircle, Plus, LayoutGrid } from 'lucide-react';

export default function SetupZone() {
  const [rackZones, setRackZones] = useState({});
  const [availableZones, setAvailableZones] = useState([]);
  const [newZoneName, setNewZoneName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 1. Tải dữ liệu Kệ và Dãy đang có trong kho
  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from('location_nodes')
        .select('rack, zone');
      
      if (!error && data) {
        const uniqueRacks = {};
        const zonesSet = new Set(); // Dùng Set để lọc các dãy trùng lặp

        data.forEach(item => {
          // Gom nhóm lấy các kệ duy nhất
          if (item.rack && !uniqueRacks[item.rack]) {
            uniqueRacks[item.rack] = item.zone || '';
          }
          // Gom danh sách các dãy đã có sẵn trong DB
          if (item.zone) {
            zonesSet.add(item.zone.toUpperCase());
          }
        });

        setRackZones(uniqueRacks);
        setAvailableZones(Array.from(zonesSet).sort());
      }
    };
    fetchLocations();
  }, []);

  // 2. Thêm một Dãy mới vào danh sách Dropdown
  const handleAddZone = (e) => {
    e.preventDefault(); // Ngăn reload trang nếu để trong form
    const zone = newZoneName.trim().toUpperCase();
    
    if (!zone) return;
    
    if (!availableZones.includes(zone)) {
      setAvailableZones(prev => [...prev, zone].sort());
    }
    setNewZoneName(''); // Clear ô input sau khi thêm
  };

  // 3. Xử lý khi chọn Dãy cho Kệ
  const handleZoneChange = (rack, value) => {
    setRackZones(prev => ({ ...prev, [rack]: value }));
  };

  // 4. Lưu toàn bộ cấu hình vào DB
  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const promises = Object.entries(rackZones).map(([rack, zone]) => {
        return supabase
          .from('location_nodes')
          .update({ zone: zone || null }) // Gửi null nếu chọn "Chưa phân dãy"
          .eq('rack', rack);
      });

      await Promise.all(promises);
      setMessage('Lưu cấu hình dãy kệ thành công!');
      setTimeout(() => setMessage(''), 3000); // Ẩn thông báo sau 3s
    } catch (error) {
      console.error(error);
      setMessage('Có lỗi xảy ra khi lưu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><MapPin size={24} /></div>
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Quy định Dãy cho Kệ</h2>
          <p className="text-sm text-gray-500 font-medium">Quản lý danh sách các Dãy và phân bổ Kệ vào Dãy để tối ưu lấy hàng.</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.includes('lỗi') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          <AlertCircle size={18} /> {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cột trái: Quản lý danh sách Dãy (Tạo mới) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <LayoutGrid size={18} className="text-blue-600"/> Quản lý Dãy (Zone)
            </h3>
            
            {/* Form thêm dãy mới */}
            <form onSubmit={handleAddZone} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Nhập tên dãy (VD: A)"
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

            {/* Danh sách các dãy đang có */}
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

        {/* Cột phải: Danh sách Kệ để gán Dropdown */}
        <div className="lg:col-span-2">
          <div className="p-6 bg-white border border-gray-200 shadow-sm rounded-3xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-800 text-lg">Gán Dãy cho Kệ hiện tại</h3>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-50"
              >
                <Save size={18} /> {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(rackZones).length === 0 ? (
                <div className="col-span-full py-8 text-center text-gray-400 text-sm">
                  Không tìm thấy Kệ nào trong kho. Vui lòng kiểm tra dữ liệu vị trí.
                </div>
              ) : (
                Object.entries(rackZones).map(([rack, currentZone]) => (
                  <div key={rack} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-2 hover:border-blue-200 transition-colors">
                    <label className="text-sm font-bold text-gray-600">Kệ: <span className="text-gray-900">{rack}</span></label>
                    <select
                      value={currentZone || ''}
                      onChange={(e) => handleZoneChange(rack, e.target.value)}
                      className="px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 cursor-pointer bg-white"
                    >
                      <option value="" className="text-gray-400 font-normal">-- Chưa phân dãy --</option>
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
          </div>
        </div>

      </div>
    </div>
  );
}