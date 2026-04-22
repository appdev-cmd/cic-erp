import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, CheckSquare, Search, Clock, AlertTriangle, Calendar,
  X, MessageSquare, Tag, Copy, Pin, Play, CheckCircle2,
  Briefcase, ArrowUpDown, Trash2, ChevronRight, Download,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import { useLayoutContext } from '../layout/MainLayout';
import { TaskService } from '../../services/taskService';
import { DiscussionService } from '../../services/discussionService';
import { TaskPersonalTagService } from '../../services/taskPersonalTagService';
import { dataClient } from '../../lib/dataClient';
import TaskDetailPanel from './TaskDetailPanel';
import CreateTaskPanel from './CreateTaskPanel';
import CalendarView from './CalendarView';
import { GanttView } from './GanttView';
import { BitrixListView } from './views/BitrixListView';
import { DeadlineView } from './views/DeadlineView';
import { PlannerView } from './views/PlannerView';
import { BulkActionsBar } from './views/BulkActionsBar';
import TaskTemplateManagerPanel from './TaskTemplateManagerPanel';
import TeamDashboard from './TeamDashboard';
import PeoplePickerPopover from './PeoplePickerPopover';
import { useTaskVisibility } from '../../hooks/useTaskVisibility';
import { formatDate, formatDateShort, formatDateTime } from '../../utils/formatters';
import type {
  Task, TaskStatus, TaskPriority, TaskFilterOptions, CreateTaskInput, TaskRoleFilter
} from '../../types/taskTypes';
import { TaskFilterBar, type DateRange } from './TaskFilterBar';
import { exportTasksToExcel } from '../../services/taskExportService';

// Extracted sub-components & configs (previously inline — ~515 lines)
import {
  PRIORITY_CONFIG,
  ROLE_TABS,
  VIEW_TABS,
  type ViewMode,
  PersonAvatar,
  QuickTaskInput,
  StatusDropdown,
  DeadlineInput,
  ProjectPickerDropdown,
  InlineTagInput,
  InlineCommentInput,
  COLUMN_KEYS,
  type ColumnKey,
  COL_LABELS,
  COL_RESPONSIVE,
  loadColWidths,
  saveColWidths,
  ResizeHandle,
} from './TasksPageSubComponents';

// ═══════════════════════════════════════
// TASKS PAGE (main)
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// TASKS PAGE (main)
// ═══════════════════════════════════════
interface TasksPageProps {
  onSelectTask?: (taskId: string) => void;
  isEmbedded?: boolean;
  sourceModule?: string;
  sourceEntityId?: string;
}

const TasksPage: React.FC<TasksPageProps> = ({ onSelectTask, isEmbedded, sourceModule, sourceEntityId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilterState] = useState<TaskRoleFilter>(() => {
    return (localStorage.getItem('cic-erp-task-role') as TaskRoleFilter) || 'all';
  });
  const setRoleFilter = (role: TaskRoleFilter) => {
    setRoleFilterState(role);
    localStorage.setItem('cic-erp-task-role', role);
  };
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('cic_task_view_mode') as ViewMode) || 'list';
    } catch {
      return 'list';
    }
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    try { return localStorage.getItem('cic-erp-task-search') || ''; } catch { return ''; }
  });
  const [filterProjectId, setFilterProjectIdState] = useState<string>(() => {
    try { return localStorage.getItem('cic-erp-task-project') || 'all'; } catch { return 'all'; }
  });
  const setFilterProjectId = (val: string) => {
    setFilterProjectIdState(val);
    try { localStorage.setItem('cic-erp-task-project', val); } catch { /* ignore */ }
  };
  const [projects, setProjects] = useState<{id: string; name: string}[]>([]);
  const [employees, setEmployees] = useState<Record<string, { name: string; avatar?: string }>>({});
  const [personalUserTags, setPersonalUserTags] = useState<string[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Advanced filter states — với persistence
  const [filterStatusIds, setFilterStatusIdsState] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cic-erp-task-status-ids') || '[]'); } catch { return []; }
  });
  const setFilterStatusIds = (val: string[]) => {
    setFilterStatusIdsState(val);
    try { localStorage.setItem('cic-erp-task-status-ids', JSON.stringify(val)); } catch { /* ignore */ }
  };
  const [filterAssigneeIds, setFilterAssigneeIdsState] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cic-erp-task-assignee-ids') || '[]'); } catch { return []; }
  });
  const setFilterAssigneeIds = (val: string[]) => {
    setFilterAssigneeIdsState(val);
    try { localStorage.setItem('cic-erp-task-assignee-ids', JSON.stringify(val)); } catch { /* ignore */ }
  };
  const [filterDateRange, setFilterDateRangeState] = useState<DateRange>(() => {
    try { return JSON.parse(localStorage.getItem('cic-erp-task-date-range') || '{}'); } catch { return {}; }
  });
  const setFilterDateRange = (val: DateRange) => {
    setFilterDateRangeState(val);
    try { localStorage.setItem('cic-erp-task-date-range', JSON.stringify(val)); } catch { /* ignore */ }
  };

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const currentPage = useRef(0);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem('cic_task_view_mode', viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // Persist search query
  useEffect(() => {
    try { localStorage.setItem('cic-erp-task-search', searchQuery); } catch { /* ignore */ }
  }, [searchQuery]);

  const { getVisibleTasks, getMyTasks, isAdmin, isManager, visibilityContext } = useTaskVisibility();

  // Build role tabs — conditionally include "Giám sát" for managers
  const roleTabs = useMemo(() => {
    const base = [...ROLE_TABS];
    if (isManager) {
      base.push({ key: 'supervising', label: 'Giám sát', icon: <Briefcase size={15} /> });
    }
    return base;
  }, [isManager]);
  const { openPanel, closePanel } = useSlidePanel();
  const { selectedUnit } = useLayoutContext();

  // Load projects
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await dataClient.from('projects').select('id, name').order('name');
        if (data) setProjects(data.map((p: any) => ({ id: p.id, name: p.name })));
      } catch { /* ignore */ }
    };
    load();

    // Load user's personal tags
    if (visibilityContext.userId) {
      import('../../services/taskPersonalTagService').then(m => {
        m.TaskPersonalTagService.getAllUserTags(visibilityContext.userId).then(tags => {
          setPersonalUserTags(tags);
        });
      });
    }
  }, [visibilityContext.userId]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Parse #tags from search query
      const tagMatches = (debouncedSearchQuery || '').match(/#(\S+)/g);
      const searchTags = tagMatches ? tagMatches.map(t => t.substring(1)) : [];
      const textSearch = (debouncedSearchQuery || '').replace(/#\S+/g, '').trim();

      const [statusList, taskList, counts] = await Promise.all([
        TaskService.getStatuses(),
        TaskService.getTasksByRole(visibilityContext.userId, roleFilter, {
          search: textSearch || undefined,
          project_id: filterProjectId !== 'all' ? filterProjectId : undefined,
          tags: searchTags.length > 0 ? searchTags : undefined,
          status_ids: filterStatusIds.length > 0 ? filterStatusIds : undefined,
          assignee_ids: filterAssigneeIds.length > 0 ? filterAssigneeIds : undefined,
          due_before: filterDateRange.end ? filterDateRange.end : undefined,
          due_after: filterDateRange.start ? filterDateRange.start : undefined,
          source_modules: isEmbedded && sourceModule ? [sourceModule] : undefined,
          source_entity_id: isEmbedded && sourceEntityId ? sourceEntityId : undefined,
        }, visibilityContext),
        TaskService.getRoleCounts(visibilityContext.userId, visibilityContext.role),
      ]);
      setStatuses(statusList);
      setRoleCounts(counts);

      const PAGE_SIZE = 50;
      setHasMore(taskList.length === PAGE_SIZE);
      currentPage.current = 0;

      // Enrich tasks with project names
      const projectIds = [...new Set(taskList.filter(t => t.project_id).map(t => t.project_id!))];
      let projectMap: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: projData } = await dataClient.from('projects').select('id, name').in('id', projectIds);
        if (projData) projData.forEach((p: any) => { projectMap[p.id] = p.name; });
      }
      const enriched = taskList.map(t => ({
        ...t,
        _projectName: t.project_id ? projectMap[t.project_id] : undefined,
      }));

      // If searching by #tag, also include tasks matched by personal tags
      if (searchTags.length > 0) {
        try {
          const personalMatchPromises = searchTags.map(tag => TaskPersonalTagService.getTaskIdsByTag(visibilityContext.userId, tag));
          const personalMatchArrays = await Promise.all(personalMatchPromises);
          const personalTaskIds = new Set(personalMatchArrays.flat());
          // Remove IDs that are already in the result
          const existingIds = new Set(enriched.map(t => t.id));
          const missingIds = [...personalTaskIds].filter(id => !existingIds.has(id));
          if (missingIds.length > 0) {
            // Fetch those missing tasks
            const { data: extraTasks } = await dataClient.from('tasks').select('*').in('id', missingIds);
            if (extraTasks) {
              for (const t of extraTasks) {
                enriched.push({
                  ...t,
                  _projectName: t.project_id ? projectMap[t.project_id] : undefined,
                } as any);
              }
            }
          }
        } catch { /* silent */ }
      }

      setTasks(enriched);

      // Load employee info for all referenced people
      const allPeopleIds = new Set<string>();
      taskList.forEach(t => {
        if (t.created_by) allPeopleIds.add(t.created_by);
        t.assignees?.forEach(id => allPeopleIds.add(id));
        t.supporters?.forEach(id => allPeopleIds.add(id));
      });
      if (allPeopleIds.size > 0) {
        const { data: empData } = await dataClient.from('employees').select('id, name, avatar').in('id', Array.from(allPeopleIds));
        if (empData) {
          const map: Record<string, { name: string; avatar?: string }> = {};
          empData.forEach((e: any) => { map[e.id] = { name: e.name || e.id.substring(0, 8), avatar: e.avatar }; });
          setEmployees(map);
        }
      }
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
      toast.error('Lỗi tải công việc: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, [roleFilter, debouncedSearchQuery, filterProjectId, filterStatusIds, filterAssigneeIds, filterDateRange, visibilityContext.userId, isEmbedded, sourceModule, sourceEntityId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Load More (T6.2) ───────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = currentPage.current + 1;
    try {
      const tagMatches = (debouncedSearchQuery || '').match(/#(\S+)/g);
      const searchTags = tagMatches ? tagMatches.map(t => t.substring(1)) : [];
      const textSearch = (debouncedSearchQuery || '').replace(/#\S+/g, '').trim();
      const moreTasks = await TaskService.getTasksByRole(
        visibilityContext.userId,
        roleFilter,
        {
          search: textSearch || undefined,
          project_id: filterProjectId !== 'all' ? filterProjectId : undefined,
          tags: searchTags.length > 0 ? searchTags : undefined,
          status_ids: filterStatusIds.length > 0 ? filterStatusIds : undefined,
          assignee_ids: filterAssigneeIds.length > 0 ? filterAssigneeIds : undefined,
          due_before: filterDateRange.end ? filterDateRange.end : undefined,
          due_after: filterDateRange.start ? filterDateRange.start : undefined,
          source_modules: isEmbedded && sourceModule ? [sourceModule] : undefined,
          source_entity_id: isEmbedded && sourceEntityId ? sourceEntityId : undefined,
        },
        visibilityContext,
        nextPage,
      );
      currentPage.current = nextPage;
      setHasMore(moreTasks.length === 50);
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const unique = moreTasks.filter(t => !existingIds.has(t.id));
        return [...prev, ...unique];
      });
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, debouncedSearchQuery, visibilityContext, roleFilter, filterProjectId, filterStatusIds, filterAssigneeIds, filterDateRange, isEmbedded, sourceModule, sourceEntityId]);


  useEffect(() => {
    const channel = dataClient
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        // T6.4: Smart realtime — chỉ update row đơn, không reload toàn bộ
        if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          // New task from AI agent or other users → reload one time to get enriched data
          loadData();
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new as any;
          setTasks(prev => prev.map(t => {
            if (t.id !== updated.id) return t;
            return { ...t, ...updated };
          }));
        }
      })
      .subscribe();

    return () => {
      dataClient.removeChannel(channel);
    };
  }, [loadData]);

  // Tasks are primarily governed by visibilityContext and personal filters
  // Therefore, we do not filter personal tasks out by the global selectedUnit.
  const filteredTasks = tasks;

  const [tabTags, setTabTags] = useState<string[]>([]);

  useEffect(() => {
    // Only update the pool of available tags when no search is active,
    // so suggestions don't instantly disappear when typing partial tags filters the task list.
    if (!searchQuery) {
      const tagSet = new Set<string>();
      tasks.forEach(t => {
        t.tags?.forEach(tag => tagSet.add(tag));
      });
      setTabTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
    }
  }, [tasks, searchQuery]);

  // Derive actual unique tags from unfiltered tab tags + personal tags
  // This ensures that any suggested tag WILL yield result(s) in the current view
  const actualTags = useMemo(() => {
    return Array.from(new Set([...tabTags, ...personalUserTags]))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [tabTags, personalUserTags]);

  // Handlers
  const handleToggleComplete = useCallback(async (task: Task) => {
    const prevTasks = tasks; // snapshot for rollback
    try {
      if (task.status?.is_done) {
        const defaultId = await TaskService.getDefaultStatusId();
        const defaultStatus = statuses.find(s => s.id === defaultId);
        if (defaultId) {
          // Optimistic update
          setTasks(prev => prev.map(t => t.id === task.id
            ? { ...t, status_id: defaultId, status: defaultStatus, completed_at: undefined, completed_by: undefined }
            : t
          ));
          await TaskService.update(task.id, { status_id: defaultId, completed_at: undefined, completed_by: undefined });
        }
      } else {
        const doneStatus = statuses.find(s => s.is_done);
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id
          ? { ...t, status_id: doneStatus?.id, status: doneStatus, completed_at: new Date().toISOString(), completed_by: visibilityContext.userId }
          : t
        ));
        await TaskService.complete(task.id, visibilityContext.userId);
      }
    } catch (err: any) {
      setTasks(prevTasks); // rollback on error
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [visibilityContext.userId, tasks, statuses]);

  const handleSelectTask = useCallback((taskId: string, initialTab?: 'detail' | 'comments' | 'history' | 'links' | 'time') => {
    if (onSelectTask) {
      onSelectTask(taskId);
    } else {
      openPanel({
        component: (
          <TaskDetailPanel
            taskId={taskId}
            onUpdate={loadData}
            currentUserId={visibilityContext.userId}
            onClose={closePanel}
            initialTab={initialTab}
          />
        ),
        title: 'Chi tiết công việc',
        url: `/tasks/${taskId}`,
      });
    }
  }, [onSelectTask, openPanel, closePanel, loadData, visibilityContext.userId]);

  // Read ?taskId= query param and auto-open (e.g., from AI assistant link)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const taskIdQuery = searchParams.get('taskId');
      if (taskIdQuery) {
        // Xóa param khỏi URL sau khi xử lý
        window.history.replaceState({}, '', window.location.pathname);
        // Delay một chút để đảm bảo UI/PanelContext đã sẵn sàng
        setTimeout(() => handleSelectTask(taskIdQuery), 100);
      }
    }
  }, [handleSelectTask]);

  const handleTogglePin = useCallback(async (taskId: string) => {
    try {
      const pinned = await TaskService.togglePin(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_pinned: pinned } : t));
      toast.success(pinned ? 'Đã ghim công việc' : 'Đã bỏ ghim');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, []);

  const handleStartTask = useCallback(async (task: Task) => {
    try {
      const inProgressStatus = statuses.find(s => s.name?.includes('Đang') || s.name?.includes('In Progress'));
      if (inProgressStatus) {
        await TaskService.update(task.id, { status_id: inProgressStatus.id });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status_id: inProgressStatus.id, status: inProgressStatus } : t));
        toast.success('Đã bắt đầu công việc');
      } else {
        toast.error('Không tìm thấy trạng thái "Đang thực hiện"');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [statuses]);

  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(`#${tag}`);
  }, []);

  const handleQuickCreate = useCallback(async (title: string, tags: string[], dueDate?: string) => {
    try {
      await TaskService.create({
        title,
        tags,
        due_date: dueDate,
        assignees: [visibilityContext.userId],
        created_by: visibilityContext.userId,
        source_module: isEmbedded ? sourceModule : undefined,
        source_entity_id: isEmbedded ? sourceEntityId : undefined,
      });
      toast.success('Đã tạo công việc');
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [visibilityContext.userId, loadData, isEmbedded, sourceModule, sourceEntityId]);

  // Inline update handlers — optimistic: update local state immediately, no full reload
  const handleUpdateStatus = useCallback(async (taskId: string, statusId: string) => {
    const status = statuses.find(s => s.id === statusId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status_id: statusId, status: status || t.status } : t));
    try {
      await TaskService.update(taskId, { status_id: statusId });
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
      loadData(); // rollback on error
    }
  }, [statuses, loadData]);

  const handleUpdateDeadline = useCallback(async (taskId: string, deadline: string | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: deadline || undefined } : t));
    try {
      await TaskService.update(taskId, { due_date: deadline ?? null } as any);
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
      loadData();
    }
  }, [loadData]);

  const handleUpdateAssignee = useCallback(async (taskId: string, assigneeIds: string[]) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignees: assigneeIds } : t));
    // Ensure new assignee info is in the employees map
    const missingIds = assigneeIds.filter(id => !employees[id]);
    if (missingIds.length > 0) {
      try {
        const { data: empData } = await dataClient.from('employees').select('id, name, avatar').in('id', missingIds);
        if (empData) {
          setEmployees(prev => {
            const next = { ...prev };
            empData.forEach((e: any) => { next[e.id] = { name: e.name || e.id.substring(0, 8), avatar: e.avatar }; });
            return next;
          });
        }
      } catch { /* ignore */ }
    }
    try {
      await TaskService.update(taskId, { assignees: assigneeIds });
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
      loadData();
    }
  }, [employees, loadData]);

  const handleUpdateProject = useCallback(async (taskId: string, projectId: string | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, project_id: projectId || undefined } : t));
    try {
      await TaskService.update(taskId, { project_id: projectId || undefined });
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
      loadData();
    }
  }, [loadData]);

  const handleQuickComment = useCallback(async (taskId: string, content: string) => {
    if (!visibilityContext.userId) return;
    try {
      await DiscussionService.add({
        entity_type: 'task',
        entity_id: taskId,
        user_id: visibilityContext.userId,
        content,
        comment_type: 'user'
      });
      toast.success('Đã gửi bình luận!');
    } catch (err: any) {
      toast.error('Lỗi khi gửi bình luận: ' + (err.message || err));
    }
  }, [visibilityContext.userId]);

  // Selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  // Bulk actions
  const handleBulkComplete = async () => {
    try {
      const doneStatus = statuses.find(s => s.is_done && s.name !== 'Hủy');
      if (!doneStatus) return;
      await TaskService.bulkUpdateStatus(Array.from(selectedIds), doneStatus.id, visibilityContext.userId);
      toast.success(`Đã hoàn thành ${selectedIds.size} công việc`);
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleBulkSetDeadline = async () => {
    const dateStr = prompt('Nhập deadline (dd/mm/yyyy):');
    if (!dateStr) return;
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) { toast.error('Sai định dạng ngày, dùng dd/mm/yyyy'); return; }
    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
    try {
      await TaskService.bulkSetDeadline(Array.from(selectedIds), isoDate);
      toast.success(`Đã đặt deadline cho ${selectedIds.size} công việc`);
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} công việc đã chọn? \nLưu ý: Hành động này không thể hoàn tác.`)) {
      return;
    }
    try {
      await TaskService.bulkDelete(Array.from(selectedIds));
      toast.success(`Đã xóa ${selectedIds.size} công việc`);
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast.error('Lỗi khi xóa: ' + (err.message || err));
    }
  };

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const doneStatusIds = statuses.filter(s => s.is_done).map(s => s.id);
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && !doneStatusIds.includes(t.status_id || '')).length;
  const commentsCount = 0;

  // ─── Keyboard Shortcuts ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.isContentEditable || target.closest('[role="dialog"]');
      if (isInput) return;

      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault();
          openPanel({
            component: <CreateTaskPanel
              onTaskCreated={loadData}
              onClose={() => closePanel()}
              currentUserId={visibilityContext.userId}
              initialData={isEmbedded && sourceModule && sourceEntityId
                ? { source_module: sourceModule, source_entity_id: sourceEntityId } : undefined}
            />,
            title: 'Thêm công việc',
          });
          break;
        case 'Escape':
          if (selectedIds.size > 0) {
            setSelectedIds(new Set());
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          document.getElementById('task-search-input')?.focus();
          break;
        case 'r':
        case 'R':
          if (e.ctrlKey || e.metaKey) break; // let browser handle Ctrl+R
          e.preventDefault();
          loadData();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openPanel, closePanel, loadData, visibilityContext.userId, selectedIds.size, isEmbedded, sourceModule, sourceEntityId]);

  return (
    <div className={`space-y-0 ${isEmbedded ? 'flex flex-col h-full min-h-0' : ''}`}>
      {/* ═══ TOP ROLE TABS (Bitrix24-style) ═══ */}
      {!isEmbedded && (
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 -mx-6 -mt-6 px-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {roleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setRoleFilter(tab.key); setSelectedIds(new Set()); }}
              className={`relative flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer border-b-2
                ${roleFilter === tab.key
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
            >
              {tab.icon}
              {tab.label}
              {roleCounts[tab.key] !== undefined && roleCounts[tab.key] > 0 && (
                <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                  ${roleFilter === tab.key
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {roleCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ═══ SUB-HEADER ═══ */}
      {!isEmbedded && (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-5 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* NEW TASK button */}
          <button
            onClick={() => {
              openPanel({
                component: <CreateTaskPanel 
                   onTaskCreated={loadData} 
                   onClose={() => closePanel()} 
                   currentUserId={visibilityContext.userId} 
                   initialData={isEmbedded && sourceModule && sourceEntityId ? { source_module: sourceModule, source_entity_id: sourceEntityId } : undefined}
                />,
                title: 'Thêm công việc',
              });
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} /> CÔNG VIỆC MỚI
          </button>



          {/* Advanced Filter Bar */}
          <TaskFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            availableTags={actualTags}
            statuses={statuses}
            selectedStatusIds={filterStatusIds}
            onStatusChange={setFilterStatusIds}
            selectedAssigneeIds={filterAssigneeIds}
            onAssigneeChange={setFilterAssigneeIds}
            dateRange={filterDateRange}
            onDateRangeChange={setFilterDateRange}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Export Excel */}
          <button
            onClick={() => exportTasksToExcel(filteredTasks, employees)}
            title="Xuất danh sách công việc ra Excel"
            className="hidden sm:flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download size={13} /> Excel
          </button>
          {/* Template manager */}
          <button
            onClick={() => {
              openPanel({
                component: <TaskTemplateManagerPanel onClose={() => closePanel()} />,
                title: 'Quản lý Mẫu Công Việc',
              });
            }}
            className="hidden sm:flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Copy size={13} /> Mẫu
          </button>
        </div>
      </div>
      )}

      {/* ═══ VIEW MODE TABS + COUNTERS ═══ */}
      <div className={`flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-0 ${isEmbedded ? 'mb-0 px-2' : 'mb-4'}`}>
        <div className="flex items-center gap-0">
          {VIEW_TABS.map(tab => (
            <button
              key={tab.mode}
              onClick={() => setViewMode(tab.mode)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2
                ${viewMode === tab.mode
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pb-2">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
              <AlertTriangle size={12} /> {overdueCount} Quá hạn
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageSquare size={12} /> {commentsCount} Bình luận
          </span>
        </div>
      </div>

      {/* ═══ TEAM DASHBOARD (supervising mode) ═══ */}
      {roleFilter === 'supervising' && isManager && !loading && (
        <TeamDashboard
          visibilityContext={visibilityContext}
          onSelectEmployee={(empId) => {
            setSearchQuery('');
            setFilterProjectId('all');
            // Navigate to filtered view for this employee
            setRoleFilter('supervising');
            // The TeamDashboard handles its own filtering internally
          }}
          onViewTask={handleSelectTask}
        />
      )}

      {/* ═══ CONTENT ═══ */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20 min-h-[300px]">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className={`${isEmbedded ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
          {viewMode === 'list' && (
            <BitrixListView
              tasks={filteredTasks}
              statuses={statuses}
              employees={employees}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onSelect={handleSelectTask}
              onToggleComplete={handleToggleComplete}
              onTogglePin={handleTogglePin}
              onStartTask={handleStartTask}
              onQuickCreate={handleQuickCreate}
              onTagClick={handleTagClick}
              onUpdateStatus={handleUpdateStatus}
              onUpdateDeadline={handleUpdateDeadline}
              onUpdateAssignee={handleUpdateAssignee}
              onUpdateProject={handleUpdateProject}
              onQuickComment={handleQuickComment}
              projects={projects}
            />
          )}
          {viewMode === 'deadline' && (
            <DeadlineView
              tasks={filteredTasks}
              statuses={statuses}
              employees={employees}
              onSelect={handleSelectTask}
              onToggleComplete={handleToggleComplete}
              onQuickCreate={handleQuickCreate}
              onUpdateDeadline={handleUpdateDeadline}
              onUpdateAssignee={handleUpdateAssignee}
            />
          )}
          {viewMode === 'planner' && (
            <PlannerView
              tasks={filteredTasks}
              statuses={statuses}
              employees={employees}
              onSelect={handleSelectTask}
              onToggleComplete={handleToggleComplete}
              onQuickCreate={handleQuickCreate}
            />
          )}
          {viewMode === 'calendar' && (
            <CalendarView
              tasks={filteredTasks}
              statuses={statuses}
              onSelect={handleSelectTask}
              onUpdateDates={async (taskId, newDueDate) => {
                try {
                  await TaskService.update(taskId, { due_date: newDueDate });
                  await loadData();
                  toast.success('Đã cập nhật deadline');
                } catch (err: any) {
                  toast.error('Không thể cập nhật: ' + err.message);
                }
              }}
            />
          )}
          {viewMode === 'gantt' && (
            <GanttView
              tasks={filteredTasks}
              statuses={statuses}
              onSelect={handleSelectTask}
              onUpdateDates={async (taskId, startDate, dueDate) => {
                try {
                  await TaskService.update(taskId, { start_date: startDate ?? undefined, due_date: dueDate ?? undefined });
                  await loadData();
                } catch (err: any) {
                  toast.error('Không thể cập nhật ngày: ' + err.message);
                }
              }}
            />
          )}
        </div>
      )}


      {/* ─── Empty State ─── */}
      {!loading && filteredTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          {(debouncedSearchQuery || filterStatusIds.length > 0 || filterAssigneeIds.length > 0 || filterProjectId !== 'all') ? (
            // Case 1: Đang filter/search nhưng không có kết quả
            <>
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Search size={28} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-2">Không tìm thấy công việc nào</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-5">
                Thử thay đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem thêm kết quả.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatusIds([]);
                  setFilterAssigneeIds([]);
                  setFilterProjectId('all');
                  setFilterDateRange({});
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <X size={14} /> Xóa tất cả bộ lọc
              </button>
            </>
          ) : roleFilter === 'ongoing' && tasks.length === 0 ? (
            // Case 2: Tab "Hoàn thành" trống
            <>
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-2">Chưa có công việc đang thực hiện</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                Các công việc bạn đang thực hiện sẽ xuất hiện tại đây.
              </p>
            </>
          ) : (
            // Case 3: Tab khác không có task
            <>
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
                <CheckSquare size={28} className="text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-2">
                {roleFilter === 'assisting' ? 'Bạn chưa được giao việc nào' :
                 roleFilter === 'set_by_me' ? 'Bạn chưa tạo công việc nào' :
                 roleFilter === 'all' ? 'Chưa có công việc nào' :
                 'Không có công việc phù hợp'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-5">
                Tạo công việc đầu tiên để bắt đầu quản lý tiến độ công việc.
              </p>
              {!isEmbedded && (
                <button
                  onClick={() => openPanel({
                    component: <CreateTaskPanel
                      onTaskCreated={loadData}
                      onClose={() => closePanel()}
                      currentUserId={visibilityContext.userId}
                    />,
                    title: 'Thêm công việc',
                  })}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors cursor-pointer shadow-sm"
                >
                  <Plus size={15} /> Tạo công việc mới
                </button>
              )}
              {!isEmbedded && (
                <p className="text-xs text-slate-400 dark:text-slate-600 mt-3">Hoặc nhấn phím <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px]">N</kbd> để tạo nhanh</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Load More button (T6.2) ─── */}
      {!loading && hasMore && (viewMode === 'list' || viewMode === 'deadline') && (
        <div className="flex justify-center py-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold transition-all disabled:opacity-60 shadow-sm"
          >
            {loadingMore ? (
              <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            ) : null}
            {loadingMore ? 'Đang tải thêm…' : 'Tải thêm công việc'}
          </button>
        </div>
      )}


      {/* ═══ BULK ACTIONS BAR ═══ */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        totalCount={filteredTasks.length}
        onComplete={handleBulkComplete}
        onSetDeadline={handleBulkSetDeadline}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default TasksPage;
