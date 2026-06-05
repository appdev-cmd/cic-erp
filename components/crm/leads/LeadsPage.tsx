import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { CrmLeadService, CrmStageTemplateService, CrmSeedService } from '../../../services';
import { CrmLead, CrmStageTemplate } from '../../../types';
import { toast } from 'sonner';
import { CrmLayout } from '../CrmLayout';
import { LayoutGrid, List, Calendar as CalendarIcon, Plus, Search, Filter, Database, Target, Upload, Users, UserCheck, CheckCircle2 } from 'lucide-react';
import LeadsKanbanView from './LeadsKanbanView';
import LeadsListView from './LeadsListView';
import LeadsCalendarView from './LeadsCalendarView';
import { useSlidePanel } from '../../../contexts/SlidePanelContext';
import { useAuth } from '../../../contexts/AuthContext';
import LeadDetailsPanel from './LeadDetailsPanel';
import { LeadAdvancedFilter } from './LeadAdvancedFilter';
import ImportLeadModal from './ImportLeadModal';
import { calcLeadScore } from '../../../lib/crm/leadScoring';
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'all' | 'unclaimed' | 'mine' | 'completed'>('all');
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
      const [leadsData, poolData, stagesData] = await Promise.all([
        CrmLeadService.getAll(selectedUnit?.id === 'all' ? undefined : selectedUnit?.id),
        CrmLeadService.getNoPotentialPool(), // ao "Không tiềm năng" — toàn công ty
        CrmStageTemplateService.getAll('lead')
      ]);

      // Hợp nhất lead theo unit + ao Không tiềm năng (dedup theo id):
      // ao bổ sung lead lose của các unit khác để cả công ty khai thác lại.
      const byId = new Map<string, CrmLead>();
      for (const l of leadsData) byId.set(l.id, l);
      for (const l of poolData) if (!byId.has(l.id)) byId.set(l.id, l);
      const mergedLeads = Array.from(byId.values());
      
      // Color map cho 4 stages mới
      const colorMap: Record<string, string> = {
        'Mới': '#93C5FD',              // Blue-300
        'Đang xử lý': '#60A5FA',       // Blue-400
        'Tiềm năng cao': '#22C55E',    // Green-500 (win)
        'Không tiềm năng': '#6B7280',  // Gray-500 (lose)
        // Legacy names fallback
        'Đầu mối mới khởi tạo': '#93C5FD',
        'Phân loại tiềm năng thấp': '#60A5FA',
        'Phân loại tiềm năng cao': '#60A5FA',
        'Đã liên hệ': '#60A5FA',
        'Đủ điều kiện': '#60A5FA',
        'Chuyển đổi': '#22C55E',
        'Hoàn thành': '#22C55E',
        'Không đủ ĐK': '#6B7280',
        'Mất': '#6B7280',
      };
      const correctedStages = stagesData.map(s => ({ ...s, color: colorMap[s.name] || s.color }));

      setLeads(mergedLeads);
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
      if (activeFilters.region && activeFilters.region.length > 0) {
        match = match && activeFilters.region.includes(lead.region || 'unknown');
      }
      if (activeFilters.scoreMin) {
        const score = calcLeadScore(lead);
        match = match && score >= Number(activeFilters.scoreMin);
      }
      if (activeFilters.scoreMax) {
        const score = calcLeadScore(lead);
        match = match && score <= Number(activeFilters.scoreMax);
      }
    }
    
    return match;
  });

  // Quick filter
  const quickFilteredLeads = filteredLeads.filter(lead => {
    switch (quickFilter) {
      case 'unclaimed':
        return !lead.assigned_to;
      case 'mine':
        return lead.assigned_to === profile?.id;
      case 'completed':
        return !!lead.completed_at;
      default:
        return true;
    }
  });

  // Claim lead handler
  const handleClaimLead = async (leadId: string) => {
    try {
      await CrmLeadService.claimLead(leadId);
      fetchData();
      toast.success('Đã nhận lead thành công!');
    } catch (error: any) {
      toast.error(error.message || 'Không thể nhận lead');
    }
  };

  // Count unclaimed leads
  const unclaimedCount = leads.filter(l => !l.assigned_to).length;

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

            {/* Import from Excel Button */}
            <button 
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-sm transition-all shadow-sm"
              title="Import Lead từ file Excel"
            >
              <Upload className="w-4 h-4 text-emerald-500" />
              Import Excel
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

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          {[
            { key: 'all' as const, label: 'Tất cả', icon: Users, count: filteredLeads.length },
            { key: 'unclaimed' as const, label: 'Chưa có người nhận 🔴', icon: Users, count: unclaimedCount, highlight: unclaimedCount > 0 },
            { key: 'mine' as const, label: 'Của tôi', icon: UserCheck },
            { key: 'completed' as const, label: 'Đã hoàn thành', icon: CheckCircle2 },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setQuickFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                quickFilter === tab.key
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tab.highlight && quickFilter !== tab.key
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : quickFilter === tab.key
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
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
                  leads={quickFilteredLeads}
                  stages={stages}
                  onLeadUpdated={fetchData}
                  onLeadClick={handleLeadClick}
                  currentUnitId={selectedUnit?.id === 'all' ? undefined : selectedUnit?.id}
                />
              )}
              {viewMode === 'list' && (
                <div className="flex-1 overflow-auto">
                  <LeadsListView 
                    leads={quickFilteredLeads} 
                    onLeadClick={handleLeadClick}
                    onClaimLead={handleClaimLead}
                  />
                </div>
              )}
              {viewMode === 'calendar' && (
                <LeadsCalendarView 
                  leads={quickFilteredLeads} 
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Import Lead from Excel Modal */}
      <ImportLeadModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          fetchData();
          toast.success('Import Lead từ Excel thành công!');
        }}
      />
    </CrmLayout>
  );
};

export default LeadsPage;
