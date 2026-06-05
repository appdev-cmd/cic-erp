/**
 * CrmSettingsPage — Trang cấu hình CRM
 * Quản lý: Lead Stages, Deal Stages, Product Catalog (crm_visible), Region config, Source config
 */

import React, { useState, useEffect } from 'react';
import { CrmLayout } from '../CrmLayout';
import { CrmStageTemplateService } from '../../../services';
import { dataClient as supabase } from '../../../lib/dataClient';
import { toast } from 'sonner';
import {
  Settings2, Target, Briefcase, Package, MapPin,
  Plus, Trash2, GripVertical, Save, ChevronRight,
  Palette, ArrowUpDown, Users,
} from 'lucide-react';
import type { CrmStageTemplate } from '../../../types';
import LeadAssignmentSettings from './LeadAssignmentSettings';

type SettingsTab = 'lead-stages' | 'deal-stages' | 'products' | 'assignment';

interface StageFormItem extends Partial<CrmStageTemplate> {
  _isNew?: boolean;
  _deleted?: boolean;
}

const COLOR_PRESETS = [
  '#93C5FD', '#60A5FA', '#3B82F6', '#1D4ED8', '#8B5CF6',
  '#6366F1', '#EC4899', '#F43F5E', '#F87171', '#FB923C',
  '#FBBF24', '#34D399', '#10B981', '#059669', '#6B7280',
];

export default function CrmSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('lead-stages');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Stage management
  const [leadStages, setLeadStages] = useState<StageFormItem[]>([]);
  const [dealStages, setDealStages] = useState<StageFormItem[]>([]);

  // Products management
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    fetchStages();
    fetchProducts();
  }, []);

  const fetchStages = async () => {
    try {
      setLoading(true);
      const [leads, deals] = await Promise.all([
        CrmStageTemplateService.getAll('lead'),
        CrmStageTemplateService.getAll('deal'),
      ]);
      setLeadStages(leads.map(s => ({ ...s })));
      setDealStages(deals.map(s => ({ ...s })));
    } catch (err: any) {
      toast.error('Lỗi tải cấu hình: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, code, category, crm_visible, ai_description')
        .order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      toast.error('Lỗi tải sản phẩm: ' + err.message);
    }
  };

  const handleSaveStages = async (entityType: 'lead' | 'deal') => {
    const stages = entityType === 'lead' ? leadStages : dealStages;
    try {
      setSaving(true);

      for (const stage of stages) {
        if (stage._deleted && stage.id) {
          await supabase.from('crm_stage_templates').delete().eq('id', stage.id);
          continue;
        }

        if (stage._isNew) {
          await supabase.from('crm_stage_templates').insert({
            entity_type: entityType,
            name: stage.name,
            color: stage.color || '#3B82F6',
            sort_order: stage.sort_order || 0,
            is_win: stage.is_win || false,
            is_lose: stage.is_lose || false,
          });
        } else if (stage.id) {
          await supabase.from('crm_stage_templates').update({
            name: stage.name,
            color: stage.color,
            sort_order: stage.sort_order,
            is_win: stage.is_win || false,
            is_lose: stage.is_lose || false,
          }).eq('id', stage.id);
        }
      }

      toast.success(`Đã lưu cấu hình ${entityType === 'lead' ? 'Lead' : 'Deal'} stages`);
      fetchStages();
    } catch (err: any) {
      toast.error('Lỗi lưu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCrmVisible = async (productId: string, currentVal: boolean) => {
    try {
      await supabase.from('products').update({ crm_visible: !currentVal }).eq('id', productId);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, crm_visible: !currentVal } : p));
      toast.success(!currentVal ? 'Đã bật hiển thị CRM' : 'Đã tắt hiển thị CRM');
    } catch (err: any) {
      toast.error('Lỗi cập nhật: ' + err.message);
    }
  };

  const handleUpdateAiDescription = async (productId: string, desc: string) => {
    try {
      await supabase.from('products').update({ ai_description: desc }).eq('id', productId);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, ai_description: desc } : p));
    } catch (err: any) {
      toast.error('Lỗi cập nhật: ' + err.message);
    }
  };

  const addStage = (entityType: 'lead' | 'deal') => {
    const stages = entityType === 'lead' ? leadStages : dealStages;
    const setter = entityType === 'lead' ? setLeadStages : setDealStages;
    const newStage: StageFormItem = {
      name: 'Stage mới',
      color: COLOR_PRESETS[stages.length % COLOR_PRESETS.length],
      sort_order: stages.length + 1,
      is_win: false,
      is_lose: false,
      _isNew: true,
    };
    setter([...stages, newStage]);
  };

  const removeStage = (entityType: 'lead' | 'deal', index: number) => {
    const stages = entityType === 'lead' ? leadStages : dealStages;
    const setter = entityType === 'lead' ? setLeadStages : setDealStages;
    const updated = [...stages];
    if (updated[index].id) {
      updated[index]._deleted = true;
    } else {
      updated.splice(index, 1);
    }
    setter(updated);
  };

  const updateStage = (entityType: 'lead' | 'deal', index: number, field: string, value: any) => {
    const setter = entityType === 'lead' ? setLeadStages : setDealStages;
    setter(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ElementType; description: string }[] = [
    { key: 'lead-stages', label: 'Lead Stages', icon: Target, description: 'Cấu hình trạng thái Lead pipeline' },
    { key: 'deal-stages', label: 'Deal Stages', icon: Briefcase, description: 'Cấu hình trạng thái Deal pipeline' },
    { key: 'products', label: 'Sản phẩm CRM', icon: Package, description: 'Chọn sản phẩm hiển thị trên CRM' },
    { key: 'assignment', label: 'Phân công Lead', icon: Users, description: 'Routing Lead về đơn vị & cân bằng tải' },
  ];

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const renderStageEditor = (entityType: 'lead' | 'deal') => {
    const stages = (entityType === 'lead' ? leadStages : dealStages).filter(s => !s._deleted);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {entityType === 'lead' ? 'Lead' : 'Deal'} Stages ({stages.length})
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => addStage(entityType)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
            >
              <Plus size={12} /> Thêm stage
            </button>
            <button
              onClick={() => handleSaveStages(entityType)}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save size={12} /> Lưu thay đổi
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {stages.map((stage, idx) => (
            <div
              key={stage.id || `new-${idx}`}
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg group hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
            >
              {/* Drag handle */}
              <GripVertical size={14} className="text-slate-300 dark:text-slate-600 cursor-grab flex-shrink-0" />

              {/* Sort order */}
              <input
                type="number"
                value={stage.sort_order || 0}
                onChange={(e) => updateStage(entityType, idx, 'sort_order', parseInt(e.target.value))}
                className="w-12 px-1 py-1 text-center text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                min={1}
              />

              {/* Color picker */}
              <div className="relative">
                <input
                  type="color"
                  value={stage.color || '#3B82F6'}
                  onChange={(e) => updateStage(entityType, idx, 'color', e.target.value)}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                  style={{ backgroundColor: stage.color || '#3B82F6' }}
                />
              </div>

              {/* Name */}
              <input
                type="text"
                value={stage.name || ''}
                onChange={(e) => updateStage(entityType, idx, 'name', e.target.value)}
                className="flex-1 px-2 py-1.5 text-sm bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Tên stage..."
              />

              {/* Win/Lose flags */}
              <label className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stage.is_win || false}
                  onChange={(e) => updateStage(entityType, idx, 'is_win', e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                />
                Win
              </label>
              <label className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stage.is_lose || false}
                  onChange={(e) => updateStage(entityType, idx, 'is_lose', e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-red-600 focus:ring-red-500"
                />
                Lose
              </label>

              {/* Delete */}
              <button
                onClick={() => removeStage(entityType, idx)}
                className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Stage Preview */}
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Xem trước Pipeline</p>
          <div className="flex items-center gap-1">
            {stages.map((stage, idx) => (
              <div
                key={stage.id || `preview-${idx}`}
                className="flex-1 h-8 flex items-center justify-center text-[10px] font-bold text-white rounded truncate px-1"
                style={{
                  backgroundColor: stage.color || '#3B82F6',
                  clipPath: idx === stages.length - 1
                    ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 6px 50%)'
                    : idx === 0
                      ? 'polygon(0% 0%, calc(100% - 6px) 0%, 100% 50%, calc(100% - 6px) 100%, 0% 100%)'
                      : 'polygon(0% 0%, calc(100% - 6px) 0%, 100% 50%, calc(100% - 6px) 100%, 0% 100%, 6px 50%)',
                  marginLeft: idx > 0 ? '-4px' : '0',
                }}
              >
                {stage.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderProductSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Sản phẩm hiển thị trên CRM ({products.filter(p => p.crm_visible).length}/{products.length})
        </h3>
        <input
          type="text"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Tìm sản phẩm..."
          className="w-48 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="space-y-1 max-h-[500px] overflow-y-auto">
        {filteredProducts.map(product => (
          <div
            key={product.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              product.crm_visible
                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            {/* Toggle */}
            <button
              onClick={() => handleToggleCrmVisible(product.id, product.crm_visible)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                product.crm_visible ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                product.crm_visible ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {product.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {product.code && <span className="mr-2">{product.code}</span>}
                {product.category && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{product.category}</span>}
              </div>
            </div>

            {/* AI Description */}
            <div className="w-64 flex-shrink-0">
              <input
                type="text"
                value={product.ai_description || ''}
                onChange={(e) => {
                  setProducts(prev => prev.map(p => p.id === product.id ? { ...p, ai_description: e.target.value } : p));
                }}
                onBlur={(e) => handleUpdateAiDescription(product.id, e.target.value)}
                placeholder="Mô tả cho AI..."
                className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <CrmLayout>
      <div className="h-full flex bg-slate-50 dark:bg-slate-950">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 overflow-y-auto">
          <div className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
              <Settings2 size={16} className="text-indigo-600 dark:text-indigo-400" />
              Cấu hình CRM
            </h2>

            <nav className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <tab.icon size={16} className={activeTab === tab.key ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} />
                  <div>
                    <div className="text-sm font-medium">{tab.label}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">{tab.description}</div>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'lead-stages' && renderStageEditor('lead')}
              {activeTab === 'deal-stages' && renderStageEditor('deal')}
              {activeTab === 'products' && renderProductSettings()}
              {activeTab === 'assignment' && <LeadAssignmentSettings />}
            </>
          )}
        </div>
      </div>
    </CrmLayout>
  );
}
