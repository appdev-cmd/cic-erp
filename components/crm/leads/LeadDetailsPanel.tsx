import React, { useState, useEffect, useCallback } from 'react';
import { 
  Phone, Mail, MessageSquare, Settings, Edit2, Target, 
  User, Save, X, Plus, Send, Link2, MoreVertical, FileText, 
  Briefcase, Activity, CheckSquare, MessageCircle, AlertCircle, Package
} from 'lucide-react';
import { CrmLead, CrmActivity, CrmStageTemplate } from '../../../types';
import { CrmLeadService, CrmActivityService, CrmStageTemplateService } from '../../../services';
import { dataClient as supabase } from '../../../lib/dataClient';
import { formatDate, formatDateTime, formatCurrency } from '../../../utils/formatters';
import { toast } from 'sonner';
import SearchableSelect from '../../ui/SearchableSelect';

interface Props {
  lead?: CrmLead; // If undefined, we are in "Create Lead" mode
  onClose: () => void;
  onSave: () => void;
  stages: CrmStageTemplate[];
}

export const LeadDetailsPanel: React.FC<Props> = ({ lead, onClose, onSave, stages }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'products' | 'quotes' | 'automation' | 'workflows' | 'dependencies' | 'history' | 'market'>('general');
  const [activeActivityTab, setActiveActivityTab] = useState<'comment' | 'task' | 'sms' | 'email' | 'wait' | 'meeting' | 'call' | 'visit'>('comment');
  
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
      setSource('Trực tiếp');
      setStageId(stages.length > 0 ? stages[0].id : '');
      setExpectedValue(0);
      setAssignedTo(null);
      setSalutation('Chưa chọn');
      setLastName('');
      setActivities([]);
    }
  }, [lead, stages]);

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
      
      const leadData: Partial<CrmLead> = {
        title,
        name: name || undefined,
        company_name: companyName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        source: source || undefined,
        stage_id: stageId || undefined,
        expected_value: lead?.products?.length ? lead.products.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0) : 0,
        assigned_to: assignedTo || undefined
      };

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
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2.5 pr-8 shrink-0">
          <button className="flex items-center gap-1 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
            CƠ HỘI
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
                  onClick={() => setStageId(stage.id)}
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
                    {stage.name === 'Thất bại' ? 'Không tiềm năng' : stage.name}
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
            { id: 'quotes', name: 'Báo giá' },
            { id: 'automation', name: 'Tự động hoá' },
            { id: 'workflows', name: 'Quy trình' },
            { id: 'dependencies', name: 'Liên kết' },
            { id: 'history', name: 'Lịch sử' },
            { id: 'market', name: 'Thị trường' },
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
              
              {/* LEAD INFORMATION SECTION */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    THÔNG TIN CHUNG
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-sky-500 font-bold flex items-center gap-1 cursor-pointer"><Settings size={12}/> AI24 Chấm điểm</span>
                    <span className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">sửa</span>
                  </div>
                </div>
                
                <div className="p-4 space-y-5">
                  {/* Status */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Trạng thái</label>
                    <select
                      value={stageId}
                      onChange={(e) => setStageId(e.target.value)}
                      className="w-full py-2 px-0 bg-transparent border-none text-[15px] font-medium text-slate-900 dark:text-slate-100 focus:ring-0 cursor-pointer"
                    >
                      <option value="">-- Chọn Trạng thái --</option>
                      {stages.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name === 'Thất bại' ? 'Không tiềm năng' : s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount and currency */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Giá trị</label>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl text-slate-500">đ</span>
                      <input
                        type="text"
                        readOnly
                        value={new Intl.NumberFormat('vi-VN').format(
                          lead?.products?.length ? lead.products.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0) : 0
                        )}
                        className="flex-1 p-0 bg-transparent border-none text-2xl font-medium text-slate-900 dark:text-slate-100 focus:ring-0 cursor-not-allowed opacity-80"
                        title="Giá trị này tự động tính tổng tiền từ danh sách sản phẩm"
                      />
                    </div>
                  </div>

                  {/* Client */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-2">Khách hàng</label>
                    
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
                  
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span className="hover:text-slate-600 cursor-pointer">Chọn trường</span>
                    <span className="hover:text-slate-600 cursor-pointer">Tạo trường</span>
                    <div className="flex-1" />
                    <span className="hover:text-slate-600 cursor-pointer">Xóa mục</span>
                  </div>
                </div>
              </div>

              {/* MORE SECTION */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm mt-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    THÔNG TIN THÊM
                  </h3>
                  <span className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">sửa</span>
                </div>
                
                <div className="p-4 space-y-5">
                  {/* Source */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Nguồn</label>
                    <input
                      type="text"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full p-0 bg-transparent border-none text-[15px] text-slate-900 dark:text-slate-100 focus:ring-0"
                    />
                  </div>

                  {/* Source Information */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Thông tin nguồn</label>
                    <input
                      type="text"
                      defaultValue="CIC.com.vn"
                      className="w-full p-0 bg-transparent border-none text-[15px] text-slate-900 dark:text-slate-100 focus:ring-0"
                    />
                  </div>

                  {/* Available to everyone */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Hiển thị cho tất cả</label>
                    <div className="text-[15px] text-slate-900 dark:text-slate-100">Không</div>
                  </div>

                  {/* Responsible person */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">Người phụ trách</label>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        <img src="https://ui-avatars.com/api/?name=Quynh+Tran&background=random" alt="avatar" className="w-full h-full object-cover"/>
                      </div>
                      <div>
                        <div className="text-[14px] font-medium text-sky-600 dark:text-sky-400">Trần Ngọc Quỳnh</div>
                        <div className="text-[11px] text-slate-500">Giám đốc TT</div>
                      </div>
                    </div>
                  </div>

                  {/* UTM parameters */}
                  <div>
                    <label className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">Tham số UTM</label>
                    <div className="text-[15px] text-slate-900 dark:text-slate-100">Trống</div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span className="hover:text-slate-600 cursor-pointer">Chọn trường</span>
                    <span className="hover:text-slate-600 cursor-pointer">Tạo trường</span>
                    <div className="flex-1" />
                    <span className="hover:text-slate-600 cursor-pointer">Xóa mục</span>
                  </div>
                </div>
              </div>

              {/* PRODUCTS SECTION */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-sm mt-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    SẢN PHẨM <Edit2 size={10} className="text-slate-300"/>
                  </h3>
                  <span className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">sửa</span>
                </div>
                
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 border-dotted pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <span className="text-slate-300">⋮⋮</span> Sản phẩm <Settings size={12}/>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-[15px] text-slate-900 dark:text-slate-100">Tổng cộng</div>
                    <div className="text-[15px] text-slate-900 dark:text-slate-100">đ0</div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span className="hover:text-slate-600 cursor-pointer">Chọn trường</span>
                    <span className="hover:text-slate-600 cursor-pointer">Tạo trường</span>
                    <div className="flex-1" />
                    <span className="hover:text-slate-600 cursor-pointer">Xóa mục</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  <span className="hover:text-slate-700 cursor-pointer">Thêm mục</span>
                  <span className="hover:text-slate-700 cursor-pointer">Thị trường</span>
                  <span className="hover:text-slate-700 cursor-pointer flex items-center gap-1"><User size={12}/> Chế độ xem chung</span>
                </div>
              </div>

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
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                  <Plus size={14} /> Thêm sản phẩm
                </button>
              </div>
              
              {!lead?.products || lead.products.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                    <Package size={20} />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Lead này chưa chọn sản phẩm nào</p>
                  <p className="text-xs text-slate-400 mt-1">Gắn thêm sản phẩm tiềm năng để dễ dàng theo dõi</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-5">Tên sản phẩm</th>
                        <th className="py-3 px-5 w-24">Số lượng</th>
                        <th className="py-3 px-5 w-24">Đơn vị</th>
                        <th className="py-3 px-5 text-right">Đơn giá</th>
                        <th className="py-3 px-5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800/60">
                      {lead.products.map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-5 font-medium text-slate-800 dark:text-slate-200">{p.product_name}</td>
                          <td className="py-3 px-5 text-slate-600 dark:text-slate-400">{p.quantity}</td>
                          <td className="py-3 px-5 text-slate-600 dark:text-slate-400">{p.unit}</td>
                          <td className="py-3 px-5 text-right font-medium text-slate-600 dark:text-slate-400">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.unit_price)}</td>
                          <td className="py-3 px-5 text-right font-bold text-sky-600 dark:text-sky-400">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.total_price)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <td colSpan={4} className="py-3 px-5 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng cộng</td>
                        <td className="py-3 px-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-base">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                            lead.products.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-4 border border-slate-200 dark:border-slate-700">
              <Briefcase size={28} />
            </div>
            <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
              Phân hệ {activeTab.toUpperCase()}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Tính năng đang được phát triển nâng cao và sẽ tự động liên kết dữ liệu trong các bản phát hành tiếp theo.
            </p>
          </div>
        )}

      </div>

      {/* 5. Footer Buttons */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-end gap-3">
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
  );
};

export default LeadDetailsPanel;
