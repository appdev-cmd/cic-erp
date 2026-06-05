/**
 * LeadAssignmentSettings — Cấu hình phân công Lead về Đơn vị (Unit Pool routing)
 * - Bảng cấu hình routing: sản phẩm × vùng × priority × mặc định
 * - Thống kê cân bằng tải 7/30 ngày
 */

import React, { useEffect, useState } from 'react';
import { CrmAssignmentService } from '../../../services';
import type { CrmUnitAssignmentConfig, CrmAssignmentBalanceStat } from '../../../services';
import { dataClient as supabase } from '../../../lib/dataClient';
import { toast } from 'sonner';
import { Plus, Trash2, Star, Loader2, BarChart3, Info } from 'lucide-react';
import { REGION_LABELS } from '../../../types/crm';

const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: 'north', label: REGION_LABELS.north },
  { value: 'central', label: REGION_LABELS.central },
  { value: 'south', label: REGION_LABELS.south },
  { value: 'national', label: 'Toàn quốc' },
];

interface UnitOpt { id: string; name: string; code: string; }
interface ProductOpt { id: string; name: string; code?: string; }

export default function LeadAssignmentSettings() {
  const [configs, setConfigs] = useState<CrmUnitAssignmentConfig[]>([]);
  const [stats, setStats] = useState<CrmAssignmentBalanceStat[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [cfgs, balanceStats, unitsRes, prodRes] = await Promise.all([
        CrmAssignmentService.getConfigs().catch(() => []),
        CrmAssignmentService.getBalanceStats().catch(() => []),
        supabase.from('units').select('id, name, code').in('type', ['Business', 'Branch']).order('name'),
        supabase.from('products').select('id, name, code').eq('crm_visible', true).order('name'),
      ]);
      setConfigs(cfgs as any);
      setStats(balanceStats as any);
      setUnits(((unitsRes.data as any) || []).length ? (unitsRes.data as any) : []);
      // Fallback: nếu không có unit nào type Business/Branch, lấy tất cả
      if (!unitsRes.data || (unitsRes.data as any).length === 0) {
        const all = await supabase.from('units').select('id, name, code').order('name');
        setUnits((all.data as any) || []);
      }
      setProducts((prodRes.data as any) || []);
    } catch (err: any) {
      toast.error('Lỗi tải cấu hình phân công: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async () => {
    if (units.length === 0) {
      toast.error('Chưa có đơn vị nào để cấu hình');
      return;
    }
    try {
      setBusy(true);
      await CrmAssignmentService.createConfig({
        unit_id: units[0].id,
        product_ids: [],
        regions: ['national'],
        priority: 0,
        is_default: false,
        is_active: true,
      });
      await load();
    } catch (err: any) {
      toast.error('Lỗi thêm cấu hình: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, fields: Partial<CrmUnitAssignmentConfig>) => {
    // Optimistic update
    setConfigs(prev => prev.map(c => (c.id === id ? { ...c, ...fields } : c)));
    try {
      await CrmAssignmentService.updateConfig(id, fields);
    } catch (err: any) {
      toast.error('Lỗi cập nhật: ' + err.message);
      load();
    }
  };

  const setDefault = async (id: string) => {
    // Chỉ 1 default — bỏ default ở các config khác
    const others = configs.filter(c => c.is_default && c.id !== id);
    setConfigs(prev => prev.map(c => ({ ...c, is_default: c.id === id })));
    try {
      await Promise.all([
        CrmAssignmentService.updateConfig(id, { is_default: true }),
        ...others.map(c => CrmAssignmentService.updateConfig(c.id, { is_default: false })),
      ]);
    } catch (err: any) {
      toast.error('Lỗi đặt mặc định: ' + err.message);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Xóa cấu hình routing này?')) return;
    setConfigs(prev => prev.filter(c => c.id !== id));
    try {
      await CrmAssignmentService.deleteConfig(id);
    } catch (err: any) {
      toast.error('Lỗi xóa: ' + err.message);
      load();
    }
  };

  const toggleProduct = (cfg: CrmUnitAssignmentConfig, productId: string) => {
    const has = cfg.product_ids.includes(productId);
    const next = has ? cfg.product_ids.filter(p => p !== productId) : [...cfg.product_ids, productId];
    patch(cfg.id, { product_ids: next });
  };

  const toggleRegion = (cfg: CrmUnitAssignmentConfig, region: string) => {
    const has = cfg.regions.includes(region);
    const next = has ? cfg.regions.filter(r => r !== region) : [...cfg.regions, region];
    patch(cfg.id, { regions: next });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Cân bằng tải ── */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
          <BarChart3 size={16} className="text-indigo-600 dark:text-indigo-400" />
          Phân bổ Lead theo đơn vị
        </h3>
        {stats.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">Chưa có dữ liệu phân bổ.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Đơn vị</th>
                  <th className="text-right px-3 py-2 font-semibold">7 ngày</th>
                  <th className="text-right px-3 py-2 font-semibold">30 ngày</th>
                  <th className="text-right px-3 py-2 font-semibold">Redirect cân bằng (7d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.map(s => (
                  <tr key={s.unit_id} className="text-slate-700 dark:text-slate-300">
                    <td className="px-3 py-2 font-medium">{s.unit_name} <span className="text-slate-400">({s.unit_code})</span></td>
                    <td className="px-3 py-2 text-right font-semibold">{s.leads_7d}</td>
                    <td className="px-3 py-2 text-right">{s.leads_30d}</td>
                    <td className="px-3 py-2 text-right">{s.balance_redirects_7d > 0 ? <span className="text-amber-600 dark:text-amber-400 font-semibold">{s.balance_redirects_7d}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cấu hình routing ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Cấu hình routing ({configs.length})
          </h3>
          <button
            onClick={addConfig}
            disabled={busy}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Thêm cấu hình
          </button>
        </div>

        <div className="flex items-start gap-2 mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            Lead khớp <b>sản phẩm</b> (rỗng = mọi SP) và <b>vùng</b> (Toàn quốc = mọi vùng). Nhiều đơn vị đủ điều kiện → ưu tiên theo <b>priority</b>;
            nếu chênh lệch tải &gt; 5 lead/tuần → tự cân bằng về đơn vị ít lead nhất. Không khớp rule nào → đơn vị <b>mặc định</b>.
          </span>
        </div>

        <div className="space-y-3">
          {configs.map(cfg => (
            <div
              key={cfg.id}
              className={`p-4 rounded-xl border transition-colors ${
                cfg.is_default
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                {/* Unit */}
                <select
                  value={cfg.unit_id}
                  onChange={(e) => patch(cfg.id, { unit_id: e.target.value })}
                  className="px-2 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                </select>

                {/* Priority */}
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Priority
                  <input
                    type="number"
                    value={cfg.priority}
                    onChange={(e) => patch(cfg.id, { priority: parseInt(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 text-center text-sm rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </label>

                {/* Active */}
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfg.is_active}
                    onChange={(e) => patch(cfg.id, { is_active: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  Kích hoạt
                </label>

                {/* Default */}
                <button
                  onClick={() => setDefault(cfg.id)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                    cfg.is_default
                      ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
                      : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                  title="Đặt làm đơn vị mặc định"
                >
                  <Star size={12} className={cfg.is_default ? 'fill-amber-500 text-amber-500' : ''} />
                  {cfg.is_default ? 'Mặc định' : 'Đặt mặc định'}
                </button>

                <button
                  onClick={() => remove(cfg.id)}
                  className="ml-auto p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Regions */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Vùng</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {REGION_OPTIONS.map(r => {
                    const active = cfg.regions.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        onClick={() => toggleRegion(cfg, r.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Products */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Sản phẩm {cfg.product_ids.length === 0 && <span className="text-slate-400 normal-case font-normal">(rỗng = tất cả)</span>}
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1 max-h-28 overflow-y-auto">
                  {products.map(p => {
                    const active = cfg.product_ids.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleProduct(cfg, p.id)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title={p.name}
                      >
                        {p.code || p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <input
                type="text"
                value={cfg.notes || ''}
                onChange={(e) => setConfigs(prev => prev.map(c => c.id === cfg.id ? { ...c, notes: e.target.value } : c))}
                onBlur={(e) => patch(cfg.id, { notes: e.target.value })}
                placeholder="Ghi chú cho admin..."
                className="mt-3 w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
              />
            </div>
          ))}

          {configs.length === 0 && (
            <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              Chưa có cấu hình routing. Bấm "Thêm cấu hình" để bắt đầu.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
