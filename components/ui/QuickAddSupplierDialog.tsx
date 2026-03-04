import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Building2, Phone, Mail, Loader2, CheckCircle, Hash, MapPin, ChevronDown } from 'lucide-react';
import { CustomerService } from '../../services/customerService';
import { Customer } from '../../types';
import { INDUSTRIES } from '../../constants';
import AICustomerFill from './AICustomerFill';

interface QuickAddSupplierDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (supplier: Customer) => void;
    initialName?: string;
}

const QuickAddSupplierDialog: React.FC<QuickAddSupplierDialogProps> = ({
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

    // AI auto-fill handler
    const handleAIExtracted = useCallback((data: Partial<Customer>) => {
        if (data.name) setName(data.name);
        if (data.shortName) setShortName(data.shortName);
        if (data.industry && Array.isArray(data.industry) && data.industry.length > 0) setIndustry(data.industry);
        if (data.contactPerson) setContactPerson(data.contactPerson);
        if (data.phone) setPhone(data.phone);
        if (data.email) setEmail(data.email);
        if (data.taxCode) setTaxCode(data.taxCode);
        if (data.address) setAddress(data.address);
    }, []);

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
            setError('Vui lòng nhập tên nhà cung cấp');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const newSupplier = await CustomerService.create({
                name: name.trim(),
                shortName: shortName.trim(),
                industry: industry.length > 0 ? industry : ['Khác'],
                contactPerson: contactPerson.trim(),
                phone: phone.trim(),
                email: email.trim(),
                taxCode: taxCode.trim(),
                address: address.trim(),
                type: 'Supplier'
            } as any);

            onCreated(newSupplier);
            resetForm();
            onClose();
        } catch (err: any) {
            console.error('[QuickAddSupplier] Error:', err);
            setError(err.message || 'Không thể tạo nhà cung cấp. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                            <Building2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Thêm nhà cung cấp mới</h2>
                            <p className="text-teal-100 text-xs">Tạo nhanh NCC để chọn cho hạng mục</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { resetForm(); onClose(); }}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-white" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* AI Auto-fill */}
                    <AICustomerFill onExtracted={handleAIExtracted} compact />

                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-medium">
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Building2 size={10} /> Tên nhà cung cấp *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Công ty TNHH ABC..."
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Short name + Industry */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Tên viết tắt</label>
                            <input
                                type="text"
                                value={shortName}
                                onChange={(e) => setShortName(e.target.value)}
                                placeholder="VD: ABC"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1 relative" ref={dropdownRef}>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Ngành nghề</label>
                            <button
                                type="button"
                                onClick={() => setShowDropdown(!showDropdown)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-teal-500 outline-none transition-all text-left flex items-center justify-between"
                            >
                                <span className={industry.length > 0 ? 'text-slate-900 dark:text-slate-100 truncate' : 'text-slate-400'}>
                                    {industry.length > 0 ? industry.join(', ') : '-- Chọn --'}
                                </span>
                                <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {industry.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {industry.map(ind => (
                                        <span key={ind} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded text-[10px] font-bold">
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
                                                className="w-3.5 h-3.5 rounded text-teal-600"
                                            />
                                            <span className="text-slate-700 dark:text-slate-300">{ind}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tax + Phone */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Hash size={10} /> Mã số thuế
                            </label>
                            <input
                                type="text"
                                value={taxCode}
                                onChange={(e) => setTaxCode(e.target.value)}
                                placeholder="MST..."
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Phone size={10} /> SĐT
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Số điện thoại..."
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Email + Address */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Mail size={10} /> Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@company.com"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <MapPin size={10} /> Địa chỉ
                            </label>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Địa chỉ..."
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-teal-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => { resetForm(); onClose(); }}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="px-6 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-bold rounded-lg hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-teal-200 dark:shadow-none"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={14} className="animate-spin" /> Đang tạo...</>
                            ) : (
                                <><CheckCircle size={14} /> Tạo & Chọn</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuickAddSupplierDialog;
