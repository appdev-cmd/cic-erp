import React, { useState, useEffect } from 'react';
import {
  Save, Trash2, Link2, Edit2, UserCircle,
  History, Clock, Phone, Mail, Plus, X, Tag, Users, Briefcase, Star
} from 'lucide-react';
import { AuditLogService, AuditLog } from '../../../services/auditLogService';
import { dataClient as supabase } from '../../../lib/dataClient';
import { formatDate, formatCurrency } from '../../../utils/formatters';
import { toast } from 'sonner';
import { DECISION_ROLE_LABELS } from '../../../types/crm';
import type { DecisionRole } from '../../../types/crm';
import SearchableSelect from '../../ui/SearchableSelect';
import DateInput from '../../ui/DateInput';

interface Props {
  contact?: any;
  onClose: () => void;
  onSave: () => void;
}

export const ContactDetailsPanel: React.FC<Props> = ({ contact, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'deals' | 'history'>('info');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Contact Form Fields
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [zalo, setZalo] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [birthday, setBirthday] = useState('');
  const [decisionRole, setDecisionRole] = useState<DecisionRole>('unknown');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');

  // Related data
  const [deals, setDeals] = useState<any[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);

  // Init form
  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setCustomerId(contact.customer_id || null);
      setCustomerName(contact.customer?.name || '');
      setPosition(contact.position || '');
      setDepartment(contact.department || '');
      setPhone(contact.phone || '');
      setEmail(contact.email || '');
      setIsPrimary(!!contact.is_primary);
      setZalo(contact.zalo || '');
      setLinkedinUrl(contact.linkedin_url || '');
      setBirthday(contact.birthday || '');
      setDecisionRole(contact.decision_role || 'unknown');
      setAssignedTo(contact.assigned_to || null);
      setTags(contact.tags || []);
      setNotes(contact.notes || '');
    } else {
      setName('');
      setCustomerId(null);
      setCustomerName('');
      setPosition('');
      setDepartment('');
      setPhone('');
      setEmail('');
      setIsPrimary(false);
      setZalo('');
      setLinkedinUrl('');
      setBirthday('');
      setDecisionRole('unknown');
      setAssignedTo(null);
      setTags([]);
      setNotes('');
    }
  }, [contact]);

  // Fetch profiles (assignee options)
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, name')
          .order('name');
        setProfiles(data || []);
      } catch (err) {
        console.error('Error fetching profiles:', err);
      }
    };
    fetchProfiles();
  }, []);

  // Fetch deals linked to contact
  useEffect(() => {
    if (activeTab === 'deals' && contact?.id) {
      const fetchDeals = async () => {
        setLoadingDeals(true);
        try {
          const { data } = await supabase
            .from('crm_deals')
            .select('*, stage:crm_stage_templates(*)')
            .eq('contact_id', contact.id)
            .order('created_at', { ascending: false });
          setDeals(data || []);
        } catch (err) {
          console.error('Error fetching deals:', err);
        } finally {
          setLoadingDeals(false);
        }
      };
      fetchDeals();
    }
  }, [activeTab, contact?.id]);

  // Fetch audit logs
  useEffect(() => {
    if (activeTab === 'history' && contact?.id) {
      const fetchLogs = async () => {
        setLoadingAuditLogs(true);
        try {
          const logs = await AuditLogService.getByRecordId('customer_contacts', contact.id);
          setAuditLogs(logs);
        } catch (err) {
          console.error('Error fetching audit logs:', err);
        } finally {
          setLoadingAuditLogs(false);
        }
      };
      fetchLogs();
    }
  }, [activeTab, contact?.id]);

  // Search companies handler
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

  // Save Contact
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên liên hệ');
      return;
    }

    try {
      setSaving(true);
      const contactData = {
        name,
        customer_id: customerId || null,
        position: position || null,
        department: department || null,
        phone: phone || null,
        email: email || null,
        is_primary: isPrimary,
        zalo: zalo || null,
        linkedin_url: linkedinUrl || null,
        birthday: birthday || null,
        decision_role: decisionRole,
        assigned_to: assignedTo || null,
        tags: tags.length > 0 ? tags : null,
        notes: notes || null,
      };

      if (contact) {
        // Get old data for audit
        const { data: oldData } = await supabase
          .from('customer_contacts')
          .select('*')
          .eq('id', contact.id)
          .single();

        const { error } = await supabase
          .from('customer_contacts')
          .update(contactData)
          .eq('id', contact.id);

        if (error) throw error;

        // Audit log
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await AuditLogService.create({
            user_id: user?.id || null,
            table_name: 'customer_contacts',
            record_id: contact.id,
            action: 'UPDATE',
            old_data: oldData,
            new_data: contactData,
            comment: null,
          });
        } catch (e) {
          console.warn('[ContactDetailsPanel] Audit log failed:', e);
        }

        toast.success('Đã cập nhật liên hệ thành công');
      } else {
        const { data: created, error } = await supabase
          .from('customer_contacts')
          .insert(contactData)
          .select()
          .single();

        if (error) throw error;

        // Audit log
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await AuditLogService.create({
            user_id: user?.id || null,
            table_name: 'customer_contacts',
            record_id: created.id,
            action: 'INSERT',
            old_data: null,
            new_data: created,
            comment: null,
          });
        } catch (e) {
          console.warn('[ContactDetailsPanel] Audit log failed:', e);
        }

        toast.success('Đã tạo liên hệ mới thành công');
      }

      onSave();
      onClose();
    } catch (error: any) {
      toast.error('Lỗi lưu liên hệ: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete Contact
  const handleDelete = async () => {
    if (!contact) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa liên hệ "${contact.name}"?`)) return;

    try {
      setSaving(true);
      // Get old data for audit
      const { data: oldData } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('id', contact.id)
        .single();

      const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;

      // Audit log
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await AuditLogService.create({
          user_id: user?.id || null,
          table_name: 'customer_contacts',
          record_id: contact.id,
          action: 'DELETE',
          old_data: oldData,
          new_data: null,
          comment: null,
        });
      } catch (e) {
        console.warn('[ContactDetailsPanel] Audit log failed:', e);
      }

      toast.success('Đã xóa liên hệ');
      onSave();
      onClose();
    } catch (error: any) {
      toast.error('Lỗi xóa liên hệ: ' + error.message);
      setSaving(false);
    }
  };

  // Tag management
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter(x => x !== t));
  };

  const inputCls = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none transition-colors";
  const labelCls = "block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-8">
          <UserCircle className="text-indigo-600 dark:text-indigo-400 shrink-0" size={24} />
          {isEditingTitle ? (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
              className="text-lg md:text-xl font-bold bg-white dark:bg-slate-800 border border-indigo-500 focus:outline-none rounded px-2 py-0.5 w-full text-slate-950 dark:text-slate-50"
            />
          ) : (
            <div className="flex items-center gap-2 group min-w-0">
              <h2
                onClick={() => setIsEditingTitle(true)}
                className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1.5 py-0.5 transition-colors"
              >
                {name || 'Tạo liên hệ mới'}
              </h2>
              <Edit2 size={14} onClick={() => setIsEditingTitle(true)} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <nav className="flex space-x-6 overflow-x-auto select-scrollbar-none">
          {[
            { id: 'info', name: 'Thông tin' },
            { id: 'deals', name: 'Deals' },
            { id: 'history', name: 'Lịch sử' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 border-b-2 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' && (
          <div className="p-6 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className={labelCls}>THÔNG TIN CÁ NHÂN</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className={labelCls}>Họ và tên *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                </div>

                {/* Company (SearchableSelect) */}
                <div>
                  <label className={labelCls}>Công ty / Tổ chức</label>
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

                {/* Position */}
                <div>
                  <label className={labelCls}>Chức vụ</label>
                  <input type="text" value={position} onChange={e => setPosition(e.target.value)} className={inputCls} placeholder="VD: Giám đốc kỹ thuật, Trưởng phòng BIM..." />
                </div>

                {/* Department */}
                <div>
                  <label className={labelCls}>Phòng ban</label>
                  <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className={inputCls} placeholder="VD: Phòng BIM, Phòng Mua hàng..." />
                </div>

                {/* Phone */}
                <div>
                  <label className={labelCls}>Số điện thoại</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
                </div>

                {/* Email */}
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                </div>

                {/* Zalo */}
                <div>
                  <label className={labelCls}>Số Zalo</label>
                  <input type="text" value={zalo} onChange={e => setZalo(e.target.value)} className={inputCls} placeholder="Nhập số điện thoại Zalo..." />
                </div>

                {/* Linkedin */}
                <div>
                  <label className={labelCls}>Linkedin URL</label>
                  <input type="text" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} className={inputCls} placeholder="https://linkedin.com/in/..." />
                </div>

                {/* Birthday (DateInput component) */}
                <div>
                  <label className={labelCls}>Ngày sinh</label>
                  <DateInput
                    value={birthday}
                    onChange={setBirthday}
                    className={inputCls}
                  />
                </div>

                {/* Decision Role */}
                <div>
                  <label className={labelCls}>Vai trò quyết định</label>
                  <select
                    value={decisionRole}
                    onChange={e => setDecisionRole(e.target.value as DecisionRole)}
                    className={inputCls + ' cursor-pointer'}
                  >
                    {Object.entries(DECISION_ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Assignee / Employee */}
                <div>
                  <label className={labelCls}>Người phụ trách</label>
                  <select
                    value={assignedTo || ''}
                    onChange={e => setAssignedTo(e.target.value || null)}
                    className={inputCls + ' cursor-pointer'}
                  >
                    <option value="">-- Chọn người phụ trách --</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Primary Contact Toggle */}
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={isPrimary}
                    onChange={e => setIsPrimary(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="isPrimary" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1">
                    <Star size={14} className="text-amber-500 fill-current" /> Là liên hệ chính của công ty
                  </label>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Ghi chú</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className={inputCls + " resize-none"}
                    placeholder="Ghi chú thêm về liên hệ..."
                  />
                </div>

                {/* Tags */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Nhãn (Tags)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-full">
                        <Tag size={10} />{tag}
                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 cursor-pointer"><X size={12} /></button>
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
                    <button onClick={handleAddTag} className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deals' && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase size={18} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Deals liên kết</h3>
            </div>

            {loadingDeals ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : deals.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800">
                <Briefcase size={24} className="text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có deal nào liên kết</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm transition-shadow">
                    <div>
                      <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{deal.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatCurrency(deal.amount || 0)} • {deal.stage?.name || '—'}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      deal.stage?.is_win
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : deal.stage?.is_lose
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {deal.probability}%
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                    const actionColors: Record<string, string> = { 'INSERT': 'bg-emerald-500', 'UPDATE': 'bg-sky-500', 'DELETE': 'bg-red-500' };
                    const dotColor = actionColors[log.action] || 'bg-slate-400';

                    return (
                      <div key={log.id} className="relative flex gap-4 py-3 pl-1">
                        <div className={`w-[10px] h-[10px] rounded-full ${dotColor} mt-1.5 shrink-0 z-10 ring-2 ring-white dark:ring-slate-900`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-400 dark:text-slate-500">{time} — {date}</span>
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

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800 shrink-0 flex justify-between items-center gap-3">
        <div>
          {contact && (
            <button onClick={handleDelete} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors rounded-lg cursor-pointer">
              <Trash2 size={16} /> XÓA LIÊN HỆ
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors rounded-lg cursor-pointer">HỦY</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold text-sm shadow-md shadow-emerald-100 dark:shadow-none transition-all cursor-pointer">
            <Save size={16} /> LƯU LIÊN HỆ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailsPanel;
