import React, { useState } from 'react';
import { Customer } from '../../types';
import { Building2, Globe, Hash, User, Phone, Mail, MapPin, Briefcase, ShieldCheck, Calendar, Landmark, CheckCircle2, ChevronUp, ChevronDown, Save, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FieldConfig {
    key: keyof Partial<Customer>;
    label: string;
    icon: any;
    type?: 'text' | 'array' | 'date';
}

export const CUSTOMER_FIELDS: FieldConfig[] = [
    { key: 'name', label: 'Tên công ty', icon: Building2 },
    { key: 'shortName', label: 'Tên viết tắt', icon: Building2 },
    { key: 'internationalName', label: 'Tên quốc tế', icon: Globe },
    { key: 'taxCode', label: 'Mã số thuế', icon: Hash },
    { key: 'representative', label: 'Người đại diện', icon: User },
    { key: 'contactPerson', label: 'Người liên hệ', icon: User },
    { key: 'phone', label: 'Điện thoại', icon: Phone },
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'address', label: 'Địa chỉ', icon: MapPin },
    { key: 'website', label: 'Website', icon: Globe },
    { key: 'industry', label: 'Ngành nghề', icon: Briefcase, type: 'array' },
    { key: 'businessType', label: 'Loại hình DN', icon: Building2 },
    { key: 'businessStatus', label: 'Tình trạng', icon: ShieldCheck },
    { key: 'foundedDate', label: 'Ngày hoạt động', icon: Calendar, type: 'date' },
    { key: 'bankName', label: 'Ngân hàng', icon: Landmark },
    { key: 'bankBranch', label: 'Chi nhánh NH', icon: Landmark },
    { key: 'bankAccount', label: 'Số tài khoản', icon: Hash },
];

export const CustomerExtractCard: React.FC<{
    data: Partial<Customer>;
    onSave: (data: Partial<Customer>) => void;
    saving: boolean;
}> = ({ data, onSave, saving }) => {
    const [editData, setEditData] = useState<Partial<Customer>>(data);
    const [showEmpty, setShowEmpty] = useState(false);

    const filledFields = CUSTOMER_FIELDS.filter(f => {
        const val = (editData as any)[f.key];
        return val && (Array.isArray(val) ? val.length > 0 : String(val).trim() !== '');
    });
    const emptyFields = CUSTOMER_FIELDS.filter(f => {
        const val = (editData as any)[f.key];
        return !val || (Array.isArray(val) ? val.length === 0 : String(val).trim() === '');
    });

    const updateField = (key: string, value: any) => {
        setEditData(prev => ({ ...prev, [key]: value }));
    };

    const renderField = (field: FieldConfig) => {
        const val = (editData as any)[field.key];
        const display = field.type === 'array'
            ? (Array.isArray(val) ? val.join(', ') : val || '')
            : (val ?? '');
        const isFilled = display && String(display).trim() !== '';
        const Icon = field.icon;

        return (
            <div key={field.key} className="flex items-center gap-2 py-1.5">
                <Icon size={13} className={isFilled ? "text-violet-500 shrink-0" : "text-slate-400 dark:text-slate-600 shrink-0"} />
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 w-24 shrink-0">{field.label}</span>
                <input
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={display}
                    onChange={(e) => {
                        const v = field.type === 'array'
                            ? e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            : e.target.value;
                        updateField(field.key, v);
                    }}
                    className={cn(
                        "flex-1 px-2 py-1 text-sm rounded-md border bg-transparent transition-colors",
                        "focus:outline-none focus:ring-1 focus:ring-violet-400",
                        isFilled
                            ? "border-violet-200/50 dark:border-violet-800/30 text-slate-800 dark:text-slate-200 font-medium"
                            : "border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                    )}
                    placeholder="Nhập bổ sung..."
                />
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            {/* Header with progress bar */}
            <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                            Trích xuất: {filledFields.length}/{CUSTOMER_FIELDS.length} trường
                        </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-500">
                        {Math.round((filledFields.length / CUSTOMER_FIELDS.length) * 100)}%
                    </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${(filledFields.length / CUSTOMER_FIELDS.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* All filled fields — always visible */}
            <div className="px-4 py-2">
                {filledFields.map(renderField)}
            </div>

            {/* Empty fields — expandable */}
            {emptyFields.length > 0 && (
                <>
                    <button
                        onClick={() => setShowEmpty(!showEmpty)}
                        className="w-full flex items-center justify-center gap-1 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 border-t border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        {showEmpty ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {showEmpty ? 'Ẩn trường trống' : `${emptyFields.length} trường trống — bổ sung thủ công`}
                    </button>
                    {showEmpty && (
                        <div className="px-4 pb-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                            {emptyFields.map(renderField)}
                        </div>
                    )}
                </>
            )}

            {/* Save Button */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <button
                    onClick={() => onSave(editData)}
                    disabled={saving || !editData.name}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl text-sm font-black transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-emerald-200 dark:shadow-none"
                >
                    {saving ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang lưu...</>
                    ) : (
                        <><Save size={16} /> Nạp vào Khách hàng</>
                    )}
                </button>
            </div>
        </div>
    );
};
