/**
 * LeadAIInsightsTab — Tab "AI Insights" trong LeadDetailsPanel
 * Hiển thị kết quả phân tích AI + nút phân tích lại + chọn AI provider.
 */

import React, { useEffect, useState } from 'react';
import { CrmIntelligenceService } from '../../../services';
import type { CrmLead, CrmLeadIntelligence, CrmRecommendedProduct, CrmSalesInsight } from '../../../types/crm';
import { toast } from 'sonner';
import {
  Sparkles, Loader2, RefreshCw, Building2, Target, Lightbulb,
  AlertTriangle, TrendingUp, Newspaper, MessageSquare, Swords, Cpu,
} from 'lucide-react';
import { formatDate } from '../../../utils/formatters';

const PROVIDER_KEY = 'cic_lead_intelligence_provider';
const GEMINI_KEY_STORAGE = 'cic_custom_gemini_key';

const INSIGHT_META: Record<CrmSalesInsight['category'], { icon: React.ElementType; color: string; label: string }> = {
  pain_point:  { icon: AlertTriangle, color: 'text-red-500',    label: 'Pain point' },
  opportunity: { icon: TrendingUp,    color: 'text-emerald-500', label: 'Cơ hội' },
  risk:        { icon: AlertTriangle, color: 'text-amber-500',  label: 'Rủi ro' },
  news:        { icon: Newspaper,     color: 'text-sky-500',     label: 'Tin tức' },
  contact_tip: { icon: MessageSquare, color: 'text-violet-500',  label: 'Tip gặp mặt' },
  competitor:  { icon: Swords,        color: 'text-orange-500',  label: 'Đối thủ' },
};

const URGENCY_META: Record<CrmRecommendedProduct['urgency'], { label: string; cls: string }> = {
  high:   { label: 'Ưu tiên cao', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: 'Trung bình', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  low:    { label: 'Thấp', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

interface Props { lead: CrmLead; }

const LeadAIInsightsTab: React.FC<Props> = ({ lead }) => {
  const [intel, setIntel] = useState<CrmLeadIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [provider, setProvider] = useState<string>(() => {
    try { return localStorage.getItem(PROVIDER_KEY) || 'local_cic'; } catch { return 'local_cic'; }
  });
  const hasGeminiKey = (() => { try { return !!localStorage.getItem(GEMINI_KEY_STORAGE); } catch { return false; } })();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const data = await CrmIntelligenceService.getByLeadId(lead.id);
      if (active) { setIntel(data); setLoading(false); }
    })();
    return () => { active = false; };
  }, [lead.id]);

  const saveProvider = (val: string) => {
    setProvider(val);
    try { localStorage.setItem(PROVIDER_KEY, val); } catch { /* ignore */ }
  };

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      toast.loading('AI đang phân tích lead...', { id: 'ai-intel' });
      const result = await CrmIntelligenceService.analyze(lead);
      setIntel(result);
      toast.success('Phân tích AI hoàn tất', { id: 'ai-intel' });
    } catch (err: any) {
      toast.error('Lỗi phân tích AI: ' + (err?.message || err), { id: 'ai-intel' });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const completed = intel?.status === 'completed';

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">AI Lead Intelligence</h3>
          {completed && intel?.analyzed_at && (
            <span className="text-xs text-slate-400">· {formatDate(intel.analyzed_at)}</span>
          )}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {analyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {completed ? 'Phân tích lại' : 'Phân tích AI'}
        </button>
      </div>

      {/* Provider selector */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Cpu size={13} /> AI dùng:</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="radio" name="ai-provider" checked={provider === 'local_cic'} onChange={() => saveProvider('local_cic')} />
          <span className="text-slate-700 dark:text-slate-300">AI CIC (Qwen, mặc định)</span>
        </label>
        <label className={`flex items-center gap-1.5 ${hasGeminiKey ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
          <input type="radio" name="ai-provider" disabled={!hasGeminiKey} checked={provider === 'gemini_personal'} onChange={() => saveProvider('gemini_personal')} />
          <span className="text-slate-700 dark:text-slate-300">Gemini cá nhân {!hasGeminiKey && '(chưa có key)'}</span>
        </label>
      </div>

      {/* Empty / failed states */}
      {!intel && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Sparkles size={28} className="mx-auto text-violet-400 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa phân tích AI cho lead này.</p>
          <p className="text-xs text-slate-400 mt-1">Bấm "Phân tích AI" để nhận tóm tắt, gợi ý sản phẩm và insights.</p>
        </div>
      )}

      {intel?.status === 'failed' && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          Phân tích thất bại: {intel.error_message || 'Lỗi không xác định'}
        </div>
      )}

      {completed && intel && (
        <>
          {/* AI Score */}
          <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800 rounded-xl">
            <div className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">+{intel.ai_score_contribution}<span className="text-sm font-medium text-violet-400">/30</span></div>
            <div className="text-xs text-slate-600 dark:text-slate-400 flex-1">{intel.ai_score_reasoning || 'Điểm AI đóng góp vào lead score.'}</div>
          </div>

          {/* Company summary */}
          {intel.company_summary && (
            <section>
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2"><Building2 size={13} /> Tóm tắt</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{intel.company_summary}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {intel.technology_level && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Tech: {intel.technology_level}</span>}
                {intel.industry_sector && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Ngành: {intel.industry_sector}</span>}
              </div>
            </section>
          )}

          {/* Recommended products */}
          {Array.isArray(intel.recommended_products) && intel.recommended_products.length > 0 && (
            <section>
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2"><Target size={13} /> Sản phẩm gợi ý</h4>
              <div className="space-y-2">
                {intel.recommended_products.map((p, i) => {
                  const urg = URGENCY_META[p.urgency] || URGENCY_META.low;
                  return (
                    <div key={i} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.product_name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${urg.cls}`}>{urg.label}</span>
                          <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{p.fit_score}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
                        <div className="h-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, p.fit_score))}%` }} />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{p.reasoning}</p>
                      {Array.isArray(p.talking_points) && p.talking_points.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {p.talking_points.map((t, j) => (
                            <li key={j} className="text-xs text-slate-500 dark:text-slate-400 flex gap-1.5"><span className="text-violet-400">💬</span>{t}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Sales insights */}
          {Array.isArray(intel.sales_insights) && intel.sales_insights.length > 0 && (
            <section>
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2"><Lightbulb size={13} /> Insights cho sale</h4>
              <div className="space-y-2">
                {intel.sales_insights.map((ins, i) => {
                  const meta = INSIGHT_META[ins.category] || INSIGHT_META.opportunity;
                  const Icon = meta.icon;
                  return (
                    <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <Icon size={15} className={`${meta.color} shrink-0 mt-0.5`} />
                      <div className="min-w-0">
                        <span className={`text-[10px] font-bold uppercase ${meta.color}`}>{meta.label}</span>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{ins.content}</p>
                        {ins.source_url && (
                          <a href={ins.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-sky-500 hover:underline break-all">{ins.source_url}</a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {intel.model_used && (
            <p className="text-[10px] text-slate-400 text-right">Model: {intel.model_used}</p>
          )}
        </>
      )}
    </div>
  );
};

export default LeadAIInsightsTab;
