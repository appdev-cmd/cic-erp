import React, { useState, useEffect } from 'react';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSlidePanel } from '../../../contexts/SlidePanelContext';
import { dataClient as supabase } from '../../../lib/dataClient';
import { toast } from 'sonner';
import { CrmLayout } from '../CrmLayout';
import { Plus, Search, UserCircle, MoreVertical, Phone, Mail, Building2, Star } from 'lucide-react';
import ContactDetailsPanel from './ContactDetailsPanel';
import { formatDate } from '../../../utils/formatters';

interface ContactRow {
  id: string;
  name: string;
  position?: string;
  department?: string;
  phone?: string;
  email?: string;
  is_primary: boolean;
  notes?: string;
  created_at?: string;
  customer_id: string;
  customer?: {
    id: string;
    name: string;
    short_name?: string;
  };
}

export const ContactsPage: React.FC = () => {
  const { selectedUnit } = useLayoutContext();
  const { profile } = useAuth();
  const { openPanel, closePanel } = useSlidePanel();

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPrimary, setFilterPrimary] = useState<'all' | 'primary'>('all');

  useEffect(() => {
    fetchData();
  }, [selectedUnit]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('*, customer:customers(id, name, short_name)')
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast.error('Lỗi tải dữ liệu liên hệ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = (contact?: ContactRow) => {
    openPanel({
      title: contact ? contact.name : 'Tạo liên hệ mới',
      url: contact ? `/crm/contacts/${contact.id}` : '/crm/contacts/new',
      icon: <UserCircle className="text-indigo-600 dark:text-indigo-400" size={20} />,
      component: (
        <ContactDetailsPanel
          contact={contact as any}
          onClose={() => closePanel()}
          onSave={fetchData}
        />
      ),
      width: '800px'
    });
  };

  // Client-side filtering
  const filteredContacts = contacts.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(searchQuery) ||
        c.email?.toLowerCase().includes(q) ||
        c.position?.toLowerCase().includes(q) ||
        c.customer?.name?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterPrimary === 'primary' && !c.is_primary) return false;
    return true;
  });

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
                placeholder="Tìm liên hệ, công ty..."
                className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Primary filter */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
              <button
                onClick={() => setFilterPrimary('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterPrimary === 'all'
                    ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setFilterPrimary('primary')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterPrimary === 'primary'
                    ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Star size={12} className="inline mr-1" />
                Liên hệ chính
              </button>
            </div>

            <button
              onClick={() => handleContactClick()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm shadow-indigo-100 dark:shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tạo liên hệ mới
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 text-xs text-slate-500 dark:text-slate-400">
          <span>Tổng: <span className="font-bold text-slate-700 dark:text-slate-300">{filteredContacts.length}</span> liên hệ</span>
          <span>Liên hệ chính: <span className="font-bold text-emerald-600 dark:text-emerald-400">{filteredContacts.filter(c => c.is_primary).length}</span></span>
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
                      <th className="px-4 py-3 font-medium">Tên liên hệ</th>
                      <th className="px-4 py-3 font-medium">Công ty</th>
                      <th className="px-4 py-3 font-medium">Chức vụ</th>
                      <th className="px-4 py-3 font-medium">SĐT</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium text-center">Chính</th>
                      <th className="px-4 py-3 font-medium">Ngày tạo</th>
                      <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredContacts.map(contact => (
                      <tr
                        key={contact.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        {/* Name */}
                        <td className="px-4 py-3">
                          <div
                            onClick={() => handleContactClick(contact)}
                            className="font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                          >
                            {contact.name}
                          </div>
                        </td>

                        {/* Company */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <Building2 size={12} className="text-slate-400" />
                            {contact.customer?.name || '—'}
                          </div>
                        </td>

                        {/* Position */}
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                          {contact.position || '—'}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <Phone size={10} />
                            {contact.phone || '—'}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <Mail size={10} />
                            {contact.email || '—'}
                          </div>
                        </td>

                        {/* Is Primary */}
                        <td className="px-4 py-3 text-center">
                          {contact.is_primary ? (
                            <Star size={14} className="text-amber-500 dark:text-amber-400 mx-auto fill-current" />
                          ) : (
                            <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>

                        {/* Created at */}
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {contact.created_at ? formatDate(contact.created_at) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleContactClick(contact)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredContacts.length === 0 && (
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

export default ContactsPage;
