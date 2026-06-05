import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Phone, Mail, MessageSquare, Settings, Edit2, Target, 
  User, Save, X, Plus, Send, Link2, MoreVertical, FileText, 
  Briefcase, Activity, CheckSquare, MessageCircle, AlertCircle, Package, Trash2,
  History, Clock, ArrowRightCircle, MapPin
} from 'lucide-react';
import { CrmLead, CrmActivity, CrmStageTemplate } from '../../../types';
import { LEAD_SOURCE_LABELS, SOURCE_DETAIL_PLACEHOLDER, REGION_LABELS } from '../../../types/crm';
import type { LeadSource, RegionType } from '../../../types/crm';
import { detectLeadRegion } from '../../../lib/crm/regionDetect';
import { CrmLeadService, CrmActivityService, CrmStageTemplateService, ProductService, CustomerService } from '../../../services';
import { AuditLogService, AuditLog } from '../../../services/auditLogService';
import { dataClient as supabase } from '../../../lib/dataClient';
import { formatDate, formatDateTime, formatCurrency } from '../../../utils/formatters';
import { toast } from 'sonner';
import SearchableSelect from '../../ui/SearchableSelect';
import StageTransitionModal from './StageTransitionModal';
import CompleteLeadModal from './CompleteLeadModal';
import LeadScoreBadge from '../shared/LeadScoreBadge';
import LeadAIInsightsTab from './LeadAIInsightsTab';
import MergeLeadModal from './MergeLeadModal';
import {
  isLoseStage, resolveStageAction, isHighPotentialStage, isInProgressStage,
  mapPotentialLevelToStage, isLevelUp,
} from '../../../lib/crm/stageWorkflow';
import { POTENTIAL_LEVEL_LABELS, POTENTIAL_LEVEL_COLORS } from '../../../types/crm';
import type { PotentialLevel } from '../../../types/crm';
import { GitMerge, Hand, TrendingUp } from 'lucide-react';
import SourceSelect from '../shared/SourceSelect';

interface Props {
  lead?: CrmLead; // If undefined, we are in "Create Lead" mode
  onClose: () => void;
  onSave: () => void;
  stages: CrmStageTemplate[];
}

export const LeadDetailsPanel: React.FC<Props> = ({ lead, onClose, onSave, stages }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'products' | 'history' | 'ai_insights'>('general');
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [pendingStage, setPendingStage] = useState<CrmStageTemplate | null>(null);
  // Mức tiềm năng — đổi mức trong "Đang xử lý" (không đổi stage)
  const [pendingLevelChange, setPendingLevelChange] = useState<PotentialLevel | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [activeActivityTab, setActiveActivityTab] = useState<'comment' | 'task' | 'sms' | 'email' | 'wait' | 'meeting' | 'call' | 'visit'>('comment');
  const [localProducts, setLocalProducts] = useState<any[]>([]);
  
  // Lead Form Fields
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [stageId, setStageId] = useState('');
  const [expectedValue, setExpectedValue] = useState<number>(0);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [salutation, setSalutation] = useState('Chưa chọn');
  const [lastName, setLastName] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [sourceDetail, setSourceDetail] = useState('');
  const [region, setRegion] = useState<RegionType>('unknown');
  const [claimedName, setClaimedName] = useState<string | null>(null); // optimistic sau khi tự nhận

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState<CrmLead[]>([]);
  const dupCheckTimer = useRef<NodeJS.Timeout | null>(null);

  // Search initial states for dropdowns
  const [companyOptions, setCompanyOptions] = useState<any[]>([]);
  const [contactOptions, setContactOptions] = useState<any[]>([]);

  // Timeline activities
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Load Lead Data
  useEffect(() => {
    if (lead) {
      setTitle(lead.title || '');
      setName(lead.name || '');
      setCompanyName(lead.company_name || '');
      setPhone(lead.phone || '');
      setEmail(lead.email || '');
      setSource(lead.source || '');
      setStageId(lead.stage_id || '');
      setExpectedValue(Number(lead.expected_value) || 0);
      setAssignedTo(lead.assigned_to || null);
      setSourceDetail((lead as any).source_detail || '');
      setRegion(((lead as any).region as RegionType) || 'unknown');
      
      const parsedProducts = (lead.products || []).map((p: any) => ({
        id: p.id || Math.random().toString(36).substring(2, 9),
        productId: p.productId || undefined,
        productName: p.productName || p.product_name || '',
        quantity: p.quantity || 1,
        unit: p.unit || 'Cái',
        price: p.price !== undefined ? p.price : (p.unit_price || 0),
        manufacturer: p.manufacturer || '',
        supplier: p.supplier || '',
        total: p.total !== undefined ? p.total : (p.total_price || 0)
      }));
      setLocalProducts(parsedProducts);

      // Attempt to extract salutation & last name from name
      if (lead.name) {
        if (lead.name.startsWith('Mr.') || lead.name.includes('[CRM-TEST] Mr.')) {
          setSalutation('Mr');
        } else if (lead.name.startsWith('Ms.') || lead.name.includes('[CRM-TEST] Ms.')) {
          setSalutation('Ms');
        } else {
          setSalutation('Chưa chọn');
        }
        
        // Simple last name logic (everything after first word)
        const cleanName = lead.name.replace('[CRM-TEST] ', '').trim();
        const parts = cleanName.split(' ');
        if (parts.length > 1) {
          setLastName(parts.slice(1).join(' '));
        } else {
          setLastName(cleanName);
        }
      } else {
        setSalutation('Chưa chọn');
        setLastName('');
      }

      fetchActivities();
    } else {
      // Create mode
      setTitle('Đầu mối mới');
      setName('');
      setCompanyName('');
      setPhone('');
      setEmail('');
      setSource('website');
      setStageId(stages.length > 0 ? stages[0].id : '');
      setExpectedValue(0);
      setAssignedTo(null);
      setSalutation('Chưa chọn');
      setLastName('');
      setLocalProducts([]);
      setActivities([]);
      setSourceDetail('');
      setRegion('unknown');
      setDuplicateWarning([]);
    }
  }, [lead, stages]);
  
  // Auto detect region based on company name or source detail
  useEffect(() => {
    if (region === 'unknown') {
      const detected = detectLeadRegion({ company_name: companyName, source_detail: sourceDetail });
      if (detected !== 'unknown') {
        setRegion(detected);
      }
    }
  }, [companyName, sourceDetail, region]);

  // Load audit logs when History tab is active
  useEffect(() => {
    if (activeTab === 'history' && lead?.id) {
      const fetchAuditLogs = async () => {
        setLoadingAuditLogs(true);
        try {
          const logs = await AuditLogService.getByRecordId('crm_leads', lead.id);
          setAuditLogs(logs);
        } catch (err) {
          console.error('Error fetching audit logs:', err);
        } finally {
          setLoadingAuditLogs(false);
        }
      };
      fetchAuditLogs();
    }
  }, [activeTab, lead?.id]);

  const fetchActivities = async () => {
    if (!lead) return;
    try {
      setLoadingActivities(true);
      const data = await CrmActivityService.getByEntity('lead', lead.id);
      setActivities(data);
    } catch (error: any) {
      toast.error('Lỗi tải timeline hoạt động: ' + error.message);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Dropdown search handlers
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

  // Activity comment submit
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !lead) return;

    try {
      setSaving(true);
      // Retrieve current session to assign creator
      const { data: { session } } = await supabase.auth.getSession();
      
      await CrmActivityService.create({
        lead_id: lead.id,
        activity_type: 'Note',
        description: commentText,
        created_by: session?.user?.id
      });

      setCommentText('');
      toast.success('Đã thêm ghi chú thành công');
      fetchActivities();
    } catch (error: any) {
      toast.error('Lỗi thêm bình luận: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════
  // Stage Transition Logic (Bitrix24-style)
  // ═══════════════════════════════════════
  const handleStageClick = (targetStage: CrmStageTemplate) => {
    if (!lead) return; // Create mode — no stage transitions
    if (targetStage.id === stageId) return; // Same stage — no-op

    const action = resolveStageAction(lead, targetStage);
    if (action === 'complete') {
      // Stage "Tiềm năng cao" (win) → Open CompleteLeadModal
      setShowCompleteModal(true);
    } else if (action === 'transition') {
      // Missing required fields, or lose stage (needs reason) → StageTransitionModal
      setPendingStage(targetStage);
      setShowTransitionModal(true);
    } else {
      // 'direct' — đủ điều kiện / lùi stage → cập nhật ngay
      setStageId(targetStage.id);
      handleAutoSaveStage(targetStage.id);
    }
  };

  // Auto-save stage change (used for backward transitions)
  const handleAutoSaveStage = async (newStageId: string) => {
    if (!lead) return;
    try {
      await CrmLeadService.update(lead.id, { stage_id: newStageId });
      toast.success('Đã cập nhật trạng thái');
      onSave();
    } catch (err: any) {
      toast.error('Lỗi cập nhật: ' + err.message);
    }
  };

  // Callback from StageTransitionModal: fields validated, save & move
  const handleStageTransitionConfirm = async (updatedData: Partial<CrmLead>) => {
    if (!lead || !pendingStage) return;
    try {
      // Lose stages → record completion bookkeeping (closed, not an opportunity)
      const losePayload: Partial<CrmLead> = isLoseStage(pendingStage.name)
        ? {
            is_opportunity: false,
            completed_at: new Date().toISOString(),
            completion_result: pendingStage.name.toLowerCase().includes('mất') ? 'lost' : 'unqualified',
          }
        : {};

      // Save lead with updated fields + new stage
      await CrmLeadService.update(lead.id, {
        ...updatedData,
        ...losePayload,
        stage_id: pendingStage.id,
      });
      setStageId(pendingStage.id);
      // Update local state with the validated fields
      if (updatedData.source) setSource(updatedData.source);
      if (updatedData.company_name) setCompanyName(updatedData.company_name);
      if (updatedData.name) setName(updatedData.name);
      if (updatedData.email) setEmail(updatedData.email);
      if (updatedData.phone) setPhone(updatedData.phone);
      
      toast.success(`Đã chuyển sang "${pendingStage.name}"`);
      onSave();
    } catch (err: any) {
      toast.error('Lỗi chuyển trạng thái: ' + err.message);
    } finally {
      setShowTransitionModal(false);
      setPendingStage(null);
    }
  };

  // Nhận lead (Unit Pool self-claim)
  const handleClaimLead = async () => {
    if (!lead) return;
    try {
      await CrmLeadService.claimLead(lead.id);
      // Optimistic: hiện ngay tên người nhận (chính mình) không cần mở lại panel
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
          setClaimedName(prof?.full_name || 'Bạn');
        }
      } catch { /* ignore */ }
      toast.success('Đã nhận lead thành công');
      onSave();
    } catch (err: any) {
      toast.error(err.message || 'Không thể nhận lead');
    }
  };

  // Lead Save Form
  const handleSaveLead = async () => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên Lead');
      return;
    }
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên người liên hệ');
      return;
    }
    if (!phone.trim()) {
      toast.error('Vui lòng nhập số điện thoại người liên hệ');
      return;
    }
    if (!email.trim()) {
      toast.error('Vui lòng nhập email người liên hệ');
      return;
    }
    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Vui lòng nhập email hợp lệ');
      return;
    }

    try {
      setSaving(true);
      
      const totalExpectedValue = localProducts.reduce((sum: number, p: any) => sum + (p.quantity * p.price), 0);

      const serializedProducts = localProducts.map((p: any) => ({
        id: p.id,
        productId: p.productId,
        productName: p.productName,
        quantity: p.quantity,
        unit: p.unit,
        unit_price: p.price,
        total_price: p.quantity * p.price,
        price: p.price,
        total: p.quantity * p.price,
        manufacturer: p.manufacturer,
        supplier: p.supplier
      }));

      const leadData: Partial<CrmLead> = {
        title,
        name: name || undefined,
        company_name: companyName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        source: source || undefined,
        source_detail: sourceDetail || undefined,
        region: region || 'unknown',
        stage_id: stageId || undefined,
        expected_value: totalExpectedValue,
        assigned_to: assignedTo || undefined,
        products: serializedProducts
      } as any;

      if (lead) {
        // Update
        await CrmLeadService.update(lead.id, leadData);
        toast.success('Đã cập nhật thông tin Lead thành công');
      } else {
        // Create
        const { data: { session } } = await supabase.auth.getSession();
        const profile = session?.user ? (await supabase.from('profiles').select('unit_id').eq('id', session.user.id).single()).data : null;
        
        await CrmLeadService.create({
          ...leadData,
          created_by: session?.user?.id,
          unit_id: profile?.unit_id || undefined
        });
        toast.success('Đã tạo Lead mới thành công');
      }

      onSave();
      onClose();
    } catch (error: any) {
      toast.error('Lỗi lưu Lead: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    
    if (window.confirm(`Bạn có chắc chắn muốn xóa Lead "${lead.title}" không? Hành động này không thể hoàn tác.`)) {
      try {
        setSaving(true);
        await CrmLeadService.delete(lead.id);
        toast.success('Đã xóa Lead thành công');
        onSave(); // Kích hoạt reload data bên ngoài
        onClose(); // Đóng panel
      } catch (error: any) {
        toast.error('Lỗi khi xóa Lead: ' + error.message);
        setSaving(false); 
      }
    }
  };

  const handleCopyLink = () => {
    if (!lead) {
      toast.error('Lead chưa được tạo, không thể sao chép liên kết');
      return;
    }
    const link = `${window.location.origin}/crm/leads?id=${lead.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Đã sao chép liên kết lead vào clipboard');
  };

  // Render chat bubble format if chat transcript exists
  const renderActivityDescription = (desc: string) => {
    const isLiveChat = desc.includes('Open Channel chat') || desc.includes('[Live chat]');
    if (!isLiveChat) {
      return (
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {desc}
        </p>
      );
    }

    // Parse the lines
    const lines = desc.split('\n');
    const header = lines[0];
    const footer = lines.find(l => l.startsWith('With:'));
    const messageLines = lines.slice(1).filter(l => l && !l.startsWith('With:'));

    return (
      <div className="mt-2 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
          <MessageCircle size={12} className="text-indigo-500" />
          <span>{header}</span>
        </div>

        {/* Message container */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-2.5">
          {messageLines.map((line, idx) => {
            const isUser = line.startsWith('[Bùi Quang Hùng]');
            const isSystem = line.startsWith('[Hệ thống]');
            let cleanMsg = line;
            if (isUser) cleanMsg = line.replace('[Bùi Quang Hùng]:', '').trim();
            if (isSystem) cleanMsg = line.replace('[Hệ thống]:', '').trim();

            if (isUser) {
              return (
                <div key={idx} className="flex justify-start">
                  <div className="max-w-[85%] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300 rounded-2xl rounded-tl-none px-3.5 py-2 text-sm font-medium border border-indigo-100/50 dark:border-indigo-900/30">
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">Bùi Quang Hùng</p>
                    <p>{cleanMsg}</p>
                  </div>
                </div>
              );
            } else if (isSystem) {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-[85%] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 rounded-2xl rounded-tr-none px-3.5 py-2 text-sm font-medium border border-emerald-100/50 dark:border-emerald-900/30 shadow-sm animate-pulse">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">Hệ thống</p>
                    <p>{cleanMsg}</p>
                  </div>
                </div>
              );
            } else {
              return (
                <div key={idx} className="text-center">
                  <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {line}
                  </span>
                </div>
              );
            }
          })}
        </div>

        {footer && (
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic text-right mt-1">
            {footer}
          </p>
        )}
      </div>
    );
  };

  const handleAddProductRow = () => {
    const newRow = {
      id: Math.random().toString(36).substring(2, 9),
      productId: undefined,
      productName: '',
      quantity: 1,
      unit: 'Cái',
      price: 0,
      manufacturer: '',
      supplier: '',
      total: 0
    };
    setLocalProducts([...localProducts, newRow]);
  };

  const handleRemoveProductRow = (id: string) => {
    setLocalProducts(localProducts.filter(p => p.id !== id));
  };

  const handleProductChange = (index: number, field: string, value: any) => {
    const updated = [...localProducts];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    if (field === 'quantity' || field === 'price') {
      updated[index].total = updated[index].quantity * updated[index].price;
    }
    setLocalProducts(updated);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-8">
          <Target className="text-indigo-600 dark:text-indigo-400 shrink-0" size={24} />
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
                {title || 'Tạo Lead mới'}
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
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Bấm để copy link"
          >
            <Link2 size={16} />
          </button>
          {/* Lead Score Badge */}
          {lead && <LeadScoreBadge lead={lead} size="md" showLabel />}
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2.5 pr-8 shrink-0">
          <button 
            onClick={() => setShowCompleteModal(true)}
            disabled={!lead}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <ArrowRightCircle size={14} />
            HOÀN THÀNH
          </button>
        </div>
      </div>

      {/* 2. Chevron Stepper */}
      <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center w-full select-none overflow-x-auto select-scrollbar-none">
          <div className="flex w-full items-center min-w-[760px]">
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

      {/* 3. Tab slide bar */}
      <div className="px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <nav className="flex space-x-6 overflow-x-auto select-scrollbar-none">
          {[
            { id: 'general', name: 'Chung' },
            { id: 'products', name: 'Sản phẩm' },
            ...(lead ? [{ id: 'ai_insights', name: '✨ AI Insights' }] : []),
            { id: 'history', name: 'Lịch sử' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 border-b-2 text-sm font-bold transition-all whitespace-nowrap ${
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

      {/* 4. Split Two Column Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {activeTab === 'general' ? (
          <>
            {/* LEFT COLUMN: Lead Form */}
            <div className="w-full md:w-1/2 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
              
              {/* ① SUMMARY STRIP — Score · Vùng · Nhận lead */}
              {lead && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <LeadScoreBadge lead={lead} size="sm" showLabel />
                  {/* Vùng miền — luôn hiển thị (unknown = Chưa xác định) */}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${
                    region && region !== 'unknown'
                      ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}>
                    <MapPin size={11} /> {REGION_LABELS[region || 'unknown']}
                  </span>
                  <div className="flex-1" />
                  {/* Trạng thái nhận — luôn hiển thị */}
                  {(lead.assignee?.name || claimedName) ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {lead.assignee?.name || claimedName} đang khai thác
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Chưa có người nhận
                      </span>
                      <button
                        onClick={handleClaimLead}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer"
                      >
                        <Hand size={13} /> Nhận lead
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* ② THÔNG TIN LIÊN HỆ */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    THÔNG TIN LIÊN HỆ
                  </h3>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* Client */}
                  <div>

                    {/* Contact box */}
                    <div className="border border-slate-100 dark:border-slate-800/60 p-3 rounded-md mb-2 group relative">
                       <div className="flex justify-between items-start">
                         <div className="flex-1 pr-4">
                           <div className="text-[10px] text-slate-400 mb-0.5">Người liên hệ <span className="text-red-500">*</span></div>
                           <input 
                             type="text" 
                             value={name} 
                             onChange={e => setName(e.target.value)}
                             placeholder="Nhập tên người liên hệ... *"
                             className="bg-transparent border-none p-0 text-[15px] font-medium text-sky-600 dark:text-sky-400 focus:ring-0 w-full"
                           />
                           <div className="text-[13px] text-slate-500 mt-1 space-y-1">
                             <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Số điện thoại *" className="bg-transparent border-none p-0 w-full focus:ring-0 text-slate-500 placeholder:text-slate-300"/>
                             <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email *" className="bg-transparent border-none p-0 w-full focus:ring-0 text-slate-500 placeholder:text-slate-300"/>
                           </div>
                         </div>
                         <div className="flex gap-2.5 text-sky-500/60 pt-4">
                           <Phone size={16} className="cursor-pointer hover:text-sky-500"/>
                           <Mail size={16} className="cursor-pointer hover:text-sky-500"/>
                           <MessageSquare size={16} className="cursor-pointer hover:text-sky-500"/>
                         </div>
                       </div>
                    </div>

                    {/* Company box */}
                    <div className="border border-slate-100 dark:border-slate-800/60 p-3 rounded-md group relative">
                       <div className="flex justify-between items-start">
                         <div className="flex-1 pr-4">
                           <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                              Công ty
                              {lead?.customer_id && (
                                <a href={`/crm/customers/${lead.customer_id}`} target="_blank" rel="noreferrer" className="text-sky-500 hover:underline flex items-center" title="Xem hồ sơ khách hàng">
                                  <Link2 size={10} className="ml-0.5" />
                                </a>
                              )}
                            </div>
                           <input 
                             type="text" 
                             value={companyName} 
                             onChange={e => setCompanyName(e.target.value)}
                             placeholder="Nhập tên công ty..."
                             className="bg-transparent border-none p-0 text-[15px] font-medium text-slate-900 dark:text-slate-100 focus:ring-0 w-full"
                           />
                         </div>
                         <div className="flex gap-2.5 text-slate-300 dark:text-slate-600 pt-4">
                           <Phone size={16} className="cursor-pointer hover:text-slate-400"/>
                           <Mail size={16} className="cursor-pointer hover:text-slate-400"/>
                           <MessageSquare size={16} className="cursor-pointer hover:text-slate-400"/>
                         </div>
                       </div>
                    </div>
                  </div>
                  
                </div>
              </div>

              {/* ③ PHÂN LOẠI & NGUỒN */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm mt-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    PHÂN LOẠI & NGUỒN
                  </h3>
                </div>
                
                <div className="p-4 space-y-5">
                  {/* Source */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Nguồn</label>
                    <SourceSelect
                      value={source}
                      onChange={(val) => setSource(val)}
                      className="w-full mt-1"
                    />
                  </div>

                  {/* Source Detail */}
                  {source && (
                    <div>
                      <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Chi tiết nguồn</label>
                      <input
                        type="text"
                        value={sourceDetail}
                        onChange={(e) => setSourceDetail(e.target.value)}
                        placeholder={SOURCE_DETAIL_PLACEHOLDER[source as LeadSource] || 'Nhập chi tiết nguồn...'}
                        className="w-full p-0 bg-transparent border-none text-[14px] text-slate-900 dark:text-slate-100 focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  )}

                  {/* Region */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                      <MapPin size={10} /> Vùng miền
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value as RegionType)}
                      className="w-full py-1.5 px-0 bg-transparent border-none text-[15px] text-slate-900 dark:text-slate-100 focus:ring-0 cursor-pointer"
                    >
                      {Object.entries(REGION_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Duplicate warning */}
                  {duplicateWarning.length > 0 && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                        <AlertCircle size={12} /> Có thể trùng lặp!
                      </div>
                      <div className="space-y-1">
                        {duplicateWarning.map(dup => (
                          <div key={dup.id} className="text-xs text-amber-600 dark:text-amber-400">
                            • {dup.title} ({dup.phone || dup.email}) - {(dup as any).stage?.name || ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* ④ GIÁ TRỊ & SẢN PHẨM */}
              <div 
                onClick={() => setActiveTab('products')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm mt-4 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    GIÁ TRỊ & SẢN PHẨM <Edit2 size={10} className="text-slate-300"/>
                  </h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveTab('products'); }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold transition-colors cursor-pointer"
                  >
                    sửa
                  </button>
                </div>
                
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 border-dotted pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <span className="text-slate-300">⋮⋮</span> Sản phẩm <Settings size={12}/>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[15px] text-slate-900 dark:text-slate-100">Tổng cộng</div>
                    <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                        localProducts.reduce((sum: number, p: any) => sum + (p.quantity * p.price), 0)
                      )}
                    </div>
                  </div>
                  
                </div>

                <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setActiveTab('products')}
                    className="hover:text-slate-700 font-bold cursor-pointer text-indigo-600 dark:text-indigo-400"
                  >
                    Thêm mục
                  </button>
                </div>
              </div>

              {/* ⑤ Metadata */}
              {lead && (
                <div className="px-1 pb-2 text-[11px] text-slate-400 dark:text-slate-500 space-y-0.5">
                  <div>Tạo: {formatDateTime(lead.created_at)}</div>
                  {lead.updated_at && <div>Cập nhật lần cuối: {formatDateTime(lead.updated_at)}</div>}
                </div>
              )}

            </div>

            {/* RIGHT COLUMN: Interaction Timeline & Chat */}
            <div className="w-full md:w-1/2 flex flex-col h-full bg-slate-50 dark:bg-slate-900">
              
              {/* Interaction quick buttons */}
              <div className="px-6 pt-4 shrink-0">
                <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto select-scrollbar-none pb-2">
                  {[
                    { id: 'comment', name: 'Ghi chú' },
                    { id: 'task', name: 'Nhiệm vụ' },
                    { id: 'sms', name: 'SMS' },
                    { id: 'email', name: 'Email' },
                    { id: 'wait', name: 'Chờ' },
                    { id: 'meeting', name: 'Họp' },
                    { id: 'call', name: 'Gọi' },
                    { id: 'visit', name: 'Gặp' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      onClick={() => setActiveActivityTab(act.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        activeActivityTab === act.id
                          ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {act.name}
                    </button>
                  ))}
                  <button className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    Khác
                  </button>
                </div>
              </div>

              {/* Leave a comment textarea */}
              <div className="p-6 pb-2 shrink-0">
                {activeActivityTab === 'comment' ? (
                  <form onSubmit={handleAddComment} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Viết ghi chú hoặc tương tác mới..."
                      rows={3}
                      className="w-full resize-none bg-transparent border-0 focus:outline-none focus:ring-0 text-sm text-slate-800 dark:text-slate-200"
                    />
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-2">
                      <button 
                        type="button"
                        className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs font-bold"
                      >
                        <Plus size={14} /> Mời chat
                      </button>
                      
                      <button
                        type="submit"
                        disabled={saving || !commentText.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-600 text-xs font-bold rounded-lg shadow-sm transition-all"
                      >
                        <Send size={12} />
                        Lưu ghi chú
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                    Tính năng lập {activeActivityTab} đang được tích hợp...
                  </div>
                )}
              </div>

              {/* Interaction Timeline List */}
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                
                {loadingActivities ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-xs">Đang tải timeline...</p>
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                    <AlertCircle size={20} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Chưa có tương tác nào được tạo</p>
                    <p className="text-xs text-slate-400 mt-0.5">Viết ghi chú hoặc tin nhắn để ghi lại tương tác đầu tiên.</p>
                  </div>
                ) : (
                  <div className="relative border-l border-slate-200 dark:border-slate-800 pl-6 ml-3 space-y-8 mt-6">
                    {activities.map((act) => {
                      const isPlanned = new Date(act.created_at) > new Date();
                      
                      return (
                        <div key={act.id} className="relative group">
                          
                          {/* Timeline node icon */}
                          <div className={`absolute -left-[37px] top-1 w-6 h-6 rounded-full flex items-center justify-center border shadow-sm ${
                            isPlanned
                              ? 'bg-sky-500 text-white border-sky-600'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            {act.activity_type === 'Call' && <Phone size={11} />}
                            {act.activity_type === 'Email' && <Mail size={11} />}
                            {act.activity_type === 'Telegram' || act.activity_type === 'Zalo' ? <MessageCircle size={11} /> : null}
                            {act.activity_type === 'Meeting' && <User size={11} />}
                            {act.activity_type === 'Note' && <FileText size={11} />}
                          </div>

                          {/* Planned/History Label Badge */}
                          {isPlanned && (
                            <span className="absolute -top-5 -left-1 px-2 py-0.5 rounded bg-green-500 text-white text-[8px] font-black uppercase tracking-widest">
                              KẾ HOẠCH
                            </span>
                          )}

                          {/* Timeline content bubble */}
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center mb-1.5 border-b border-slate-50 dark:border-slate-800 pb-1.5">
                              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {act.activity_type} BỞI {act.creator?.fullName || 'HỆ THỐNG'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                {formatDateTime(act.created_at)}
                              </span>
                            </div>

                            {renderActivityDescription(act.description)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </>
        ) : activeTab === 'products' ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 w-full">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Danh mục sản phẩm quan tâm</h3>
                <button 
                  onClick={handleAddProductRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Thêm sản phẩm
                </button>
              </div>
              
              {localProducts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                    <Package size={20} />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Lead này chưa chọn sản phẩm nào</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Gắn thêm sản phẩm tiềm năng để dễ dàng theo dõi</p>
                  <button 
                    onClick={handleAddProductRow}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus size={14} /> Thêm sản phẩm đầu tiên
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-5 w-[280px]">Sản phẩm</th>
                        <th className="py-3 px-3 w-40">Hãng SX</th>
                        <th className="py-3 px-3 w-40">Nhà cung cấp</th>
                        <th className="py-3 px-3 w-28">Đơn vị</th>
                        <th className="py-3 px-3 w-28 text-center">SL dự kiến</th>
                        <th className="py-3 px-3 w-40 text-right">Đơn giá</th>
                        <th className="py-3 px-5 text-right w-44">Thành tiền</th>
                        <th className="py-3 px-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800/60">
                      {localProducts.map((p: any, index: number) => {
                        const rowBg = index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800';
                        return (
                          <tr key={p.id} className={`${rowBg} hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors`}>
                            {/* Product Select */}
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-2">
                                <span className="flex-shrink-0 w-5 h-5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                                  {index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <SearchableSelect
                                    value={p.productId || null}
                                    placeholder="Chọn sản phẩm gốc..."
                                    getDisplayValue={() => p.productName || undefined}
                                    size="sm"
                                    onChange={async (pId, option) => {
                                      if (pId && option) {
                                        const updated = [...localProducts];
                                        updated[index] = {
                                          ...updated[index],
                                          productId: pId,
                                          productName: option.name,
                                          unit: 'Cái',
                                          price: 0,
                                          manufacturer: '',
                                          supplier: ''
                                        };
                                        
                                        try {
                                          const fullProduct = await ProductService.getById(pId);
                                          if (fullProduct) {
                                            updated[index].unit = fullProduct.unit || 'Cái';
                                            updated[index].price = fullProduct.basePrice || 0;
                                            
                                            if (fullProduct.brandName) {
                                              updated[index].manufacturer = fullProduct.brandName;
                                            }
                                            
                                            if (fullProduct.supplierId) {
                                              const supplierData = await CustomerService.getById(fullProduct.supplierId);
                                              if (supplierData) {
                                                updated[index].supplier = supplierData.shortName || supplierData.name;
                                              }
                                            } else if (fullProduct.brandName) {
                                              updated[index].supplier = fullProduct.brandName;
                                            }
                                          }
                                        } catch (err) {
                                          console.warn('Error fetching product detail:', err);
                                        }
                                        
                                        updated[index].total = updated[index].quantity * updated[index].price;
                                        setLocalProducts(updated);
                                      }
                                    }}
                                    onSearch={async (query) => {
                                      const results = await ProductService.search(query, 20);
                                      return results.map(prod => ({ id: prod.id, name: prod.name, subText: prod.category }));
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            {/* Brand */}
                            <td className="py-3.5 px-3">
                              <input
                                type="text"
                                readOnly
                                value={p.manufacturer || ''}
                                placeholder="Tự điền..."
                                className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed"
                              />
                            </td>
                            {/* Supplier */}
                            <td className="py-3.5 px-3">
                              <input
                                type="text"
                                readOnly
                                value={p.supplier || ''}
                                placeholder="Tự điền..."
                                className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed"
                              />
                            </td>
                            {/* Unit */}
                            <td className="py-3.5 px-3">
                              <input
                                type="text"
                                value={p.unit || ''}
                                onChange={(e) => handleProductChange(index, 'unit', e.target.value)}
                                placeholder="Cái..."
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-500 outline-none transition-colors"
                              />
                            </td>
                            {/* Expected Quantity */}
                            <td className="py-3.5 px-3">
                              <input
                                type="number"
                                min={1}
                                value={p.quantity}
                                onChange={(e) => handleProductChange(index, 'quantity', Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-center text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                              />
                            </td>
                            {/* Price */}
                            <td className="py-3.5 px-3">
                              <input
                                type="number"
                                min={0}
                                value={p.price}
                                onChange={(e) => handleProductChange(index, 'price', Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-right text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none transition-colors"
                              />
                            </td>
                            {/* Total Output */}
                            <td className="py-3.5 px-5 text-right">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.quantity * p.price)}
                              </span>
                            </td>
                            {/* Delete Button */}
                            <td className="py-3.5 px-3 text-center">
                              <button 
                                onClick={() => handleRemoveProductRow(p.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                title="Xóa dòng"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-800">
                        <td colSpan={6} className="py-4 px-5 text-right text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Tổng cộng</td>
                        <td className="py-4 px-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-base">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                            localProducts.reduce((sum: number, p: any) => sum + (p.quantity * p.price), 0)
                          )}
                        </td>
                        <td className="py-4 px-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'history' ? (
          /* Tab Lịch sử - Audit Log */
          <div className="flex-1 overflow-auto p-6">
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
                {/* Timeline line */}
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
                        {/* Timeline dot */}
                        <div className={`w-[10px] h-[10px] rounded-full ${dotColor} mt-1.5 shrink-0 z-10 ring-2 ring-white dark:ring-slate-900`} />
                        
                        {/* Content */}
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
        ) : activeTab === 'ai_insights' && lead ? (
          <LeadAIInsightsTab lead={lead} />
        ) : null}

      </div>

      {/* 5. Footer Buttons */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-between items-center gap-3">
        <div className="flex items-center gap-1">
          {lead && (
            <>
              <button
                onClick={handleDeleteLead}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors rounded-lg"
              >
                <Trash2 size={16} />
                XÓA LEAD
              </button>
              <button
                onClick={() => setShowMergeModal(true)}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors rounded-lg"
                title="Tìm lead trùng và gộp"
              >
                <GitMerge size={16} />
                GỘP TRÙNG
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors rounded-lg"
          >
            HỦY
          </button>
          <button
            onClick={handleSaveLead}
            disabled={saving}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold text-sm shadow-md shadow-emerald-100 dark:shadow-none transition-all"
          >
            <Save size={16} />
            LƯU LEAD
          </button>
        </div>
      </div>

      {/* Stage Transition Modal (forward navigation validation) */}
      {lead && pendingStage && (
        <StageTransitionModal
          isOpen={showTransitionModal}
          onClose={() => {
            setShowTransitionModal(false);
            setPendingStage(null);
          }}
          onConfirm={handleStageTransitionConfirm}
          targetStage={pendingStage}
          lead={lead}
        />
      )}

      {/* Complete Lead Modal (final stage — Bitrix24-style) */}
      {lead && (
        <CompleteLeadModal
          isOpen={showCompleteModal}
          onClose={() => setShowCompleteModal(false)}
          lead={lead}
          stages={stages}
          onSuccess={() => {
            setShowCompleteModal(false);
            onSave();
          }}
        />
      )}

      {/* Merge Lead Modal (duplicate detection & merge) */}
      {lead && (
        <MergeLeadModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          lead={lead}
          onMerged={onSave}
        />
      )}
    </div>
  );
};

export default LeadDetailsPanel;
