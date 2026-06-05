import React, { useState, useEffect } from 'react';
import {
  Save, Trash2, Link2, Edit2, Building2,
  History, Clock, Phone, Mail, Plus, X, Tag, Users, Briefcase
} from 'lucide-react';
import { AuditLogService, AuditLog } from '../../../services/auditLogService';
import { dataClient as supabase } from '../../../lib/dataClient';
import { formatDate, formatCurrency } from '../../../utils/formatters';
import { toast } from 'sonner';

interface Props {
  company?: any;
  onClose: () => void;
  onSave: () => void;
}

export const CompanyDetailsPanel: React.FC<Props> = ({ company, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'contacts' | 'deals' | 'history'>('info');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Company Form Fields
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [type, setType] = useState<string>('Customer');
  const [industry, setIndustry] = useState<string[]>([]);
  const [industryInput, setIndustryInput] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState<number>(0);
  const [crmOwner, setCrmOwner] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [rating, setRating] = useState('Standard');

  // Related data
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);

  // Init form
  useEffect(() => {
    if (company) {
      setName(company.name || '');
      setShortName(company.short_name || '');
      setType(company.type || 'Customer');
      setIndustry(company.industry || []);
      setPhone(company.phone || '');
      setEmail(company.email || '');
      setAddress(company.address || '');
      setTaxCode(company.tax_code || '');
      setCompanySize(company.company_size || '');
      setAnnualRevenue(Number(company.annual_revenue) || 0);
      setCrmOwner(company.crm_owner || '');
      setRating(company.rating || 'Standard');
      setTags([]);
    } else {
      setName('');
      setShortName('');
      setType('Customer');
      setIndustry([]);
      setPhone('');
      setEmail('');
      setAddress('');
      setTaxCode('');
      setCompanySize('');
      setAnnualRevenue(0);
      setCrmOwner('');
      setRating('Standard');
      setTags([]);
    }
  }, [company]);

  // Fetch contacts
  useEffect(() => {
    if (activeTab === 'contacts' && company?.id) {
      const fetch = async () => {
        setLoadingContacts(true);
        try {
          const { data } = await supabase
            .from('customer_contacts')
            .select('*')
            .eq('customer_id', company.id)
            .order('name');
          setContacts(data || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingContacts(false);
        }
      };
      fetch();
    }
  }, [activeTab, company?.id]);

  // Fetch deals
  useEffect(() => {
    if (activeTab === 'deals' && company?.id) {
      const fetch = async () => {
        setLoadingDeals(true);
        try {
          const { data } = await supabase
            .from('crm_deals')
            .select('*, stage:crm_stage_templates(*)')
            .eq('customer_id', company.id)
            .order('created_at', { ascending: false });
          setDeals(data || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingDeals(false);
        }
      };
      fetch();
    }
  }, [activeTab, company?.id]);

  // Fetch audit logs
  useEffect(() => {
    if (activeTab === 'history' && company?.id) {
      const fetch = async () => {
        setLoadingAuditLogs(true);
        try {
          const logs = await AuditLogService.getByRecordId('customers', company.id);
          setAuditLogs(logs);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingAuditLogs(false);
        }
      };
      fetch();
    }
  }, [activeTab, company?.id]);

  // Save
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên công ty');
      return;
    }

    try {
      setSaving(true);
      const companyData = {
        name,
        short_name: shortName || name.substring(0, 30),
        type,
        industry,
        phone: phone || null,
        email: email || null,
        address: address || null,
        tax_code: taxCode || null,
        company_size: companySize || null,
        annual_revenue: annualRevenue || null,
        crm_owner: crmOwner || null,
        rating,
      };

      if (company) {
        // Get old data for audit
        const { data: oldData } = await supabase.from('customers').select('*').eq('id', company.id).single();

        const { error } = await supabase
          .from('customers')
          .update(companyData)
          .eq('id', company.id);
        if (error) throw error;

        // Audit log
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await AuditLogService.create({
            user_id: user?.id || null,
            table_name: 'customers',
            record_id: company.id,
            action: 'UPDATE',
            old_data: oldData,
            new_data: companyData,
            comment: null,
          });
        } catch (e) {
          console.warn('[CompanyDetailsPanel] Audit log failed:', e);
        }

        toast.success('Đã cập nhật công ty thành công');
      } else {
        const { data: created, error } = await supabase
          .from('customers')
          .insert(companyData)
          .select()
          .single();
        if (error) throw error;

        // Audit log
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await AuditLogService.create({
            user_id: user?.id || null,
            table_name: 'customers',
            record_id: created.id,
            action: 'INSERT',
            old_data: null,
            new_data: created,
            comment: null,
          });
        } catch (e) {
          console.warn('[CompanyDetailsPanel] Audit log failed:', e);
        }

        toast.success('Đã tạo công ty mới thành công');
      }

      onSave();
      onClose();
    } catch (error: any) {
      toast.error('Lỗi lưu công ty: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!company) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa công ty "${company.name}"?`)) return;

    try {
      setSaving(true);
      // Get old data for audit
      const { data: oldData } = await supabase.from('customers').select('*').eq('id', company.id).single();

      const { error } = await supabase.from('customers').delete().eq('id', company.id);
      if (error) throw error;

      // Audit log
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await AuditLogService.create({
          user_id: user?.id || null,
          table_name: 'customers',
          record_id: company.id,
          action: 'DELETE',
          old_data: oldData,
          new_data: null,
          comment: null,
        });
      } catch (e) {
        console.warn('[CompanyDetailsPanel] Audit log failed:', e);
      }

      toast.success('Đã xóa công ty');
      onSave();
      onClose();
    } catch (error: any) {
      toast.error('Lỗi xóa: ' + error.message);
      setSaving(false);
    }
  };

  // Industry tag management
  const handleAddIndustry = () => {
    if (industryInput.trim() && !industry.includes(industryInput.trim())) {
      setIndustry([...industry, industryInput.trim()]);
      setIndustryInput('');
    }
  };

  const handleRemoveIndustry = (ind: string) => {
    setIndustry(industry.filter(i => i !== ind));
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
          <Building2 className="text-indigo-600 dark:text-indigo-400 shrink-0" size={24} />
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
                {name || 'Tạo công ty mới'}
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
            { id: 'contacts', name: 'Liên hệ' },
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
                <h3 className={labelCls}>THÔNG TIN CHUNG</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className={labelCls}>Tên công ty *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                </div>

                {/* Short name */}
                <div>
                  <label className={labelCls}>Tên viết tắt</label>
                  <input type="text" value={shortName} onChange={e => setShortName(e.target.value)} className={inputCls} />
                </div>

                {/* Type */}
                <div>
                  <label className={labelCls}>Loại</label>
                  <select value={type} onChange={e => setType(e.target.value)} className={inputCls + ' cursor-pointer'}>
                    <option value="Customer">Khách hàng (KH)</option>
                    <option value="Supplier">Nhà cung cấp (NCC)</option>
                    <option value="Both">Cả hai</option>
                  </select>
                </div>

                {/* Rating */}
                <div>
                  <label className={labelCls}>Rating</label>
                  <select value={rating} onChange={e => setRating(e.target.value)} className={inputCls + ' cursor-pointer'}>
                    <option value="VIP">VIP</option>
                    <option value="Gold">Gold</option>
                    <option value="Standard">Standard</option>
                    <option value="Lead">Lead</option>
                  </select>
                </div>

                {/* Phone */}
                <div>
                  <label className={labelCls}>Điện thoại</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
                </div>

                {/* Email */}
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                </div>

                {/* Tax code */}
                <div>
                  <label className={labelCls}>Mã số thuế</label>
                  <input type="text" value={taxCode} onChange={e => setTaxCode(e.target.value)} className={inputCls} />
                </div>

                {/* Company size */}
                <div>
                  <label className={labelCls}>Quy mô</label>
                  <select value={companySize} onChange={e => setCompanySize(e.target.value)} className={inputCls + ' cursor-pointer'}>
                    <option value="">-- Chọn --</option>
                    <option value="1-10">1-10 nhân viên</option>
                    <option value="11-50">11-50 nhân viên</option>
                    <option value="51-200">51-200 nhân viên</option>
                    <option value="201-500">201-500 nhân viên</option>
                    <option value="500+">500+ nhân viên</option>
                  </select>
                </div>

                {/* Annual Revenue */}
                <div>
                  <label className={labelCls}>Doanh thu năm (VNĐ)</label>
                  <input type="number" value={annualRevenue} onChange={e => setAnnualRevenue(Number(e.target.value))} className={inputCls} min={0} />
                </div>

                {/* CRM Owner */}
                <div>
                  <label className={labelCls}>Account Manager</label>
                  <input type="text" value={crmOwner} onChange={e => setCrmOwner(e.target.value)} className={inputCls} />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Địa chỉ</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
                </div>

                {/* Industry tags */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Ngành nghề</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {industry.map(ind => (
                      <span key={ind} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full">
                        {ind}
                        <button onClick={() => handleRemoveIndustry(ind)} className="hover:text-red-500 cursor-pointer"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={industryInput}
                      onChange={e => setIndustryInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddIndustry())}
                      placeholder="Nhập ngành..."
                      className={inputCls + ' flex-1'}
                    />
                    <button onClick={handleAddIndustry} className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer">
                      <Plus size={14} />
                    </button>
                  </div>
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

        {activeTab === 'contacts' && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Danh sách liên hệ</h3>
            </div>

            {loadingContacts ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800">
                <Users size={24} className="text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có liên hệ nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map(contact => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm transition-shadow">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{contact.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {contact.position && <span>{contact.position} • </span>}
                        {contact.phone && <span>{contact.phone} </span>}
                        {contact.email && <span>• {contact.email}</span>}
                      </div>
                    </div>
                    {contact.is_primary && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                        Chính
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
          {company && (
            <button onClick={handleDelete} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors rounded-lg cursor-pointer">
              <Trash2 size={16} /> XÓA
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors rounded-lg cursor-pointer">HỦY</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold text-sm shadow-md shadow-emerald-100 dark:shadow-none transition-all cursor-pointer">
            <Save size={16} /> LƯU
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyDetailsPanel;
