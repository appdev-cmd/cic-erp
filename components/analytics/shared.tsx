/**
 * Analytics shared pieces — CIC ERP
 *
 * Các component trình bày + helper thuần dùng chung cho trang Phân tích (BI),
 * tách từ Analytics.tsx để các file card theo tab (analytics/cards/*) cùng dùng.
 * KHÔNG chứa state/data-fetching — phần đó vẫn nằm ở Analytics.tsx.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    ChevronDown, ArrowUpRight, ArrowDownRight, Inbox, Check,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { isDarkTheme } from '../../lib/themeColors';
import { Skeleton } from '../ui/Skeleton';

/* ─── Loading Skeleton ─── */
export const AnalyticsSkeleton = () => (
    <div className="space-y-8 animate-pulse p-2">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => <Skeleton key={i} className="h-[380px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
    </div>
);

/* ─── Empty State ─── */
export const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Inbox size={28} className="text-slate-300 dark:text-slate-600" />
        </div>
        <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{message}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Hãy thử chọn đơn vị hoặc năm khác</p>
    </div>
);

/* ─── KPI Card ─── */
export const KPICard = ({ title, metric, stats, target, companyTarget, yoy, color, icon, index }: {
    title: string;
    metric: string;
    stats: any;
    target: any;
    companyTarget: any;
    yoy: { value: string; isUp: boolean; lastYearTotal: number };
    color: string;
    icon: React.ReactNode;
    index: number;
}) => {
    const actual = stats[metric] || 0;
    const plan = target[metric] || 0;
    const progress = plan > 0 ? Math.round((actual / plan) * 100) : 0;

    // Chỉ tiêu ĐHCĐ
    const dhcdPlan = companyTarget ? (companyTarget[metric] || 0) : 0;
    const dhcdProgress = dhcdPlan > 0 ? Math.round((actual / dhcdPlan) * 100) : 0;

    const colors: any = {
        indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30',
        emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30',
        purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30',
        amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30',
        cyan: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-900/30',
    };

    const formatValue = (val: number) => {
        const abs = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ`;
        if (abs >= 1e6) return `${sign}${Math.round(abs / 1e6)} triệu`;
        if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K`;
        return Math.round(val).toString();
    };

    const barColor = color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-500' : color === 'purple' ? 'bg-purple-500' : color === 'cyan' ? 'bg-cyan-500' : 'bg-indigo-600';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
            className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden dark-card-glow"
        >
            <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div className={`p-2.5 sm:p-3 rounded-lg ${colors[color] || colors.indigo} transition-transform group-hover:rotate-6`}>
                    {icon}
                </div>
                <div className="text-right">
                    <div className={`flex items-center justify-end gap-1 text-xs font-black ${yoy.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {yoy.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {yoy.value}%
                    </div>
                    {yoy.lastYearTotal > 0 && (
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {formatValue(yoy.lastYearTotal)}
                        </div>
                    )}
                </div>
            </div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{title}</p>
            <div className="mb-4">
                <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{formatValue(actual)}</h4>
            </div>
            {plan > 0 || dhcdPlan > 0 ? (
                <div className="space-y-2">
                    {/* Chỉ tiêu Nội bộ */}
                    {plan > 0 && (
                        <>
                            <div className="flex justify-between items-center text-xs font-black uppercase tracking-tighter">
                                <span className="text-slate-400">{dhcdPlan > 0 ? 'KH Nội bộ' : 'Hoàn thành KH'}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 normal-case tracking-normal">/ {formatValue(plan)}</span>
                                    <span className={progress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}>{progress.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${Math.min(100, progress)}%` }}></div>
                            </div>
                        </>
                    )}
                    {/* Chỉ tiêu ĐHCĐ */}
                    {dhcdPlan > 0 && (
                        <>
                            <div className="flex justify-between items-center text-xs font-black uppercase tracking-tighter mt-1">
                                <span className="text-orange-500 dark:text-orange-400">KH ĐHCĐ</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 normal-case tracking-normal">/ {formatValue(dhcdPlan)}</span>
                                    <span className={dhcdProgress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}>{dhcdProgress.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000 bg-orange-500" style={{ width: `${Math.min(100, dhcdProgress)}%` }}></div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="h-2" />
            )}
        </motion.div>
    );
};

/* ─── Searchable Select Component ─── */
interface SearchableSelectProps {
    label: string;
    value: string[];
    options: { id: string; name: string }[];
    onChange: (value: string[]) => void;
    placeholder?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, value, options, onChange, placeholder = 'Tất cả' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const displayValue = useMemo(() => {
        if (!value || value.length === 0) return placeholder;
        if (value.length === 1) {
            const opt = options.find(o => o.id === value[0]);
            return opt ? opt.name : placeholder;
        }
        return `Đã chọn (${value.length})`;
    }, [value, options, placeholder]);

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        const s = search.toLowerCase();
        return options.filter(o => o.name.toLowerCase().includes(s));
    }, [options, search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) setSearch('');
    }, [isOpen]);

    const handleSelectAll = () => {
        onChange([]);
    };

    const handleToggleOption = (id: string) => {
        let newValue: string[];
        if (value.includes(id)) {
            newValue = value.filter(v => v !== id);
        } else {
            newValue = [...value, id];
        }
        onChange(newValue);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:border-orange-500 dark:hover:border-orange-500 transition-colors cursor-pointer text-left focus:outline-none min-w-[120px] max-w-[200px]"
            >
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{displayValue}</span>
                </div>
                <ChevronDown size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-30 overflow-hidden flex flex-col max-h-[350px]">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm kiếm..."
                            className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-orange-500 text-slate-800 dark:text-slate-200"
                            autoFocus
                        />
                        {value.length > 0 && (
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 whitespace-nowrap px-1 cursor-pointer shrink-0"
                            >
                                Xóa chọn
                            </button>
                        )}
                    </div>
                    <div className="overflow-y-auto flex-1 py-1 max-h-[260px] styled-scrollbar">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center gap-2.5 ${
                                value.length === 0
                                    ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                value.length === 0
                                    ? 'bg-orange-500 border-orange-500 text-white'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                            }`}>
                                {value.length === 0 && <Check size={10} strokeWidth={3} />}
                            </div>
                            <span className="truncate">{placeholder}</span>
                        </button>
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">Không tìm thấy kết quả</div>
                        ) : (
                            filteredOptions.map(o => {
                                const isChecked = value.includes(o.id);
                                return (
                                    <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => handleToggleOption(o.id)}
                                        className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors truncate flex items-center gap-2.5 ${
                                            isChecked
                                                ? 'bg-orange-50/70 dark:bg-orange-950/15 text-orange-600 dark:text-orange-400'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                        title={o.name}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                            isChecked
                                                ? 'bg-orange-500 border-orange-500 text-white'
                                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                        }`}>
                                            {isChecked && <Check size={10} strokeWidth={3} />}
                                        </div>
                                        <span className="truncate">{o.name}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ─── Chart Card Wrapper ─── */
export const ChartCard = ({ title, subtitle, children, index, className = '' }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    index: number;
    className?: string;
}) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 + index * 0.12, duration: 0.5, ease: 'easeOut' }}
        className={`bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all ${className}`}
    >
        <div className="mb-4 lg:mb-8">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {children}
    </motion.div>
);

/* ─── Simple Tooltip (không drill-down) ─── */
export const SimpleTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const dark = isDarkTheme();
    return (
        <div className={`px-5 py-4 rounded-xl shadow-2xl border ${dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{label}</p>
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{p.name}:</span>
                    <span className="text-sm font-black">{formatCurrencyGlobal(p.value)}</span>
                </div>
            ))}
        </div>
    );
};

export const formatCurrencyGlobal = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)} tr`;
    if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K`;
    return `${Math.round(val)}`;
};

export const renderPieLabel = (data: any[]) => (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value, name, index } = props;
    if (!data || data.length === 0) return null;

    const valuesSorted = [...data].map(d => d.value || 0).sort((a, b) => b - a);
    const threshold = valuesSorted.length > 3 ? valuesSorted[2] : 0;

    if (data.length > 3 && value < threshold) return null;

    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 12;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const sx = cx + outerRadius * Math.cos(-midAngle * RADIAN);
    const sy = cy + outerRadius * Math.sin(-midAngle * RADIAN);
    const mx = cx + (outerRadius + 6) * Math.cos(-midAngle * RADIAN);
    const my = cy + (outerRadius + 6) * Math.sin(-midAngle * RADIAN);
    const ex = x + (midAngle > 90 && midAngle < 270 ? -1 : 1) * 6;
    const ey = y;

    const textAnchor = midAngle > 90 && midAngle < 270 ? 'end' : 'start';
    const formattedVal = formatCurrencyGlobal(value);

    const displayName = name.length > 14 ? name.substring(0, 12) + '..' : name;

    // Tính tỷ trọng %
    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';

    return (
        <g>
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#94a3b8" fill="none" strokeWidth={1} />
            <circle cx={ex} cy={ey} r={1.5} fill="#94a3b8" />
            <text
                x={ex + (textAnchor === 'start' ? 4 : -4)}
                y={ey}
                textAnchor={textAnchor}
                fill="#64748b"
                className="text-[9px] font-bold dark:fill-slate-400"
                dominantBaseline="central"
            >
                <tspan x={ex + (textAnchor === 'start' ? 4 : -4)} dy="-0.5em">{displayName}</tspan>
                <tspan x={ex + (textAnchor === 'start' ? 4 : -4)} dy="1.1em">{`${formattedVal} (${pct}%)`}</tspan>
            </text>
        </g>
    );
};

export const getContractRevenueInPeriod = (c: any, year: string, paymentsList: any[]) => {
    const contractPayments = paymentsList.filter(p => p.contractId === c.id);
    const revenuePayments = contractPayments.filter(p =>
        p.voucherType === 'VAT_INVOICE' &&
        ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status) &&
        (year === 'All' || year === 'all' || (p.invoiceDate || p.paymentDate)?.startsWith(year))
    );
    let revenue = 0;
    revenuePayments.forEach(p => {
        const hasVat = c.hasVat !== false;
        const vatRate = c.vatRate ?? 10;
        if (p.vatInvoiceItems && p.vatInvoiceItems.length > 0) {
            revenue += p.vatInvoiceItems.reduce((s: number, item: any) => s + (Number(item.amountBeforeVAT) || 0), 0);
        } else {
            const gross = Number(p.amount) || 0;
            const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;
            revenue += Math.round(gross / vatDivisor);
        }
    });
    return revenue;
};

/** Doanh thu trước VAT của 1 line item (outputPrice × quantity). */
export const lineItemRevenue = (li: any) => (li.outputPrice || 0) * (li.quantity || 1);
/** Tổng doanh thu trước VAT của hợp đồng — base nhất quán (pre-VAT) để phân bổ lợi nhuận theo line. */
export const contractLineTotal = (c: any) => (c.lineItems || []).reduce((s: number, li: any) => s + lineItemRevenue(li), 0);

/**
 * Phân khúc sản phẩm–dịch vụ (suy ra từ Product.category) — dùng để tách 1 hãng
 * thành nhiều dòng (vd CIC · Phần mềm / CIC · Thiết bị / CIC · Dịch vụ).
 * Map khớp danh mục chuẩn ở constants.tsx; category lạ/chưa phân loại → 'other'.
 */
export type ProductSegment = 'software' | 'device' | 'service' | 'other';
export const SEGMENT_OF: Record<string, ProductSegment> = {
    'Phần mềm': 'software', 'Bảo trì': 'software',
    'Thiết bị': 'device',
    'Tư vấn': 'service', 'Dịch vụ': 'service', 'Đào tạo': 'service',
};
/** Nhãn viết tắt dùng trên biểu đồ cho gọn (PM/TB/DV/Khác). */
export const SEGMENT_SHORT: Record<ProductSegment, string> = {
    software: 'PM', device: 'TB', service: 'DV', other: 'Khác',
};
/**
 * Gắn nhãn cho các dòng "hãng × phân khúc" SAU khi đã slice top-N:
 * hãng chỉ còn 1 phân khúc trên biểu đồ → chỉ hiện tên hãng;
 * hãng có ≥2 phân khúc → thêm hậu tố viết tắt (vd "CIC · PM").
 */
export const labelBrandSegments = <T extends { brandId: string; segment: ProductSegment; brandName: string }>(
    rows: T[]
): (T & { name: string })[] => {
    const cnt = new Map<string, number>();
    rows.forEach(r => cnt.set(r.brandId, (cnt.get(r.brandId) || 0) + 1));
    return rows.map(r => ({
        ...r,
        name: (cnt.get(r.brandId) || 0) > 1 ? `${r.brandName} · ${SEGMENT_SHORT[r.segment]}` : r.brandName,
    }));
};
export const segmentOf = (cat?: string): ProductSegment => SEGMENT_OF[(cat || '').trim()] || 'other';

// Static custom tick components to prevent ResponsiveContainer resize rendering loop
export const BrandYAxisTick = React.memo(({ x, y, payload, data, onOpen }: any) => {
    const dataItem = data.find(d => d.name === payload?.value);
    const id = dataItem?.brandId || dataItem?.id;
    return (
        <text
            x={x}
            y={y}
            dy={4}
            textAnchor="end"
            className={id ? "fill-slate-600 dark:fill-slate-400 hover:fill-indigo-600 dark:hover:fill-indigo-400 hover:underline cursor-pointer font-bold transition-colors duration-150" : "fill-slate-600 dark:fill-slate-400 font-bold"}
            fontSize={11}
            onClick={(e) => {
                e.stopPropagation();
                if (id) onOpen(id);
            }}
        >
            {payload?.value}
        </text>
    );
});
BrandYAxisTick.displayName = 'BrandYAxisTick';

export const ProductYAxisTick = React.memo(({ x, y, payload, products, onOpen }: any) => {
    const matchedProd = products.find(p => (p.productLine && p.productLine.trim() === payload?.value) || p.name === payload?.value);
    return (
        <text
            x={x}
            y={y}
            dy={4}
            textAnchor="end"
            className={matchedProd?.id ? "fill-slate-600 dark:fill-slate-400 hover:fill-indigo-600 dark:hover:fill-indigo-400 hover:underline cursor-pointer font-bold transition-colors duration-150" : "fill-slate-600 dark:fill-slate-400 font-bold"}
            fontSize={11}
            onClick={(e) => {
                e.stopPropagation();
                if (matchedProd?.id) onOpen(matchedProd.id);
            }}
        >
            {payload?.value}
        </text>
    );
});
ProductYAxisTick.displayName = 'ProductYAxisTick';

export const CustomerYAxisTick = React.memo(({ x, y, payload, data, onOpen }: any) => {
    const dataItem = data.find(d => d.name === payload?.value);
    const id = dataItem?.id;
    return (
        <text
            x={x}
            y={y}
            dy={4}
            textAnchor="end"
            className={id ? "fill-slate-600 dark:fill-slate-400 hover:fill-indigo-600 dark:hover:fill-indigo-400 hover:underline cursor-pointer font-bold transition-colors duration-150" : "fill-slate-600 dark:fill-slate-400 font-bold"}
            fontSize={11}
            onClick={(e) => {
                e.stopPropagation();
                if (id) onOpen(id);
            }}
        >
            {payload?.value}
        </text>
    );
});
CustomerYAxisTick.displayName = 'CustomerYAxisTick';

export const EmployeeYAxisTick = React.memo(({ x, y, payload, data, onOpen }: any) => {
    const dataItem = data.find(d => d.name === payload?.value);
    const id = dataItem?.id;
    return (
        <text
            x={x}
            y={y}
            dy={4}
            textAnchor="end"
            className={id ? "fill-slate-600 dark:fill-slate-400 hover:fill-indigo-600 dark:hover:fill-indigo-400 hover:underline cursor-pointer font-bold transition-colors duration-150" : "fill-slate-600 dark:fill-slate-400 font-bold"}
            fontSize={11}
            onClick={(e) => {
                e.stopPropagation();
                if (id) onOpen(id);
            }}
        >
            {payload?.value}
        </text>
    );
});
EmployeeYAxisTick.displayName = 'EmployeeYAxisTick';

export const BrandParetoXAxisTick = React.memo(({ x, y, payload, data, onOpen }: any) => {
    const dataItem = data.find(d => d.name === payload?.value);
    const id = dataItem?.brandId;
    return (
        <text
            x={x}
            y={y}
            dy={8}
            textAnchor="end"
            className={id ? "fill-slate-600 dark:fill-slate-400 hover:fill-indigo-600 dark:hover:fill-indigo-400 hover:underline cursor-pointer font-bold transition-colors duration-150" : "fill-slate-600 dark:fill-slate-400 font-bold"}
            fontSize={9}
            fontWeight={600}
            transform={`rotate(-35, ${x}, ${y})`}
            onClick={(e) => {
                e.stopPropagation();
                if (id) onOpen(id);
            }}
        >
            {payload?.value}
        </text>
    );
});
BrandParetoXAxisTick.displayName = 'BrandParetoXAxisTick';
