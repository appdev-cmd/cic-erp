import React, { useState } from 'react';
import { CrmDeal } from '../../../types';
import { formatDateShort, formatCurrency } from '../../../utils/formatters';
import { MoreVertical, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  deals: CrmDeal[];
  onDealClick: (deal: CrmDeal) => void;
}

type SortField = 'amount' | 'probability' | 'expected_close_date' | 'title';
type SortDir = 'asc' | 'desc';

const DealsListView: React.FC<Props> = ({ deals, onDealClick }) => {
  const [sortField, setSortField] = useState<SortField>('amount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedDeals = [...deals].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'amount':
        cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
        break;
      case 'probability':
        cmp = (a.probability || 0) - (b.probability || 0);
        break;
      case 'expected_close_date':
        cmp = (a.expected_close_date || '').localeCompare(b.expected_close_date || '');
        break;
      case 'title':
        cmp = (a.title || '').localeCompare(b.title || '');
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
      : <ChevronDown className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />;
  };

  // Probability color helper
  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
    if (probability >= 50) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 uppercase">
            <tr>
              <th
                className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-1">
                  Tên Deal <SortIcon field="title" />
                </div>
              </th>
              <th className="px-4 py-3 font-medium">Công ty</th>
              <th
                className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center gap-1">
                  Giá trị <SortIcon field="amount" />
                </div>
              </th>
              <th
                className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => handleSort('probability')}
              >
                <div className="flex items-center gap-1">
                  Xác suất <SortIcon field="probability" />
                </div>
              </th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Phụ trách</th>
              <th
                className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => handleSort('expected_close_date')}
              >
                <div className="flex items-center gap-1">
                  Ngày dự kiến <SortIcon field="expected_close_date" />
                </div>
              </th>
              <th className="px-4 py-3 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sortedDeals.map((deal) => (
              <tr
                key={deal.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {/* Tên Deal */}
                <td className="px-4 py-3">
                  <div
                    onClick={() => onDealClick(deal)}
                    className="font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                  >
                    {deal.title}
                  </div>
                  {deal.contact?.name && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {deal.contact.name}
                    </div>
                  )}
                </td>

                {/* Công ty */}
                <td className="px-4 py-3">
                  <div className="text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                    {deal.customer?.name || '—'}
                  </div>
                </td>

                {/* Giá trị */}
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {formatCurrency(deal.amount || 0)}
                </td>

                {/* Xác suất */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getProbabilityColor(deal.probability)}`}>
                    {deal.probability}%
                  </span>
                </td>

                {/* Trạng thái */}
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: deal.stage?.color ? `${deal.stage.color}20` : '#F3F4F6',
                      color: deal.stage?.color || '#374151',
                      border: `1px solid ${deal.stage?.color || '#D1D5DB'}`
                    }}
                  >
                    {deal.stage?.name || 'Chưa phân loại'}
                  </span>
                </td>

                {/* Phụ trách */}
                <td className="px-4 py-3">
                  {deal.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {deal.assignee.avatar ? (
                          <img src={deal.assignee.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">
                            {deal.assignee.name?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                        {deal.assignee.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">Chưa gán</span>
                  )}
                </td>

                {/* Ngày dự kiến */}
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                  {deal.expected_close_date ? formatDateShort(deal.expected_close_date) : '—'}
                </td>

                {/* Thao tác */}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDealClick(deal)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {deals.length === 0 && (
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
  );
};

export default DealsListView;
