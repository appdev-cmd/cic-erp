import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle, Search, Loader2, ShieldAlert, Filter, X, ExternalLink,
    RefreshCw, ChevronDown,
} from 'lucide-react';
import { ContractService, UnitService } from '../services';
import type { Contract, Unit, AnomalySeverity, AnomalyCategory, AnomalyRuleKey, ContractAnomalyResult } from '../types';
import { useCurrentUserVisibleUnits } from '../hooks';
import { useContractAnomalyConfig } from '../hooks/useContractAnomalyConfig';
import { useLayoutContext } from './layout/MainLayout';
import {
    evaluateContracts,
    ANOMALY_CATEGORY_ORDER,
    ANOMALY_CATEGORY_LABELS,
    SEVERITY_LABELS,
} from '../lib/contractAnomalies';
import { formatVND } from '../utils/contractHelpers';
import { formatDate } from '../utils/formatters';
import { toast } from 'sonner';

// ── Bảng màu theo mức nghiêm trọng ──
const SEVERITY_BADGE: Record<AnomalySeverity, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
};
const SEVERITY_DOT: Record<AnomalySeverity, string> = {
    high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-slate-400',
};
const SEVERITY_ORDER: AnomalySeverity[] = ['high', 'medium', 'low'];

// Mỗi loại cảnh báo một màu riêng (nền + chữ + viền, có biến thể dark mode).
// Lưu ý: Tailwind cần class literal đầy đủ để JIT include — không ghép động.
const RULE_BADGE: Record<AnomalyRuleKey, string> = {
    // A. Lợi nhuận
    profit_margin_high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    profit_margin_low: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
    profit_margin_negative: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800',
    cost_missing: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
    // B. Dữ liệu / Doanh thu - Chi phí
    expected_revenue_missing: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300 border border-lime-200 dark:border-lime-800',
    value_zero: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700',
    actual_revenue_over: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    actual_cost_over: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
    line_below_cost: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
    // C. Dòng tiền / Công nợ
    overdue_payment: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border border-pink-200 dark:border-pink-800',
    overdue_advance: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800',
    accepted_no_invoice: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
    receivable_large: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800',
    cash_over_invoiced: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700',
    // D. Tiến độ / Vòng đời
    overdue_execution: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
    stale_processing: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800',
    completed_cash_gap: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    // E. Dữ liệu / Phân bổ
    missing_salesperson: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    allocation_mismatch: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700',
    missing_dates: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
};

interface ContractReviewPageProps {
    /** Mở chi tiết hợp đồng (slide panel). Nếu không truyền → điều hướng route. */
    onSelectContract?: (id: string) => void;
}

const ContractReviewPage: React.FC<ContractReviewPageProps> = ({ onSelectContract }) => {
    const navigate = useNavigate();
    const openContract = (id: string) => onSelectContract ? onSelectContract(id) : navigate(`/contracts/${id}`);
    const { visibleUnits } = useCurrentUserVisibleUnits();
    const { selectedUnit, yearFilter } = useLayoutContext();
    const { rules, isLoading: rulesLoading } = useContractAnomalyConfig();

    const [contracts, setContracts] = useState<Contract[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Bộ lọc
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<AnomalyCategory | 'all'>('all');
    const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | 'all'>('all');
    const [unitFilter, setUnitFilter] = useState<string>('all');

    // ── Tải đơn vị (để map tên + dropdown lọc) ──
    useEffect(() => {
        UnitService.getAll().then(setUnits).catch(() => { /* im lặng */ });
    }, []);

    const unitNameById = useMemo(() => {
        const m = new Map<string, string>();
        units.forEach(u => m.set(u.id, u.name));
        return m;
    }, [units]);

    // ── Tải hợp đồng TRONG PHẠM VI ĐƯỢC PHÉP (giống Analytics) ──
    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Siết phạm vi theo đơn vị được phép xem.
                let unitId: string;
                if (selectedUnit?.id === 'all') {
                    unitId = visibleUnits === 'all'
                        ? 'all'
                        : (visibleUnits.length > 0 ? visibleUnits.join(',') : 'all');
                } else if (visibleUnits !== 'all' && selectedUnit?.id && !visibleUnits.includes(selectedUnit.id)) {
                    unitId = visibleUnits.length > 0 ? visibleUnits.join(',') : 'all';
                } else {
                    unitId = selectedUnit?.id || 'all';
                }

                const year = yearFilter && yearFilter !== 'All' && yearFilter !== 'all'
                    ? yearFilter : undefined;

                const res = await ContractService.list({ page: 1, limit: 10000, unitId, year });
                if (!cancelled) setContracts(res.data || []);
            } catch (e) {
                if (!cancelled) toast.error('Lỗi tải dữ liệu hợp đồng');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [selectedUnit, yearFilter, visibleUnits]);

    // ── Chạy rule engine ──
    const results = useMemo<ContractAnomalyResult[]>(
        () => evaluateContracts(contracts, rules),
        [contracts, rules]
    );

    // ── Thống kê tóm tắt ──
    const summary = useMemo(() => {
        const bySeverity: Record<AnomalySeverity, number> = { high: 0, medium: 0, low: 0 };
        const byCategory: Record<AnomalyCategory, number> = { profit: 0, data: 0, cashflow: 0, lifecycle: 0 };
        for (const r of results) {
            bySeverity[r.maxSeverity]++;
            const cats = new Set(r.flags.map(f => f.category));
            cats.forEach(c => byCategory[c]++);
        }
        return { bySeverity, byCategory, total: results.length };
    }, [results]);

    // ── Áp bộ lọc ──
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return results.filter(r => {
            if (severityFilter !== 'all' && r.maxSeverity !== severityFilter) return false;
            if (categoryFilter !== 'all' && !r.flags.some(f => f.category === categoryFilter)) return false;
            if (unitFilter !== 'all' && r.contract.unitId !== unitFilter) return false;
            if (term) {
                const c = r.contract;
                const hay = `${c.contractCode} ${c.title} ${c.partyA} ${c.clientInitials}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [results, search, severityFilter, categoryFilter, unitFilter]);

    // Đơn vị xuất hiện trong kết quả (cho dropdown)
    const resultUnits = useMemo(() => {
        const ids = new Set(results.map(r => r.contract.unitId).filter(Boolean));
        return Array.from(ids).map(id => ({ id, name: unitNameById.get(id) || id }));
    }, [results, unitNameById]);

    const hasActiveFilter = search || categoryFilter !== 'all' || severityFilter !== 'all' || unitFilter !== 'all';
    const loading = isLoading || rulesLoading;

    return (
        <div className="space-y-5">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
                        <ShieldAlert className="text-red-500" size={30} />
                        Rà soát Hợp đồng Bất thường
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-bold mt-1">
                        Phạm vi: <span className="text-indigo-700 dark:text-indigo-400 font-black uppercase">{selectedUnit?.name || 'Toàn công ty'}</span>
                        {yearFilter && yearFilter !== 'All' && <span> · Năm {yearFilter}</span>}
                        <span className="text-slate-400"> · Chỉ hiển thị trong vùng dữ liệu bạn được phép xem</span>
                    </p>
                </div>
                <button
                    onClick={() => navigate('/contracts')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all self-start"
                >
                    <ExternalLink size={16} /> Về danh sách HĐ
                </button>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                    active={severityFilter === 'all' && categoryFilter === 'all'}
                    onClick={() => { setSeverityFilter('all'); setCategoryFilter('all'); }}
                    label="Tổng HĐ bất thường" value={summary.total} tone="indigo" icon={<AlertTriangle size={18} />}
                />
                {SEVERITY_ORDER.map(sev => (
                    <SummaryCard
                        key={sev}
                        active={severityFilter === sev}
                        onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
                        label={`Mức ${SEVERITY_LABELS[sev]}`}
                        value={summary.bySeverity[sev]}
                        tone={sev === 'high' ? 'red' : sev === 'medium' ? 'amber' : 'slate'}
                        icon={<span className={`w-2.5 h-2.5 rounded-full ${SEVERITY_DOT[sev]}`} />}
                    />
                ))}
            </div>

            {/* CATEGORY CHIPS */}
            <div className="flex flex-wrap gap-2">
                <CategoryChip label="Tất cả nhóm" active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
                {ANOMALY_CATEGORY_ORDER.map(cat => (
                    <CategoryChip
                        key={cat}
                        label={`${ANOMALY_CATEGORY_LABELS[cat]} (${summary.byCategory[cat]})`}
                        active={categoryFilter === cat}
                        onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
                    />
                ))}
            </div>

            {/* FILTER BAR */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[240px] relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Tìm mã HĐ, tên, đối tác..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-10 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900 dark:text-slate-100"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 rounded-full">
                            <X size={16} />
                        </button>
                    )}
                </div>
                {resultUnits.length > 1 && (
                    <div className="relative">
                        <select
                            value={unitFilter}
                            onChange={(e) => setUnitFilter(e.target.value)}
                            className="appearance-none pl-4 pr-9 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="all">Tất cả đơn vị</option>
                            {resultUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                )}
                {hasActiveFilter && (
                    <button
                        onClick={() => { setSearch(''); setCategoryFilter('all'); setSeverityFilter('all'); setUnitFilter('all'); }}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                        <RefreshCw size={14} /> Xóa lọc
                    </button>
                )}
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-auto flex items-center gap-1.5">
                    <Filter size={14} /> {filtered.length} / {results.length} hợp đồng
                </div>
            </div>

            {/* TABLE */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="animate-spin mr-2" /> Đang rà soát...
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-10 text-center">
                    <p className="text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                        {results.length === 0 ? '✓ Không phát hiện hợp đồng bất thường trong phạm vi của bạn' : 'Không có kết quả khớp bộ lọc'}
                    </p>
                </div>
            ) : (
                <div className="hidden md:block bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase font-black">
                                <tr>
                                    <th className="text-left px-4 py-3">Hợp đồng</th>
                                    <th className="text-left px-4 py-3">Đơn vị</th>
                                    <th className="text-right px-4 py-3">Giá trị</th>
                                    <th className="text-right px-4 py-3">Biên LN</th>
                                    <th className="text-left px-4 py-3 min-w-[320px]">Cảnh báo</th>
                                    <th className="text-left px-4 py-3">Ngày ký</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filtered.map(r => (
                                    <tr
                                        key={r.contract.id}
                                        onClick={() => openContract(r.contract.id)}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-black text-slate-900 dark:text-slate-100">{r.contract.contractCode}</div>
                                            <div className="text-slate-500 dark:text-slate-400 text-xs line-clamp-1 max-w-[260px]">{r.contract.title}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs font-bold">
                                            {unitNameById.get(r.contract.unitId) || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                            {formatVND(r.contract.value || 0)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-black whitespace-nowrap ${
                                            (r.contract.margin ?? 0) < 0 ? 'text-red-600 dark:text-red-400'
                                                : (r.contract.margin ?? 0) > 50 ? 'text-amber-600 dark:text-amber-400'
                                                    : 'text-slate-700 dark:text-slate-200'
                                        }`}>
                                            {(Math.round((r.contract.margin ?? 0) * 10) / 10)}%
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {r.flags.map((f, i) => (
                                                    <span
                                                        key={i}
                                                        title={`${f.detail} · Mức ${SEVERITY_LABELS[f.severity]}`}
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${RULE_BADGE[f.ruleKey] || SEVERITY_BADGE[f.severity]}`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[f.severity]}`} />
                                                        {f.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                            {formatDate(r.contract.signedDate)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MOBILE CARDS (< md) — mỗi HĐ 1 card, badge cảnh báo, bấm để mở chi tiết */}
            {!loading && filtered.length > 0 && (
                <div className="md:hidden space-y-3">
                    {filtered.map(r => (
                        <div
                            key={r.contract.id}
                            onClick={() => openContract(r.contract.id)}
                            className="bg-white dark:bg-slate-900 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <div className="font-black text-slate-900 dark:text-slate-100">{r.contract.contractCode}</div>
                                    <div className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2">{r.contract.title}</div>
                                </div>
                                <span className={`shrink-0 font-black text-sm whitespace-nowrap ${
                                    (r.contract.margin ?? 0) < 0 ? 'text-red-600 dark:text-red-400'
                                        : (r.contract.margin ?? 0) > 50 ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-slate-700 dark:text-slate-200'
                                }`}>
                                    {(Math.round((r.contract.margin ?? 0) * 10) / 10)}%
                                </span>
                            </div>

                            {/* Cảnh báo */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {r.flags.map((f, i) => (
                                    <span
                                        key={i}
                                        title={`${f.detail} · Mức ${SEVERITY_LABELS[f.severity]}`}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${RULE_BADGE[f.ruleKey] || SEVERITY_BADGE[f.severity]}`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[f.severity]}`} />
                                        {f.label}
                                    </span>
                                ))}
                            </div>

                            {/* Meta: đơn vị · giá trị · ngày ký */}
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-600 dark:text-slate-300">{unitNameById.get(r.contract.unitId) || '—'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{formatVND(r.contract.value || 0)}</span>
                                <span className="text-slate-400 dark:text-slate-500 ml-auto">{formatDate(r.contract.signedDate)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Sub-components ──
const TONE_MAP: Record<string, string> = {
    indigo: 'border-indigo-200 dark:border-indigo-800 ring-indigo-400',
    red: 'border-red-200 dark:border-red-800 ring-red-400',
    amber: 'border-amber-200 dark:border-amber-800 ring-amber-400',
    slate: 'border-slate-200 dark:border-slate-700 ring-slate-400',
};

const SummaryCard: React.FC<{
    label: string; value: number; tone: string; icon: React.ReactNode;
    active?: boolean; onClick?: () => void;
}> = ({ label, value, tone, icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`text-left bg-white dark:bg-slate-900 rounded-xl border p-4 transition-all hover:shadow-md ${TONE_MAP[tone] || TONE_MAP.slate} ${active ? 'ring-2' : ''}`}
    >
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold mb-1.5">
            {icon} {label}
        </div>
        <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{value}</div>
    </button>
);

const CategoryChip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
            active
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
        }`}
    >
        {label}
    </button>
);

export default ContractReviewPage;
