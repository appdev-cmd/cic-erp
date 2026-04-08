import React, { useState, useEffect } from 'react';
import { PlaneTakeoff, CalendarDays, History, AlertCircle, Plus, CheckCircle2, Clock, XCircle, Ban } from 'lucide-react';
import { LeaveService } from '../../services/leaveService';
import { LeaveBalanceSummary, LeaveRequest, LeaveRequestStatus } from '../../types/hrmTypes';
import { useAuth } from '../../contexts/AuthContext';
import LeaveRequestForm from './LeaveRequestForm';
import { formatDate, formatDateShort } from '../../utils/formatters';
import LeaveCalendar from './LeaveCalendar';

const STATUS_ICONS: Record<LeaveRequestStatus, React.ReactNode> = {
  draft: <Clock size={16} className="text-slate-400" />,
  pending: <Clock size={16} className="text-amber-500" />,
  approved: <CheckCircle2 size={16} className="text-emerald-500" />,
  rejected: <XCircle size={16} className="text-red-500" />,
  cancelled: <Ban size={16} className="text-slate-400" />
};

const STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy'
};

const STATUS_COLORS: Record<LeaveRequestStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  pending: 'bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100/50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
};

const LeavePage: React.FC = () => {
  const { profile: currentEmployee } = useAuth();
  const [activeTab, setActiveTab] = useState<'my-leave' | 'team-calendar'>('my-leave');
  
  // Data
  const [balances, setBalances] = useState<LeaveBalanceSummary[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editRequest, setEditRequest] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    if (currentEmployee) {
      loadData();
    }
  }, [currentEmployee]);

  const loadData = async () => {
    if (!currentEmployee) return;
    setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const [bals, reqs] = await Promise.all([
        LeaveService.getBalanceSummary(currentEmployee.id, currentYear),
        LeaveService.getRequestsByEmployee(currentEmployee.id, currentYear)
      ]);
      setBalances(bals);
      setRequests(reqs);
    } catch (e) {
      console.error('Lỗi tải dữ liệu phép:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (req: LeaveRequest) => {
    setEditRequest(req);
    setShowForm(true);
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn nghỉ phép này?')) return;
    try {
      await LeaveService.cancelRequest(id);
      loadData();
    } catch (e) {
      alert('Không thể hủy đơn');
      console.error(e);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
            <PlaneTakeoff className="text-emerald-600 dark:text-emerald-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Quản lý Nghỉ phép
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tra cứu quỹ phép, nộp đơn và theo dõi lịch nghỉ của đơn vị
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab === 'my-leave' && (
            <button
              onClick={() => { setEditRequest(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
            >
              <Plus size={18} />
              <span>Tạo Đơn Nghỉ Phép</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('my-leave')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'my-leave'
              ? 'border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <History size={18} />
          Phép của tôi
        </button>
        <button
          onClick={() => setActiveTab('team-calendar')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'team-calendar'
              ? 'border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <CalendarDays size={18} />
          Lịch Đơn Vị
        </button>
      </div>

      {/* Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 dark:border-emerald-400 truncate"></div>
          </div>
        ) : (
          <>
            {activeTab === 'my-leave' && (
              <div className="space-y-6">
                {/* Balances */}
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Quỹ phép năm {currentYear}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {balances.map(bal => (
                    <div key={bal.leave_type} className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                      <div className={`absolute top-0 right-0 w-2 h-full bg-[${bal.color}]`} style={{ backgroundColor: bal.color }} />
                      <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">{bal.label}</h4>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{bal.remaining}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 mb-1">/ {bal.total_days} ngày</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Đã dùng: <strong className="text-slate-700 dark:text-slate-300">{bal.used_days}</strong></span>
                        <span>Đang chờ: <strong className="text-slate-700 dark:text-slate-300">{bal.pending_days}</strong></span>
                      </div>
                    </div>
                  ))}
                  {balances.length === 0 && (
                     <div className="col-span-full p-4 flex items-center gap-2 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                       <AlertCircle size={16} /> Chưa có dữ liệu quỹ phép năm nay. Vui lòng liên hệ HR.
                     </div>
                  )}
                </div>

                {/* History */}
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-8 mb-4">Lịch sử nghỉ phép</h3>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Loại phép</th>
                        <th className="px-4 py-3">Thời gian</th>
                        <th className="px-4 py-3 text-center">Số ngày</th>
                        <th className="px-4 py-3">Lý do</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {requests.map(req => (
                        <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {balances.find(b => b.leave_type === req.leave_type)?.label || req.leave_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDateShort(req.start_date)} {req.start_half ? `(${req.start_half === 'morning' ? 'Sáng' : 'Chiều'})` : ''}
                            <span className="mx-2 text-slate-300">→</span>
                            {formatDateShort(req.end_date)} {req.end_half ? `(${req.end_half === 'morning' ? 'Sáng' : 'Chiều'})` : ''}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                            {req.total_days}
                          </td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={req.reason}>
                            {req.reason || '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                              {STATUS_ICONS[req.status]}
                              {STATUS_LABELS[req.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(req.status === 'draft' || req.status === 'pending') && (
                              <div className="flex items-center justify-end gap-2">
                                {req.status === 'draft' && (
                                  <button onClick={() => handleEdit(req)} className="text-indigo-600 hover:underline text-xs font-medium">Sửa</button>
                                )}
                                <button onClick={() => handleCancelRequest(req.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Hủy</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {requests.length === 0 && (
                    <div className="text-center py-12">
                       <History size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                       <p className="text-slate-500 dark:text-slate-400">Bạn chưa có lịch sử nghỉ phép nào.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'team-calendar' && (
              <LeaveCalendar />
            )}
          </>
        )}
      </div>

      {showForm && currentEmployee && (
        <LeaveRequestForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            loadData();
          }}
          employeeId={currentEmployee.id}
          unitId={currentEmployee.unit_id || undefined}
          editRequest={editRequest}
        />
      )}
    </div>
  );
};

export default LeavePage;
