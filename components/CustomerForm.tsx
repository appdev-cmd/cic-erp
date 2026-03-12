import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Save, Loader2, ChevronDown, X, Star, Search } from 'lucide-react';
import Modal from './ui/Modal';
import { Customer } from '../types';
import { INDUSTRIES } from '../constants';
import AICustomerFill from './ui/AICustomerFill';
import { TaxLookupService } from '../services/taxLookupService';
import { CustomerService } from '../services/customerService';

interface CustomerFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Customer, 'id'> | Customer) => Promise<void>;
    customer?: Customer;
    defaultType?: 'Customer' | 'Supplier' | 'Both' | 'all';
}

const CustomerForm: React.FC<CustomerFormProps> = ({ isOpen, onClose, onSave, customer, defaultType = 'Customer' }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [formData, setFormData] = useState({
        name: '',
        shortName: '',
        industry: [] as string[],
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        taxCode: '',
        website: '',
        notes: '',
        type: (defaultType === 'all' ? 'Customer' : defaultType) as 'Customer' | 'Supplier' | 'Both',
        rating: 'Standard' as 'VIP' | 'Gold' | 'Standard' | 'Lead',
        source: '',
        paymentTerms: '',
        creditLimit: 0,
    });

    useEffect(() => {
        if (customer) {
            setFormData({
                name: customer.name,
                shortName: customer.shortName,
                industry: Array.isArray(customer.industry) ? customer.industry : (customer.industry ? [customer.industry as string] : []),
                contactPerson: customer.contactPerson || '',
                phone: customer.phone || '',
                email: customer.email || '',
                address: customer.address || '',
                taxCode: customer.taxCode || '',
                website: customer.website || '',
                notes: customer.notes || '',
                type: customer.type || 'Customer',
                rating: customer.rating || 'Standard',
                source: customer.source || '',
                paymentTerms: customer.paymentTerms || '',
                creditLimit: customer.creditLimit || 0,
            });
        } else {
            setFormData({
                name: '',
                shortName: '',
                industry: [],
                contactPerson: '',
                phone: '',
                email: '',
                address: '',
                taxCode: '',
                website: '',
                notes: '',
                type: (defaultType === 'all' ? 'Customer' : defaultType) as 'Customer' | 'Supplier' | 'Both',
                rating: 'Standard' as 'VIP' | 'Gold' | 'Standard' | 'Lead',
                source: '',
                paymentTerms: '',
                creditLimit: 0,
            });
        }
    }, [customer, isOpen, defaultType]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowIndustryDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleIndustry = (ind: string) => {
        setFormData(prev => ({
            ...prev,
            industry: prev.industry.includes(ind)
                ? prev.industry.filter(i => i !== ind)
                : [...prev.industry, ind]
        }));
    };

    // AI auto-fill handler (only for new customer)
    const handleAIExtracted = useCallback((data: Partial<Customer>) => {
        setFormData(prev => ({
            ...prev,
            ...(data.name ? { name: data.name } : {}),
            ...(data.shortName ? { shortName: data.shortName } : {}),
            ...(data.industry && Array.isArray(data.industry) && data.industry.length > 0 ? { industry: data.industry } : {}),
            ...(data.contactPerson ? { contactPerson: data.contactPerson } : {}),
            ...(data.phone ? { phone: data.phone } : {}),
            ...(data.email ? { email: data.email } : {}),
            ...(data.address ? { address: data.address } : {}),
            ...(data.taxCode ? { taxCode: data.taxCode } : {}),
            ...(data.website ? { website: data.website } : {}),
        }));
    }, []);

    // ─── Tax Code Lookup via VietQR ──────────────────────
    const handleTaxLookup = useCallback(async () => {
        const code = formData.taxCode.trim();
        if (!code || code.length < 10) {
            toast.error('Vui lòng nhập mã số DN hợp lệ (≥ 10 ký tự)');
            return;
        }
        setIsLookingUp(true);
        try {
            const result = await TaxLookupService.lookup(code);
            if (!result) {
                toast.error('Không tìm thấy doanh nghiệp với mã số này');
                return;
            }
            // Auto-fill form fields from lookup
            setFormData(prev => ({
                ...prev,
                ...(result.name ? { name: result.name } : {}),
                ...(result.address ? { address: result.address } : {}),
            }));
            toast.success(`Đã tìm thấy: ${result.name}`);
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi tra cứu mã số DN');
        } finally {
            setIsLookingUp(false);
        }
    }, [formData.taxCode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setDuplicateError(null);

        // Validate tax code required for Customer type
        if ((formData.type === 'Customer' || formData.type === 'Both') && !formData.taxCode.trim()) {
            toast.error('Mã số Doanh nghiệp là bắt buộc khi đối tác là Khách hàng');
            return;
        }

        setIsSubmitting(true);
        try {
            // Duplicate check by tax code
            if (formData.taxCode.trim()) {
                const existing = await CustomerService.findByTaxCode(formData.taxCode.trim());
                if (existing && existing.id !== customer?.id) {
                    const msg = `Mã số DN "${formData.taxCode}" đã tồn tại — Đối tác: ${existing.name} (${existing.shortName})`;
                    setDuplicateError(msg);
                    toast.error(msg);
                    setIsSubmitting(false);
                    return;
                }
            }

            if (customer) {
                await onSave({ ...formData, id: customer.id });
            } else {
                await onSave(formData);
            }
            onClose();
        } catch (error) {
            console.error('Error saving customer:', error);
            toast.error('Lỗi khi lưu thông tin đối tác');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTitle = () => {
        if (customer) return 'Chỉnh sửa Đối tác';
        if (formData.type === 'Customer') return 'Thêm Khách hàng mới';
        if (formData.type === 'Supplier') return 'Thêm Nhà cung cấp mới';
        return 'Thêm Đối tác mới';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={getTitle()} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* AI Auto-fill — only visible when adding new */}
                {!customer && (
                    <AICustomerFill onExtracted={handleAIExtracted} />
                )}

                {/* Type Selection */}
                <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="type"
                            value="Customer"
                            checked={formData.type === 'Customer'}
                            onChange={() => setFormData(prev => ({ ...prev, type: 'Customer' }))}
                            className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Khách hàng</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="type"
                            value="Supplier"
                            checked={formData.type === 'Supplier'}
                            onChange={() => setFormData(prev => ({ ...prev, type: 'Supplier' }))}
                            className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nhà cung cấp</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="type"
                            value="Both"
                            checked={formData.type === 'Both'}
                            onChange={() => setFormData(prev => ({ ...prev, type: 'Both' }))}
                            className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cả hai</span>
                    </label>
                </div>

                {/* Row 1: Name + Short Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tên công ty *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="VD: FECON Corporation"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tên viết tắt *</label>
                        <input
                            type="text"
                            required
                            value={formData.shortName}
                            onChange={e => setFormData(prev => ({ ...prev, shortName: e.target.value.toUpperCase() }))}
                            placeholder="VD: FECON"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                </div>

                {/* Row 2: Industry (Multi-select) + Tax Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div ref={dropdownRef} className="relative">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Ngành nghề *</label>
                        <button
                            type="button"
                            onClick={() => setShowIndustryDropdown(!showIndustryDropdown)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-left flex items-center justify-between"
                        >
                            <span className={formData.industry.length > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
                                {formData.industry.length > 0 ? formData.industry.join(', ') : 'Chọn ngành nghề...'}
                            </span>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${showIndustryDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {/* Selected tags */}
                        {formData.industry.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {formData.industry.map(ind => (
                                    <span key={ind} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold">
                                        {ind}
                                        <button type="button" onClick={() => toggleIndustry(ind)} className="hover:text-rose-500"><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        {/* Dropdown */}
                        {showIndustryDropdown && (
                            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {INDUSTRIES.map(ind => (
                                    <label
                                        key={ind}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.industry.includes(ind)}
                                            onChange={() => toggleIndustry(ind)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{ind}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Mã số Doanh nghiệp {(formData.type === 'Customer' || formData.type === 'Both') && <span className="text-rose-500">*</span>}
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                required={formData.type === 'Customer' || formData.type === 'Both'}
                                value={formData.taxCode}
                                onChange={e => { setFormData(prev => ({ ...prev, taxCode: e.target.value })); setDuplicateError(null); }}
                                placeholder="VD: 0101234567"
                                className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${
                                    duplicateError ? 'border-rose-400 dark:border-rose-500' : 'border-slate-200 dark:border-slate-800'
                                }`}
                            />
                            <button
                                type="button"
                                onClick={handleTaxLookup}
                                disabled={isLookingUp || !formData.taxCode.trim()}
                                className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer disabled:cursor-not-allowed"
                                title="Tra cứu thông tin DN từ mã số thuế"
                            >
                                {isLookingUp ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                Tra cứu
                            </button>
                        </div>
                        {duplicateError && (
                            <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">{duplicateError}</p>
                        )}
                    </div>
                </div>

                {/* Contact Info Section */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Thông tin liên hệ</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Người liên hệ</label>
                            <input
                                type="text"
                                value={formData.contactPerson}
                                onChange={e => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                                placeholder="VD: Nguyễn Văn Hùng"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Số điện thoại</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="VD: 024 3784 5678"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="VD: contact@company.vn"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Website</label>
                            <input
                                type="text"
                                value={formData.website}
                                onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                                placeholder="VD: www.company.vn"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Địa chỉ</label>
                    <input
                        type="text"
                        value={formData.address}
                        onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="VD: Tầng 15, Tòa nhà ABC, Quận Cầu Giấy, Hà Nội"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Ghi chú</label>
                    <textarea
                        value={formData.notes}
                        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                        placeholder="Ghi chú thêm..."
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                    />
                </div>

                {/* CRM Section */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Star size={14} className="text-amber-500" />
                        CRM
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Phân hạng</label>
                            <select
                                value={formData.rating}
                                onChange={e => setFormData(prev => ({ ...prev, rating: e.target.value as any }))}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                                <option value="Lead">Lead (Tiềm năng)</option>
                                <option value="Standard">Standard</option>
                                <option value="Gold">Gold</option>
                                <option value="VIP">VIP</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nguồn khách hàng</label>
                            <select
                                value={formData.source}
                                onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                                <option value="">-- Chưa rõ --</option>
                                <option value="Website">Website</option>
                                <option value="Referral">Giới thiệu</option>
                                <option value="Cold call">Gọi điện</option>
                                <option value="Event">Sự kiện</option>
                                <option value="Partner">Đối tác</option>
                                <option value="Social Media">Mạng xã hội</option>
                                <option value="Other">Khác</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Điều khoản thanh toán</label>
                            <select
                                value={formData.paymentTerms}
                                onChange={e => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                                <option value="">-- Mặc định --</option>
                                <option value="COD">COD (Thanh toán khi nhận)</option>
                                <option value="Prepaid">Trả trước</option>
                                <option value="NET15">NET15 (15 ngày)</option>
                                <option value="NET30">NET30 (30 ngày)</option>
                                <option value="NET60">NET60 (60 ngày)</option>
                                <option value="NET90">NET90 (90 ngày)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Hạn mức tín dụng (VNĐ)</label>
                            <input
                                type="number"
                                min={0}
                                value={formData.creditLimit || ''}
                                onChange={e => setFormData(prev => ({ ...prev, creditLimit: parseInt(e.target.value) || 0 }))}
                                placeholder="0"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {customer ? 'Cập nhật' : 'Thêm mới'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CustomerForm;
