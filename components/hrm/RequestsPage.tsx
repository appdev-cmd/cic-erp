import React, { useState, useEffect } from 'react';
import { FileEdit, CheckCircle2, Clock, Ban, Plus, XCircle } from 'lucide-react';
import { RequestService } from '../../services/requestService';
import { InternalRequest } from '../../types/hrmTypes';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateShort } from '../../utils/formatters';
import RequestForm from './RequestForm';
import FacilityCalendar from './FacilityCalendar';

const TYPE_LABELS: Record<string, string> = {
  meeting_room: 'Phòng họp',
  vehicle: 'Điều xe',
  stationery: 'VPP/Tài sản',
  other: 'Khác',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  pending_unit: 'Chờ Leader duyệt',
  pending_admin: 'Chờ HCNS duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

const RequestsPage: React.FC = () => {
  const { profile: currentEmployee } = useAuth();
  const [requests, setRequests] = useState<InternalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'my_requests' | 'need_approval' | 'calendar'>('my_requests');
  
  // States for pre-filling form from calendar
  const [prefillFacility, setPrefillFacility] = useState('');
  const [prefillStartTime, setPrefillStartTime] = useState('');

  const isManager = currentEmployee?.role === 'UnitLeader' || currentEmployee?.role === 'AdminUnit';
  const isAdmin = currentEmployee?.role === 'Admin'; // Adjust based on who HCNS is

  useEffect(() => {
    if (currentEmployee) {
      loadData();
    }
  }, [currentEmployee, activeTab]);

  const loadData = async () => {
    if (!currentEmployee) return;
    setIsLoading(true);
    try {
      if (activeTab === 'my_requests') {
        const reqs = await RequestService.getByEmployee(currentEmployee.id);
        setRequests(reqs);
      } else if (activeTab === 'need_approval') {
        if (isAdmin) {
          const reqs = await RequestService.getPendingForAdmin();
          setRequests(reqs);
        } else if (isManager && currentEmployee.unitId) {
          const reqs = await RequestService.getPendingForUnit(currentEmployee.unitId);
          setRequests(reqs);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string, currentStatus: string) => {
    if (!currentEmployee) return;
    try {
      if (currentStatus === 'pending_unit') {
        await RequestService.approveUnit(id, currentEmployee.id);
      } else {
        await RequestService.approveAdmin(id, currentEmployee.id);
      }
      loadData();
    } catch (e) {
      alert('Có lỗi xảy ra');
    }
  };

  const handleReject = async (id: string) => {
    if (!currentEmployee) return;
    const reason = prompt('Nhập lý do từ chối:');
    if (reason === null) return;
    try {
      await RequestService.reject(id, currentEmployee.id, reason);
      loadData();
    } catch (e) {
      alert('Có lỗi xảy ra');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <FileEdit className="text-amber-600 dark:text-amber-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Quản lý Đề xuất Nội bộ
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Đặt phòng họp, điều xe công tác, mua sắm văn phòng phẩm...
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
        >
          <Plus size={18} /> Tạo Đề xuất Mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('my_requests')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'my_requests' ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
        >
          Đề xuất của tôi
        </button>
        {(isManager || isAdmin) && (
          <button
            onClick={() => setActiveTab('need_approval')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'need_approval' ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          >
            Cần tôi duyệt
          </button>
        )}
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'calendar' ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
        >
          📅 Lịch Cơ sở Vật chất
        </button>
      </div>

      {/* Grid */}
      {activeTab === 'calendar' ? (
        <FacilityCalendar 
          onCreateRequest={(facilityId, startTime) => {
            setPrefillFacility(facilityId);
            setPrefillStartTime(startTime);
            setShowForm(true);
          }}
        />
      ) : isLoading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map(req => (
            <div key={req.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded">
                  {TYPE_LABELS[req.type]}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  req.status.includes('pending') ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 
                  req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 
                  req.status === 'draft' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800' :
                  'bg-red-50 text-red-600 dark:bg-red-900/30'
                }`}>
                  {STATUS_LABELS[req.status]}
                </span>
              </div>
              
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg mb-2 line-clamp-2" title={req.title}>{req.title}</h3>
              {activeTab === 'need_approval' && (
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 border-b border-slate-100 dark:border-slate-800 pb-2">Người đề xuất: {req.employee_name}</p>
              )}
              
              <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1 mb-4 flex-1">
                {(req.type === 'meeting_room' || req.type === 'vehicle') && req.details?.start_time && (
                  <p>TG: {formatDateShort(req.details.start_time)} - {formatDateShort(req.details.end_time)}</p>
                )}
                {req.type === 'meeting_room' && req.facility?.name && <p>Phòng: {req.facility.name}</p>}
                {req.type === 'vehicle' && req.facility?.name && <p>Xe: {req.facility.name}</p>}
                {req.type === 'meeting_room' && !req.facility && req.details?.room_name && <p>Phòng: {req.details.room_name}</p>}
                {req.type === 'vehicle' && req.details?.destination && <p>Lộ trình: {req.details.destination}</p>}
                {req.description && <p className="line-clamp-2 mt-2 text-xs italic">"{req.description}"</p>}
                {req.rejection_reason && <p className="text-red-500 mt-2 text-xs">Lý do từ chối: {req.rejection_reason}</p>}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
                <span className="text-xs text-slate-400">{formatDateShort(req.created_at)}</span>
                
                {activeTab === 'need_approval' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(req.id)} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">Từ chối</button>
                    <button onClick={() => handleApprove(req.id, req.status)} className="px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg">Duyệt</button>
                  </div>
                )}
                {activeTab === 'my_requests' && req.status === 'draft' && (
                  <button onClick={async () => { await RequestService.submit(req.id); loadData(); }} className="text-amber-600 text-sm font-medium hover:underline">Gửi duyệt</button>
                )}
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400">Không có đề xuất nào.</div>
          )}
        </div>
      )}

      {showForm && currentEmployee && (
        <RequestForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSaved={loadData}
          employeeId={currentEmployee.id}
          unitId={currentEmployee.unitId || undefined}
          initialFacilityId={prefillFacility}
          initialStartTime={prefillStartTime}
        />
      )}
    </div>
  );
};

export default RequestsPage;
