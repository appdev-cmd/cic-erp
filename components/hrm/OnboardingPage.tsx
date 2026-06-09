// ============================================================
// Onboarding Dashboard — CIC ERP
// Theo dõi tiến độ hội nhập (Onboarding)
// ============================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    GraduationCap, Search, Plus, Filter, Loader2, PlayCircle,
    CheckCircle2, Clock, CheckCircle, ChevronRight, FileText, User,
    Trash2, Edit, X, Settings, ArrowRight, UserCheck, Check, MoreVertical,
    Calendar, AlertTriangle, ListChecks, CheckCircle as CheckCircleIcon,
    XCircle, Copy
} from 'lucide-react';
import { OnboardingService } from '../../services/onboardingService';
import { EmployeeService } from '../../services/employeeService';
import type { 
    OnboardingChecklist, 
    OnboardingChecklistItem, 
    OnboardingTemplate, 
    OnboardingTask,
    OnboardingStatus,
    OnboardingAssigneeRole,
    OnboardingItemStatus,
    QuizQuestion
} from '../../types/onboardingTypes';
import type { Employee } from '../../types/employee';
import { formatDate } from '../../utils/formatters';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import DateInput from '../ui/DateInput';
import { DocumentQuizConfig } from './DocumentQuizConfig';

export const OnboardingPage: React.FC = () => {
    const { openPanel } = useSlidePanel();
    const [activeTab, setActiveTab] = useState<'checklists' | 'templates'>('checklists');
    const [checklists, setChecklists] = useState<OnboardingChecklist[]>([]);
    const [loadingChecklists, setLoadingChecklists] = useState(true);
    
    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | OnboardingStatus>('all');
    
    // Modals
    const [showLaunchModal, setShowLaunchModal] = useState(false);

    const loadData = async () => {
        setLoadingChecklists(true);
        try {
            const data = await OnboardingService.getChecklists();
            setChecklists(data);
        } catch {
            toast.error('Lỗi tải danh sách Onboarding');
        } finally {
            setLoadingChecklists(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const openChecklistDetail = (id: string, name: string) => {
        openPanel({
            title: `Tiến độ hội nhập: ${name}`,
            url: `/hrm/onboarding/${id}`,
            component: <OnboardingDetail checklistId={id} onRefresh={loadData} />
        });
    };

    const getStatusBadge = (s: string) => {
        if (s === 'completed') return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-900/50">Hoàn tất</span>;
        if (s === 'cancelled') return <span className="px-2.5 py-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700">Đã Hủy</span>;
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-900/50 animate-pulse">Đang chạy</span>;
    };

    // Filtering logic
    const filteredChecklists = checklists.filter(c => {
        const nameMatch = c.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
        const statusMatch = statusFilter === 'all' || c.status === statusFilter;
        return nameMatch && statusMatch;
    });

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-fuchsia-50 dark:bg-fuchsia-950 text-fuchsia-600 dark:text-fuchsia-400 rounded-2xl border border-fuchsia-100 dark:border-fuchsia-900/50 shadow-sm">
                        <GraduationCap size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Quy trình Hội nhập</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Thiết lập lộ trình công việc và theo dõi onboarding cho nhân sự mới</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowLaunchModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-fuchsia-600 dark:bg-fuchsia-700 hover:bg-fuchsia-700 dark:hover:bg-fuchsia-600 rounded-xl transition duration-200 shadow-md hover:shadow-fuchsia-500/20 active:scale-95 cursor-pointer"
                    >
                        <Plus size={18} /> Gán Model
                    </button>
                </div>
            </div>

            {/* Tabs & Filters bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Tab select */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50 self-start md:self-auto">
                    <button
                        onClick={() => setActiveTab('checklists')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'checklists'
                                ? 'bg-white dark:bg-slate-700 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <ListChecks size={16} />
                        <span>Tiến độ hội nhập</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'templates'
                                ? 'bg-white dark:bg-slate-700 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Settings size={16} />
                        <span>Thiết lập Mẫu</span>
                    </button>
                </div>

                {/* Filter and search controls for Checklists */}
                {activeTab === 'checklists' && (
                    <div className="flex flex-col sm:flex-row gap-3 flex-1 justify-end">
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Tìm nhân viên (tên, mã)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-fuchsia-500/50 cursor-pointer"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="in_progress">Đang chạy</option>
                            <option value="completed">Đã hoàn thành</option>
                            <option value="cancelled">Đã hủy</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            {activeTab === 'checklists' ? (
                loadingChecklists ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-fuchsia-500" size={40} />
                    </div>
                ) : filteredChecklists.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredChecklists.map(c => (
                            <div
                                key={c.id}
                                onClick={() => openChecklistDetail(c.id, c.employee_name || '')}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-fuchsia-300 dark:hover:border-fuchsia-950 hover:shadow-xl dark:hover:shadow-fuchsia-950/10 transition-all duration-300 overflow-hidden group flex flex-col justify-between"
                            >
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-950/30 border border-fuchsia-100 dark:border-fuchsia-900/30 flex items-center justify-center font-black text-fuchsia-600 dark:text-fuchsia-400 text-lg shadow-sm">
                                                {c.employee_name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition">{c.employee_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{c.employee_code || 'Chưa cấp mã'}</p>
                                            </div>
                                        </div>
                                        {getStatusBadge(c.status)}
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{c.template_name || 'Mẫu tự do'}</h4>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                                            <Calendar size={12} /> Bắt đầu: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatDate(c.start_date)}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="px-5 pb-5 pt-2 border-t border-slate-50 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900">
                                    {/* Progress Bar */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-500 dark:text-slate-450">Tiến độ hội nhập</span>
                                            <span className="text-fuchsia-600 dark:text-fuchsia-400 font-extrabold">{c.progress}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-fuchsia-500 dark:bg-fuchsia-600 rounded-full transition-all duration-500 ease-out"
                                                style={{ width: `${c.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <GraduationCap className="mx-auto text-slate-300 dark:text-slate-700 mb-4" size={56} />
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">Không tìm thấy tiến trình nào</p>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Vui lòng điều chỉnh bộ lọc hoặc nhấn "Gán Model" để bắt đầu quy trình hội nhập mới.</p>
                    </div>
                )
            ) : (
                <TemplateManager />
            )}

            {/* Launch Onboarding Modal */}
            {showLaunchModal && (
                <LaunchOnboardingModal 
                    onClose={() => setShowLaunchModal(false)}
                    onSuccess={() => {
                        setShowLaunchModal(false);
                        loadData();
                    }}
                />
            )}
        </div>
    );
};

// ── Component Modal: Gán mẫu hội nhập cho nhân sự mới ──
interface LaunchModalProps {
    onClose: () => void;
    onSuccess: () => void;
}
const LaunchOnboardingModal: React.FC<LaunchModalProps> = ({ onClose, onSuccess }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const fetchFormData = async () => {
            try {
                const [empList, tplList] = await Promise.all([
                    EmployeeService.getAll(),
                    OnboardingService.getTemplates()
                ]);
                setEmployees(empList);
                setTemplates(tplList);
            } catch {
                toast.error('Lỗi khi tải dữ liệu khởi tạo');
            } finally {
                setLoading(false);
            }
        };
        fetchFormData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId) {
            toast.error('Vui lòng chọn nhân viên');
            return;
        }

        setSubmitting(true);
        try {
            await OnboardingService.launchOnboarding(
                selectedEmployeeId,
                selectedTemplateId || null,
                startDate
            );
            toast.success('Khởi tạo tiến trình hội nhập thành công!');
            onSuccess();
        } catch {
            toast.error('Lỗi khi khởi tạo onboarding');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h3 className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <GraduationCap className="text-fuchsia-500" size={20} />
                        Khởi tạo Quy trình Hội nhập
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 transition cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-fuchsia-500" size={32} /></div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chọn Nhân viên mới</label>
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-fuchsia-500 outline-none transition cursor-pointer"
                            >
                                <option value="">-- Chọn nhân sự --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.employeeCode || 'Chưa cấp mã'}) - {emp.position || 'Nhân viên mới'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chọn Mẫu Hội nhập</label>
                            <select
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-fuchsia-500 outline-none transition cursor-pointer"
                            >
                                <option value="">Mẫu tự do (Không theo khuôn mẫu)</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} {t.is_default ? '(Mặc định)' : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ngày nhận việc</label>
                            <DateInput
                                value={startDate}
                                onChange={setStartDate}
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                            />
                        </div>

                        <div className="flex gap-3 pt-3 justify-end border-t border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-bold text-slate-550 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2 text-sm font-bold text-white bg-fuchsia-600 dark:bg-fuchsia-700 hover:bg-fuchsia-700 dark:hover:bg-fuchsia-600 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {submitting && <Loader2 className="animate-spin" size={14} />}
                                Khởi tạo
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

// ── Component: Quản lý Mẫu Quy trình Hội nhập (Templates & Tasks CRUD) ──
const TemplateManager: React.FC = () => {
    const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [showEditTplModal, setShowEditTplModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<OnboardingTemplate | null>(null);
    const [showTasksModal, setShowTasksModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<OnboardingTemplate | null>(null);

    // Form inputs
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [position, setPosition] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await OnboardingService.getTemplates();
            setTemplates(data);
        } catch {
            toast.error('Lỗi tải danh sách mẫu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    const openAddModal = () => {
        setEditingTemplate(null);
        setName('');
        setDescription('');
        setPosition('');
        setIsDefault(false);
        setShowEditTplModal(true);
    };

    const openEditModal = (tpl: OnboardingTemplate) => {
        setEditingTemplate(tpl);
        setName(tpl.name || '');
        setDescription(tpl.description || '');
        setPosition(tpl.position || '');
        setIsDefault(tpl.is_default || false);
        setShowEditTplModal(true);
    };

    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Vui lòng nhập tên mẫu');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || null,
                position: position.trim() || null,
                is_default: isDefault
            };

            if (editingTemplate) {
                await OnboardingService.updateTemplate(editingTemplate.id, payload);
                toast.success('Cập nhật mẫu thành công!');
            } else {
                await OnboardingService.createTemplate(payload);
                toast.success('Tạo mới mẫu thành công!');
            }
            setShowEditTplModal(false);
            loadTemplates();
        } catch {
            toast.error('Có lỗi xảy ra khi lưu mẫu');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string, name: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa mẫu hội nhập "${name}"? Thao tác này sẽ xóa mọi công việc cấu hình bên trong mẫu.`)) return;

        try {
            await OnboardingService.deleteTemplate(id);
            toast.success('Đã xóa mẫu thành công');
            loadTemplates();
        } catch {
            toast.error('Lỗi khi xóa mẫu');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">Danh sách Mẫu Hội nhập</h3>
                    <p className="text-xs text-slate-500">Các mẫu kịch bản Onboarding áp dụng tự động cho nhân sự mới</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl transition cursor-pointer"
                >
                    <Plus size={14} /> Thêm Mẫu mới
                </button>
            </div>

            {loading ? (
                <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-fuchsia-500" size={32} /></div>
            ) : templates.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {templates.map(t => (
                        <div key={t.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1 max-w-xl">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">{t.name}</h4>
                                    {t.is_default && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-fuchsia-50 dark:bg-fuchsia-950 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-100 dark:border-fuchsia-900/50 text-[9px] font-black uppercase tracking-wider">Mặc định</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-550 dark:text-slate-400 line-clamp-2 leading-relaxed">{t.description || 'Chưa cấu hình mô tả.'}</p>
                                {t.position && (
                                    <p className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest">Dành cho vị trí: {t.position}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => {
                                        setSelectedTemplate(t);
                                        setShowTasksModal(true);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-fuchsia-600 dark:text-slate-350 dark:hover:text-fuchsia-400 bg-slate-50 hover:bg-fuchsia-50 dark:bg-slate-800 dark:hover:bg-fuchsia-950/20 border border-slate-200 dark:border-slate-700/60 rounded-xl transition cursor-pointer"
                                >
                                    <Settings size={12} /> Cấu hình tasks
                                </button>
                                <button
                                    onClick={() => openEditModal(t)}
                                    className="p-1.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                                    title="Sửa"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteTemplate(t.id, t.name)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-450 transition hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                                    title="Xóa"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Settings className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold">Chưa có mẫu hội nhập nào</p>
                    <p className="text-slate-400 text-xs mt-0.5">Nhấp nút "Thêm Mẫu mới" để tạo mẫu quy trình hội nhập đầu tiên.</p>
                </div>
            )}

            {/* Template Edit / Add Modal */}
            {showEditTplModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-2xl">
                            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                                {editingTemplate ? 'Chỉnh sửa Mẫu Hội nhập' : 'Tạo mới Mẫu Hội nhập'}
                            </h3>
                            <button onClick={() => setShowEditTplModal(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveTemplate} className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-405 uppercase tracking-wider">Tên Mẫu</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition"
                                    placeholder="Ví dụ: Onboarding Lập trình viên NodeJS"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-405 uppercase tracking-wider">Vị trí áp dụng (Tùy chọn)</label>
                                <input
                                    type="text"
                                    value={position}
                                    onChange={e => setPosition(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
                                    placeholder="Ví dụ: Backend Developer"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-455 uppercase tracking-wider">Mô tả quy trình</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition h-20 resize-none"
                                    placeholder="Mô tả tóm tắt nội dung quy trình hội nhập..."
                                />
                            </div>

                            <div className="flex items-center gap-2 py-1">
                                <input
                                    type="checkbox"
                                    id="isDefaultTpl"
                                    checked={isDefault}
                                    onChange={e => setIsDefault(e.target.checked)}
                                    className="w-4 h-4 rounded text-fuchsia-600 focus:ring-fuchsia-500 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                                />
                                <label htmlFor="isDefaultTpl" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">Đặt làm Mẫu mặc định</label>
                            </div>

                            <div className="flex gap-3 pt-3 justify-end border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowEditTplModal(false)}
                                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-sm font-bold text-white bg-fuchsia-600 dark:bg-fuchsia-700 hover:bg-fuchsia-700 dark:hover:bg-fuchsia-600 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                                >
                                    {saving && <Loader2 className="animate-spin" size={14} />}
                                    Lưu
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Template Tasks Editor Modal */}
            {showTasksModal && selectedTemplate && (
                <TemplateTaskEdit 
                    template={selectedTemplate} 
                    onClose={() => {
                        setShowTasksModal(false);
                        setSelectedTemplate(null);
                    }}
                />
            )}
        </div>
    );
};

// ── Component Modal: Quản lý Công việc mẫu (Template Tasks CRUD) ──
interface TaskEditProps {
    template: OnboardingTemplate;
    onClose: () => void;
}
const TemplateTaskEdit: React.FC<TaskEditProps> = ({ template, onClose }) => {
    const [tasks, setTasks] = useState<OnboardingTask[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Form States
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingTask, setEditingTask] = useState<OnboardingTask | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assigneeRole, setAssigneeRole] = useState<OnboardingAssigneeRole>('new_hire');
    const [dueDays, setDueDays] = useState(0);
    const [sortOrder, setSortOrder] = useState(10);
    const [category, setCategory] = useState('orientation');
    const [saving, setSaving] = useState(false);

    // Document & Quiz States
    const [documentUrl, setDocumentUrl] = useState<string | null>(null);
    const [documentName, setDocumentName] = useState<string | null>(null);
    const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await OnboardingService.getTemplateTasks(template.id);
            setTasks(data);
        } catch {
            toast.error('Lỗi tải công việc mẫu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, [template.id]);

    const openAddTask = () => {
        setEditingTask(null);
        setTitle('');
        setDescription('');
        setAssigneeRole('new_hire');
        setDueDays(0);
        // Default sort_order is last task + 10
        const maxSort = tasks.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);
        setSortOrder(maxSort + 10);
        setCategory('orientation');
        setDocumentUrl(null);
        setDocumentName(null);
        setConvertedHtml(null);
        setQuizQuestions(null);
        setShowAddForm(true);
    };

    const openEditTask = (task: OnboardingTask) => {
        setEditingTask(task);
        setTitle(task.title || '');
        setDescription(task.description || '');
        setAssigneeRole(task.assignee_role || 'new_hire');
        setDueDays(task.due_days || 0);
        setSortOrder(task.sort_order || 10);
        setCategory(task.category || 'orientation');
        setDocumentUrl(task.document_url || null);
        setDocumentName(task.document_name || null);
        setConvertedHtml(task.converted_html || null);
        setQuizQuestions(task.quiz_questions || null);
        setShowAddForm(true);
    };

    const handleSaveTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Vui lòng nhập tên công việc');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                template_id: template.id,
                title: title.trim(),
                description: description.trim() || null,
                assignee_role: assigneeRole,
                due_days: Number(dueDays),
                sort_order: Number(sortOrder),
                category: category || null,
                document_url: documentUrl,
                document_name: documentName,
                converted_html: convertedHtml,
                quiz_questions: quizQuestions
            };

            if (editingTask) {
                await OnboardingService.updateTemplateTask(editingTask.id, payload);
                toast.success('Đã cập nhật công việc mẫu');
            } else {
                await OnboardingService.createTemplateTask(payload);
                toast.success('Đã thêm công việc mẫu');
            }
            setShowAddForm(false);
            loadTasks();
        } catch {
            toast.error('Lỗi khi lưu công việc mẫu');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (!window.confirm('Bạn có muốn xóa công việc mẫu này?')) return;
        try {
            await OnboardingService.deleteTemplateTask(id);
            toast.success('Đã xóa công việc mẫu');
            loadTasks();
        } catch {
            toast.error('Lỗi khi xóa công việc mẫu');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-2xl shrink-0">
                    <div>
                        <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                            Cấu hình Công việc Mẫu: {template.name}
                        </h3>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">Tổng số công việc: {tasks.length}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                    {/* Add / Edit Task Inline Form */}
                    {showAddForm && (
                        <form onSubmit={handleSaveTask} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
                            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                {editingTask ? 'Cập nhật công việc mẫu' : 'Thêm công việc mẫu mới'}
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tên công việc</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                        placeholder="Ví dụ: Nhận bàn giao máy tính cá nhân"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vai trò phụ trách</label>
                                    <select
                                        value={assigneeRole}
                                        onChange={e => setAssigneeRole(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                                    >
                                        <option value="new_hire">Nhân sự mới (New Hire)</option>
                                        <option value="hr">Nhân sự (HR Team)</option>
                                        <option value="manager">Quản lý (Manager)</option>
                                        <option value="it">Bộ phận IT (IT Team)</option>
                                        <option value="buddy">Người đồng hành (Buddy)</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Số ngày hoàn thành</label>
                                    <input
                                        type="number"
                                        value={dueDays}
                                        onChange={e => setDueDays(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                        min="0"
                                        placeholder="Sau bao nhiêu ngày kể từ ngày đi làm"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Thứ tự hiển thị</label>
                                    <input
                                        type="number"
                                        value={sortOrder}
                                        onChange={e => setSortOrder(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Phân loại (Category)</label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                                    >
                                        <option value="setup">Cấp phát / Cài đặt</option>
                                        <option value="documents">Hồ sơ / Giấy tờ</option>
                                        <option value="orientation">Hội nhập định hướng</option>
                                        <option value="training">Đào tạo chuyên môn</option>
                                        <option value="evaluation">Họp review / Đánh giá</option>
                                        <option value="other">Phân loại khác</option>
                                    </select>
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mô tả công việc</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs h-16 resize-none"
                                        placeholder="Mô tả yêu cầu cụ thể cần hoàn thành..."
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <DocumentQuizConfig
                                        documentUrl={documentUrl}
                                        documentName={documentName}
                                        convertedHtml={convertedHtml}
                                        quizQuestions={quizQuestions}
                                        onChange={(data) => {
                                            setDocumentUrl(data.documentUrl);
                                            setDocumentName(data.documentName);
                                            setConvertedHtml(data.convertedHtml);
                                            setQuizQuestions(data.quizQuestions);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                >
                                    Đóng form
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-1.5 text-xs font-bold text-white bg-fuchsia-600 dark:bg-fuchsia-700 hover:bg-fuchsia-700 dark:hover:bg-fuchsia-600 rounded-lg transition cursor-pointer"
                                >
                                    {saving ? 'Đang lưu...' : 'Lưu công việc'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Task List */}
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-fuchsia-500" size={24} /></div>
                    ) : tasks.length > 0 ? (
                        <div className="space-y-3">
                            {tasks.map(t => (
                                <div key={t.id} className="flex justify-between items-start p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-350 dark:hover:border-slate-700 transition">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.title}</span>
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider">{t.category}</span>
                                            <span className="text-[10px] text-fuchsia-600 dark:text-fuchsia-400 font-bold">Ngày +{t.due_days}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">{t.description || 'Không có mô tả.'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Phụ trách: {t.assignee_role}</p>
                                    </div>
                                    
                                    <div className="flex gap-1 shrink-0 ml-4">
                                        <button
                                            onClick={() => openEditTask(t)}
                                            className="p-1 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTask(t.id)}
                                            className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                            <p className="text-slate-400 text-sm">Chưa có công việc nào. Hãy tạo công việc đầu tiên bằng nút bên dưới.</p>
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between bg-slate-50 dark:bg-slate-900 rounded-b-2xl shrink-0">
                    <button
                        onClick={openAddTask}
                        className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg cursor-pointer"
                    >
                        <Plus size={14} /> Thêm công việc mẫu
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Chi tiết Tiến độ & Tùy chỉnh danh sách công việc (Slide Panel Content) ──
const OnboardingDetail: React.FC<{ checklistId: string, onRefresh?: () => void }> = ({ checklistId, onRefresh }) => {
    const [items, setItems] = useState<OnboardingChecklistItem[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit Item States
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState<OnboardingChecklistItem | null>(null);
    const [itemTitle, setItemTitle] = useState('');
    const [itemAssigneeId, setItemAssigneeId] = useState('');
    const [itemNotes, setItemNotes] = useState('');
    const [savingItem, setSavingItem] = useState(false);

    // Document & Quiz States
    const [itemDocumentUrl, setItemDocumentUrl] = useState<string | null>(null);
    const [itemDocumentName, setItemDocumentName] = useState<string | null>(null);
    const [itemConvertedHtml, setItemConvertedHtml] = useState<string | null>(null);
    const [itemQuizQuestions, setItemQuizQuestions] = useState<QuizQuestion[] | null>(null);

    const fetchData = async () => {
        try {
            const [itemList, empList, checklistsList] = await Promise.all([
                OnboardingService.getChecklistItems(checklistId),
                EmployeeService.getAll(),
                OnboardingService.getChecklists()
            ]);
            setItems(itemList);
            setEmployees(empList);
            const current = checklistsList.find(c => c.id === checklistId);
            if (current) setChecklist(current);
        } catch {
            toast.error('Lỗi tải thông tin chi tiết');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [checklistId]);

    const toggleStatus = async (item: OnboardingChecklistItem) => {
        const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
        toast.promise(
            OnboardingService.updateItemStatus(item.id, nextStatus),
            {
                loading: 'Đang cập nhật...',
                success: () => {
                    fetchData();
                    if (onRefresh) onRefresh();
                    return 'Cập nhật thành công';
                },
                error: 'Lỗi cập nhật trạng thái'
            }
        );
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemTitle.trim()) {
            toast.error('Vui lòng nhập tên công việc');
            return;
        }

        setSavingItem(true);
        try {
            const payload = {
                checklist_id: checklistId,
                title: itemTitle.trim(),
                assignee_id: itemAssigneeId || null,
                notes: itemNotes.trim() || null,
                document_url: itemDocumentUrl,
                document_name: itemDocumentName,
                converted_html: itemConvertedHtml,
                quiz_questions: itemQuizQuestions
            };

            if (editingItem) {
                await OnboardingService.updateChecklistItem(editingItem.id, payload);
                toast.success('Đã cập nhật công việc');
            } else {
                await OnboardingService.createChecklistItem({ ...payload, status: 'pending' });
                toast.success('Đã thêm công việc tùy chỉnh');
            }
            setShowItemForm(false);
            fetchData();
            if (onRefresh) onRefresh();
        } catch {
            toast.error('Có lỗi xảy ra khi lưu công việc');
        } finally {
            setSavingItem(false);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!window.confirm('Bạn có muốn xóa công việc này khỏi lộ trình hội nhập?')) return;
        try {
            await OnboardingService.deleteChecklistItem(id);
            toast.success('Đã xóa công việc thành công');
            fetchData();
            if (onRefresh) onRefresh();
        } catch {
            toast.error('Lỗi khi xóa công việc');
        }
    };

    const handleUpdateStatus = async (status: OnboardingStatus) => {
        const confirmMsg = status === 'completed' 
            ? 'Xác nhận hoàn thành toàn bộ tiến trình hội nhập này?' 
            : 'Xác nhận hủy tiến trình hội nhập này?';
        
        if (!window.confirm(confirmMsg)) return;

        try {
            await OnboardingService.updateChecklistStatus(checklistId, status);
            toast.success('Cập nhật trạng thái tiến trình thành công!');
            fetchData();
            if (onRefresh) onRefresh();
        } catch {
            toast.error('Lỗi cập nhật trạng thái tiến trình');
        }
    };

    const openAddItem = () => {
        setEditingItem(null);
        setItemTitle('');
        setItemAssigneeId('');
        setItemNotes('');
        setItemDocumentUrl(null);
        setItemDocumentName(null);
        setItemConvertedHtml(null);
        setItemQuizQuestions(null);
        setShowItemForm(true);
    };

    const openEditItem = (item: OnboardingChecklistItem) => {
        setItemTitle(item.title || '');
        setItemAssigneeId(item.assignee_id || '');
        setItemNotes(item.notes || '');
        setItemDocumentUrl(item.document_url || null);
        setItemDocumentName(item.document_name || null);
        setItemConvertedHtml(item.converted_html || null);
        setItemQuizQuestions(item.quiz_questions || null);
        setShowItemForm(true);
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-fuchsia-500" size={32} /></div>;

    const completedCount = items.filter(i => i.status === 'completed').length;
    const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    return (
        <div className="space-y-6 pb-12">
            {/* Header info */}
            {checklist && (
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Trạng thái tổng thể</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 capitalize">
                            {checklist.status === 'in_progress' ? 'Đang hội nhập' : checklist.status === 'completed' ? 'Đã hoàn thành' : 'Đã hủy'}
                        </p>
                    </div>
                    
                    {checklist.status === 'in_progress' && (
                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={() => handleUpdateStatus('completed')}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer transition"
                            >
                                <CheckCircleIcon size={12} /> Hoàn tất
                            </button>
                            <button
                                onClick={() => handleUpdateStatus('cancelled')}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition"
                            >
                                <XCircle size={12} /> Hủy
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Progress Card */}
            <div className="bg-fuchsia-50 dark:bg-fuchsia-950/20 p-5 rounded-xl border border-fuchsia-100 dark:border-fuchsia-900/30">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <h3 className="font-extrabold text-fuchsia-900 dark:text-fuchsia-400">Tiến độ hoàn thiện: {completedCount}/{items.length}</h3>
                        <p className="text-xs text-fuchsia-600/80 dark:text-fuchsia-500">Các hạng mục onboarding cần giải quyết</p>
                    </div>
                    <span className="text-2xl font-black text-fuchsia-700 dark:text-fuchsia-400">{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-fuchsia-100 dark:bg-fuchsia-950 rounded-full overflow-hidden">
                    <div className="h-full bg-fuchsia-500 dark:bg-fuchsia-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
            </div>

            {/* Actions for Items */}
            {checklist?.status === 'in_progress' && (
                <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest pl-1">Danh sách Công việc</h4>
                    <button
                        onClick={openAddItem}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg transition cursor-pointer"
                    >
                        <Plus size={12} /> Thêm nhiệm vụ
                    </button>
                </div>
            )}

            {/* Item Editor Dialog Form */}
            {showItemForm && (
                <form onSubmit={handleSaveItem} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        {editingItem ? 'Sửa công việc' : 'Thêm công việc tùy chỉnh mới'}
                    </h4>
                    
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tên công việc</label>
                        <input
                            type="text"
                            value={itemTitle}
                            onChange={e => setItemTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                            placeholder="Ví dụ: Lấy thẻ xe & vé xe thang máy"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Người phụ trách (Assignee)</label>
                        <select
                            value={itemAssigneeId}
                            onChange={e => setItemAssigneeId(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                        >
                            <option value="">Chưa gán (HR Team phụ trách chung)</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position || 'Nhân viên'})</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ghi chú hướng dẫn</label>
                        <textarea
                            value={itemNotes}
                            onChange={e => setItemNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs h-16 resize-none"
                            placeholder="Ghi chú chi tiết địa điểm, liên hệ hoặc tài liệu tham khảo..."
                        />
                    </div>

                    <div className="pt-2">
                        <DocumentQuizConfig
                            documentUrl={itemDocumentUrl}
                            documentName={itemDocumentName}
                            convertedHtml={itemConvertedHtml}
                            quizQuestions={itemQuizQuestions}
                            onChange={(data) => {
                                setItemDocumentUrl(data.documentUrl);
                                setItemDocumentName(data.documentName);
                                setItemConvertedHtml(data.convertedHtml);
                                setItemQuizQuestions(data.quizQuestions);
                            }}
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                        <button
                            type="button"
                            onClick={() => setShowItemForm(false)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="submit"
                            disabled={savingItem}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-fuchsia-600 dark:bg-fuchsia-700 hover:bg-fuchsia-700 dark:hover:bg-fuchsia-600 rounded-lg transition cursor-pointer"
                        >
                            {savingItem ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </div>
                </form>
            )}

            {/* Checklist Items list */}
            <div className="space-y-3">
                {items.length > 0 ? (
                    items.map(item => (
                        <div
                            key={item.id}
                            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                                item.status === 'completed'
                                    ? 'bg-slate-50/50 dark:bg-slate-800 border-slate-200/70 dark:border-slate-800/50 opacity-70'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                            }`}
                        >
                            <button
                                onClick={() => checklist?.status === 'in_progress' && toggleStatus(item)}
                                disabled={checklist?.status !== 'in_progress'}
                                className={`mt-0.5 rounded-full p-0.5 flex-shrink-0 transition-colors ${
                                    item.status === 'completed'
                                        ? 'text-emerald-500 dark:text-emerald-400'
                                        : 'text-slate-350 dark:text-slate-650 hover:text-emerald-500 dark:hover:text-emerald-400 cursor-pointer'
                                }`}
                            >
                                <CheckCircle2 size={24} fill="currentColor" className="text-white dark:text-slate-900" />
                            </button>
                            <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-extrabold ${item.status === 'completed' ? 'text-slate-400 dark:text-slate-500 line-through font-normal' : 'text-slate-900 dark:text-slate-100'}`}>
                                    {item.title}
                                </h4>
                                {item.notes && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-1 leading-relaxed">{item.notes}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                                    <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                                        <User size={12} /> Phụ trách: <span className="font-bold text-slate-600 dark:text-slate-350">{item.assignee_name || 'HR Team'}</span>
                                    </span>
                                    {item.due_days !== null && item.due_days !== undefined && (
                                        <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/20 text-[10px] uppercase">
                                            <Clock size={10} /> {item.due_days === 0 ? 'Trong Ngày đầu' : `Sau ${item.due_days} ngày`}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {checklist?.status === 'in_progress' && (
                                <div className="flex gap-1 shrink-0 ml-2">
                                    <button
                                        onClick={() => openEditItem(item)}
                                        className="p-1 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Sửa"
                                    >
                                        <Edit size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                        title="Xóa"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <p className="text-slate-400 text-sm">Chưa có công việc nào trong tiến trình hội nhập này.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
