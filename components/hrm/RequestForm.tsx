import React, { useState } from 'react';
import { X, Upload, FileEdit } from 'lucide-react';
import DateInput from '../ui/DateInput';
import { RequestService } from '../../services/requestService';
import { InternalRequestType } from '../../types/hrmTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  unitId?: string;
}

const RequestForm: React.FC<Props> = ({ isOpen, onClose, onSaved, employeeId, unitId }) => {
  const [type, setType] = useState<InternalRequestType>('meeting_room');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Dynamic fields
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (asDraft: boolean) => {
    if (!title || !unitId) return;

    setLoading(true);
    try {
      const details: Record<string, string> = {};
      if (type === 'meeting_room' || type === 'vehicle') {
        details['start_time'] = startTime;
        details['end_time'] = endTime;
      }
      if (type === 'meeting_room') {
        details['room_name'] = location;
      }
      if (type === 'vehicle') {
        details['destination'] = location;
      }

      const req = await RequestService.create({
        employee_id: employeeId,
        unit_id: unitId,
        type,
        title,
        description,
        details,
      });

      if (!asDraft) {
        await RequestService.submit(req.id);
      }

      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <FileEdit className="text-amber-600 dark:text-amber-400" size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tạo Đề xuất Nội bộ</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Loại đề xuất</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="meeting_room">Đặt phòng họp</option>
                <option value="vehicle">Điều xe công tác</option>
                <option value="stationery">Mua sắm VPP / Thiết bị</option>
                <option value="other">Đề xuất khác</option>
              </select>
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tiêu đề</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="VD: Đặt phòng họp tiếp đối tác..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            {(type === 'meeting_room' || type === 'vehicle') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Bắt đầu</label>
                  <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Kết thúc</label>
                  <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {type === 'meeting_room' ? 'Tên phòng họp' : 'Điểm đến / Lộ trình'}
                  </label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Chi tiết đề xuất</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Nhập nội dung chi tiết..."
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Hủy</button>
          <button onClick={() => handleSubmit(true)} disabled={loading || !title} className="px-4 py-2 font-medium text-amber-700 dark:text-amber-400 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 hover:bg-amber-100 rounded-lg">Lưu nháp</button>
          <button onClick={() => handleSubmit(false)} disabled={loading || !title} className="px-5 py-2 font-medium text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 rounded-lg">Gửi duyệt</button>
        </div>
      </div>
    </div>
  );
};

export default RequestForm;
