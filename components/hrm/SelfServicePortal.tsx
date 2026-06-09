// ============================================================
// Self-Service Portal — CIC ERP
// Cổng thông tin dành riêng cho User (Nhân viên)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import {
    User, CalendarDays, Clock, FileText, Settings,
    ChevronRight, MapPin, Briefcase, Mail, Phone, ExternalLink, Loader2, Home, CreditCard,
    CheckCircle2, ListChecks, GraduationCap, X, Check, ArrowRight
} from 'lucide-react';
import { EmployeeService } from '../../services';
import { Employee } from '../../types';
import DateInput from '../ui/DateInput';
import { OnboardingService } from '../../services/onboardingService';
import type { QuizQuestion } from '../../types/onboardingTypes';
import { formatDate } from '../../utils/formatters';

export const SelfServicePortal: React.FC = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'payslips' | 'assets' | 'onboarding'>('profile');
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Onboarding states
    const [onboardingChecklist, setOnboardingChecklist] = useState<any>(null);
    const [onboardingItems, setOnboardingItems] = useState<any[]>([]);
    const [assistingItems, setAssistingItems] = useState<any[]>([]);
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [selectedQuizItem, setSelectedQuizItem] = useState<any>(null);

    // Edit fields state
    const [name, setName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [hometown, setHometown] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [address, setAddress] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const fetchEmployeeData = async () => {
        if (!profile?.employeeId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const data = await EmployeeService.getById(profile!.employeeId);
            if (data) {
                setEmployee(data);
                setName(data.name || '');
                setDateOfBirth(data.dateOfBirth || '');
                setHometown(data.hometown || '');
                setIdNumber(data.idNumber || '');
                setAddress(data.address || '');
            }
        } catch (error) {
            console.error('Error fetching employee profile:', error);
            toast.error('Lỗi khi tải thông tin hồ sơ');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOnboardingData = async () => {
        if (!profile?.employeeId) return;
        try {
            const allChecklists = await OnboardingService.getChecklists();
            // Find active onboarding checklist for this employee
            const myChecklist = allChecklists.find(
                c => c.employee_id === profile?.employeeId && c.status === 'in_progress'
            );
            if (myChecklist) {
                setOnboardingChecklist(myChecklist);
                const items = await OnboardingService.getChecklistItems(myChecklist.id);
                setOnboardingItems(items);
            } else {
                setOnboardingChecklist(null);
                setOnboardingItems([]);
            }

            // Find assisting items in active checklists for other employees
            const activeOtherChecklists = allChecklists.filter(
                c => c.status === 'in_progress' && c.employee_id !== profile?.employeeId
            );
            const allAssisting: any[] = [];
            for (const cl of activeOtherChecklists) {
                const items = await OnboardingService.getChecklistItems(cl.id);
                const mine = items.filter(i => i.assignee_id === profile?.employeeId && i.status !== 'completed');
                if (mine.length > 0) {
                    mine.forEach(item => {
                        allAssisting.push({
                            ...item,
                            new_hire_name: cl.employee_name,
                            new_hire_code: cl.employee_code
                        });
                    });
                }
            }
            setAssistingItems(allAssisting);
        } catch (error) {
            console.error('Error fetching onboarding data for portal:', error);
        }
    };

    const handleToggleOnboardingItem = async (item: any) => {
        const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
        try {
            await OnboardingService.updateItemStatus(item.id, nextStatus);
            toast.success('Cập nhật trạng thái nhiệm vụ thành công');
            fetchOnboardingData();
        } catch {
            toast.error('Lỗi cập nhật trạng thái nhiệm vụ');
        }
    };

    useEffect(() => {
        fetchEmployeeData();
        fetchOnboardingData();
    }, [profile?.employeeId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.employeeId) return;

        if (!name.trim()) {
            toast.error('Họ và tên không được để trống');
            return;
        }

        setIsSaving(true);
        try {
            await EmployeeService.update(profile!.employeeId, {
                name: name.trim(),
                dateOfBirth: dateOfBirth || undefined,
                hometown: hometown.trim(),
                idNumber: idNumber.trim(),
                address: address.trim()
            });
            
            toast.success('Cập nhật thông tin hồ sơ thành công!');
            
            // Phát sự kiện để các component khác cập nhật
            window.dispatchEvent(new CustomEvent('employee-changed'));
            
            // Tải lại dữ liệu
            fetchEmployeeData();
        } catch (error) {
            console.error('Error saving employee profile:', error);
            toast.error('Có lỗi xảy ra khi lưu thông tin.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
            {/* User Header Profile */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 border border-slate-200 dark:border-slate-800 relative shadow-sm">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 flex items-center justify-center font-black text-4xl text-slate-400 dark:text-slate-600 shadow-md overflow-hidden shrink-0">
                    {employee?.avatar ? (
                        <img src={employee.avatar} alt={name} className="w-full h-full object-cover" />
                    ) : (
                        name?.charAt(0) || profile?.fullName?.charAt(0) || 'U'
                    )}
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                        {isLoading ? 'Đang tải...' : (name || profile?.fullName || 'Nhân viên mới')}
                    </h1>
                    <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-4">
                        {employee?.position || profile?.role || 'User'}
                    </p>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5"><Mail size={16} /> {employee?.email || profile?.email}</span>
                        {employee?.phone && <span className="flex items-center gap-1.5"><Phone size={16} /> {employee.phone}</span>}
                        {profile?.unitCode && <span className="flex items-center gap-1.5"><MapPin size={16} /> {profile.unitCode}</span>}
                    </div>
                </div>
            </div>

            {/* Quick Action Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickActionBtn icon={<CalendarDays size={24} />} title="Đơn phép" color="text-emerald-500 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-900/20" />
                <QuickActionBtn icon={<Clock size={24} />} title="Đăng ký OT" color="text-amber-500 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/20" />
                <QuickActionBtn icon={<FileText size={24} />} title="Phiếu lương" color="text-indigo-500 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-900/20" />
                <QuickActionBtn icon={<User size={24} />} title="KPI cá nhân" color="text-rose-500 dark:text-rose-400" bg="bg-rose-50 dark:bg-rose-900/20" />
            </div>

            {/* Tabs Content */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                    <button onClick={() => setActiveTab('profile')} className={`flex-1 flex justify-center py-4 text-sm font-bold border-b-2 transition ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Thông tin cá nhân</button>
                    <button onClick={() => setActiveTab('payslips')} className={`flex-1 flex justify-center py-4 text-sm font-bold border-b-2 transition ${activeTab === 'payslips' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Lịch sử nhận lương</button>
                    <button onClick={() => setActiveTab('assets')} className={`flex-1 flex justify-center py-4 text-sm font-bold border-b-2 transition ${activeTab === 'assets' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Tài sản cấp phát</button>
                    {(onboardingChecklist || assistingItems.length > 0) && (
                        <button onClick={() => setActiveTab('onboarding')} className={`flex-1 flex justify-center py-4 text-sm font-bold border-b-2 transition ${activeTab === 'onboarding' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Nhiệm vụ Hội nhập</button>
                    )}
                </div>

                <div className="p-6">
                    {activeTab === 'profile' && (
                        isLoading ? (
                            <div className="py-12 flex justify-center items-center">
                                <Loader2 className="animate-spin text-indigo-500" size={32} />
                                <span className="ml-3 text-sm text-slate-500">Đang tải hồ sơ...</span>
                            </div>
                        ) : (
                            <form onSubmit={handleSave} className="space-y-6">
                                <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Cập nhật hồ sơ cá nhân</h3>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Bạn được tự sửa các thông tin cơ bản bên dưới</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {/* 5 editable fields */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Họ và Tên</label>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm font-medium" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ngày tháng năm sinh</label>
                                        <DateInput 
                                            value={dateOfBirth} 
                                            onChange={setDateOfBirth}
                                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quê quán</label>
                                        <input 
                                            type="text" 
                                            value={hometown} 
                                            onChange={(e) => setHometown(e.target.value)}
                                            placeholder="Nhập quê quán..."
                                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm font-medium" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Số CCCD / CMND</label>
                                        <input 
                                            type="text" 
                                            value={idNumber} 
                                            onChange={(e) => setIdNumber(e.target.value)}
                                            placeholder="Nhập số CCCD..."
                                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm font-medium" 
                                        />
                                    </div>
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Địa chỉ liên hệ</label>
                                        <input 
                                            type="text" 
                                            value={address} 
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="Nhập địa chỉ hiện tại..."
                                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm font-medium" 
                                        />
                                    </div>

                                    {/* Readonly info fields */}
                                    <div className="sm:col-span-2 pt-4 border-t dark:border-slate-800">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Thông tin công tác (Chỉ đọc)</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="flex justify-between py-1.5 border-b dark:border-slate-800">
                                                <span className="text-xs text-slate-400">Mã nhân viên:</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{employee?.employeeCode || '—'}</span>
                                            </div>
                                            <div className="flex justify-between py-1.5 border-b dark:border-slate-800">
                                                <span className="text-xs text-slate-400">Chức vụ:</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{employee?.position || '—'}</span>
                                            </div>
                                            <div className="flex justify-between py-1.5 border-b dark:border-slate-800">
                                                <span className="text-xs text-slate-400">Ngày vào làm:</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{employee?.dateJoined ? formatDate(employee.dateJoined) : '—'}</span>
                                            </div>
                                            <div className="flex justify-between py-1.5 border-b dark:border-slate-800">
                                                <span className="text-xs text-slate-400">Loại HĐ Lao động:</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{employee?.contractType || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button 
                                        type="submit" 
                                        disabled={isSaving}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm text-sm flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                                    >
                                        {isSaving && <Loader2 size={16} className="animate-spin" />}
                                        Lưu cập nhật
                                    </button>
                                </div>
                            </form>
                        )
                    )}
                    {activeTab === 'payslips' && (
                        <div className="py-8 text-center">
                            <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">Không có phiếu lương</h3>
                            <p className="text-sm text-slate-500 mt-1">Chưa đến kỳ trả lương hoặc bạn chưa được nhận lương trên hệ thống mới.</p>
                        </div>
                    )}
                    {activeTab === 'assets' && (
                        <div className="py-8 text-center">
                            <Briefcase size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">Tài sản hiện tại trống</h3>
                            <p className="text-sm text-slate-500 mt-1">Bạn chưa được Cấp phát bất kỳ Laptop/Thiết bị nào do công ty quản lý.</p>
                        </div>
                    )}
                    {activeTab === 'onboarding' && (
                        <div className="space-y-6">
                            {onboardingChecklist && (
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-slate-800 pb-3">
                                        <div className="text-left">
                                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                <GraduationCap className="text-fuchsia-500" size={18} />
                                                Lộ trình hội nhập của bạn
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-0.5">Vui lòng thực hiện các công việc cần thiết chuẩn bị nhận việc chính thức.</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                                            <span>Tiến độ hoàn thành:</span>
                                            <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{onboardingChecklist.progress}%</span>
                                        </div>
                                    </div>
                                    
                                    {/* Progress bar */}
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-305" style={{ width: `${onboardingChecklist.progress}%` }} />
                                    </div>

                                    <div className="space-y-3 mt-4">
                                        {onboardingItems.map(item => {
                                            const hasMaterial = !!item.converted_html;
                                            const canToggle = (item.assignee_id === profile?.employeeId || !item.assignee_id) && !hasMaterial;
                                            return (
                                                <div key={item.id} className={`flex items-start gap-4 p-4 rounded-xl border ${item.status === 'completed' ? 'bg-slate-50/50 dark:bg-slate-800 border-slate-200/50 dark:border-slate-800/50 opacity-60' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'}`}>
                                                    <button
                                                        onClick={() => {
                                                            if (hasMaterial) {
                                                                setSelectedQuizItem(item);
                                                                setShowQuizModal(true);
                                                            } else if (canToggle) {
                                                                handleToggleOnboardingItem(item);
                                                            }
                                                        }}
                                                        disabled={!canToggle && !hasMaterial}
                                                        className={`mt-0.5 rounded-full p-0.5 flex-shrink-0 transition-colors ${
                                                            item.status === 'completed'
                                                                ? 'text-emerald-500'
                                                                : hasMaterial
                                                                ? 'text-fuchsia-500 hover:text-fuchsia-600 cursor-pointer'
                                                                : canToggle
                                                                ? 'text-slate-355 dark:text-slate-650 hover:text-emerald-555 cursor-pointer'
                                                                : 'text-slate-200 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <CheckCircle2 size={22} fill="currentColor" className="text-white dark:text-slate-900" />
                                                    </button>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <h4 className={`text-sm font-bold ${item.status === 'completed' ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}`}>{item.title}</h4>
                                                        {item.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{item.notes}</p>}
                                                        
                                                        {hasMaterial && (
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedQuizItem(item);
                                                                        setShowQuizModal(true);
                                                                    }}
                                                                    className="px-3 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer flex items-center gap-1 shadow-sm"
                                                                >
                                                                    📚 Học tập & Làm Test
                                                                </button>
                                                                {item.quiz_passed ? (
                                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-450 border border-emerald-250 dark:border-emerald-900/50 rounded-lg text-[9.5px] font-black uppercase tracking-wider">Đạt: {item.quiz_score}%</span>
                                                                ) : item.quiz_score !== null && item.quiz_score !== undefined ? (
                                                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-450 border border-rose-250 dark:border-rose-900/50 rounded-lg text-[9.5px] font-black uppercase tracking-wider">Chưa đạt: {item.quiz_score}%</span>
                                                                ) : null}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                                                            <User size={10} /> Phụ trách: <span className="font-bold">{item.assignee_name || 'HR Team'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {assistingItems.length > 0 && (
                                <div className="space-y-4 pt-4 border-t dark:border-slate-800">
                                    <div className="border-b dark:border-slate-800 pb-3 text-left">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <ListChecks className="text-emerald-500" size={18} />
                                            Nhiệm vụ hỗ trợ đồng nghiệp mới
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Các công việc bạn được phân công hỗ trợ hoặc làm Buddy cho nhân sự mới.</p>
                                    </div>

                                    <div className="space-y-3">
                                        {assistingItems.map(item => (
                                            <div key={item.id} className="flex items-start gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                                                <button
                                                    onClick={() => handleToggleOnboardingItem(item)}
                                                    className="mt-0.5 rounded-full p-0.5 flex-shrink-0 text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition cursor-pointer"
                                                >
                                                    <CheckCircle2 size={22} fill="currentColor" className="text-white dark:text-slate-900" />
                                                </button>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <span className="inline-block px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded uppercase tracking-wider mb-2">Hỗ trợ: {item.new_hire_name} ({item.new_hire_code})</span>
                                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.title}</h4>
                                                    {item.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{item.notes}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
            </div>
            {showQuizModal && selectedQuizItem && (
                <OnboardingStudyQuizModal
                    item={selectedQuizItem}
                    onClose={() => {
                        setShowQuizModal(false);
                        setSelectedQuizItem(null);
                    }}
                    onSuccess={() => {
                        fetchOnboardingData();
                    }}
                />
            )}
        </div>
    </div>
    );
};

// ── Component Modal: Học tập và kiểm tra trắc nghiệm ──
interface OnboardingStudyQuizModalProps {
    item: any;
    onClose: () => void;
    onSuccess: () => void;
}

const OnboardingStudyQuizModal: React.FC<OnboardingStudyQuizModalProps> = ({ item, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState<'study' | 'quiz'>('study');
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [submitted, setSubmitted] = useState(false);
    const [score, setScore] = useState(item.quiz_score || 0);
    const [passed, setPassed] = useState(item.quiz_passed || false);
    const [submitting, setSubmitting] = useState(false);

    const questions: QuizQuestion[] = item.quiz_questions || [];

    const handleOptionSelect = (qIndex: number, oIndex: number) => {
        if (submitted) return;
        setAnswers(prev => ({ ...prev, [qIndex]: oIndex }));
    };

    const handleSubmitQuiz = async () => {
        if (questions.length === 0) {
            setSubmitting(true);
            try {
                await OnboardingService.updateQuizResult(item.id, 100, true);
                toast.success('Xác nhận hoàn thành nhiệm vụ!');
                onSuccess();
                onClose();
            } catch {
                toast.error('Lỗi khi cập nhật trạng thái');
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (Object.keys(answers).length < questions.length) {
            toast.error('Vui lòng trả lời đầy đủ tất cả các câu hỏi!');
            return;
        }

        setSubmitting(true);
        try {
            let correctCount = 0;
            questions.forEach((q, idx) => {
                if (answers[idx] === q.answerIndex) {
                    correctCount++;
                }
            });

            const finalScore = Math.round((correctCount / questions.length) * 100);
            const isPassed = finalScore >= 80;

            await OnboardingService.updateQuizResult(item.id, finalScore, isPassed);

            setScore(finalScore);
            setPassed(isPassed);
            setSubmitted(true);

            if (isPassed) {
                toast.success(`Chúc mừng! Bạn đã vượt qua bài test với điểm số ${finalScore}%`);
                onSuccess();
            } else {
                toast.error(`Bài test chưa đạt (${finalScore}%). Vui lòng thử lại!`);
            }
        } catch (error) {
            toast.error('Lỗi nộp bài kiểm tra');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetry = () => {
        setAnswers({});
        setSubmitted(false);
        setScore(0);
        setPassed(false);
        setActiveTab('study');
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-2xl shrink-0">
                    <div>
                        <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                            Học tập & Kiểm tra: {item.title}
                        </h3>
                        {item.document_name && (
                            <p className="text-[10px] text-fuchsia-600 dark:text-fuchsia-400 font-semibold mt-0.5 uppercase tracking-wider">Tài liệu: {item.document_name}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <button
                        onClick={() => setActiveTab('study')}
                        className={`flex-1 py-3 text-xs font-bold border-b-2 transition ${activeTab === 'study' ? 'border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        📚 1. Tài liệu Học tập
                    </button>
                    <button
                        onClick={() => {
                            if (!item.converted_html) {
                                toast.error('Hãy đọc tài liệu học tập trước.');
                                return;
                            }
                            setActiveTab('quiz');
                        }}
                        className={`flex-1 py-3 text-xs font-bold border-b-2 transition ${activeTab === 'quiz' ? 'border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        📝 2. Bài kiểm tra trắc nghiệm
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950">
                    {activeTab === 'study' ? (
                        <div className="space-y-6">
                            <div 
                                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm prose prose-sm dark:prose-invert prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-slate-200 prose-p:leading-relaxed max-w-none prose-table:border prose-table:border-collapse prose-td:border prose-td:p-2"
                                dangerouslySetInnerHTML={{ __html: item.converted_html || 'Chưa có nội dung tài liệu học tập.' }}
                            />
                            
                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => setActiveTab('quiz')}
                                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl transition shadow-md hover:shadow-fuchsia-500/20 cursor-pointer"
                                >
                                    Bắt đầu làm bài kiểm tra <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {submitted || item.quiz_passed ? (
                                <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
                                    <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md ${passed || item.quiz_passed ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                                            {passed || item.quiz_passed ? 'Chúc mừng! Bạn đã vượt qua bài test!' : 'Bài test chưa đạt điểm tối thiểu'}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {passed || item.quiz_passed
                                                ? `Điểm số của bạn: ${score || item.quiz_score}% (Đạt yêu cầu tối thiểu >= 80%)`
                                                : `Điểm số của bạn: ${score || item.quiz_score}% (Yêu cầu tối thiểu >= 80%)`}
                                        </p>
                                    </div>
                                    
                                    {!(passed || item.quiz_passed) && (
                                        <div className="pt-2 flex justify-center gap-3">
                                            <button
                                                onClick={handleRetry}
                                                className="px-5 py-2.5 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl transition shadow-md cursor-pointer"
                                            >
                                                Làm lại bài kiểm tra
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {questions.length === 0 ? (
                                        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                            <p className="text-xs text-slate-500">Nhiệm vụ này không có bài test trắc nghiệm. Vui lòng bấm nộp bài để xác nhận đã hoàn thành việc học tập.</p>
                                        </div>
                                    ) : (
                                        questions.map((q, qIndex) => (
                                            <div 
                                                key={qIndex}
                                                className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm"
                                            >
                                                <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm leading-tight font-sans">
                                                    Câu {qIndex + 1}: {q.question}
                                                </h4>
                                                <div className="grid grid-cols-1 gap-2.5">
                                                    {q.options.map((opt, oIndex) => {
                                                        const isSelected = answers[qIndex] === oIndex;
                                                        return (
                                                            <button
                                                                key={oIndex}
                                                                type="button"
                                                                onClick={() => handleOptionSelect(qIndex, oIndex)}
                                                                className={`w-full p-3.5 text-left text-xs font-semibold rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                                                                    isSelected 
                                                                        ? 'border-fuchsia-500 bg-fuchsia-50/10 text-fuchsia-600 dark:text-fuchsia-400 font-extrabold'
                                                                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350'
                                                                }`}
                                                            >
                                                                <span>{opt}</span>
                                                                {isSelected && <Check size={16} className="text-fuchsia-500 shrink-0 ml-3" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={handleSubmitQuiz}
                                            disabled={submitting}
                                            className="px-6 py-2.5 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl transition shadow-md hover:shadow-fuchsia-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {submitting && <Loader2 className="animate-spin" size={14} />}
                                            Nộp bài & Hoàn thành
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const QuickActionBtn: React.FC<{ icon: React.ReactNode, title: string, color: string, bg: string }> = ({ icon, title, color, bg }) => (
    <button className={`group flex flex-col p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-900 cursor-pointer`}>
        <div className="flex justify-between items-start w-full">
            <div className={`p-3 rounded-xl ${bg} ${color}`}>{icon}</div>
            <ExternalLink size={16} className="text-slate-300 dark:text-slate-700 group-hover:text-indigo-400 transition" />
        </div>
        <div className="mt-4 text-left">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{title}</h4>
        </div>
    </button>
);
