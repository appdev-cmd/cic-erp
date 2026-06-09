// ============================================================
// Overtime Requests UI — CIC ERP
// Quản lý đăng ký tăng ca (Thứ 7, Chủ Nhật, Lễ)
// ============================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Clock, Plus, CheckCircle, XCircle, Search, Filter, Loader2, User } from 'lucide-react';
import { AttendanceService } from '../../services/attendanceService';
import { EmployeeService } from '../../services/employeeService';
import type { OvertimeRequest, CreateOvertimeRequestInput } from '../../types/attendanceTypes';
import { formatDate } from '../../utils/formatters';
import DateInput from '../ui/DateInput';

export const OvertimeRequestsPanel: React.FC = () => {
    const [requests, setRequests] = useState<OvertimeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState<string>(
        new Date().toISOString().substring(0, 7) // YYYY-MM
    );
    const [showForm, setShowForm] = useState(false);

    // Form states
    const [employees, setEmployees] = useState<{ id: string, name: string }[]>([]);
    const [form, setForm] = useState<Partial<CreateOvertimeRequestInput>>({
        day_type: 'saturday',
        start_time: '08:00',
        end_time: '12:00',
        hours: 4,
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await AttendanceService.getAllOvertimeRequests({
                status: filterStatus !== 'all' ? filterStatus : undefined,
                month: filterMonth
            });
            setRequests(data);

            // Fetch employees for dropdown if not loaded
            if (employees.length === 0) {
                const emps = await EmployeeService.getAll();
                setEmployees(emps.map(e => ({ id: e.id, name: e.name })));
            }
        } catch {
            toast.error('Lỗi tải danh sách tăng ca');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [filterStatus, filterMonth]);

    const calculateHours = (start: string, end: string) => {
        if (!start || !end) return 0;
        const [sH, sM] = start.split(':').map(Number);
        const [eH, eM] = end.split(':').map(Number);
        let diff = (eH + eM / 60) - (sH + sM / 60);
        return diff > 0 ? Math.round(diff * 10) / 10 : 0;
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => {
            const updated = { ...prev, [name]: value };
            if (name === 'start_time' || name === 'end_time') {
                updated.hours = calculateHours(updated.start_time || '00:00', updated.end_time || '00:00');
            }
            return updated;
        });
    };

    const handleSubmit = async () => {
        if (!form.employee_id || !form.date) {
            toast.error('Vui lòng điền đủ thông tin nhân viên và ngày');
            return;
        }
        try {
            await AttendanceService.createOvertimeRequest(form as CreateOvertimeRequestInput);
            toast.success('Đã tạo phiếu đăng ký tăng ca');
            setShowForm(false);
            setForm({ day_type: 'saturday', start_time: '08:00', end_time: '12:00', hours: 4 });
            fetchData();
        } catch {
            toast.error('Lỗi khi tạo phiếu');
        }
    };

    const handleReview = async (id: string, isApproved: boolean) => {
        // Trong hệ thống thực tế, reviewerId sẽ lấy từ Auth Context. 
        // Ở đây giả lập lấy admin đầu tiên hoặc hardcode ID của admin hiện tại
        const reviewerId = employees[0]?.id; // Giả lập
        if (!reviewerId) return;

        let reason = '';
        if (!isApproved) {
            const input = prompt('Lý do từ chối:');
            if (input === null) return;
            reason = input;
        }

        try {
            await AttendanceService.reviewOvertimeRequest(id, isApproved, reviewerId, reason);
            toast.success(isApproved ? 'Đã duyệt tăng ca' : 'Đã từ chối tăng ca');
            fetchData();
        } catch {
            toast.error('Lỗi khi xử lý');
        }
    };

    const getStatusColor = (s: string) => {
        if (s === 'approved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (s === 'rejected') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    };

    const getStatusLabel = (s: string) => {
        if (s === 'approved') return 'Đã duyệt';
        if (s === 'rejected') return 'Từ chối';
        return 'Chờ duyệt';
    };

    const getDayTypeLabel = (s: string) => {
        if (s === 'saturday') return 'Thứ 7';
        if (s === 'sunday') return 'Chủ Nhật';
        if (s === 'holiday') return 'Ngày Lễ';
        return s;
    };

    const inputCls = "w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Clock size={24} className="text-indigo-500" />
                        Duyệt Tăng ca
                    </h2>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none w-full sm:w-auto text-slate-900 dark:text-slate-100"
                    />
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none w-full sm:w-auto text-slate-900 dark:text-slate-100"
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="pending">Chờ duyệt</option>
                        <option value="approved">Đã duyệt</option>
                        <option value="rejected">Từ chối</option>
                    </select>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition w-full sm:w-auto"
                    >
                        {showForm ? 'Đóng form' : <><Plus size={16} /> Tạo đơn</>}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Đăng ký tăng ca mới</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nhân viên <span className="text-red-500">*</span></label>
                            <select name="employee_id" value={form.employee_id || ''} onChange={handleFormChange} className={inputCls}>
                                <option value="">-- Chọn nhân viên --</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Ngày <span className="text-red-500">*</span></label>
                            <DateInput value={form.date || ''} onChange={(v: string) => setForm(p => ({ ...p, date: v }))} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Loại ngày</label>
                            <select name="day_type" value={form.day_type || 'saturday'} onChange={handleFormChange} className={inputCls}>
                                <option value="saturday">Thứ 7</option>
                                <option value="sunday">Chủ Nhật</option>
                                <option value="holiday">Ngày Phép / Lễ</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Lý do</label>
                            <input name="reason" value={form.reason || ''} onChange={handleFormChange} className={inputCls} placeholder="Mô tả công việc..." />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Giờ bắt đầu</label>
                            <input type="time" name="start_time" value={form.start_time || ''} onChange={handleFormChange} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Giờ kết thúc</label>
                            <input type="time" name="end_time" value={form.end_time || ''} onChange={handleFormChange} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Số giờ</label>
                            <div className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold">
                                {form.hours}h
                            </div>
                        </div>
                        <div className="flex items-end justify-end">
                            <button onClick={handleSubmit} className="px-5 py-2 w-full text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                                Lưu đơn
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
            ) : requests.length > 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Nhân viên</th>
                                <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Ngày</th>
                                <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Thời gian</th>
                                <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Lý do</th>
                                <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Trạng thái</th>
                                <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {requests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded-full"><User size={14} className="text-indigo-600 dark:text-indigo-400" /></div>
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{req.employee_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDate(req.date)}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{getDayTypeLabel(req.day_type)}</p>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{req.hours}h</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{req.start_time.substring(0, 5)} - {req.end_time.substring(0, 5)}</p>
                                    </td>
                                    <td className="p-4 max-w-[200px]">
                                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate" title={req.reason || ''}>{req.reason || '—'}</p>
                                        {req.rejection_reason && <p className="text-[10px] text-rose-500 mt-1 truncate" title={req.rejection_reason}>Từ chối: {req.rejection_reason}</p>}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(req.status)}`}>
                                            {getStatusLabel(req.status)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {req.status === 'pending' ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => handleReview(req.id, true)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded" title="Duyệt"><CheckCircle size={18} /></button>
                                                <button onClick={() => handleReview(req.id, false)} className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded" title="Từ chối"><XCircle size={18} /></button>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-slate-400">Bởi {req.approver_name || 'Hệ thống'}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Filter className="text-slate-400" size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Không có dữ liệu</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Không tìm thấy yêu cầu tăng ca nào phù hợp với bộ lọc hiện tại.</p>
                </div>
            )}
        </div>
    );
};
