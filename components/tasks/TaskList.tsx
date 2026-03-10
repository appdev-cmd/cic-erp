import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Plus, Search, Filter, LayoutList, LayoutGrid, ChevronRight, ChevronDown,
    Folder as FolderIcon, List as ListIcon, MoreHorizontal, Settings2,
    Calendar as CalendarIcon, Flag, User, Clock, CheckSquare, Trash2, Edit3, X,
    AlertCircle, ArrowUpDown, ChartNoAxesGantt, Table2, AlignHorizontalJustifyStart, BarChart3, Zap, Users
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SpaceService, TaskService } from '../../services';
import { Space, Folder, TaskList as TaskListType, Task, TaskStatus } from '../../types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '../../constants';
import { DEFAULT_STATUSES } from '../../services/taskService';
import { toast } from 'sonner';
import { formatDateShort } from '../../utils/formatters';
import TaskBoard from './TaskBoard';
import TaskCalendar from './TaskCalendar';
import TaskGantt from './TaskGantt';
import TaskTable from './TaskTable';
import TaskTimeline from './TaskTimeline';
import TaskDashboardWidgets from './TaskDashboardWidgets';
import TaskAutomation from './TaskAutomation';
import TaskWorkload from './TaskWorkload';
import TaskDetail from './TaskDetail';
import TaskForm from './TaskForm';

type ViewMode = 'list' | 'board' | 'calendar' | 'gantt' | 'table' | 'timeline' | 'dashboard' | 'automation' | 'workload';

interface Props {
    selectedUnit?: string;
}

// ============================================================================
// TASK LIST PAGE — Main task management page with space sidebar + list/board
// ============================================================================
const TaskListPage: React.FC<Props> = ({ selectedUnit }) => {
    const { user, profile } = useAuth();

    // Data state
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tasksLoading, setTasksLoading] = useState(false);

    // Selection state
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    // UI state
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [showNewSpaceInput, setShowNewSpaceInput] = useState(false);
    const [newSpaceName, setNewSpaceName] = useState('');
    const [showNewListInput, setShowNewListInput] = useState<string | null>(null); // spaceId
    const [newListName, setNewListName] = useState('');
    const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const limit = 50;

    // Get current list's statuses
    const currentStatuses: TaskStatus[] = useMemo(() => {
        if (!selectedListId || !selectedSpaceId) return DEFAULT_STATUSES;
        const space = spaces.find(s => s.id === selectedSpaceId);
        if (!space) return DEFAULT_STATUSES;
        const allLists = [...(space.lists || []), ...(space.folders || []).flatMap((f: Folder) => f.lists || [])];
        const list = allLists.find((l: any) => l.id === selectedListId);
        return (list as any)?.statuses || DEFAULT_STATUSES;
    }, [selectedListId, selectedSpaceId, spaces]);

    // Load spaces
    const loadSpaces = useCallback(async () => {
        try {
            const data = await SpaceService.listSpaces();
            setSpaces(data);
            // Auto-select first space if none selected
            if (data.length > 0 && !selectedSpaceId) {
                setSelectedSpaceId(data[0].id);
                setExpandedSpaces(new Set([data[0].id]));
                // Auto-select first list
                const firstList = data[0].lists?.[0] || (data[0].folders?.[0] as any)?.lists?.[0];
                if (firstList) setSelectedListId(firstList.id);
            }
        } catch (e: any) {
            toast.error('Lỗi tải danh sách: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [selectedSpaceId]);

    // Load tasks
    const loadTasks = useCallback(async () => {
        setTasksLoading(true);
        try {
            const result = await TaskService.list({
                listId: selectedListId || undefined,
                spaceId: !selectedListId ? (selectedSpaceId || undefined) : undefined,
                parentId: null, // Top-level tasks only
                search: search || undefined,
                status: statusFilter || undefined,
                priority: priorityFilter || undefined,
                page,
                limit,
            });
            setTasks(result.data);
            setTotalCount(result.count);
        } catch (e: any) {
            toast.error('Lỗi tải công việc: ' + e.message);
        } finally {
            setTasksLoading(false);
        }
    }, [selectedListId, selectedSpaceId, search, statusFilter, priorityFilter, page]);

    useEffect(() => { loadSpaces(); }, []);
    useEffect(() => { if (selectedSpaceId || selectedListId) loadTasks(); }, [selectedListId, selectedSpaceId, search, statusFilter, priorityFilter, page]);

    // Handlers
    const toggleSpace = (id: string) => {
        const next = new Set(expandedSpaces);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedSpaces(next);
    };

    const toggleFolder = (id: string) => {
        const next = new Set(expandedFolders);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedFolders(next);
    };

    const selectList = (listId: string, spaceId: string) => {
        setSelectedListId(listId);
        setSelectedSpaceId(spaceId);
        setPage(1);
        setSelectedTasks(new Set());
    };

    const handleCreateSpace = async () => {
        if (!newSpaceName.trim()) return;
        try {
            await SpaceService.createSpace({ name: newSpaceName.trim(), created_by: user?.id });
            setNewSpaceName('');
            setShowNewSpaceInput(false);
            await loadSpaces();
            toast.success('Đã tạo Space mới');
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleCreateList = async (spaceId: string) => {
        if (!newListName.trim()) return;
        try {
            await SpaceService.createList({ space_id: spaceId, name: newListName.trim(), created_by: user?.id });
            setNewListName('');
            setShowNewListInput(null);
            await loadSpaces();
            toast.success('Đã tạo danh sách mới');
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleCreateTask = async (taskData: Partial<Task>) => {
        try {
            await TaskService.create({
                ...taskData,
                list_id: selectedListId || taskData.list_id,
                created_by: user?.id,
            });
            setShowTaskForm(false);
            setEditingTask(null);
            await loadTasks();
            toast.success('Đã tạo công việc');
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
        try {
            await TaskService.update(id, updates, user?.id);
            await loadTasks();
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa công việc này?')) return;
        try {
            await TaskService.delete(id, user?.id);
            setSelectedTaskId(null);
            await loadTasks();
            toast.success('Đã xóa công việc');
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleBulkStatusChange = async (statusId: string) => {
        if (selectedTasks.size === 0) return;
        try {
            await TaskService.batchUpdateStatus(Array.from(selectedTasks), statusId, user?.id);
            setSelectedTasks(new Set());
            await loadTasks();
            toast.success(`Đã cập nhật ${selectedTasks.size} công việc`);
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const toggleSelectTask = (id: string) => {
        const next = new Set(selectedTasks);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedTasks(next);
    };

    const getStatusInfo = (statusId: string) => {
        const customStatus = currentStatuses.find(s => s.id === statusId);
        if (customStatus) return { label: customStatus.name, color: customStatus.color };
        return TASK_STATUS_LABELS[statusId] || { label: statusId, color: '#808080' };
    };

    const getPriorityInfo = (priority: string) => {
        return TASK_PRIORITY_LABELS[priority] || { label: priority, color: '#94A3B8', icon: '⚪' };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-slate-900">
            {/* ===== SPACE SIDEBAR ===== */}
            <aside className="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-800 overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Spaces</h2>
                    <button
                        onClick={() => setShowNewSpaceInput(true)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                        title="Tạo Space mới"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {/* New Space Input */}
                    {showNewSpaceInput && (
                        <div className="flex items-center gap-1 mb-2 px-1">
                            <input
                                autoFocus
                                value={newSpaceName}
                                onChange={e => setNewSpaceName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateSpace()}
                                placeholder="Tên space..."
                                className="flex-1 text-sm px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button onClick={handleCreateSpace} className="text-indigo-500 hover:text-indigo-600"><Plus size={16} /></button>
                            <button onClick={() => { setShowNewSpaceInput(false); setNewSpaceName(''); }} className="text-slate-400 hover:text-slate-500"><X size={16} /></button>
                        </div>
                    )}

                    {spaces.map(space => (
                        <div key={space.id}>
                            {/* Space Header */}
                            <button
                                onClick={() => { toggleSpace(space.id); setSelectedSpaceId(space.id); setSelectedListId(null); setPage(1); }}
                                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors cursor-pointer ${selectedSpaceId === space.id && !selectedListId
                                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {expandedSpaces.has(space.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: space.color || '#6366f1' }} />
                                <span className="truncate flex-1 text-left">{space.name}</span>
                            </button>

                            {/* Space Children */}
                            {expandedSpaces.has(space.id) && (
                                <div className="ml-4 space-y-0.5 mt-0.5">
                                    {/* Folders */}
                                    {(space.folders || []).map((folder: Folder) => (
                                        <div key={folder.id}>
                                            <button
                                                onClick={() => toggleFolder(folder.id)}
                                                className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                            >
                                                {expandedFolders.has(folder.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                <FolderIcon size={12} />
                                                <span className="truncate">{folder.name}</span>
                                            </button>
                                            {expandedFolders.has(folder.id) && (
                                                <div className="ml-4 space-y-0.5">
                                                    {(folder.lists || []).map((list: any) => (
                                                        <button
                                                            key={list.id}
                                                            onClick={() => selectList(list.id, space.id)}
                                                            className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${selectedListId === list.id
                                                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                                }`}
                                                        >
                                                            <ListIcon size={12} />
                                                            <span className="truncate">{list.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Lists directly under space */}
                                    {(space.lists || []).filter((l: TaskListType) => !l.folder_id).map((list: TaskListType) => (
                                        <button
                                            key={list.id}
                                            onClick={() => selectList(list.id, space.id)}
                                            className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${selectedListId === list.id
                                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            <ListIcon size={12} />
                                            <span className="truncate">{list.name}</span>
                                        </button>
                                    ))}

                                    {/* Add list button */}
                                    {showNewListInput === space.id ? (
                                        <div className="flex items-center gap-1 px-1 mt-1">
                                            <input
                                                autoFocus
                                                value={newListName}
                                                onChange={e => setNewListName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleCreateList(space.id)}
                                                placeholder="Tên list..."
                                                className="flex-1 text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <button onClick={() => handleCreateList(space.id)} className="text-indigo-500"><Plus size={14} /></button>
                                            <button onClick={() => { setShowNewListInput(null); setNewListName(''); }} className="text-slate-400"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowNewListInput(space.id)}
                                            className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                        >
                                            <Plus size={12} />
                                            <span>Thêm danh sách</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {spaces.length === 0 && (
                        <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
                            <p>Chưa có Space nào</p>
                            <button
                                onClick={() => setShowNewSpaceInput(true)}
                                className="mt-2 text-indigo-500 hover:text-indigo-600 text-sm font-medium"
                            >
                                + Tạo Space đầu tiên
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-3 bg-white dark:bg-slate-900">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Tìm kiếm công việc..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="text-sm px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Tất cả trạng thái</option>
                        {currentStatuses.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    {/* Priority Filter */}
                    <select
                        value={priorityFilter}
                        onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
                        className="text-sm px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Tất cả ưu tiên</option>
                        {Object.entries(TASK_PRIORITY_LABELS).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                        {[
                            { mode: 'list' as ViewMode, icon: LayoutList, label: 'Danh sách' },
                            { mode: 'board' as ViewMode, icon: LayoutGrid, label: 'Kanban' },
                            { mode: 'calendar' as ViewMode, icon: CalendarIcon, label: 'Lịch' },
                            { mode: 'gantt' as ViewMode, icon: ChartNoAxesGantt, label: 'Gantt' },
                            { mode: 'table' as ViewMode, icon: Table2, label: 'Bảng' },
                            { mode: 'timeline' as ViewMode, icon: AlignHorizontalJustifyStart, label: 'Timeline' },
                            { mode: 'dashboard' as ViewMode, icon: BarChart3, label: 'Dashboard' },
                            { mode: 'automation' as ViewMode, icon: Zap, label: 'Tự động' },
                            { mode: 'workload' as ViewMode, icon: Users, label: 'Workload' },
                        ].map(({ mode, icon: Icon, label }) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === mode
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                title={label}
                            >
                                <Icon size={16} />
                            </button>
                        ))}
                    </div>

                    {/* Create Task Button */}
                    {selectedListId && (
                        <button
                            onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus size={16} />
                            Tạo việc
                        </button>
                    )}
                </div>

                {/* Bulk Actions Bar */}
                {selectedTasks.size > 0 && (
                    <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20">
                        <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                            Đã chọn {selectedTasks.size} công việc
                        </span>
                        <select
                            onChange={e => { if (e.target.value) handleBulkStatusChange(e.target.value); e.target.value = ''; }}
                            className="text-sm px-2 py-1 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                            <option value="">Đổi trạng thái...</option>
                            {currentStatuses.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setSelectedTasks(new Set())}
                            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                            Bỏ chọn
                        </button>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-auto">
                    {!selectedSpaceId && spaces.length > 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                            <div className="text-center">
                                <CheckSquare size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">Chọn một Space hoặc List</p>
                                <p className="text-sm mt-1">để xem danh sách công việc</p>
                            </div>
                        </div>
                    ) : tasksLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : viewMode === 'board' ? (
                        <TaskBoard
                            tasks={tasks}
                            statuses={currentStatuses}
                            onUpdateTask={handleUpdateTask}
                            onSelectTask={setSelectedTaskId}
                            getPriorityInfo={getPriorityInfo}
                        />
                    ) : viewMode === 'calendar' ? (
                        <TaskCalendar
                            tasks={tasks}
                            statuses={currentStatuses}
                            onSelectTask={setSelectedTaskId}
                            onUpdateTask={handleUpdateTask}
                            getPriorityInfo={getPriorityInfo}
                        />
                    ) : viewMode === 'gantt' ? (
                        <TaskGantt
                            tasks={tasks}
                            statuses={currentStatuses}
                            onSelectTask={setSelectedTaskId}
                            onUpdateTask={handleUpdateTask}
                            getPriorityInfo={getPriorityInfo}
                        />
                    ) : viewMode === 'table' ? (
                        <TaskTable
                            tasks={tasks}
                            statuses={currentStatuses}
                            onSelectTask={setSelectedTaskId}
                            onUpdateTask={handleUpdateTask}
                            getPriorityInfo={getPriorityInfo}
                        />
                    ) : viewMode === 'timeline' ? (
                        <TaskTimeline
                            tasks={tasks}
                            onTaskClick={task => setSelectedTaskId(task.id)}
                        />
                    ) : viewMode === 'dashboard' ? (
                        <TaskDashboardWidgets tasks={tasks} />
                    ) : viewMode === 'automation' ? (
                        <div className="p-4">
                            <TaskAutomation spaceId={selectedSpaceId || ''} listId={selectedListId || undefined} />
                        </div>
                    ) : viewMode === 'workload' ? (
                        <TaskWorkload
                            tasks={tasks}
                            onTaskClick={task => setSelectedTaskId(task.id)}
                        />
                    ) : (
                        /* LIST VIEW */
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                                    <CheckSquare size={40} className="opacity-30 mb-3" />
                                    <p className="font-medium">Chưa có công việc nào</p>
                                    {selectedListId && (
                                        <button
                                            onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                                            className="mt-3 text-indigo-500 hover:text-indigo-600 text-sm font-medium flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Tạo công việc đầu tiên
                                        </button>
                                    )}
                                </div>
                            ) : (
                                tasks.map(task => (
                                    <div
                                        key={task.id}
                                        onClick={() => setSelectedTaskId(task.id)}
                                        className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${selectedTaskId === task.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <input
                                            type="checkbox"
                                            checked={selectedTasks.has(task.id)}
                                            onChange={e => { e.stopPropagation(); toggleSelectTask(task.id); }}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                        />

                                        {/* Status dot */}
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                const idx = currentStatuses.findIndex(s => s.id === task.status_id);
                                                const next = currentStatuses[(idx + 1) % currentStatuses.length];
                                                handleUpdateTask(task.id, { status_id: next.id });
                                            }}
                                            className="w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors cursor-pointer"
                                            style={{
                                                borderColor: getStatusInfo(task.status_id).color,
                                                backgroundColor: task.status_id === 'status_done' ? getStatusInfo(task.status_id).color : 'transparent'
                                            }}
                                            title={getStatusInfo(task.status_id).label}
                                        />

                                        {/* Title + Tags */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-medium truncate ${task.status_id === 'status_done'
                                                    ? 'text-slate-400 dark:text-slate-500 line-through'
                                                    : 'text-slate-800 dark:text-slate-200'
                                                    }`}>
                                                    {task.title}
                                                </span>
                                                {task.subtask_count && task.subtask_count > 0 && (
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                                                        <CheckSquare size={10} /> {task.completed_subtask_count || 0}/{task.subtask_count}
                                                    </span>
                                                )}
                                            </div>
                                            {(task.tags || []).length > 0 && (
                                                <div className="flex gap-1 mt-0.5">
                                                    {task.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Priority badge */}
                                        {task.priority && task.priority !== 'none' && (
                                            <span
                                                className="text-xs font-medium px-1.5 py-0.5 rounded"
                                                style={{
                                                    color: getPriorityInfo(task.priority).color,
                                                    backgroundColor: getPriorityInfo(task.priority).color + '15',
                                                }}
                                            >
                                                {getPriorityInfo(task.priority).label}
                                            </span>
                                        )}

                                        {/* Due date */}
                                        {task.due_date && (
                                            <span className={`text-xs flex items-center gap-1 ${task.due_date < new Date().toISOString().slice(0, 10) && task.status_id !== 'status_done'
                                                ? 'text-red-500 dark:text-red-400'
                                                : 'text-slate-500 dark:text-slate-400'
                                                }`}>
                                                <CalendarIcon size={12} />
                                                {formatDateShort(task.due_date)}
                                            </span>
                                        )}

                                        {/* Assignees */}
                                        {task.assignees && task.assignees.length > 0 && (
                                            <div className="flex -space-x-1">
                                                {task.assignees.slice(0, 3).map((_, i) => (
                                                    <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 dark:from-indigo-500 dark:to-purple-600 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                                                        <User size={10} className="text-white" />
                                                    </div>
                                                ))}
                                                {task.assignees.length > 3 && (
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] text-slate-600 dark:text-slate-400">
                                                        +{task.assignees.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}

                            {/* Pagination */}
                            {totalCount > limit && (
                                <div className="px-4 py-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                                    <span>Hiển thị {Math.min(tasks.length, limit)} / {totalCount} công việc</span>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={page <= 1}
                                            onClick={() => setPage(p => p - 1)}
                                            className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        >
                                            Trước
                                        </button>
                                        <button
                                            disabled={page * limit >= totalCount}
                                            onClick={() => setPage(p => p + 1)}
                                            className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        >
                                            Sau
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* ===== TASK DETAIL SLIDE-OVER ===== */}
            {selectedTaskId && (
                <TaskDetail
                    taskId={selectedTaskId}
                    statuses={currentStatuses}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onRefresh={loadTasks}
                />
            )}

            {/* ===== TASK FORM MODAL ===== */}
            {showTaskForm && (
                <TaskForm
                    task={editingTask || undefined}
                    listId={selectedListId || ''}
                    statuses={currentStatuses}
                    onSave={handleCreateTask}
                    onCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
                />
            )}
        </div>
    );
};

export default TaskListPage;
