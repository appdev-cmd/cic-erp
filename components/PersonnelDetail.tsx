import React, { useState, useEffect } from 'react';
import { CONTRACT_STATUS_LABELS, ROLE_LABELS } from '../constants';
import { toast } from 'sonner';

import {
    ArrowLeft, User, Building, Target, TrendingUp, FileText, Award,
    ChevronRight, Loader2, Mail, Phone, Briefcase, Calendar, Hash,
    Pencil, DollarSign, LayoutDashboard, CreditCard, Heart, MapPin,
    GraduationCap, Shield, ExternalLink, Plus, Trash2, FolderOpen, Link2, X
} from 'lucide-react';
import { EmployeeService, ContractService, UnitService, EmployeeTimelineService, GoogleDriveService } from '../services';
import { EmployeeDocumentService, EmployeeDocument } from '../services/employeeDocumentService';
import PersonnelForm from './PersonnelForm';
import { ContractsHRTab, SalaryHistoryTab, AssetsTab } from './hrm/CoreHRTabs';
import { Employee, Contract, Unit, UserRole, EmployeeTimeline, EmployeeTimelineType } from '../types';
import { formatDate } from '../utils/formatters';
import DateInput from './ui/DateInput';
import { useSlidePanelSafe } from '../contexts/SlidePanelContext';
import { useAuth } from '../contexts/AuthContext';

interface PersonnelDetailProps {
    personnelId: string;
    onBack: () => void;
    onViewContract: (contractId: string) => void;
}

interface PersonnelStats {
    contractCount: number;
    totalSigning: number;
    totalRevenue: number;
    totalProfit: number;
    totalRevenueProfit: number;
    activeContracts: number;
    completedContracts: number;
    signingProgress: number;
    revenueProgress: number;
    profitProgress: number;
    revProfitProgress: number;
    target: { signing: number; revenue: number; adminProfit: number; revProfit: number; cash: number };
}

type DetailTab = 'overview' | 'timeline' | 'documents' | 'kpi' | 'contracts' | 'hr_contracts' | 'salary' | 'assets';

const DOC_TYPE_OPTIONS = [
    { value: 'degree', label: 'Bằng cấp' },
    { value: 'certificate', label: 'Chứng chỉ' },
    { value: 'contract', label: 'Hợp đồng lao động' },
    { value: 'id_card', label: 'Giấy tờ tùy thân' },
    { value: 'other', label: 'Khác' },
];

const DOC_TYPE_ICONS: Record<string, { bg: string; color: string }> = {
    degree: { bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
    certificate: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', color: 'text-emerald-600 dark:text-emerald-400' },
    contract: { bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
    id_card: { bg: 'bg-amber-100 dark:bg-amber-900/30', color: 'text-amber-600 dark:text-amber-400' },
    other: { bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-600 dark:text-slate-400' },
};

const PersonnelDetail: React.FC<PersonnelDetailProps> = ({ personnelId, onBack, onViewContract }) => {
    const { profile } = useAuth();
    const [person, setPerson] = useState<Employee | null>(null);
    const [unit, setUnit] = useState<Unit | null>(null);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [stats, setStats] = useState<PersonnelStats | null>(null);
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
    const [timeline, setTimeline] = useState<EmployeeTimeline[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showAllContracts, setShowAllContracts] = useState(false);
    const [contractFilter, setContractFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [activeTab, setActiveTabState] = useState<DetailTab>(() => {
        return (localStorage.getItem('cic-erp-personnel-tab') as DetailTab) || 'overview';
    });

    const setActiveTab = (tab: DetailTab) => {
        setActiveTabState(tab);
        localStorage.setItem('cic-erp-personnel-tab', tab);
    };
    const [kpiYear, setKpiYear] = useState(new Date().getFullYear());
    
    // Document state
    const [showDocForm, setShowDocForm] = useState(false);
    const [editingDoc, setEditingDoc] = useState<EmployeeDocument | null>(null);
    const [docForm, setDocForm] = useState({ name: '', docType: 'other' as string, description: '', url: '', issuedDate: '', expiryDate: '' });
    
    // Timeline state
    const [showTimelineForm, setShowTimelineForm] = useState(false);
    const [editingTimeline, setEditingTimeline] = useState<EmployeeTimeline | null>(null);
    const [timelineForm, setTimelineForm] = useState({
        type: 'other' as EmployeeTimelineType,
        title: '',
        decisionNumber: '',
        effectiveDate: '',
        description: '',
        attachmentUrl: '',
    });
    
    const [isUploading, setIsUploading] = useState(false);
    const slidePanel = useSlidePanelSafe();

    const isHR = profile?.role === 'Admin' || profile?.role === 'Leadership' || 
                 (['AdminUnit', 'UnitLeader'].includes(profile?.role || '') && 
                  ['HCNS', 'TH'].includes((profile?.unitCode || '').toUpperCase()));
    const isSelf = !!person && (
        (!!profile?.employeeId && !!person.id && profile.employeeId === person.id) || 
        (!!profile?.email && !!person.email && profile.email === person.email)
    );
    const isAllowedToEdit = isHR || isSelf;

    const currentYear = new Date().getFullYear();
    const filteredContracts = contracts.filter(c => {
        if (contractFilter === 'active') {
            const signedYear = c.signedDate ? new Date(c.signedDate).getFullYear() : null;
            return signedYear === currentYear || c.status !== 'Completed';
        }
        if (contractFilter === 'completed') return c.status === 'Completed';
        return true;
    });

    const fetchData = async (year?: number) => {
        setIsLoading(true);
        try {
            const personData = await EmployeeService.getBySlugOrId(personnelId);
            if (personData) {
                setPerson(personData);
                const realId = personData.id;
                const [unitData, statsData, contractsData, docsData, timelineData] = await Promise.all([
                    UnitService.getById(personData.unitId),
                    EmployeeService.getStats(realId, year),
                    ContractService.getByEmployeeId(realId),
                    EmployeeDocumentService.getByEmployeeId(realId),
                    EmployeeTimelineService.getByEmployeeId(realId),
                ]);
                setUnit(unitData || null);
                setStats(statsData);
                setContracts(contractsData);
                setDocuments(docsData);
                setTimeline(timelineData);
            }
        } catch (error) {
            console.error('Error fetching personnel data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Update browser tab title with employee name
    useEffect(() => {
        if (person) {
            document.title = `${person.name} - CIC ERP`;
            if (slidePanel?.updatePanelTitle) {
                slidePanel.updatePanelTitle(undefined, person.name);
            }
        }
        return () => { document.title = 'CIC ERP'; };
    }, [person, slidePanel]);

    useEffect(() => { fetchData(kpiYear); }, [personnelId, kpiYear]);

    useEffect(() => {
        const handleRefresh = () => { fetchData(kpiYear); };
        window.addEventListener('employee-changed', handleRefresh);
        window.addEventListener('contract-changed', handleRefresh);
        return () => {
            window.removeEventListener('employee-changed', handleRefresh);
            window.removeEventListener('contract-changed', handleRefresh);
        };
    }, [personnelId, kpiYear]);

    const handleEditSave = async (data: Omit<Employee, 'id'> | Employee) => {
        try {
            if (person) await EmployeeService.update(person.id, data);
            setIsEditing(false);
            fetchData(kpiYear);
            toast.success("Cập nhật thông tin nhân viên thành công");
        } catch (error) {
            console.error('Error updating personnel:', error);
            toast.error('Có lỗi xảy ra khi cập nhật thông tin.');
        }
    };

    // Document CRUD
    const resetDocForm = () => {
        setDocForm({ name: '', docType: 'other', description: '', url: '', issuedDate: '', expiryDate: '' });
        setEditingDoc(null);
        setShowDocForm(false);
    };

    const handleDocSubmit = async () => {
        if (!docForm.name.trim()) { toast.error('Vui lòng nhập tên tài liệu'); return; }
        if (!person) return;
        try {
            if (editingDoc) {
                await EmployeeDocumentService.update(editingDoc.id, { ...docForm, docType: docForm.docType as any });
                toast.success('Cập nhật tài liệu thành công');
            } else {
                await EmployeeDocumentService.create({ ...docForm, employeeId: person.id, docType: docForm.docType as any });
                toast.success('Thêm tài liệu thành công');
            }
            const docs = await EmployeeDocumentService.getByEmployeeId(person.id);
            setDocuments(docs);
            resetDocForm();
        } catch (error) {
            console.error('Error saving document:', error);
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleDocDelete = async (docId: string) => {
        if (!person || !confirm('Xóa tài liệu này?')) return;
        try {
            await EmployeeDocumentService.delete(docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
            toast.success('Đã xóa tài liệu');
        } catch (error) {
            toast.error('Lỗi khi xóa');
        }
    };

    const startEditDoc = (doc: EmployeeDocument) => {
        setEditingDoc(doc);
        setDocForm({ name: doc.name, docType: doc.docType, description: doc.description, url: doc.url, issuedDate: doc.issuedDate, expiryDate: doc.expiryDate });
        setShowDocForm(true);
    };

    // Google Drive Upload Handler
    const handleDriveUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'document' | 'timeline') => {
        const file = e.target.files?.[0];
        if (!file || !person) return;

        setIsUploading(true);
        const uploadToast = toast.loading('Đang tải tài liệu lên Google Drive...');
        try {
            const folderPath = GoogleDriveService.buildEmployeeFolderPath(person.id, person.name);
            const folder = await GoogleDriveService.getOrCreatePath(folderPath);
            const result = await GoogleDriveService.uploadFile(file, folder.id);
            
            if (targetField === 'document') {
                setDocForm(p => ({ ...p, url: result.webViewLink || '' }));
                if (!docForm.name) {
                    setDocForm(p => ({ ...p, name: file.name.substring(0, file.name.lastIndexOf('.')) || file.name }));
                }
            } else if (targetField === 'timeline') {
                setTimelineForm(p => ({ ...p, attachmentUrl: result.webViewLink || '' }));
            }
            
            toast.success(`Tải lên thành công: ${file.name}`, { id: uploadToast });
        } catch (error: any) {
            console.error('Error uploading to Google Drive:', error);
            toast.error(`Lỗi tải lên Google Drive: ${error.message || 'Không rõ nguyên nhân'}`, { id: uploadToast });
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    // Timeline CRUD
    const resetTimelineForm = () => {
        setTimelineForm({
            type: 'other',
            title: '',
            decisionNumber: '',
            effectiveDate: '',
            description: '',
            attachmentUrl: '',
        });
        setEditingTimeline(null);
        setShowTimelineForm(false);
    };

    const handleTimelineSubmit = async () => {
        if (!timelineForm.title.trim()) {
            toast.error('Vui lòng nhập tiêu đề lộ trình');
            return;
        }
        if (!timelineForm.effectiveDate) {
            toast.error('Vui lòng chọn ngày hiệu lực');
            return;
        }
        if (!person) return;

        try {
            if (editingTimeline) {
                await EmployeeTimelineService.update(editingTimeline.id, {
                    ...timelineForm,
                    employeeId: person.id,
                });
                toast.success('Cập nhật lộ trình thành công');
            } else {
                await EmployeeTimelineService.create({
                    ...timelineForm,
                    employeeId: person.id,
                });
                toast.success('Thêm mốc lộ trình thành công');
            }
            const timelineData = await EmployeeTimelineService.getByEmployeeId(person.id);
            setTimeline(timelineData);
            resetTimelineForm();
        } catch (error) {
            console.error('Error saving timeline:', error);
            toast.error('Có lỗi xảy ra khi lưu lộ trình');
        }
    };

    const handleTimelineDelete = async (id: string) => {
        if (!person || !confirm('Bạn có chắc chắn muốn xóa mốc lộ trình này?')) return;
        try {
            await EmployeeTimelineService.delete(id);
            setTimeline(prev => prev.filter(t => t.id !== id));
            toast.success('Đã xóa mốc lộ trình');
        } catch (error) {
            console.error('Error deleting timeline:', error);
            toast.error('Lỗi khi xóa mốc lộ trình');
        }
    };

    const startEditTimeline = (item: EmployeeTimeline) => {
        setEditingTimeline(item);
        setTimelineForm({
            type: item.type,
            title: item.title,
            decisionNumber: item.decisionNumber || '',
            effectiveDate: item.effectiveDate,
            description: item.description || '',
            attachmentUrl: item.attachmentUrl || '',
        });
        setShowTimelineForm(true);
    };

    const formatCurrency = (val: number) => (val || 0).toLocaleString('vi-VN') + ' ₫';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Processing': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Suspended': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Cancelled': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            case 'Acceptance': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            case 'Liquidated': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
            case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Expired': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return 'bg-emerald-500';
        if (progress >= 70) return 'bg-indigo-500';
        if (progress >= 40) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const getGenderLabel = (g?: string) => g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : g === 'other' ? 'Khác' : '—';
    const getMaritalLabel = (s?: string) => s === 'single' ? 'Độc thân' : s === 'married' ? 'Đã kết hôn' : s === 'divorced' ? 'Ly hôn' : s === 'widowed' ? 'Góa' : '—';

    if (isLoading) {
        return (<div className="flex items-center justify-center h-[60vh]"><div className="text-center"><Loader2 size={40} className="animate-spin text-indigo-500 mx-auto mb-4" /><p className="text-slate-500 dark:text-slate-400">Đang tải dữ liệu...</p></div></div>);
    }

    if (!person) {
        return (<div className="text-center py-16"><div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><User size={32} className="text-slate-400" /></div><p className="text-slate-500 dark:text-slate-400 text-lg">Không tìm thấy nhân viên</p><button onClick={onBack} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors">Quay lại</button></div>);
    }

    const tabs: { id: DetailTab; label: string; icon: any; count?: number }[] = [
        { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
        { id: 'timeline', label: 'Lộ trình', icon: Award, count: timeline.length },
        { id: 'hr_contracts', label: 'HĐ Lao động', icon: Shield },
        { id: 'salary', label: 'Lương', icon: DollarSign },
        { id: 'assets', label: 'Tài sản', icon: CreditCard },
        { id: 'documents', label: 'Hồ sơ', icon: FolderOpen, count: documents.length },
        { id: 'kpi', label: 'Chỉ tiêu KD', icon: Target },
        { id: 'contracts', label: 'Hợp đồng', icon: FileText, count: contracts.length },
    ];

    const InfoRow = ({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) => (
        <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
            {Icon && <Icon size={16} className="text-slate-400 mt-0.5 shrink-0" />}
            <div className="flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value || '—'}</p>
            </div>
        </div>
    );

    const KpiCard = ({ title, icon: Icon, iconBg, iconColor, value, target: tgt, progress }: {
        title: string; icon: any; iconBg: string; iconColor: string; value: number; target: number; progress: number;
    }) => (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`p-2 ${iconBg} rounded-lg ${iconColor}`}><Icon size={18} /></div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
                </div>
                <span className={`text-sm font-black ${progress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : progress >= 70 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>{progress.toFixed(0)}%</span>
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">{formatCurrency(value)}</p>
            <div className="space-y-1">
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getProgressColor(progress)}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
                <p className="text-[10px] text-slate-400">Mục tiêu: {formatCurrency(tgt)}</p>
            </div>
        </div>
    );

    const inputCls = "w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none";

    const TIMELINE_TYPE_OPTIONS = [
        { value: 'promotion', label: 'Bổ nhiệm / Điều động', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50' },
        { value: 'reward', label: 'Khen thưởng', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50' },
        { value: 'discipline', label: 'Kỷ luật', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50' },
        { value: 'salary_change', label: 'Thay đổi lương', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50' },
        { value: 'other', label: 'Khác', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700/50' },
    ];

    const renderTimeline = () => (
        <div className="space-y-6">
            {/* Timeline Form (HR only) */}
            {isHR && showTimelineForm && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{editingTimeline ? 'Sửa mốc lộ trình' : 'Thêm mốc lộ trình mới'}</h3>
                        <button onClick={resetTimelineForm} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Loại lộ trình <span className="text-red-500">*</span></label>
                                <select className={inputCls} value={timelineForm.type} onChange={e => setTimelineForm(p => ({ ...p, type: e.target.value as any }))}>
                                    {TIMELINE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tiêu đề quyết định <span className="text-red-500">*</span></label>
                                <input className={inputCls} value={timelineForm.title} onChange={e => setTimelineForm(p => ({ ...p, title: e.target.value }))} placeholder="VD: Bổ nhiệm Trưởng phòng HCNS" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Số quyết định</label>
                                <input className={inputCls} value={timelineForm.decisionNumber} onChange={e => setTimelineForm(p => ({ ...p, decisionNumber: e.target.value }))} placeholder="VD: QĐ-01/2026/CIC" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngày có hiệu lực <span className="text-red-500">*</span></label>
                                <DateInput value={timelineForm.effectiveDate} onChange={(v: string) => setTimelineForm(p => ({ ...p, effectiveDate: v }))} className={inputCls} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Mô tả chi tiết</label>
                            <textarea className={`${inputCls} min-h-[80px] py-2 resize-y`} value={timelineForm.description} onChange={e => setTimelineForm(p => ({ ...p, description: e.target.value }))} placeholder="Nội dung tóm tắt quyết định..." />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex justify-between items-center">
                                <span className="flex items-center gap-1.5"><Link2 size={12} /> Tài liệu quyết định (Link Google Drive)</span>
                                {isUploading && <span className="text-[10px] text-indigo-600 dark:text-indigo-400 animate-pulse">Đang tải lên...</span>}
                            </label>
                            <div className="flex gap-2">
                                <input className={`${inputCls} flex-1`} value={timelineForm.attachmentUrl} onChange={e => setTimelineForm(p => ({ ...p, attachmentUrl: e.target.value }))} placeholder="https://drive.google.com/..." />
                                <div className="relative">
                                    <input type="file" id="timeline-file-upload" className="hidden" disabled={isUploading} onChange={(e) => handleDriveUpload(e, 'timeline')} />
                                    <label htmlFor="timeline-file-upload" className={`px-4 py-2 text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <FolderOpen size={16} /> Tải lên Drive
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={resetTimelineForm} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Hủy</button>
                            <button onClick={handleTimelineSubmit} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">{editingTimeline ? 'Cập nhật' : 'Thêm'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline View */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Award size={18} className="text-indigo-500" /> Lộ trình công tác
                    </h3>
                    {isHR && (
                        <button onClick={() => { resetTimelineForm(); setShowTimelineForm(true); }}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                            <Plus size={14} /> Ghi nhận mốc mới
                        </button>
                    )}
                </div>

                {timeline.length > 0 ? (
                    <div className="p-6">
                        <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-8">
                            {timeline.map(item => {
                                const typeObj = TIMELINE_TYPE_OPTIONS.find(o => o.value === item.type) || TIMELINE_TYPE_OPTIONS[4];
                                return (
                                    <div key={item.id} className="relative group">
                                        {/* Dot on line */}
                                        <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${typeObj.bg.replace('bg-', 'bg-').split(' ')[0] || 'bg-slate-500'}`} />
                                        
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                            <div className="space-y-1.5 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${typeObj.bg} ${typeObj.color}`}>
                                                        {typeObj.label}
                                                    </span>
                                                    {item.decisionNumber && (
                                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                            Số QĐ: {item.decisionNumber}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 md:hidden">
                                                        Hiệu lực: {formatDate(item.effectiveDate)}
                                                    </span>
                                                </div>
                                                <h4 className="text-base font-black text-slate-900 dark:text-slate-100">{item.title}</h4>
                                                {item.description && (
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl whitespace-pre-wrap">{item.description}</p>
                                                )}
                                                {item.attachmentUrl && (
                                                    <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-1">
                                                        <Link2 size={12} /> Xem quyết định đính kèm (Drive)
                                                    </a>
                                                )}
                                            </div>
                                            <div className="flex items-center md:items-end gap-3 md:flex-col shrink-0">
                                                <span className="text-sm font-black text-slate-500 dark:text-slate-400 hidden md:block">
                                                    {formatDate(item.effectiveDate)}
                                                </span>
                                                {isHR && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEditTimeline(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Sửa"><Pencil size={14} /></button>
                                                        <button onClick={() => handleTimelineDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Xóa"><Trash2 size={14} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Award size={28} className="text-slate-400" />
                        </div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa ghi nhận lộ trình</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Các quyết định bổ nhiệm, khen thưởng, kỷ luật sẽ xuất hiện ở đây.</p>
                        {isHR && (
                            <button onClick={() => { resetTimelineForm(); setShowTimelineForm(true); }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                                <Plus size={14} /> Ghi nhận mốc đầu tiên
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    // ===== TAB: OVERVIEW (merged with profile info) =====
    const renderOverview = () => (
        <div className="space-y-4">
            {/* KPI Cards */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard title="KPI Ký kết" icon={Target} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400" value={stats.totalSigning} target={stats.target?.signing || 0} progress={stats.signingProgress} />
                    <KpiCard title="KPI Doanh thu" icon={TrendingUp} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-600 dark:text-indigo-400" value={stats.totalRevenue} target={stats.target?.revenue || 0} progress={stats.revenueProgress} />
                    <KpiCard title="LNG Quản trị" icon={DollarSign} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400" value={stats.totalProfit} target={stats.target?.adminProfit || 0} progress={stats.profitProgress || 0} />
                    <KpiCard title="LNG theo DT" icon={DollarSign} iconBg="bg-purple-100 dark:bg-purple-900/30" iconColor="text-purple-600 dark:text-purple-400" value={stats.totalRevenueProfit || 0} target={stats.target?.revProfit || 0} progress={stats.revProfitProgress || 0} />
                </div>
            )}
            {/* Quick Stats */}
            {stats && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Tổng HĐ', val: stats.contractCount, color: 'text-slate-900 dark:text-slate-100', filter: 'all' as const },
                        { label: 'Đang thực hiện', val: stats.activeContracts, color: 'text-emerald-600 dark:text-emerald-400', filter: 'active' as const },
                        { label: 'Hoàn thành', val: stats.completedContracts, color: 'text-blue-600 dark:text-blue-400', filter: 'completed' as const },
                    ].map(s => (
                        <button key={s.filter} onClick={() => { setContractFilter(s.filter); setActiveTab('contracts'); }}
                            className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
                            <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
                        </button>
                    ))}
                </div>
            )}
            {/* Profile Info — merged from old "Hồ sơ" tab */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><User size={16} className="text-indigo-500" /> Thông tin cá nhân</h3>
                    </div>
                    <div className="p-5">
                        <InfoRow label="Họ và tên" value={person.name} icon={User} />
                        <InfoRow label="Mã nhân viên" value={person.employeeCode || ''} icon={Hash} />
                        <InfoRow label="Ngày sinh" value={formatDate(person.dateOfBirth)} icon={Calendar} />
                        <InfoRow label="Giới tính" value={getGenderLabel(person.gender)} icon={User} />
                        <InfoRow label="Số CCCD/CMND" value={person.idNumber || ''} icon={CreditCard} />
                        <InfoRow label="Tình trạng hôn nhân" value={getMaritalLabel(person.maritalStatus)} icon={Heart} />
                        <InfoRow label="Địa chỉ" value={person.address || ''} icon={MapPin} />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Phone size={16} className="text-emerald-500" /> Thông tin liên hệ</h3>
                    </div>
                    <div className="p-5">
                        <InfoRow label="Email" value={person.email || ''} icon={Mail} />
                        <InfoRow label="Số điện thoại" value={person.phone || ''} icon={Phone} />
                        <InfoRow label="Telegram" value={person.telegram || ''} icon={Mail} />
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2"><Heart size={14} className="text-red-400" /> Liên hệ khẩn cấp</h4>
                            <InfoRow label="Tên người liên hệ" value={person.emergencyContact || ''} icon={User} />
                            <InfoRow label="Số điện thoại" value={person.emergencyPhone || ''} icon={Phone} />
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><GraduationCap size={16} className="text-purple-500" /> Học vấn & Chứng chỉ</h3>
                    </div>
                    <div className="p-5">
                        <InfoRow label="Trình độ học vấn" value={person.education || ''} icon={GraduationCap} />
                        <InfoRow label="Chuyên ngành" value={person.specialization || ''} icon={GraduationCap} />
                        <InfoRow label="Chứng chỉ" value={person.certificates || ''} icon={Award} />
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Briefcase size={16} className="text-amber-500" /> Hợp đồng lao động & Ngân hàng</h3>
                    </div>
                    <div className="p-5">
                        <InfoRow label="Chức vụ" value={person.position ? (ROLE_LABELS[person.position as UserRole] || person.position) : ''} icon={Briefcase} />
                        <InfoRow label="Đơn vị" value={unit?.name || ''} icon={Building} />
                        <InfoRow label="Ngày vào làm" value={formatDate(person.dateJoined)} icon={Calendar} />
                        <InfoRow label="Loại hợp đồng" value={person.contractType || ''} icon={FileText} />
                        <InfoRow label="Ngày hết hạn HĐ" value={formatDate(person.contractEndDate)} icon={Calendar} />
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2"><CreditCard size={14} className="text-emerald-400" /> Thông tin ngân hàng</h4>
                            <InfoRow label="Số tài khoản" value={person.bankAccount || ''} icon={CreditCard} />
                            <InfoRow label="Ngân hàng" value={person.bankName || ''} icon={Building} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // ===== TAB: DOCUMENTS (Hồ sơ — bằng cấp, chứng chỉ, HĐ lao động) =====
    const renderDocuments = () => (
        <div className="space-y-4">
            {/* Add Document Form (inline) */}
            {showDocForm && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{editingDoc ? 'Sửa tài liệu' : 'Thêm tài liệu mới'}</h3>
                        <button onClick={resetDocForm} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tên tài liệu <span className="text-red-500">*</span></label>
                                <input className={inputCls} value={docForm.name} onChange={e => setDocForm(p => ({ ...p, name: e.target.value }))} placeholder="VD: Bằng Thạc sĩ QTKD" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Loại tài liệu</label>
                                <select className={inputCls} value={docForm.docType} onChange={e => setDocForm(p => ({ ...p, docType: e.target.value }))}>
                                    {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex justify-between items-center">
                                <span className="flex items-center gap-1.5"><Link2 size={12} /> Link Google Drive / URL</span>
                                {isUploading && <span className="text-[10px] text-indigo-600 dark:text-indigo-400 animate-pulse">Đang tải lên...</span>}
                            </label>
                            <div className="flex gap-2">
                                <input className={`${inputCls} flex-1`} value={docForm.url} onChange={e => setDocForm(p => ({ ...p, url: e.target.value }))} placeholder="https://drive.google.com/..." />
                                <div className="relative">
                                    <input type="file" id="doc-file-upload" className="hidden" disabled={isUploading} onChange={(e) => handleDriveUpload(e, 'document')} />
                                    <label htmlFor="doc-file-upload" className={`px-4 py-2 text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <FolderOpen size={16} /> Tải lên Drive
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Mô tả</label>
                            <input className={inputCls} value={docForm.description} onChange={e => setDocForm(p => ({ ...p, description: e.target.value }))} placeholder="Mô tả ngắn về tài liệu" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngày cấp</label>
                                <DateInput value={docForm.issuedDate} onChange={(v: string) => setDocForm(p => ({ ...p, issuedDate: v }))} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngày hết hạn</label>
                                <DateInput value={docForm.expiryDate} onChange={(v: string) => setDocForm(p => ({ ...p, expiryDate: v }))} className={inputCls} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={resetDocForm} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Hủy</button>
                            <button onClick={handleDocSubmit} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">{editingDoc ? 'Cập nhật' : 'Thêm'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Documents List */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FolderOpen size={18} className="text-indigo-500" /> Hồ sơ tài liệu
                    </h3>
                    <button onClick={() => { resetDocForm(); setShowDocForm(true); }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                        <Plus size={14} /> Thêm tài liệu
                    </button>
                </div>

                {documents.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {documents.map(doc => {
                            const typeStyle = DOC_TYPE_ICONS[doc.docType] || DOC_TYPE_ICONS.other;
                            const typeLabel = DOC_TYPE_OPTIONS.find(o => o.value === doc.docType)?.label || 'Khác';
                            return (
                                <div key={doc.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                                    <div className={`p-2.5 rounded-lg shrink-0 ${typeStyle.bg}`}>
                                        {doc.docType === 'degree' ? <GraduationCap size={20} className={typeStyle.color} /> :
                                            doc.docType === 'certificate' ? <Award size={20} className={typeStyle.color} /> :
                                                doc.docType === 'contract' ? <FileText size={20} className={typeStyle.color} /> :
                                                    doc.docType === 'id_card' ? <CreditCard size={20} className={typeStyle.color} /> :
                                                        <FileText size={20} className={typeStyle.color} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{doc.name}</h4>
                                                <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${typeStyle.bg} ${typeStyle.color}`}>{typeLabel}</span>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                {doc.url && (
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                                        className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Mở link">
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                                <button onClick={() => startEditDoc(doc)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Sửa"><Pencil size={14} /></button>
                                                <button onClick={() => handleDocDelete(doc.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Xóa"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        {doc.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{doc.description}</p>}
                                        <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                                            {doc.issuedDate && <span>Ngày cấp: {formatDate(doc.issuedDate)}</span>}
                                            {doc.expiryDate && <span>Hết hạn: {formatDate(doc.expiryDate)}</span>}
                                        </div>
                                        {doc.url && (
                                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                                <Link2 size={12} /> {doc.url.length > 60 ? doc.url.substring(0, 60) + '...' : doc.url}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FolderOpen size={28} className="text-slate-400" />
                        </div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có tài liệu</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Thêm bằng cấp, chứng chỉ, hợp đồng lao động...</p>
                        <button onClick={() => { resetDocForm(); setShowDocForm(true); }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                            <Plus size={14} /> Thêm tài liệu đầu tiên
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    // ===== TAB: KPI =====
    const renderKpi = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Năm:</span>
                <div className="flex gap-1.5">
                    {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                        <button key={y} onClick={() => setKpiYear(y)}
                            className={`px-3.5 py-1.5 text-sm font-bold rounded-lg transition-all ${kpiYear === y
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/50 dark:shadow-none'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                            {y}
                        </button>
                    ))}
                </div>
            </div>
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { title: 'KPI Ký kết', icon: Target, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400', value: stats.totalSigning, tgt: stats.target?.signing || 0, progress: stats.signingProgress, desc: 'Tổng giá trị hợp đồng ký kết' },
                        { title: 'KPI Doanh thu', icon: TrendingUp, iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400', value: stats.totalRevenue, tgt: stats.target?.revenue || 0, progress: stats.revenueProgress, desc: 'Doanh thu thực hiện ghi nhận' },
                        { title: 'LNG Quản trị', icon: DollarSign, iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400', value: stats.totalProfit, tgt: stats.target?.adminProfit || 0, progress: stats.profitProgress || 0, desc: 'Lợi nhuận gộp dựa trên giá trị ký' },
                        { title: 'LNG theo DT', icon: DollarSign, iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400', value: stats.totalRevenueProfit || 0, tgt: stats.target?.revProfit || 0, progress: stats.revProfitProgress || 0, desc: 'Lợi nhuận gộp dựa trên doanh thu thực tế' },
                    ].map(kpi => (
                        <div key={kpi.title} className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 ${kpi.iconBg} rounded-lg ${kpi.iconColor}`}><kpi.icon size={20} /></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{kpi.title}</p>
                                        <p className="text-[10px] text-slate-400">{kpi.desc}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xl font-black ${kpi.progress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : kpi.progress >= 70 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>{kpi.progress.toFixed(0)}%</span>
                                    {kpi.progress >= 100 && (<div className="flex items-center gap-1 mt-0.5 justify-end"><Award size={12} className="text-emerald-500" /><span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Đạt KPI</span></div>)}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-black text-slate-900 dark:text-slate-100">{formatCurrency(kpi.value)}</span>
                                    <span className="text-slate-400">/ {formatCurrency(kpi.tgt)}</span>
                                </div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(kpi.progress)}`} style={{ width: `${Math.min(kpi.progress, 100)}%` }} />
                                </div>
                                {kpi.tgt > 0 && <p className="text-[10px] text-slate-400">Còn thiếu: {formatCurrency(Math.max(0, kpi.tgt - kpi.value))}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!stats && (<div className="text-center py-12 text-slate-400"><Target size={32} className="mx-auto mb-3 opacity-50" /><p>Chưa có dữ liệu chỉ tiêu</p></div>)}
        </div>
    );

    // ===== TAB: CONTRACTS =====
    const renderContracts = () => (
        <div className="space-y-4">
            {stats && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Tổng HĐ', val: stats.contractCount, color: 'text-slate-900 dark:text-slate-100', filter: 'all' as const, active: 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/30 shadow-lg' },
                        { label: 'Đang thực hiện', val: stats.activeContracts, color: 'text-emerald-600 dark:text-emerald-400', filter: 'active' as const, active: 'border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/30 shadow-lg' },
                        { label: 'Hoàn thành', val: stats.completedContracts, color: 'text-blue-600 dark:text-blue-400', filter: 'completed' as const, active: 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/30 shadow-lg' },
                    ].map(s => (
                        <button key={s.filter} onClick={() => setContractFilter(s.filter)}
                            className={`bg-white dark:bg-slate-900 p-4 rounded-lg border text-center transition-all cursor-pointer ${contractFilter === s.filter ? s.active : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                            <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
                        </button>
                    ))}
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-500" /> Hợp đồng phụ trách
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{filteredContracts.length} / {contracts.length}</span>
                </div>
                {filteredContracts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                    <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mã HĐ</th>
                                    <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Khách hàng</th>
                                    <th className="text-right py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Giá trị</th>
                                    <th className="text-right py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Doanh thu</th>
                                    <th className="text-center py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>
                                    <th className="py-3 px-5 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {(showAllContracts ? filteredContracts : filteredContracts.slice(0, 15)).map(contract => (
                                    <tr key={contract.id} className="border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer" onClick={() => onViewContract(contract.id)}>
                                        <td className="py-3.5 px-5"><p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{contract.contractCode}</p><p className="text-[11px] text-slate-500 dark:text-slate-400 md:hidden mt-0.5">{contract.clientInitials}</p></td>
                                        <td className="py-3.5 px-5 hidden md:table-cell"><p className="font-medium text-slate-700 dark:text-slate-300 text-sm truncate max-w-[200px]">{contract.partyA}</p></td>
                                        <td className="py-3.5 px-5 text-right"><p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatCurrency(contract.value)}</p></td>
                                        <td className="py-3.5 px-5 text-right hidden sm:table-cell"><p className="font-medium text-slate-700 dark:text-slate-300 text-sm">{formatCurrency(contract.actualRevenue)}</p></td>
                                        <td className="py-3.5 px-5 text-center"><span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(contract.status)}`}>{CONTRACT_STATUS_LABELS[contract.status] || contract.status}</span></td>
                                        <td className="py-3.5 px-5"><button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"><ChevronRight size={16} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3"><FileText size={24} className="text-slate-400" /></div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có hợp đồng</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Nhân viên này chưa phụ trách hợp đồng nào</p>
                    </div>
                )}
                {filteredContracts.length > 15 && (
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
                        <button onClick={() => setShowAllContracts(!showAllContracts)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                            {showAllContracts ? 'Thu gọn' : `Xem tất cả ${contracts.length} hợp đồng`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" /></button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">Chi tiết Nhân viên</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Thông tin và hợp đồng phụ trách</p>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="h-20 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 relative">
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {stats && stats.signingProgress >= 100 && (<div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white"><Award size={14} /><span className="font-bold text-xs">Đạt KPI</span></div>)}
                        {isAllowedToEdit && (
                            <button onClick={() => setIsEditing(true)} className="p-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-colors" title="Chỉnh sửa thông tin"><Pencil size={18} /></button>
                        )}
                    </div>
                </div>
                <div className="px-6 py-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative z-10 w-20 h-20 -mt-14 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-xl border-4 border-white dark:border-slate-900 flex-shrink-0 overflow-hidden">
                            {person.avatar ? (<img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />) : (person.name.split(' ').pop()?.charAt(0) || '?')}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{person.name}</h2>
                                    {person.position && (<p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">{ROLE_LABELS[person.position as UserRole] || person.position}</p>)}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                                        person.status === 'resigned'
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                            : person.status === 'probation'
                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    }`}>
                                        {person.status === 'resigned' 
                                            ? 'Đã nghỉ việc' 
                                            : person.status === 'probation' 
                                                ? 'Đang thử việc' 
                                                : 'Đang làm việc'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400"><Building size={12} />{unit?.name || 'N/A'}</span>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400"><FileText size={12} />{contracts.length} hợp đồng</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                                {person.employeeCode && (<div className="flex items-center gap-2 text-sm"><div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg"><Hash size={14} className="text-slate-500" /></div><div><p className="text-[10px] text-slate-400 uppercase tracking-wide">Mã NV</p><p className="font-medium text-slate-700 dark:text-slate-300">{person.employeeCode}</p></div></div>)}
                                {person.email && (<div className="flex items-center gap-2 text-sm"><div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Mail size={14} className="text-blue-500" /></div><div className="min-w-0"><p className="text-[10px] text-slate-400 uppercase tracking-wide">Email</p><p className="font-medium text-slate-700 dark:text-slate-300 truncate">{person.email}</p></div></div>)}
                                {person.phone && (<div className="flex items-center gap-2 text-sm"><div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><Phone size={14} className="text-emerald-500" /></div><div><p className="text-[10px] text-slate-400 uppercase tracking-wide">SĐT</p><p className="font-medium text-slate-700 dark:text-slate-300">{person.phone}</p></div></div>)}
                                {person.dateJoined && (<div className="flex items-center gap-2 text-sm"><div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><Calendar size={14} className="text-amber-500" /></div><div><p className="text-[10px] text-slate-400 uppercase tracking-wide">Ngày vào</p><p className="font-medium text-slate-700 dark:text-slate-300">{formatDate(person.dateJoined)}</p></div></div>)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-2 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            <tab.icon size={16} />
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'timeline' && renderTimeline()}
                {activeTab === 'hr_contracts' && <ContractsHRTab employeeId={person.id} />}
                {activeTab === 'salary' && <SalaryHistoryTab employeeId={person.id} />}
                {activeTab === 'assets' && <AssetsTab employeeId={person.id} />}
                {activeTab === 'documents' && renderDocuments()}
                {activeTab === 'kpi' && renderKpi()}
                {activeTab === 'contracts' && renderContracts()}
            </div>

            <PersonnelForm isOpen={isEditing} onClose={() => setIsEditing(false)} onSubmit={handleEditSave} initialData={person} />
        </div>
    );
};

export default PersonnelDetail;
