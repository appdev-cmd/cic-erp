import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, Loader2, X, AlertCircle } from 'lucide-react';
import { EmployeeService, UnitService } from '../services';
import { Employee, Unit } from '../types';
import { supabase } from '../lib/supabase';
import { dataClient } from '../lib/dataClient';

/**
 * Normalize date string to YYYY-MM-DD for native date input.
 * Handles: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, ISO timestamps
 */
const normalizeDate = (d?: string | null): string => {
    if (!d) return '';
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // ISO timestamp
    if (d.includes('T')) return d.split('T')[0];
    // DD/MM/YYYY or MM/DD/YYYY — parse via Date
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }
    return d;
};
import {
    AvatarSection,
    BasicInfoSection,
    PersonalSection,
    EmergencyContactSection,
    EducationSection,
    ContractSection,
    FormData
} from './form-sections';

interface PersonnelFormProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Employee;
    onSubmit: (data: Omit<Employee, 'id'> | Employee) => Promise<void>;
}

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

const PersonnelForm: React.FC<PersonnelFormProps> = ({ isOpen, onClose, initialData, onSubmit }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [units, setUnits] = useState<Unit[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Fetch units on open
    useEffect(() => {
        const fetchUnits = async () => {
            try {
                const data = await UnitService.getAll();
                setUnits(data);
            } catch (e) {
                console.error(e);
            }
        };
        if (isOpen) fetchUnits();
    }, [isOpen]);

    // Reset form when open/close or initialData changes
    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                unitId: initialData.unitId,
                avatar_url: initialData.avatar || '',
                employeeCode: initialData.employeeCode || '',
                position: initialData.position || '',
                email: initialData.email || '',
                phone: initialData.phone || '',
                telegram: initialData.telegram || '',
                dateJoined: normalizeDate(initialData.dateJoined),
                dateOfBirth: normalizeDate(initialData.dateOfBirth),
                gender: (initialData.gender as any) || '',
                address: initialData.address || '',
                education: initialData.education || '',
                specialization: initialData.specialization || '',
                certificates: initialData.certificates || '',
                idNumber: initialData.idNumber || '',
                bankAccount: initialData.bankAccount || '',
                bankName: initialData.bankName || '',
                maritalStatus: (initialData.maritalStatus as any) || '',
                emergencyContact: initialData.emergencyContact || '',
                emergencyPhone: initialData.emergencyPhone || '',
                contractType: initialData.contractType || '',
                contractEndDate: normalizeDate(initialData.contractEndDate),
                target: initialData.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
            });

            // If employee has no avatar, try fetching Google avatar from profiles table
            if (!initialData.avatar && initialData.email) {
                (async () => {
                    try {
                        const { data } = await dataClient
                            .from('profiles')
                            .select('avatar_url')
                            .ilike('email', initialData.email!)
                            .limit(1)
                            .single();
                        if (data?.avatar_url) {
                            setPreviewUrl(data.avatar_url);
                            setFormData(prev => ({ ...prev, avatar_url: data.avatar_url }));
                        }
                    } catch { /* no profile — keep placeholder */ }
                })();
                setPreviewUrl('');
            } else {
                setPreviewUrl(initialData.avatar || '');
            }
            setAvatarFile(null);
        } else {
            setFormData({
                ...initialFormData,
                dateJoined: new Date().toISOString().split('T')[0],
                contractType: 'Full-time',
            });
            setPreviewUrl('');
            setAvatarFile(null);
        }
    }, [initialData, isOpen]);

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

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Tên nhân viên là bắt buộc';
        }
        if (!formData.unitId) {
            newErrors.unitId = 'Vui lòng chọn đơn vị';
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Định dạng email không hợp lệ';
        }
        if (formData.phone && !/^[0-9+\-\s()]{8,15}$/.test(formData.phone)) {
            newErrors.phone = 'Số điện thoại không hợp lệ';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('Vui lòng kiểm tra lại thông tin');
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

            const submitData: any = {
                name: formData.name,
                unitId: formData.unitId,
                employeeCode: formData.employeeCode,
                position: formData.position,
                email: formData.email,
                phone: formData.phone,
                telegram: formData.telegram,
                dateJoined: formData.dateJoined,
                avatar: avatarUrl,
                target: formData.target,
                dateOfBirth: formData.dateOfBirth || null,
                gender: formData.gender || null,
                address: formData.address,
                education: formData.education,
                specialization: formData.specialization,
                certificates: formData.certificates,
                idNumber: formData.idNumber,
                bankAccount: formData.bankAccount,
                bankName: formData.bankName,
                maritalStatus: formData.maritalStatus || null,
                emergencyContact: formData.emergencyContact,
                emergencyPhone: formData.emergencyPhone,
                contractType: formData.contractType,
                contractEndDate: formData.contractEndDate || null
            };

            if (initialData?.id) submitData.id = initialData.id;

            await onSubmit(submitData);
            onClose();
            toast.success("Lưu Nhân sự thành công!");
        } catch (error) {
            toast.error("Có lỗi xảy ra khi lưu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {initialData ? 'Cập nhật Nhân sự' : 'Thêm mới Nhân sự'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Validation Errors Summary */}
                    {Object.keys(errors).length > 0 && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
                            <div className="text-sm text-red-700 dark:text-red-400">
                                {Object.values(errors).map((err, i) => (
                                    <p key={i}>{err}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Avatar & Basic Info */}
                    <div className="flex gap-6">
                        <AvatarSection previewUrl={previewUrl} onFileChange={handleFileChange} />
                        <BasicInfoSection formData={formData} setFormData={setFormData} units={units} />
                    </div>

                    {/* Personal Info */}
                    <PersonalSection formData={formData} setFormData={setFormData} />

                    {/* Emergency Contact */}
                    <EmergencyContactSection formData={formData} setFormData={setFormData} />

                    {/* Education */}
                    <EducationSection formData={formData} setFormData={setFormData} />

                    {/* Contract */}
                    <ContractSection formData={formData} setFormData={setFormData} />

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || isUploading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {initialData ? 'Cập nhật' : 'Thêm mới'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PersonnelForm;
