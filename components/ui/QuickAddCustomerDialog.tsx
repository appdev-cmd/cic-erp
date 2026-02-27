import React, { useState, useRef, useEffect } from 'react';
import { X, User, Building2, Phone, Mail, Loader2, CheckCircle, Hash, MapPin, ChevronDown } from 'lucide-react';
import { CustomerService } from '../../services/customerService';
import { Customer } from '../../types';
import { INDUSTRIES } from '../../constants';

interface QuickAddCustomerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (customer: Customer) => void;
    initialName?: string;
}

const QuickAddCustomerDialog: React.FC<QuickAddCustomerDialogProps> = ({
    isOpen,
    onClose,
    onCreated,
    initialName = ''
}) => {
    const [name, setName] = useState(initialName);
    const [shortName, setShortName] = useState('');
    const [industry, setIndustry] = useState<string[]>([]);
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [taxCode, setTaxCode] = useState('');
    const [address, setAddress] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const resetForm = () => {
        setName('');
        setShortName('');
        setIndustry([]);
        setContactPerson('');
        setPhone('');
        setEmail('');
        setTaxCode('');
        setAddress('');
        setError('');
        setShowDropdown(false);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleIndustry = (ind: string) => {
        setIndustry(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Vui lòng nhập tên khách hàng');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const newCustomer = await CustomerService.create({
                name: name.trim(),
                shortName: shortName.trim(),
                industry: industry.length > 0 ? industry : ['Khác'],
                contactPerson: contactPerson.trim(),
                phone: phone.trim(),
                email: email.trim(),
                taxCode: taxCode.trim(),
                address: address.trim(),
                type: 'Customer'
            } as any);

            onCreated(newCustomer);
            resetForm();
            onClose();
        } catch (err: any) {
            console.error('[QuickAddCustomer] Error:', err);
            setError(err.message || 'Không thể tạo khách hàng. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center">
                            <Building2 size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">Thêm khách hàng mới</h3>
                            <p className="text-xs text-slate-400">Tạo nhanh và chọn ngay</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Name - Required */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">
                            Tên khách hàng <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Công ty TNHH ABC"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Short Name + Industry */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tên viết tắt</label>
                            <input
                                type="text"
                                value={shortName}
                                onChange={(e) => setShortName(e.target.value)}
                                placeholder="VD: ABC Co."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1.5 relative" ref={dropdownRef}>
                            <label className="text-xs font-bold text-slate-500 uppercase">Ngành nghề</label>
                            <button
                                type="button"
                                onClick={() => setShowDropdown(!showDropdown)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all text-left flex items-center justify-between"
                            >
                                <span className={industry.length > 0 ? 'text-slate-900 dark:text-slate-100 truncate' : 'text-slate-400'}>
                                    {industry.length > 0 ? industry.join(', ') : '-- Chọn --'}
                                </span>
                                <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {/* Selected tags */}
                            {industry.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {industry.map(ind => (
                                        <span key={ind} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold">
                                            {ind}
                                            <button type="button" onClick={() => toggleIndustry(ind)} className="hover:text-rose-500"><X size={8} /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {showDropdown && (
                                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {INDUSTRIES.map(ind => (
                                        <label key={ind} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                checked={industry.includes(ind)}
                                                onChange={() => toggleIndustry(ind)}
                                                className="w-3.5 h-3.5 rounded text-indigo-600"
                                            />
                                            <span className="text-slate-700 dark:text-slate-300">{ind}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contact Person */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                            <User size={12} /> Người liên hệ
                        </label>
                        <input
                            type="text"
                            value={contactPerson}
                            onChange={(e) => setContactPerson(e.target.value)}
                            placeholder="VD: Nguyễn Văn A"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>

                    {/* Phone + Email */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Phone size={12} /> Số điện thoại
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="0xxx xxx xxx"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Mail size={12} /> Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="contact@company.vn"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Tax Code + Address */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Hash size={12} /> Mã số thuế
                            </label>
                            <input
                                type="text"
                                value={taxCode}
                                onChange={(e) => setTaxCode(e.target.value)}
                                placeholder="VD: 0123456789"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <MapPin size={12} /> Địa chỉ
                            </label>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="VD: 123 Nguyễn Huệ, Q.1, TP.HCM"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="px-4 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => { resetForm(); onClose(); }}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-bold text-sm transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Đang tạo...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Tạo & Chọn
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuickAddCustomerDialog;
