import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { CrmLeadService, CrmStageTemplateService, CrmSeedService } from '../../../services';
import { CrmLead, CrmStageTemplate } from '../../../types';
import { toast } from 'sonner';
import { CrmLayout } from '../CrmLayout';
import { LayoutGrid, List, Calendar as CalendarIcon, Plus, Search, Filter, Database, Target } from 'lucide-react';
import LeadsKanbanView from './LeadsKanbanView';
import LeadsListView from './LeadsListView';
import LeadsCalendarView from './LeadsCalendarView';
import { useSlidePanel } from '../../../contexts/SlidePanelContext';
import { useAuth } from '../../../contexts/AuthContext';
import LeadDetailsPanel from './LeadDetailsPanel';
import { LeadAdvancedFilter } from './LeadAdvancedFilter';
export const LeadsPage: React.FC = () => {
  const { selectedUnit } = useLayoutContext();
  const { profile } = useAuth();
  const { openPanel, closePanel } = useSlidePanel();

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [stages, setStages] = useState<CrmStageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<any>(null);
  const { id: urlId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const initialUrlChecked = useRef(false);

  useEffect(() => {
    fetchData();
  }, [selectedUnit]);

  useEffect(() => {
    if (!initialUrlChecked.current && leads.length > 0) {
      if (urlId) {
        // Rewrite history so SlidePanelContext captures the base board as baseUrl
        window.history.replaceState(null, '', '/crm/leads');
        
        if (urlId === 'new') {
          handleLeadClick();
        } else {
          const targetLead = leads.find(l => l.id === urlId);
          if (targetLead) {
            handleLeadClick(targetLead);
          }
        }
        initialUrlChecked.current = true;
      } else {
        const params = new URLSearchParams(window.location.search);
        const leadId = params.get('id');
        const isNew = params.get('new');
        
        if (leadId) {
          const targetLead = leads.find(l => l.id === leadId);
          if (targetLead) {
            handleLeadClick(targetLead);
            initialUrlChecked.current = true;
          }
        } else if (isNew === 'true') {
          handleLeadClick();
          initialUrlChecked.current = true;
        } else {
          initialUrlChecked.current = true; // no params, mark as checked
        }
      }
    }
  }, [leads, urlId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leadsData, stagesData] = await Promise.all([
        CrmLeadService.getAll(selectedUnit?.id === 'all' ? undefined : selectedUnit?.id),
        CrmStageTemplateService.getAll('lead')
      ]);
      
      // Override colors for correct gradient (light to dark)
      const colorMap: Record<string, string> = {
        'Đầu mối mới khởi tạo': '#93C5FD', // Blue-300
        'Phân loại tiềm năng thấp': '#60A5FA', // Blue-400
        'Phân loại tiềm năng cao': '#3B82F6', // Blue-500
      };
      const correctedStages = stagesData.map(s => ({ ...s, color: colorMap[s.name] || s.color }));
      
      setLeads(leadsData);
      setStages(correctedStages);
    } catch (error: any) {
      toast.error('Lỗi tải dữ liệu Leads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeadClick = (lead?: CrmLead) => {
    openPanel({
      title: lead ? 'Lead: ' + lead.title : 'Tạo Lead mới',
      url: lead ? `/crm/leads/${lead.id}` : '/crm/leads/new',
      icon: <Target className="text-indigo-600" size={20} />,
      component: (
        <LeadDetailsPanel
          lead={lead}
          stages={stages}
          onClose={() => {
            closePanel();
          }}
          onSave={fetchData}
        />
      ),
      width: '1000px'
    });
  };

  const handleSeedData = async () => {
    if (seeding) return;
    try {
      setSeeding(true);
      toast.loading('Đang khởi tạo dữ liệu CRM mẫu...', { id: 'crm-seed' });
      const result = await CrmSeedService.seedMockData(profile?.id || '', selectedUnit?.id || '');
      toast.success(`Đã tự động tạo thành công ${result.count} Leads mẫu kèm tương tác!`, { id: 'crm-seed' });
      fetchData();
    } catch (error: any) {
      toast.error('Lỗi khởi tạo dữ liệu mẫu: ' + error.message, { id: 'crm-seed' });
    } finally {
      setSeeding(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    let match = true;
    
    const currentQuery = activeFilters?.searchQuery !== undefined ? activeFilters.searchQuery : searchQuery;

    if (currentQuery) {
      const lowerQuery = currentQuery.toLowerCase();
      match = match && !!(
        lead.title?.toLowerCase().includes(lowerQuery) ||
        lead.company_name?.toLowerCase().includes(lowerQuery) ||
        lead.name?.toLowerCase().includes(lowerQuery) ||
        lead.phone?.includes(currentQuery)
      );
    }
    
    if (activeFilters) {
      if (activeFilters.source && activeFilters.source.length > 0) {
        match = match && activeFilters.source.includes(lead.source);
      }
      // For now we just implement visual matching for demonstration, 
      // actual database mapping will depend on how Lead enum maps to frontend strings
      if (activeFilters.status && activeFilters.status.length > 0) {
        match = match && activeFilters.status.includes(lead.stage?.name || (lead as any).stage_name || (lead as any).status || '');
      }
    }
    
    return match;
  });

  return (
    <CrmLayout>
      <div className="h-full flex flex-col animate-in fade-in duration-350">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <LeadAdvancedFilter 
              onFilterChange={(filters) => {
                setActiveFilters(filters);
                setSearchQuery(filters.searchQuery);
              }}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="Kanban View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="Calendar View"
              >
                <CalendarIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Seed Demo Data Button */}
            <button 
              onClick={handleSeedData}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 disabled:opacity-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-sm transition-all shadow-sm"
              title="Khởi tạo dữ liệu mẫu CRM để test"
            >
              <Database className="w-4 h-4 text-emerald-500" />
              Tạo dữ liệu mẫu
            </button>

            {/* Create Lead Button */}
            <button 
              onClick={() => handleLeadClick()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm shadow-indigo-100 dark:shadow-none"
            >
              <Plus className="w-4 h-4" />
              Tạo Lead mới
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-950 p-4 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {viewMode === 'kanban' && (
                <LeadsKanbanView 
                  leads={filteredLeads} 
                  stages={stages} 
                  onLeadUpdated={fetchData} 
                  onLeadClick={handleLeadClick} 
                />
              )}
              {viewMode === 'list' && (
                <div className="flex-1 overflow-auto">
                  <LeadsListView 
                    leads={filteredLeads} 
                    onLeadClick={handleLeadClick} 
                  />
                </div>
              )}
              {viewMode === 'calendar' && (
                <LeadsCalendarView 
                  leads={filteredLeads} 
                />
              )}
            </>
          )}
        </div>
      </div>
    </CrmLayout>
  );
};

export default LeadsPage;
