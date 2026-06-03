import React, { useState } from 'react';
import { CrmLayout } from '../CrmLayout';
import { Search, Filter, Plus, DollarSign, LayoutGrid, List, Calendar as CalendarIcon } from 'lucide-react';

export const DealsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Mock data for initial structure
  const stages = [
    { id: '1', name: 'Cơ hội mới', color: '#FDE68A', count: 1, value: 50000000 },
    { id: '2', name: 'Báo giá sơ bộ', color: '#FCD34D', count: 1, value: 120000000 },
    { id: '3', name: 'Thương thảo', color: '#FBBF24', count: 0, value: 0 },
    { id: '4', name: 'Chốt đơn (Won)', color: '#10B981', count: 1, value: 250000000 }
  ];

  const deals = [
    { id: '101', title: 'Cung cấp Phần mềm ERP - CIC', stageId: '1', amount: 50000000, company: 'Công ty Cổ phần Đầu tư CIC' },
    { id: '102', title: 'Triển khai giải pháp số hóa BIM', stageId: '2', amount: 120000000, company: 'Tập đoàn Công nghệ Giga' },
    { id: '103', title: 'Dịch vụ Đào tạo & Chuyển giao công nghệ', stageId: '4', amount: 250000000, company: 'Công ty Cổ phần Đầu tư CIC' }
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
                placeholder="Tìm kiếm Cơ hội..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Tạo Cơ hội mới
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-900 p-4 overflow-hidden">
          {viewMode === 'kanban' ? (
            <div className="flex h-full overflow-x-auto gap-4 pb-4">
              {stages.map(stage => {
                const stageDeals = deals.filter(d => d.stageId === stage.id);
                return (
                  <div key={stage.id} className="flex flex-col flex-1 min-w-0 bg-slate-100 dark:bg-slate-800 rounded-xl h-full">
                    <div className="p-3 rounded-t-xl" style={{ backgroundColor: stage.color || '#3B82F6' }}>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-white uppercase text-sm truncate drop-shadow-sm">
                          {stage.name}
                        </h3>
                        <span className="text-xs font-medium text-white bg-white/20 px-2 py-0.5 rounded-full shadow-sm">
                          {stageDeals.length}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white/90 drop-shadow-sm">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stage.value)}
                      </div>
                    </div>

                    <div className="flex-1 p-2 overflow-y-auto space-y-2">
                      {stageDeals.map(deal => (
                        <div key={deal.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer">
                          <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm mb-2 line-clamp-2">
                            {deal.title}
                          </h4>
                          <div className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(deal.amount)}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {deal.company}
                          </div>
                        </div>
                      ))}
                      {stageDeals.length === 0 && (
                        <div className="flex-1 min-h-[150px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                          <span className="text-sm text-slate-400 dark:text-slate-500">Kéo thả vào đây</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 uppercase">
                  <tr>
                    <th className="px-6 py-4 font-medium">Tên Cơ Hội</th>
                    <th className="px-6 py-4 font-medium">Khách hàng</th>
                    <th className="px-6 py-4 font-medium">Giá trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {deals.map(deal => (
                    <tr key={deal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4 text-indigo-600 dark:text-indigo-400 font-medium">{deal.title}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{deal.company}</td>
                      <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-medium">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(deal.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </CrmLayout>
  );
};

export default DealsPage;
