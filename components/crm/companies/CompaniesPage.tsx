import React, { useState, useEffect } from 'react';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSlidePanel } from '../../../contexts/SlidePanelContext';
import { dataClient as supabase } from '../../../lib/dataClient';
import { AuditLogService } from '../../../services/auditLogService';
import { toast } from 'sonner';
import { CrmLayout } from '../CrmLayout';
import { Plus, Search, Building2, MoreVertical, Phone, Mail, Users } from 'lucide-react';
import CompanyDetailsPanel from './CompanyDetailsPanel';

interface CompanyRow {
  id: string;
  name: string;
  short_name?: string;
  type?: string;
  industry?: string[];
  phone?: string;
  email?: string;
  address?: string;
  company_size?: string;
  annual_revenue?: number;
  crm_owner?: string;
  rating?: string;
  source?: string;
  tax_code?: string;
  created_at: string;
  contacts?: { count: number }[];
}

export const CompaniesPage: React.FC = () => {
  const { selectedUnit } = useLayoutContext();
  const { profile } = useAuth();
  const { openPanel, closePanel } = useSlidePanel();

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterSize, setFilterSize] = useState('');

  useEffect(() => {
    fetchData();
  }, [selectedUnit]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*, contacts:customer_contacts(count)')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      toast.error('Lỗi tải dữ liệu công ty: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyClick = (company?: CompanyRow) => {
    openPanel({
      title: company ? company.name : 'Tạo công ty mới',
      url: company ? `/crm/companies/${company.id}` : '/crm/companies/new',
      icon: <Building2 className="text-indigo-600 dark:text-indigo-400" size={20} />,
      component: (
        <CompanyDetailsPanel
          company={company as any}
          onClose={() => closePanel()}
          onSave={fetchData}
        />
      ),
      width: '900px'
    });
  };

  // Client-side filtering
  const filteredCompanies = companies.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        c.name?.toLowerCase().includes(q) ||
        c.short_name?.toLowerCase().includes(q) ||
        c.phone?.includes(searchQuery) ||
        c.email?.toLowerCase().includes(q) ||
        c.tax_code?.includes(searchQuery);
      if (!match) return false;
    }
    if (filterIndustry) {
      if (!c.industry?.some(i => i.toLowerCase().includes(filterIndustry.toLowerCase()))) return false;
    }
    if (filterSize) {
      if (c.company_size !== filterSize) return false;
    }
    return true;
  });

  const companySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

  return (
    <CrmLayout>
      <div className="h-full flex flex-col animate-in fade-in duration-350">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm công ty, mã số thuế..."
                className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Industry filter */}
            <input
              type="text"
              value={filterIndustry}
              onChange={e => setFilterIndustry(e.target.value)}
              placeholder="Lọc ngành..."
              className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
            />

            {/* Size filter */}
            <select
              value={filterSize}
              onChange={e => setFilterSize(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">Quy mô</option>
              {companySizes.map(s => (
                <option key={s} value={s}>{s} nhân viên</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => handleCompanyClick()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm shadow-indigo-100 dark:shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tạo công ty mới
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 text-xs text-slate-500 dark:text-slate-400">
          <span>Tổng: <span className="font-bold text-slate-700 dark:text-slate-300">{filteredCompanies.length}</span> công ty</span>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto bg-slate-50 dark:bg-slate-950 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Tên công ty</th>
                      <th className="px-4 py-3 font-medium">Loại</th>
                      <th className="px-4 py-3 font-medium">Ngành</th>
                      <th className="px-4 py-3 font-medium">Liên hệ</th>
                      <th className="px-4 py-3 font-medium">Quy mô</th>
                      <th className="px-4 py-3 font-medium">Số liên hệ</th>
                      <th className="px-4 py-3 font-medium">Rating</th>
                      <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredCompanies.map((company) => {
                      const contactCount = company.contacts?.[0]?.count || 0;
                      return (
                        <tr
                          key={company.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          {/* Name */}
                          <td className="px-4 py-3">
                            <div
                              onClick={() => handleCompanyClick(company)}
                              className="font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                            >
                              {company.name}
                            </div>
                            {company.short_name && company.short_name !== company.name && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {company.short_name}
                              </div>
                            )}
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              company.type === 'Customer'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                : company.type === 'Supplier'
                                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                  : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                            }`}>
                              {company.type === 'Customer' ? 'KH' : company.type === 'Supplier' ? 'NCC' : company.type || '—'}
                            </span>
                          </td>

                          {/* Industry */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(company.industry || []).slice(0, 2).map(ind => (
                                <span key={ind} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {ind}
                                </span>
                              ))}
                              {(company.industry || []).length > 2 && (
                                <span className="text-[10px] text-slate-400">+{(company.industry || []).length - 2}</span>
                              )}
                              {(!company.industry || company.industry.length === 0) && (
                                <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </div>
                          </td>

                          {/* Contact info */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {company.phone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone size={10} /> {company.phone}
                                </span>
                              )}
                              {company.email && (
                                <span className="flex items-center gap-0.5">
                                  <Mail size={10} /> {company.email}
                                </span>
                              )}
                              {!company.phone && !company.email && '—'}
                            </div>
                          </td>

                          {/* Company size */}
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                            {company.company_size || '—'}
                          </td>

                          {/* Contact count */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                              <Users size={12} />
                              {contactCount}
                            </div>
                          </td>

                          {/* Rating */}
                          <td className="px-4 py-3">
                            {company.rating ? (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                company.rating === 'VIP'
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                  : company.rating === 'Gold'
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}>
                                {company.rating}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleCompanyClick(company)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCompanies.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                          Không có dữ liệu
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </CrmLayout>
  );
};

export default CompaniesPage;
