import React, { useState } from 'react';
import { CrmLayout } from '../CrmLayout';
import { Search, Filter, Plus, User, Phone, Mail, MoreVertical, Building2 } from 'lucide-react';

export const ContactsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for initial structure
  const contacts = [
    { id: '1', name: 'Nguyễn Văn A', company: 'Công ty Cổ phần Đầu tư CIC', phone: '0987.654.321', email: 'vana@cic.com.vn', role: 'Giám đốc công nghệ' },
    { id: '2', name: 'Trần Thị B', company: 'Tập đoàn Công nghệ Giga', phone: '0912.345.678', email: 'thib@giga.vn', role: 'Trưởng phòng mua hàng' }
  ];

  return (
    <CrmLayout>
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0 gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm kiếm liên hệ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Thêm liên hệ
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase">
                  <tr>
                    <th className="px-6 py-4 font-medium">Họ và Tên</th>
                    <th className="px-6 py-4 font-medium">Công ty</th>
                    <th className="px-6 py-4 font-medium">Số điện thoại</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Chức vụ</th>
                    <th className="px-6 py-4 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                          <User className="w-4 h-4 text-slate-400" />
                          {contact.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {contact.company}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> {contact.phone}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> {contact.email}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {contact.role}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </CrmLayout>
  );
};

export default ContactsPage;
