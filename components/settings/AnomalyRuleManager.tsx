import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useContractAnomalyConfig } from '../../hooks/useContractAnomalyConfig';
import {
    ANOMALY_RULE_META,
    ANOMALY_CATEGORY_ORDER,
    ANOMALY_CATEGORY_LABELS,
    SEVERITY_LABELS,
} from '../../lib/contractAnomalies';
import type { AnomalyRuleConfig, AnomalySeverity, AnomalyCategory } from '../../types';

const SEVERITIES: AnomalySeverity[] = ['high', 'medium', 'low'];

const SEVERITY_PILL: Record<AnomalySeverity, string> = {
    high: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    medium: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    low: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
};

/**
 * AnomalyRuleManager — Admin cấu hình luật rà soát hợp đồng bất thường.
 * Bật/tắt từng luật, đổi mức độ (severity) và chỉnh ngưỡng (params).
 */
const AnomalyRuleManager: React.FC = () => {
    const { rules, isLoading, save, reset, isSaving } = useContractAnomalyConfig();
    const [draft, setDraft] = useState<AnomalyRuleConfig[]>([]);
    const [dirty, setDirty] = useState(false);

    // Đồng bộ draft khi rules từ DB thay đổi (và chưa có sửa đổi cục bộ).
    useEffect(() => {
        if (!dirty) setDraft(rules.map(r => ({ ...r, params: { ...r.params } })));
    }, [rules, dirty]);

    const byCategory = useMemo(() => {
        const map: Record<AnomalyCategory, AnomalyRuleConfig[]> = { profit: [], data: [], cashflow: [], lifecycle: [] };
        for (const r of draft) {
            const cat = ANOMALY_RULE_META[r.ruleKey]?.category;
            if (cat) map[cat].push(r);
        }
        return map;
    }, [draft]);

    const update = (ruleKey: string, patch: Partial<AnomalyRuleConfig>) => {
        setDraft(prev => prev.map(r => (r.ruleKey === ruleKey ? { ...r, ...patch } : r)));
        setDirty(true);
    };
    const updateParam = (ruleKey: string, key: string, value: number) => {
        setDraft(prev => prev.map(r => (r.ruleKey === ruleKey ? { ...r, params: { ...r.params, [key]: value } } : r)));
        setDirty(true);
    };

    const handleSave = () => {
        save(draft);
        setDirty(false);
        toast.success('Đã lưu cấu hình ngưỡng rà soát');
    };
    const handleReset = () => {
        if (!window.confirm('Khôi phục toàn bộ luật về mặc định?')) return;
        reset();
        setDirty(false);
        toast.success('Đã khôi phục mặc định');
    };

    if (isLoading) {
        return <div className="flex items-center gap-2 text-slate-500 py-6"><Loader2 size={16} className="animate-spin" /> Đang tải cấu hình...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Action bar */}
            <div className="flex items-center justify-end gap-3">
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    <RotateCcw size={15} /> Khôi phục mặc định
                </button>
                <button
                    onClick={handleSave}
                    disabled={!dirty || isSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Lưu cấu hình
                </button>
            </div>

            {ANOMALY_CATEGORY_ORDER.map(cat => (
                <div key={cat} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 font-black text-sm text-slate-700 dark:text-slate-200">
                        {ANOMALY_CATEGORY_LABELS[cat]}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {byCategory[cat].map(rule => {
                            const meta = ANOMALY_RULE_META[rule.ruleKey];
                            return (
                                <div key={rule.ruleKey} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                                    {/* Toggle + label */}
                                    <label className="flex items-start gap-3 flex-1 cursor-pointer min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={rule.enabled}
                                            onChange={(e) => update(rule.ruleKey, { enabled: e.target.checked })}
                                            className="mt-1 w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <div className={`font-bold text-sm ${rule.enabled ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                                                {meta.label}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{meta.description}</div>
                                        </div>
                                    </label>

                                    {/* Params */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {meta.paramDefs.map(pd => (
                                            <div key={pd.key} className="flex items-center gap-1.5 text-xs">
                                                <span className="text-slate-500 dark:text-slate-400 font-bold">{pd.label}</span>
                                                <input
                                                    type="number"
                                                    step={pd.step || 1}
                                                    value={rule.params[pd.key] ?? 0}
                                                    onChange={(e) => updateParam(rule.ruleKey, pd.key, Number(e.target.value))}
                                                    disabled={!rule.enabled}
                                                    className="w-28 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right font-bold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                                {pd.unit && <span className="text-slate-400">{pd.unit}</span>}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Severity */}
                                    <select
                                        value={rule.severity}
                                        onChange={(e) => update(rule.ruleKey, { severity: e.target.value as AnomalySeverity })}
                                        disabled={!rule.enabled}
                                        className={`px-2.5 py-1 rounded-md border text-xs font-bold cursor-pointer disabled:opacity-50 focus:outline-none ${SEVERITY_PILL[rule.severity]}`}
                                    >
                                        {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AnomalyRuleManager;
