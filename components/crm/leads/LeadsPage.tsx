import React, { useState, useEffect } from 'react';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { CrmLeadService, CrmStageTemplateService } from '../../../services';
import { CrmLead, CrmStageTemplate } from '../../../types';
import { toast } from 'sonner';
import { CrmLayout } from '../CrmLayout';
import { LayoutGrid, List, Calendar as CalendarIcon, Plus, Search, Filter } from 'lucide-react';
import LeadsKanbanView from './LeadsKanbanView';
import LeadsListView from './LeadsListView';
import LeadsCalendarView from './LeadsCalendarView';

export const LeadsPage: React.FC = () => {
  const { selectedUnit } = useLayoutContext();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [stages, setStages] = useState<CrmStageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, [selectedUnit]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leadsData, stagesData] = await Promise.all([
        CrmLeadService.getAll(selectedUnit === 'all' ? undefined : (typeof selectedUnit === 'string' ? selectedUnit : selectedUnit?.id)),
        CrmStageTemplateService.getAll('lead')
      ]);
      setLeads(leadsData);
      setStages(stagesData);
    } catch (error: any) {
      toast.error('Lỗi tải dữ liệu Leads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return (
      lead.title?.toLowerCase().includes(lowerQuery) ||
      lead.company_name?.toLowerCase().includes(lowerQuery) ||
      lead.name?.toLowerCase().includes(lowerQuery) ||
      lead.phone?.includes(searchQuery)
    );
  });

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
                placeholder="Tìm kiếm Lead..."
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
            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="Kanban View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="Calendar View"
              >
                <CalendarIcon className="w-4 h-4" />
              </button>
            </div>

            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Tạo Lead mới
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {viewMode === 'kanban' && <LeadsKanbanView leads={filteredLeads} stages={stages} onLeadUpdated={fetchData} />}
              {viewMode === 'list' && <LeadsListView leads={filteredLeads} />}
              {viewMode === 'calendar' && <LeadsCalendarView leads={filteredLeads} />}
            </>
          )}
        </div>
      </div>
    </CrmLayout>
  );
};

export default LeadsPage;
