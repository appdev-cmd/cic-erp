import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSlidePanel } from '../../../contexts/SlidePanelContext';
import { CrmDealService, CrmStageTemplateService } from '../../../services';
import { CrmDeal, CrmStageTemplate } from '../../../types';
import { toast } from 'sonner';
import { CrmLayout } from '../CrmLayout';
import { LayoutGrid, List, Plus, Search, Briefcase, Filter, Trophy, XCircle, Users } from 'lucide-react';
import DealsKanbanView from './DealsKanbanView';
import DealsListView from './DealsListView';
import DealDetailsPanel from './DealDetailsPanel';
import { formatCurrency } from '../../../utils/formatters';

export const DealsPage: React.FC = () => {
  const { selectedUnit } = useLayoutContext();
  const { profile } = useAuth();
  const { openPanel, closePanel } = useSlidePanel();

  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [stages, setStages] = useState<CrmStageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'negotiating' | 'won' | 'lost'>('all');
  const { id: urlId } = useParams<{ id: string }>();
  const initialUrlChecked = useRef(false);

  useEffect(() => {
    fetchData();
  }, [selectedUnit]);

  useEffect(() => {
    if (!initialUrlChecked.current && deals.length > 0) {
      if (urlId) {
        window.history.replaceState(null, '', '/crm/deals');

        if (urlId === 'new') {
          handleDealClick();
        } else {
          const targetDeal = deals.find(d => d.id === urlId);
          if (targetDeal) {
            handleDealClick(targetDeal);
          }
        }
        initialUrlChecked.current = true;
      } else {
        const params = new URLSearchParams(window.location.search);
        const dealId = params.get('id');
        const isNew = params.get('new');

        if (dealId) {
          const targetDeal = deals.find(d => d.id === dealId);
          if (targetDeal) {
            handleDealClick(targetDeal);
            initialUrlChecked.current = true;
          }
        } else if (isNew === 'true') {
          handleDealClick();
          initialUrlChecked.current = true;
        } else {
          initialUrlChecked.current = true;
        }
      }
    }
  }, [deals, urlId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dealsData, stagesData] = await Promise.all([
        CrmDealService.getAll(selectedUnit?.id === 'all' ? undefined : selectedUnit?.id),
        CrmStageTemplateService.getAll('deal')
      ]);

      // Color map for deal stages
      const colorMap: Record<string, string> = {
        'Khách hàng tiềm năng': '#93C5FD',
        'Đang thương lượng': '#3B82F6',
        'Đề xuất': '#8B5CF6',
        'Thương thảo hợp đồng': '#F59E0B',
        'Thắng': '#10B981',
        'Thua': '#EF4444',
      };
      const correctedStages = stagesData.map(s => ({ ...s, color: colorMap[s.name] || s.color }));

      setDeals(dealsData);
      setStages(correctedStages);
    } catch (error: any) {
      toast.error('Lỗi tải dữ liệu Deals: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDealClick = (deal?: CrmDeal) => {
    openPanel({
      title: deal ? 'Deal: ' + deal.title : 'Tạo Deal mới',
      url: deal ? `/crm/deals/${deal.id}` : '/crm/deals/new',
      icon: <Briefcase className="text-indigo-600 dark:text-indigo-400" size={20} />,
      component: (
        <DealDetailsPanel
          deal={deal}
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

  // Client-side search filter
  const filteredDeals = deals.filter(deal => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      const match =
        deal.title?.toLowerCase().includes(lowerQuery) ||
        deal.customer?.name?.toLowerCase().includes(lowerQuery) ||
        deal.contact?.name?.toLowerCase().includes(lowerQuery) ||
        deal.assignee?.name?.toLowerCase().includes(lowerQuery);
      if (!match) return false;
    }
    return true;
  });

  // Quick filter
  const quickFilteredDeals = filteredDeals.filter(deal => {
    switch (quickFilter) {
      case 'negotiating':
        return !deal.stage?.is_win && !deal.stage?.is_lose;
      case 'won':
        return !!deal.stage?.is_win;
      case 'lost':
        return !!deal.stage?.is_lose;
      default:
        return true;
    }
  });

  // Stats
  const totalAmount = filteredDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const wonCount = filteredDeals.filter(d => d.stage?.is_win).length;
  const lostCount = filteredDeals.filter(d => d.stage?.is_lose).length;

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
                placeholder="Tìm deal, khách hàng..."
                className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="Kanban View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Create Deal Button */}
            <button
              onClick={() => handleDealClick()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm transition-colors shadow-sm shadow-indigo-100 dark:shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tạo Deal mới
            </button>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          {[
            { key: 'all' as const, label: 'Tất cả', icon: Briefcase, count: filteredDeals.length },
            { key: 'negotiating' as const, label: 'Đang thương lượng', icon: Users },
            { key: 'won' as const, label: 'Thắng', icon: Trophy, count: wonCount, highlight: wonCount > 0 },
            { key: 'lost' as const, label: 'Thua', icon: XCircle, count: lostCount },
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
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : quickFilter === tab.key
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}

          {/* Total pipeline value */}
          <div className="ml-auto text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Pipeline: <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(totalAmount)}</span>
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
                <DealsKanbanView
                  deals={quickFilteredDeals}
                  stages={stages}
                  onDealUpdated={fetchData}
                  onDealClick={handleDealClick}
                />
              )}
              {viewMode === 'list' && (
                <div className="flex-1 overflow-auto">
                  <DealsListView
                    deals={quickFilteredDeals}
                    onDealClick={handleDealClick}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </CrmLayout>
  );
};

export default DealsPage;
