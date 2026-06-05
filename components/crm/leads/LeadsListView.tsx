import React from 'react';
import { CrmLead } from '../../../types';
import { formatDateShort } from '../../../utils/formatters';
import { MoreVertical, Hand } from 'lucide-react';
import LeadScoreBadge from '../shared/LeadScoreBadge';
import SourceBadge from '../shared/SourceBadge';
import { REGION_LABELS } from '../../../types/crm';
import type { RegionType } from '../../../types/crm';
import { calcLeadScore } from '../../../lib/crm/leadScoring';

interface Props {
  leads: CrmLead[];
  onLeadClick: (lead: CrmLead) => void;
  onClaimLead?: (leadId: string) => void;
}

const LeadsListView: React.FC<Props> = ({ leads, onLeadClick, onClaimLead }) => {
  // Sort by score descending
  const sortedLeads = [...leads].sort((a, b) => calcLeadScore(b) - calcLeadScore(a));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium w-8">Score</th>
              <th className="px-4 py-3 font-medium">Tên Lead</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Nguồn</th>
              <th className="px-4 py-3 font-medium">Vùng</th>
              <th className="px-4 py-3 font-medium">Giá trị (VNĐ)</th>
              <th className="px-4 py-3 font-medium">Khách hàng</th>
              <th className="px-4 py-3 font-medium">Phụ trách</th>
              <th className="px-4 py-3 font-medium">Ngày tạo</th>
              <th className="px-4 py-3 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sortedLeads.map((lead) => {
              const region = lead.region as RegionType | undefined;
              const isUnclaimed = !lead.assigned_to;
              
              return (
                <tr 
                  key={lead.id} 
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    isUnclaimed ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''
                  }`}
                >
                  {/* Score */}
                  <td className="px-4 py-3">
                    <LeadScoreBadge lead={lead} size="sm" />
                  </td>

                  {/* Tên Lead */}
                  <td className="px-4 py-3">
                    <div 
                      onClick={() => onLeadClick(lead)}
                      className="font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                    >
                      {lead.title}
                    </div>
                    {(lead.phone || lead.email) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {lead.phone} {lead.phone && lead.email && ' · '} {lead.email}
                      </div>
                    )}
                  </td>

                  {/* Trạng thái */}
                  <td className="px-4 py-3">
                    <span 
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ 
                        backgroundColor: lead.stage?.color ? `${lead.stage.color}20` : '#F3F4F6',
                        color: lead.stage?.color || '#374151',
                        border: `1px solid ${lead.stage?.color || '#D1D5DB'}`
                      }}
                    >
                      {lead.stage?.name || 'Chưa phân loại'}
                    </span>
                  </td>

                  {/* Nguồn */}
                  <td className="px-4 py-3">
                    <SourceBadge source={lead.source} size="sm" />
                  </td>

                  {/* Vùng */}
                  <td className="px-4 py-3">
                    {region && region !== 'unknown' ? (
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {REGION_LABELS[region]}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>

                  {/* Giá trị */}
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {lead.expected_value 
                      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(lead.expected_value) 
                      : '—'}
                  </td>

                  {/* Khách hàng */}
                  <td className="px-4 py-3">
                    <div className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                      {lead.company_name || lead.name || '—'}
                    </div>
                  </td>

                  {/* Phụ trách */}
                  <td className="px-4 py-3">
                    {lead.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {lead.assignee.avatar ? (
                            <img src={lead.assignee.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">
                              {lead.assignee.name?.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                          {lead.assignee.name}
                        </span>
                      </div>
                    ) : onClaimLead ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onClaimLead(lead.id); }}
                        className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer"
                      >
                        <Hand className="w-3 h-3" /> Nhận
                      </button>
                    ) : (
                      <span className="text-xs text-amber-500 dark:text-amber-400 italic">Chưa nhận</span>
                    )}
                  </td>

                  {/* Ngày tạo */}
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                    {formatDateShort(lead.created_at)}
                  </td>

                  {/* Thao tác */}
                  <td className="px-4 py-3 text-right">
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
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
