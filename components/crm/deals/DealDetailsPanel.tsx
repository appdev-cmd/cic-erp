import React, { useState, useEffect } from 'react';
import {
  Save, X, Plus, Trash2, Link2, Edit2, Briefcase,
  History, Clock, Package, Calendar, Tag, User
} from 'lucide-react';
import { CrmDeal, CrmDealProduct, CrmStageTemplate } from '../../../types';
import { LEAD_SOURCE_LABELS } from '../../../types/crm';
import type { LeadSource } from '../../../types/crm';
import { CrmDealService, CrmDealProductService, CrmActivityService, ProductService } from '../../../services';
import { AuditLogService, AuditLog } from '../../../services/auditLogService';
import { dataClient as supabase } from '../../../lib/dataClient';
import { formatDate, formatDateTime, formatCurrency } from '../../../utils/formatters';
import { toast } from 'sonner';
import SearchableSelect from '../../ui/SearchableSelect';
import DateInput from '../../ui/DateInput';
import LostReasonModal from './LostReasonModal';
import SourceSelect from '../shared/SourceSelect';

interface Props {
  deal?: CrmDeal;
  onClose: () => void;
  onSave: () => void;
  stages: CrmStageTemplate[];
}

export const DealDetailsPanel: React.FC<Props> = ({ deal, onClose, onSave, stages }) => {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'products' | 'history'>('general');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);

  // Deal Form Fields
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [probability, setProbability] = useState<number>(30);
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [source, setSource] = useState('');
  const [sourceDetail, setSourceDetail] = useState('');
  const [stageId, setStageId] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [lostReason, setLostReason] = useState('');

  // Products
  const [dealProducts, setDealProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Display values for selects
  const [customerName, setCustomerName] = useState('');
  const [contactName, setContactName] = useState('');

  // Load Deal Data
  useEffect(() => {
    if (deal) {
      setTitle(deal.title || '');
      setCustomerId(deal.customer_id || null);
      setContactId(deal.contact_id || null);
      setAmount(Number(deal.amount) || 0);
      setProbability(deal.probability || 30);
      setExpectedCloseDate(deal.expected_close_date || '');
      setSource(deal.source || '');
      setSourceDetail(deal.source_detail || '');
      setStageId(deal.stage_id || '');
      setAssignedTo(deal.assigned_to || null);
      setTags(deal.tags || []);
      setLostReason(deal.lost_reason || '');
      setCustomerName(deal.customer?.name || '');
      setContactName(deal.contact?.name || '');

      fetchProducts();
    } else {
      // Create mode
      setTitle('Deal mới');
      setCustomerId(null);
      setContactId(null);
      setAmount(0);
      setProbability(30);
      setExpectedCloseDate('');
      setSource('');
      setSourceDetail('');
      setStageId(stages.length > 0 ? stages[0].id : '');
      setAssignedTo(null);
      setTags([]);
      setLostReason('');
      setCustomerName('');
      setContactName('');
      setDealProducts([]);
    }
  }, [deal, stages]);

  // Load audit logs when History tab is active
  useEffect(() => {
    if (activeTab === 'history' && deal?.id) {
      const fetchAuditLogs = async () => {
        setLoadingAuditLogs(true);
        try {
          const logs = await AuditLogService.getByRecordId('crm_deals', deal.id);
          setAuditLogs(logs);
        } catch (err) {
          console.error('Error fetching audit logs:', err);
        } finally {
          setLoadingAuditLogs(false);
        }
      };
      fetchAuditLogs();
    }
  }, [activeTab, deal?.id]);

  const fetchProducts = async () => {
    if (!deal) return;
    try {
      setLoadingProducts(true);
      const data = await CrmDealProductService.getByDeal(deal.id);
      setDealProducts(data.map((p: any) => ({
        id: p.id,
        product_id: p.product_id,
        productName: p.product?.name || '',
        quantity: p.quantity,
        price: p.price,
        total: p.total,
        isNew: false,
      })));
    } catch (err: any) {
      toast.error('Lỗi tải sản phẩm: ' + err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Search handlers
  const handleSearchCompanies = async (query: string) => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email')
      .ilike('name', `%${query}%`)
      .limit(10);
    return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      subText: d.email || undefined
    }));
  };

  const handleSearchContacts = async (query: string) => {
    const { data } = await supabase
      .from('customer_contacts')
      .select('id, name, phone, email')
      .ilike('name', `%${query}%`)
      .limit(10);
    return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      subText: `${d.phone || ''} ${d.email ? '• ' + d.email : ''}`
    }));
  };

  // Stage click
  const handleStageClick = (targetStage: CrmStageTemplate) => {
    if (!deal) {
      setStageId(targetStage.id);
      return;
    }
    if (targetStage.id === stageId) return;

    if (targetStage.is_lose) {
      setShowLostModal(true);
      return;
    }

    setStageId(targetStage.id);
    handleAutoSaveStage(targetStage.id);
  };

  const handleAutoSaveStage = async (newStageId: string) => {
    if (!deal) return;
    try {
      await CrmDealService.update(deal.id, { stage_id: newStageId });
      toast.success('Đã cập nhật trạng thái');
      onSave();
    } catch (err: any) {
      toast.error('Lỗi cập nhật: ' + err.message);
    }
  };

  const handleLostConfirm = async (reason: string) => {
    if (!deal) return;
    const lostStage = stages.find(s => s.is_lose);
    if (!lostStage) return;

    try {
      setSaving(true);
      await CrmDealService.update(deal.id, {
        stage_id: lostStage.id,
        lost_reason: reason,
      });
      setStageId(lostStage.id);
      setLostReason(reason);
      toast.success('Đã đánh dấu deal là Thua');
      onSave();
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
      setShowLostModal(false);
    }
  };

  // Save Deal
  const handleSaveDeal = async () => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên Deal');
      return;
    }

    try {
      setSaving(true);

      const totalFromProducts = dealProducts.reduce((sum: number, p: any) => sum + (p.quantity * p.price), 0);

      const dealData: Partial<CrmDeal> = {
        title,
        customer_id: customerId || undefined,
        contact_id: contactId || undefined,
        amount: totalFromProducts || amount,
        expected_revenue: totalFromProducts || amount,
        currency: 'VND',
        probability,
        expected_close_date: expectedCloseDate || undefined,
        source: source || undefined,
        source_detail: sourceDetail || undefined,
        stage_id: stageId || undefined,
        assigned_to: assignedTo || undefined,
        tags: tags.length > 0 ? tags : undefined,
        lost_reason: lostReason || undefined,
      } as any;

      if (deal) {
        await CrmDealService.update(deal.id, dealData);

        // Sync deal products
        for (const dp of dealProducts) {
          if (dp.isNew && dp.product_id) {
            await CrmDealProductService.create({
              deal_id: deal.id,
              product_id: dp.product_id,
              quantity: dp.quantity,
              price: dp.price,
              total: dp.quantity * dp.price,
            });
          }
        }

        toast.success('Đã cập nhật Deal thành công');
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const profile = session?.user
          ? (await supabase.from('profiles').select('unit_id').eq('id', session.user.id).single()).data
          : null;

        const created = await CrmDealService.create({
          ...dealData,
          created_by: session?.user?.id,
          unit_id: profile?.unit_id || undefined,
        });

        // Create deal products
        for (const dp of dealProducts) {
          if (dp.product_id) {
            await CrmDealProductService.create({
              deal_id: created.id,
              product_id: dp.product_id,
              quantity: dp.quantity,
              price: dp.price,
              total: dp.quantity * dp.price,
            });
          }
        }

        toast.success('Đã tạo Deal mới thành công');
      }

      onSave();
      onClose();
    } catch (error: any) {
      toast.error('Lỗi lưu Deal: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeal = async () => {
    if (!deal) return;

    if (window.confirm(`Bạn có chắc chắn muốn xóa Deal "${deal.title}" không? Hành động này không thể hoàn tác.`)) {
      try {
        setSaving(true);
        await CrmDealService.delete(deal.id);
        toast.success('Đã xóa Deal thành công');
        onSave();
        onClose();
      } catch (error: any) {
        toast.error('Lỗi khi xóa Deal: ' + error.message);
        setSaving(false);
      }
    }
  };

  const handleCopyLink = () => {
    if (!deal) {
      toast.error('Deal chưa được tạo, không thể sao chép liên kết');
      return;
    }
    const link = `${window.location.origin}/crm/deals?id=${deal.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Đã sao chép liên kết deal vào clipboard');
  };

  // Product management
  const handleAddProductRow = () => {
    setDealProducts([...dealProducts, {
      id: Math.random().toString(36).substring(2, 9),
      product_id: null,
      productName: '',
      quantity: 1,
      price: 0,
      total: 0,
      isNew: true,
    }]);
  };

  const handleRemoveProduct = async (index: number) => {
    const product = dealProducts[index];
    if (!product.isNew && deal) {
      try {
        await CrmDealProductService.delete(product.id);
        toast.success('Đã xóa sản phẩm');
      } catch (err: any) {
        toast.error('Lỗi xóa sản phẩm: ' + err.message);
        return;
      }
    }
    setDealProducts(dealProducts.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, field: string, value: any) => {
    const updated = [...dealProducts];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'price') {
      updated[index].total = updated[index].quantity * updated[index].price;
    }
    setDealProducts(updated);
  };

  // Tag management
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const inputCls = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none transition-colors";
  const labelCls = "block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">

      {/* 1. Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-8">
          <Briefcase className="text-indigo-600 dark:text-indigo-400 shrink-0" size={24} />
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
              className="text-lg md:text-xl font-bold bg-white dark:bg-slate-800 border border-indigo-500 focus:outline-none rounded px-2 py-0.5 w-full text-slate-950 dark:text-slate-50"
            />
          ) : (
            <div className="flex items-center gap-2 group min-w-0">
              <h2
                onClick={() => setIsEditingTitle(true)}
                className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1.5 py-0.5 transition-colors"
                title="Click để chỉnh sửa tiêu đề"
              >
                {title || 'Tạo Deal mới'}
              </h2>
              <Edit2
                size={14}
                onClick={() => setIsEditingTitle(true)}
                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          )}
          <button
            onClick={handleCopyLink}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            title="Bấm để copy link"
          >
            <Link2 size={16} />
          </button>
        </div>
      </div>

      {/* 2. Chevron Stepper */}
      <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center w-full select-none overflow-x-auto select-scrollbar-none">
          <div className="flex w-full items-center min-w-[600px]">
            {stages.map((stage, idx) => {
              const isCurrent = stageId === stage.id;
              const isPassed = stages.findIndex(s => s.id === stageId) >= idx;

              return (
                <div
                  key={stage.id}
                  onClick={() => handleStageClick(stage)}
                  className={`flex-1 relative h-10 flex items-center justify-center cursor-pointer transition-all pr-4 ${
                    idx === 0 ? 'rounded-l-lg' : ''
                  } ${
                    idx === stages.length - 1 ? 'rounded-r-lg' : ''
                  } ${
                    isCurrent
                      ? 'bg-sky-500 text-white dark:bg-sky-600'
                      : isPassed
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                  style={{
                    clipPath: idx === stages.length - 1
                      ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 8px 50%)'
                      : idx === 0
                        ? 'polygon(0% 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 0% 100%)'
                        : 'polygon(0% 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 0% 100%, 8px 50%)',
                    marginLeft: idx > 0 ? '-6px' : '0'
                  }}
                >
                  <span className="text-xs font-bold truncate px-6">
                    {stage.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Tab bar */}
      <div className="px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <nav className="flex space-x-6 overflow-x-auto select-scrollbar-none">
          {[
            { id: 'general', name: 'Tổng quan' },
            { id: 'products', name: 'Sản phẩm' },
            { id: 'history', name: 'Lịch sử' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 border-b-2 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* 4. Tab content */}
      <div className="flex-1 overflow-y-auto">

        {activeTab === 'general' && (
          <div className="p-6 space-y-6">
            {/* Deal info section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className={labelCls}>THÔNG TIN DEAL</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stage */}
                <div>
                  <label className={labelCls}>Trạng thái</label>
                  <select
                    value={stageId}
                    onChange={(e) => {
                      const stage = stages.find(s => s.id === e.target.value);
                      if (stage) handleStageClick(stage);
                    }}
                    className={inputCls + ' cursor-pointer'}
                  >
                    <option value="">-- Chọn --</option>
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className={labelCls}>Giá trị (VNĐ)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    className={inputCls}
                    min={0}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {formatCurrency(amount)}
                  </p>
                </div>

                {/* Probability */}
                <div>
                  <label className={labelCls}>Xác suất (%)</label>
                  <input
                    type="number"
                    value={probability}
                    onChange={e => setProbability(Number(e.target.value))}
                    className={inputCls}
                    min={0}
                    max={100}
                  />
                </div>

                {/* Expected close date */}
                <div>
                  <label className={labelCls}>Ngày dự kiến chốt</label>
                  <DateInput
                    value={expectedCloseDate}
                    onChange={setExpectedCloseDate}
                    className={inputCls}
                  />
                </div>

                {/* Company */}
                <div>
                  <label className={labelCls}>Công ty</label>
                  <SearchableSelect
                    value={customerId}
                    onChange={(id, option) => {
                      setCustomerId(id);
                      if (option) setCustomerName(option.name);
                    }}
                    onSearch={handleSearchCompanies}
                    placeholder="Tìm công ty..."
                    getDisplayValue={() => customerName || undefined}
                    size="sm"
                  />
                </div>

                {/* Contact */}
                <div>
                  <label className={labelCls}>Người liên hệ</label>
                  <SearchableSelect
                    value={contactId}
                    onChange={(id, option) => {
                      setContactId(id);
                      if (option) setContactName(option.name);
                    }}
                    onSearch={handleSearchContacts}
                    placeholder="Tìm liên hệ..."
                    getDisplayValue={() => contactName || undefined}
                    size="sm"
                  />
                </div>

                {/* Source */}
                <div>
                  <label className={labelCls}>Nguồn</label>
                  <SourceSelect
                    value={source}
                    onChange={val => setSource(val)}
                    className="w-full mt-1.5"
                  />
                </div>

                {/* Source Detail */}
                {source && (
                  <div>
                    <label className={labelCls}>Chi tiết nguồn</label>
                    <input
                      type="text"
                      value={sourceDetail}
                      onChange={e => setSourceDetail(e.target.value)}
                      placeholder="VD: Fanpage Facebook..."
                      className={inputCls}
                    />
                  </div>
                )}

                {/* Lost Reason (readonly, shown if exists) */}
                {lostReason && (
                  <div className="md:col-span-2">
                    <label className={labelCls}>Lý do thua</label>
                    <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                      {lostReason}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Nhãn (Tags)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-full"
                      >
                        <Tag size={10} />
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-red-500 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="Nhập tag..."
                      className={inputCls + ' flex-1'}
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignee section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className={labelCls}>NGƯỜI PHỤ TRÁCH</h3>
              </div>
              <div className="p-4">
                {deal?.assignee ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                      {deal.assignee.avatar ? (
                        <img src={deal.assignee.avatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
                          {deal.assignee.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-sky-600 dark:text-sky-400">{deal.assignee.name}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-amber-500 dark:text-amber-400 italic">Chưa có người phụ trách</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="p-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Sản phẩm trong Deal</h3>
                <button
                  onClick={handleAddProductRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Thêm sản phẩm
                </button>
              </div>

              {dealProducts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                    <Package size={20} />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Chưa có sản phẩm nào</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Thêm sản phẩm vào deal này</p>
                  <button
                    onClick={handleAddProductRow}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus size={14} /> Thêm sản phẩm đầu tiên
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-5 w-[300px]">Sản phẩm</th>
                        <th className="py-3 px-3 w-28 text-center">Số lượng</th>
                        <th className="py-3 px-3 w-40 text-right">Đơn giá</th>
                        <th className="py-3 px-5 text-right w-44">Thành tiền</th>
                        <th className="py-3 px-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                      {dealProducts.map((p, index) => (
                        <tr key={p.id} className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'} hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors`}>
                          <td className="py-3.5 px-5">
                            <SearchableSelect
                              value={p.product_id || null}
                              placeholder="Chọn sản phẩm..."
                              getDisplayValue={() => p.productName || undefined}
                              size="sm"
                              onChange={async (pId, option) => {
                                if (pId && option) {
                                  const updated = [...dealProducts];
                                  updated[index] = {
                                    ...updated[index],
                                    product_id: pId,
                                    productName: option.name,
                                    price: 0,
                                  };
                                  try {
                                    const fullProduct = await ProductService.getById(pId);
                                    if (fullProduct) {
                                      updated[index].price = fullProduct.basePrice || 0;
                                    }
                                  } catch (err) {
                                    console.warn('Error fetching product detail:', err);
                                  }
                                  updated[index].total = updated[index].quantity * updated[index].price;
                                  setDealProducts(updated);
                                }
                              }}
                              onSearch={async (query) => {
                                const results = await ProductService.search(query, 20);
                                return results.map(prod => ({ id: prod.id, name: prod.name, subText: prod.category }));
                              }}
                            />
                          </td>
                          <td className="py-3.5 px-3">
                            <input
                              type="number"
                              min={1}
                              value={p.quantity}
                              onChange={e => handleProductChange(index, 'quantity', Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-center text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                            />
                          </td>
                          <td className="py-3.5 px-3">
                            <input
                              type="number"
                              min={0}
                              value={p.price}
                              onChange={e => handleProductChange(index, 'price', Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-right text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                            />
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                              {formatCurrency(p.quantity * p.price)}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <button
                              onClick={() => handleRemoveProduct(index)}
                              className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-800">
                        <td colSpan={3} className="py-4 px-5 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Tổng cộng</td>
                        <td className="py-4 px-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-base">
                          {formatCurrency(dealProducts.reduce((sum: number, p: any) => sum + (p.quantity * p.price), 0))}
                        </td>
                        <td className="py-4 px-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <History size={18} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Nhật ký thay đổi</h3>
            </div>

            {loadingAuditLogs ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-3">
                  <History size={24} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có lịch sử thay đổi</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-1">
                  {auditLogs.map((log) => {
                    const { date, time } = AuditLogService.formatDateTime(log.created_at);
                    const description = AuditLogService.formatAction(log.action, log.old_data, log.new_data);

                    const actionColors: Record<string, string> = {
                      'INSERT': 'bg-emerald-500',
                      'UPDATE': 'bg-sky-500',
                      'DELETE': 'bg-red-500',
                    };
                    const dotColor = actionColors[log.action] || 'bg-slate-400';

                    return (
                      <div key={log.id} className="relative flex gap-4 py-3 pl-1">
                        <div className={`w-[10px] h-[10px] rounded-full ${dotColor} mt-1.5 shrink-0 z-10 ring-2 ring-white dark:ring-slate-900`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                            {description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {time} — {date}
                            </span>
                            {log.user_name && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                bởi <span className="font-medium text-sky-600 dark:text-sky-400">{log.user_name}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Footer Buttons */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-between items-center gap-3">
        <div>
          {deal && (
            <button
              onClick={handleDeleteDeal}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors rounded-lg cursor-pointer"
            >
              <Trash2 size={16} />
              XÓA DEAL
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors rounded-lg cursor-pointer"
          >
            HỦY
          </button>
          <button
            onClick={handleSaveDeal}
            disabled={saving}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold text-sm shadow-md shadow-emerald-100 dark:shadow-none transition-all cursor-pointer"
          >
            <Save size={16} />
            LƯU DEAL
          </button>
        </div>
      </div>

      {/* Lost Reason Modal */}
      <LostReasonModal
        isOpen={showLostModal}
        onClose={() => setShowLostModal(false)}
        onConfirm={handleLostConfirm}
      />
    </div>
  );
};

export default DealDetailsPanel;
