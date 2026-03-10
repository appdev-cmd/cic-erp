import React, { useState } from 'react';
import { X, User, Phone, Mail, MapPin, Calendar, GraduationCap, CreditCard, Heart, Building, Pencil, Trash2 } from 'lucide-react';
import { Employee, Unit } from '../types';
import { usePermissionCheck } from '../hooks/usePermissions';
import { formatDate } from '../utils/formatters';

interface EmployeeDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: Employee | null;
    unit?: Unit;
    onEdit: (employee: Employee) => void;
    onDelete: (id: string) => void;
}

type TabType = 'personal' | 'contact' | 'education' | 'contract';

const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({ isOpen, onClose, employee, unit, onEdit, onDelete }) => {
    const [activeTab, setActiveTab] = useState<TabType>('personal');
    const { can } = usePermissionCheck();

    if (!isOpen || !employee) return null;



    const getGenderLabel = (gender?: string) => {
        switch (gender) {
            case 'male': return 'Nam';
            case 'female': return 'Nữ';
            case 'other': return 'Khác';
            default: return '—';
        }
    };

    const getMaritalLabel = (status?: string) => {
        switch (status) {
            case 'single': return 'Độc thân';
            case 'married': return 'Đã kết hôn';
            case 'divorced': return 'Ly hôn';
            case 'widowed': return 'Góa';
            default: return '—';
        }
    };

    const tabs = [
        { id: 'personal' as TabType, label: 'Cá nhân', icon: User },
        { id: 'contact' as TabType, label: 'Liên hệ', icon: Phone },
        { id: 'education' as TabType, label: 'Học vấn', icon: GraduationCap },
        { id: 'contract' as TabType, label: 'Hợp đồng', icon: Building },
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header with Avatar */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-8 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-lg bg-white/20 flex items-center justify-center text-3xl font-bold overflow-hidden border border-white/30">
                            {employee.avatar ? (
                                <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                            ) : (
                                employee.name.split(' ').pop()?.charAt(0) || '?'
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{employee.name}</h2>
                            <p className="text-white/80 text-sm mt-1">{employee.position || employee.roleCode || 'Nhân viên'}</p>
                            <div className="flex items-center gap-2 mt-2">
                                {employee.employeeCode && (
                                    <span className="px-2 py-0.5 bg-white/20 rounded text-xs">{employee.employeeCode}</span>
                                )}
                                {unit && (
                                    <span className="px-2 py-0.5 bg-white/20 rounded text-xs">{unit.name}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50 dark:bg-slate-800">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-6 max-h-[40vh] overflow-y-auto">
                    {activeTab === 'personal' && (
                        <div className="grid grid-cols-2 gap-x-6">
                            <InfoRow label="Ngày sinh" value={formatDate(employee.dateOfBirth)} icon={Calendar} />
                            <InfoRow label="Giới tính" value={getGenderLabel(employee.gender)} icon={User} />
                            <InfoRow label="Số CCCD/CMND" value={employee.idNumber || ''} icon={CreditCard} />
                            <InfoRow label="Tình trạng hôn nhân" value={getMaritalLabel(employee.maritalStatus)} icon={Heart} />
                            <div className="col-span-2">
                                <InfoRow label="Địa chỉ" value={employee.address || ''} icon={MapPin} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'contact' && (
                        <div className="space-y-1">
                            <InfoRow label="Email" value={employee.email || ''} icon={Mail} />
                            <InfoRow label="Số điện thoại" value={employee.phone || ''} icon={Phone} />
                            <InfoRow label="Telegram" value={employee.telegram || ''} icon={Mail} />
                            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                    <Heart size={16} className="text-red-400" />
                                    Liên hệ khẩn cấp
                                </h4>
                                <InfoRow label="Tên người liên hệ" value={employee.emergencyContact || ''} icon={User} />
                                <InfoRow label="Số điện thoại" value={employee.emergencyPhone || ''} icon={Phone} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'education' && (
                        <div className="space-y-1">
                            <InfoRow label="Trình độ học vấn" value={employee.education || ''} icon={GraduationCap} />
                            <InfoRow label="Chuyên ngành" value={employee.specialization || ''} icon={GraduationCap} />
                            <InfoRow label="Chứng chỉ" value={employee.certificates || ''} icon={GraduationCap} />
                        </div>
                    )}

                    {activeTab === 'contract' && (
                        <div className="space-y-1">
                            <InfoRow label="Ngày vào làm" value={formatDate(employee.dateJoined)} icon={Calendar} />
                            <InfoRow label="Loại hợp đồng" value={employee.contractType || ''} icon={Building} />
                            <InfoRow label="Ngày hết hạn HĐ" value={formatDate(employee.contractEndDate)} icon={Calendar} />
                            <InfoRow label="Đơn vị" value={unit?.name || ''} icon={Building} />
                            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                    <CreditCard size={16} className="text-emerald-400" />
                                    Thông tin ngân hàng
                                </h4>
                                <InfoRow label="Số tài khoản" value={employee.bankAccount || ''} icon={CreditCard} />
                                <InfoRow label="Ngân hàng" value={employee.bankName || ''} icon={Building} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                    <div className="flex gap-2">
                        {employee.phone && (
                            <a
                                href={`tel:${employee.phone}`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <Phone size={16} /> Gọi điện
                            </a>
                        )}
                        {employee.email && (
                            <a
                                href={`mailto:${employee.email}`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <Mail size={16} /> Email
                            </a>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {can('employees', 'update') && (
                            <button
                                onClick={() => { onEdit(employee); onClose(); }}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                            >
                                <Pencil size={16} /> Chỉnh sửa
                            </button>
                        )}
                        {can('employees', 'delete') && (
                            <button
                                onClick={() => { onDelete(employee.id); onClose(); }}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} /> Xóa
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetailModal;
