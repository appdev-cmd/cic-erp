import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, CheckCircle, ChevronDown, Search, Star } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerService } from '../../services/customerService';
import { TaxLookupService } from '../../services/taxLookupService';
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const [error, setError] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        name: initialName,
        shortName: '',
        industry: [] as string[],
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        taxCode: '',
        website: '',
        notes: '',
        type: 'Supplier' as 'Customer' | 'Supplier' | 'Both',
        rating: 'Standard' as 'VIP' | 'Gold' | 'Standard' | 'Lead',
        source: '',
        paymentTerms: '',
        creditLimit: 0,
    });

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: initialName,
                shortName: '',
                industry: [],
                contactPerson: '',
                phone: '',
                email: '',
                address: '',
                taxCode: '',
                website: '',
                notes: '',
                type: 'Supplier',
                rating: 'Standard' as 'VIP' | 'Gold' | 'Standard' | 'Lead',
                source: '',
                paymentTerms: '',
                creditLimit: 0,
            });
            setError('');
            setDuplicateError(null);
            setShowIndustryDropdown(false);
        }
    }, [isOpen, initialName]);

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

    // AI auto-fill handler
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

        if (!formData.name.trim()) {
            setError('Vui lòng nhập tên nhà cung cấp');
            return;
        }

        // Validate tax code required for Customer type
        if ((formData.type === 'Customer' || formData.type === 'Both') && !formData.taxCode.trim()) {
            toast.error('Mã số Doanh nghiệp là bắt buộc khi đối tác là Khách hàng');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Duplicate check by tax code
            if (formData.taxCode.trim()) {
                const existing = await CustomerService.findByTaxCode(formData.taxCode.trim());
                if (existing) {
                    const msg = `Mã số DN "${formData.taxCode}" đã tồn tại — Đối tác: ${existing.name} (${existing.shortName})`;
                    setDuplicateError(msg);
                    toast.error(msg);
                    setIsSubmitting(false);
                    return;
                }
            }

            const newSupplier = await CustomerService.create({
                name: formData.name.trim(),
                shortName: formData.shortName.trim(),
                industry: formData.industry.length > 0 ? formData.industry : ['Khác'],
                contactPerson: formData.contactPerson.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim(),
                taxCode: formData.taxCode.trim(),
                address: formData.address.trim(),
                website: formData.website.trim(),
                notes: formData.notes.trim(),
                type: formData.type,
                rating: formData.rating,
                source: formData.source,
                paymentTerms: formData.paymentTerms,
                creditLimit: formData.creditLimit,
            } as any);

            onCreated(newSupplier);
            onClose();
        } catch (err: any) {
            console.error('[QuickAddSupplier] Error:', err);
            setError(err.message || 'Không thể tạo nhà cung cấp. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const isCustomerType = formData.type === 'Customer' || formData.type === 'Both';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 dark:ring-1 dark:ring-slate-700/40">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Thêm Đối tác mới</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* AI Auto-fill */}
                    <AICustomerFill onExtracted={handleAIExtracted} compact />

                    {/* Type Selection */}
                    <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="quickAddSupplierType"
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
                                name="quickAddSupplierType"
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
                                name="quickAddSupplierType"
                                value="Both"
                                checked={formData.type === 'Both'}
                                onChange={() => setFormData(prev => ({ ...prev, type: 'Both' }))}
                                className="w-4 h-4 text-indigo-600"
                            />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cả hai</span>
                        </label>
                    </div>

                    {/* Row 1: Mã số DN + Tra cứu + Tên viết tắt */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_180px] gap-2 items-end">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                Mã số Doanh nghiệp {isCustomerType && <span className="text-rose-500">*</span>}
                            </label>
                            <input
                                type="text"
                                required={isCustomerType}
                                value={formData.taxCode}
                                onChange={e => { setFormData(prev => ({ ...prev, taxCode: e.target.value })); setDuplicateError(null); }}
                                placeholder="VD: 0101234567"
                                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${
                                    duplicateError ? 'border-rose-400 dark:border-rose-500' : 'border-slate-200 dark:border-slate-800'
                                }`}
                                autoFocus
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleTaxLookup}
                            disabled={isLookingUp || !formData.taxCode.trim()}
                            className="px-3 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer disabled:cursor-not-allowed"
                            title="Tra cứu thông tin DN từ mã số thuế"
                        >
                            {isLookingUp ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            Tra cứu
                        </button>
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
                    {duplicateError && (
                        <p className="-mt-3 text-xs text-rose-500 dark:text-rose-400">{duplicateError}</p>
                    )}

                    {/* Row 2: Tên công ty */}
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

                    {/* Row 3: Industry */}
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

                    {/* Error */}
                    {error && (
                        <div className="px-4 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !formData.name.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={16} className="animate-spin" /> Đang tạo...</>
                            ) : (
                                <><CheckCircle size={16} /> Tạo & Chọn</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuickAddSupplierDialog;
