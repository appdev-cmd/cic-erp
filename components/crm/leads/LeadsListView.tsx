import React from 'react';
import { CrmLead } from '../../../types';
import { formatDateShort } from '../../../utils/formatters';
import { MoreVertical } from 'lucide-react';

interface Props {
  leads: CrmLead[];
}

const LeadsListView: React.FC<Props> = ({ leads }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase">
            <tr>
              <th className="px-6 py-4 font-medium">Tên Lead</th>
              <th className="px-6 py-4 font-medium">Trạng thái</th>
              <th className="px-6 py-4 font-medium">Giá trị (VNĐ)</th>
              <th className="px-6 py-4 font-medium">Khách hàng</th>
              <th className="px-6 py-4 font-medium">Ngày tạo</th>
              <th className="px-6 py-4 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                    {lead.title}
                  </div>
                  {(lead.phone || lead.email) && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {lead.phone} {lead.phone && lead.email && ' • '} {lead.email}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: lead.stage?.color ? `${lead.stage.color}20` : '#F3F4F6',
                      color: lead.stage?.color || '#374151',
                      border: `1px solid ${lead.stage?.color || '#D1D5DB'}`
                    }}
                  >
                    {lead.stage?.name || 'Chưa phân loại'}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  {lead.expected_value 
                    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(lead.expected_value) 
                    : '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-700 dark:text-slate-300">
                    {lead.company_name || lead.name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                  {formatDateShort(lead.created_at)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadsListView;
