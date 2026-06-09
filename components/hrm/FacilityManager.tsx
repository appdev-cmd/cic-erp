import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Power, MapPin, Users, AlignLeft } from 'lucide-react';
import { FacilityService } from '../../services/facilityService';
import { Facility, FacilityType } from '../../types/hrmTypes';

const FacilityManager: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFac, setEditingFac] = useState<Facility | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<FacilityType>('meeting_room');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [metadata, setMetadata] = useState(''); // JSON string for metadata (license plate, driver, etc)

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await FacilityService.getAll();
      setFacilities(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (fac?: Facility) => {
    if (fac) {
      setEditingFac(fac);
      setName(fac.name);
      setType(fac.type);
      setCapacity(fac.capacity || '');
      setLocation(fac.location || '');
      setColor(fac.color || '#3b82f6');
      setMetadata(fac.metadata ? JSON.stringify(fac.metadata, null, 2) : '');
    } else {
      setEditingFac(null);
      setName('');
      setType('meeting_room');
      setCapacity('');
      setLocation('');
      setColor('#3b82f6');
      setMetadata('');
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    try {
      let metaObj = {};
      if (metadata.trim()) {
        try {
          metaObj = JSON.parse(metadata);
        } catch (e) {
          alert('Metadata không phải là JSON hợp lệ');
          return;
        }
      }

      const input = {
        name,
        type,
        capacity: capacity === '' ? undefined : Number(capacity),
        location,
        color,
        metadata: metaObj,
      };

      if (editingFac) {
        await FacilityService.update(editingFac.id, input);
      } else {
        await FacilityService.create(input);
      }

      setIsFormOpen(false);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Có lỗi xảy ra khi lưu');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await FacilityService.toggleActive(id, !currentActive);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Có lỗi xảy ra');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <Settings className="text-slate-600 dark:text-slate-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Quản lý Cơ sở Vật chất
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Quản lý danh mục phòng họp, xe công ty và các tài sản dùng chung.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
        >
          <Plus size={18} /> Thêm Mới
        </button>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300">Tên Tài Sản</th>
                <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300">Loại</th>
                <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300">Chi tiết</th>
                <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300 text-center">Trạng thái</th>
                <th className="p-4 font-semibold text-sm text-slate-600 dark:text-slate-300 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {facilities.map(fac => (
                <tr key={fac.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border border-slate-200 dark:border-slate-700" style={{ backgroundColor: fac.color || '#ccc' }} />
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{fac.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {fac.type === 'meeting_room' ? 'Phòng họp' : 'Xe công tác'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                    {fac.capacity && <div className="flex items-center gap-1"><Users size={14} /> Sức chứa: {fac.capacity}</div>}
                    {fac.location && <div className="flex items-center gap-1 mt-1"><MapPin size={14} /> Vị trí: {fac.location}</div>}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleActive(fac.id, fac.is_active)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        fac.is_active 
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <Power size={12} /> {fac.is_active ? 'Hoạt động' : 'Tạm khóa'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleOpenForm(fac)} className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors">
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {facilities.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có cơ sở vật chất nào.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingFac ? 'Sửa Cơ sở Vật chất' : 'Thêm Cơ sở Vật chất'}
              </h2>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Loại tài sản</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  <option value="meeting_room">Phòng họp</option>
                  <option value="vehicle">Xe công tác</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tên tài sản</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="VD: Phòng họp 1" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Sức chứa (người)</label>
                  <input type="number" value={capacity} onChange={e => setCapacity(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Màu hiển thị lịch</label>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 px-1 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Vị trí (tùy chọn)</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="VD: Tầng 3" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mở rộng (JSON metadata - tùy chọn)</label>
                <textarea 
                  value={metadata} 
                  onChange={e => setMetadata(e.target.value)} 
                  placeholder={`{\n  "license_plate": "30A-12345",\n  "driver": "Nguyễn Văn A"\n}`}
                  rows={4} 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm" 
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Hủy</button>
              <button onClick={handleSave} disabled={!name} className="px-5 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityManager;
