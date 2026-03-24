import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Save, Loader2, X, Settings, Sun, Moon, Palette } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EmployeeService } from '../services';
import { Employee, Unit } from '../types';
import { UnitService } from '../services';
import { supabase } from '../lib/supabase';
import {
    AvatarSection,
    BasicInfoSection,
    PersonalSection,
    EmergencyContactSection,
    EducationSection,
    ContractSection,
    FormData
} from './form-sections';

/**
 * Normalize date string to YYYY-MM-DD for native date input.
 */
const normalizeDate = (d?: string | null): string => {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    if (d.includes('T')) return d.split('T')[0];
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }
    return d;
};

const initialFormData: FormData = {
    name: '',
    unitId: '',
    employeeCode: '',
    position: '',
    email: '',
    phone: '',
    telegram: '',
    dateJoined: '',
    avatar_url: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    education: '',
    specialization: '',
    certificates: '',
    idNumber: '',
    bankAccount: '',
    bankName: '',
    maritalStatus: '',
    emergencyContact: '',
    emergencyPhone: '',
    contractType: '',
    contractEndDate: '',
    target: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
};

interface PersonalSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    theme?: 'light' | 'dark';
    setTheme?: (theme: 'light' | 'dark') => void;
    accent?: 'orange' | 'blue';
    setAccent?: (accent: 'orange' | 'blue') => void;
}

const PersonalSettingsDialog: React.FC<PersonalSettingsDialogProps> = ({
    isOpen,
    onClose,
    theme,
    setTheme,
    accent,
    setAccent,
}) => {
    const { profile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [units, setUnits] = useState<Unit[]>([]);
    const [employeeId, setEmployeeId] = useState<string | null>(null);

    // Load employee data on open
    useEffect(() => {
        if (!isOpen || !profile?.employeeId) {
            if (isOpen && !profile?.employeeId) {
                setIsLoading(false);
            }
            return;
        }

        const loadData = async () => {
            setIsLoading(true);
            try {
                const [employee, allUnits] = await Promise.all([
                    EmployeeService.getById(profile.employeeId!),
                    UnitService.getAll()
                ]);

                setUnits(allUnits);

                if (employee) {
                    setEmployeeId(employee.id);
                    setFormData({
                        name: employee.name,
                        unitId: employee.unitId,
                        avatar_url: employee.avatar || '',
                        employeeCode: employee.employeeCode || '',
                        position: employee.position || '',
                        email: employee.email || '',
                        phone: employee.phone || '',
                        telegram: employee.telegram || '',
                        telegram_verified: employee.telegram_verified || false,
                        dateJoined: normalizeDate(employee.dateJoined),
                        dateOfBirth: normalizeDate(employee.dateOfBirth),
                        gender: (employee.gender as any) || '',
                        address: employee.address || '',
                        education: employee.education || '',
                        specialization: employee.specialization || '',
                        certificates: employee.certificates || '',
                        idNumber: employee.idNumber || '',
                        bankAccount: employee.bankAccount || '',
                        bankName: employee.bankName || '',
                        maritalStatus: (employee.maritalStatus as any) || '',
                        emergencyContact: employee.emergencyContact || '',
                        emergencyPhone: employee.emergencyPhone || '',
                        contractType: employee.contractType || '',
                        contractEndDate: normalizeDate(employee.contractEndDate),
                        target: employee.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
                    });
                    setPreviewUrl(employee.avatar || '');
                }
            } catch (error) {
                console.error('Error loading personal settings:', error);
                toast.error('Không thể tải thông tin cá nhân');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [isOpen, profile?.employeeId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) {
            setAvatarFile(null);
            return;
        }
        const file = e.target.files[0];
        setAvatarFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const uploadAvatar = async (file: File): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading avatar:', error);
            return null;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!employeeId) {
            toast.error('Không tìm thấy thông tin nhân viên');
            return;
        }

        setIsSubmitting(true);
        try {
            let avatarUrl = formData.avatar_url;

            if (avatarFile) {
                setIsUploading(true);
                const uploadedUrl = await uploadAvatar(avatarFile);
                if (uploadedUrl) avatarUrl = uploadedUrl;
                setIsUploading(false);
            }

            // Only send editable fields to update
            const updateData: Partial<Employee> = {
                id: employeeId,
                avatar: avatarUrl,
                phone: formData.phone,
                telegram: formData.telegram,
                // Personal info (all editable)
                dateOfBirth: formData.dateOfBirth || undefined,
                gender: formData.gender as any || undefined,
                address: formData.address,
                idNumber: formData.idNumber,
                maritalStatus: formData.maritalStatus as any || undefined,
                // Emergency contact
                emergencyContact: formData.emergencyContact,
                emergencyPhone: formData.emergencyPhone,
                // Education
                education: formData.education,
                specialization: formData.specialization,
                certificates: formData.certificates,
                // Bank info only (contract type/end date not editable)
                bankAccount: formData.bankAccount,
                bankName: formData.bankName,
            };

            await EmployeeService.update(employeeId, updateData);
            onClose();
            toast.success('Đã cập nhật thông tin cá nhân!');
        } catch (error) {
            console.error('Error saving personal settings:', error);
            toast.error('Có lỗi xảy ra khi lưu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Settings size={20} className="text-orange-500" />
                        Thiết lập cá nhân
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                        <X size={20} className="text-slate-500 dark:text-slate-400" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-orange-500" />
                        <span className="ml-3 text-slate-500 dark:text-slate-400">Đang tải thông tin...</span>
                    </div>
                ) : !employeeId ? (
                    <div className="p-8 text-center">
                        <p className="text-slate-500 dark:text-slate-400">
                            Tài khoản của bạn chưa được liên kết với nhân viên trong hệ thống.
                        </p>

                        {/* Still show theme settings even without employee link */}
                        {setTheme && setAccent && (
                            <div className="mt-6 max-w-sm mx-auto">
                                <ThemeSection theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} />
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* ═══ Theme & Accent Settings ═══ */}
                        {setTheme && setAccent && (
                            <ThemeSection theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} />
                        )}

                        {/* Avatar & Basic Info (readOnly for most fields) */}
                        <div className="flex gap-6">
                            <AvatarSection previewUrl={previewUrl} onFileChange={handleFileChange} />
                            <BasicInfoSection
                                formData={formData}
                                setFormData={setFormData}
                                units={units}
                                readOnly={true}
                                isPersonalSettings={true}
                            />
                        </div>

                        {/* Personal Info (all editable) */}
                        <PersonalSection formData={formData} setFormData={setFormData} />

                        {/* Emergency Contact (editable) */}
                        <EmergencyContactSection formData={formData} setFormData={setFormData} />

                        {/* Education (editable) */}
                        <EducationSection formData={formData} setFormData={setFormData} />

                        {/* Contract (readOnly for type/date, editable for bank) */}
                        <ContractSection formData={formData} setFormData={setFormData} readOnly={true} />

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || isUploading}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors cursor-pointer font-medium"
                            >
                                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Lưu thay đổi
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
};

// ═══ Theme & Accent sub-component ═══
const ThemeSection: React.FC<{
    theme?: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    accent?: 'orange' | 'blue';
    setAccent: (accent: 'orange' | 'blue') => void;
}> = ({ theme, setTheme, accent, setAccent }) => (
    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
        <h4 className="font-medium flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Palette size={18} className="text-orange-500" />
            Giao diện
        </h4>
        <div className="flex flex-wrap items-center gap-6">
            {/* Light / Dark Mode */}
            <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chế độ:</span>
                <div className="flex items-center gap-1 p-0.5 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                    <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${theme === 'light'
                            ? 'bg-orange-50 dark:bg-slate-600 text-orange-600 dark:text-orange-400 shadow-sm'
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                    >
                        <Sun size={13} />
                        Sáng
                    </button>
                    <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${theme === 'dark'
                            ? 'bg-slate-800 dark:bg-slate-600 text-orange-400 shadow-sm'
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                    >
                        <Moon size={13} />
                        Tối
                    </button>
                </div>
            </div>

            {/* Accent Color */}
            <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Màu chủ đạo:</span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setAccent('orange')}
                        title="Cam"
                        style={accent === 'orange'
                            ? { backgroundColor: '#f97316', '--tw-ring-color': '#f97316' } as React.CSSProperties
                            : { backgroundColor: '#f97316' }}
                        className={`w-7 h-7 rounded-full transition-all cursor-pointer ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ${accent === 'orange' ? 'ring-2 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'
                            }`}
                    />
                    <button
                        type="button"
                        onClick={() => setAccent('blue')}
                        title="CIC Blue"
                        style={accent === 'blue'
                            ? { backgroundColor: '#0ea5e9', '--tw-ring-color': '#0ea5e9' } as React.CSSProperties
                            : { backgroundColor: '#0ea5e9' }}
                        className={`w-7 h-7 rounded-full transition-all cursor-pointer ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ${accent === 'blue' ? 'ring-2 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'
                            }`}
                    />
                </div>
            </div>
        </div>
    </div>
);

export default PersonalSettingsDialog;
