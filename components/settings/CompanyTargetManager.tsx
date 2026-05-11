import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Building2, TrendingUp } from 'lucide-react';
import { CompanyTargetService, CompanyTarget } from '../../services/companyTargetService';

const CompanyTargetManager: React.FC = () => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [target, setTarget] = useState<CompanyTarget | null>(null);

    // Form state (values in VND)
    const [form, setForm] = useState({
        signing: 0,
        revenue: 0,
        adminProfit: 0,
        notes: '',
    });

    const loadTarget = useCallback(async () => {
        setLoading(true);
        try {
            const ct = await CompanyTargetService.getByYear(selectedYear);
            setTarget(ct);
            if (ct) {
                setForm({
                    signing: ct.signing,
                    revenue: ct.revenue,
                    adminProfit: ct.adminProfit,
                    notes: ct.notes || '',
                });
            } else {
                setForm({ signing: 0, revenue: 0, adminProfit: 0, notes: '' });
            }
        } catch (err) {
            console.error('Failed to load company target:', err);
            toast.error('Không thể tải chỉ tiêu ĐHCĐ');
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        loadTarget();
    }, [loadTarget]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await CompanyTargetService.upsert(selectedYear, {
                signing: form.signing,
                revenue: form.revenue,
                adminProfit: form.adminProfit,
                // revProfit = adminProfit (handled by service)
            }, form.notes);
            toast.success(`Đã lưu chỉ tiêu ĐHCĐ năm ${selectedYear}`);
            await loadTarget();
        } catch (err) {
            console.error('Failed to save company target:', err);
            toast.error('Lỗi khi lưu chỉ tiêu ĐHCĐ');
        } finally {
            setSaving(false);
        }
    };

    const formatInputValue = (val: number) => {
        if (!val) return '';
        return val.toLocaleString('vi-VN');
    };

    const parseInputValue = (raw: string): number => {
        const cleaned = raw.replace(/[^0-9]/g, '');
        return parseInt(cleaned) || 0;
    };

    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    return (
        <div className="space-y-6">
            {/* Year selector */}
            <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Năm:</label>
                <div className="flex gap-1.5">
                    {yearOptions.map(y => (
                        <button
                            key={y}
                            onClick={() => setSelectedYear(y)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${selectedYear === y
                                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            {y}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                    <Loader2 size={16} className="animate-spin" /> Đang tải...
                </div>
            ) : (
                <>
                    {/* Form */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Ký kết */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Building2 size={13} className="text-indigo-500" />
                                Ký kết (VNĐ)
                            </label>
                            <input
                                type="text"
                                value={formatInputValue(form.signing)}
                                onChange={e => setForm(prev => ({ ...prev, signing: parseInputValue(e.target.value) }))}
                                placeholder="0"
                                className="w-full px-4 py-3 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 dark:text-slate-100 transition-all"
                            />
                            {form.signing > 0 && (
                                <p className="text-[10px] font-bold text-slate-400">
                                    ≈ {(form.signing / 1e9).toFixed(2)} tỷ
                                </p>
                            )}
                        </div>

                        {/* Doanh thu */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <TrendingUp size={13} className="text-emerald-500" />
                                Doanh thu (VNĐ)
                            </label>
                            <input
                                type="text"
                                value={formatInputValue(form.revenue)}
                                onChange={e => setForm(prev => ({ ...prev, revenue: parseInputValue(e.target.value) }))}
                                placeholder="0"
                                className="w-full px-4 py-3 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 dark:text-slate-100 transition-all"
                            />
                            {form.revenue > 0 && (
                                <p className="text-[10px] font-bold text-slate-400">
                                    ≈ {(form.revenue / 1e9).toFixed(2)} tỷ
                                </p>
                            )}
                        </div>

                        {/* Lợi nhuận */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <TrendingUp size={13} className="text-purple-500" />
                                Lợi nhuận (VNĐ)
                            </label>
                            <input
                                type="text"
                                value={formatInputValue(form.adminProfit)}
                                onChange={e => setForm(prev => ({ ...prev, adminProfit: parseInputValue(e.target.value) }))}
                                placeholder="0"
                                className="w-full px-4 py-3 text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 dark:text-slate-100 transition-all"
                            />
                            {form.adminProfit > 0 && (
                                <p className="text-[10px] font-bold text-slate-400">
                                    ≈ {(form.adminProfit / 1e9).toFixed(2)} tỷ · LNG QT = LNG DT
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Ghi chú
                        </label>
                        <input
                            type="text"
                            value={form.notes}
                            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="VD: Nghị quyết ĐHCĐ thường niên 2026"
                            className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-900 dark:text-slate-100 transition-all"
                        />
                    </div>

                    {/* Info banner */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                        <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                            <strong>Lưu ý:</strong> Chỉ tiêu ĐHCĐ khác với tổng chỉ tiêu nội bộ (= tổng chỉ tiêu giao cho các đơn vị). 
                            Dashboard Tổng quan sẽ hiển thị tỷ lệ hoàn thành so với cả 2 loại chỉ tiêu khi xem "Toàn công ty".
                        </p>
                    </div>

                    {/* Save button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg shadow-md shadow-orange-500/20 transition-all"
                        >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            {saving ? 'Đang lưu...' : 'Lưu chỉ tiêu ĐHCĐ'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default CompanyTargetManager;
