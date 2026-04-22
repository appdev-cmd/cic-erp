import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Filter, Loader2, Mail, Phone, Building2, Briefcase,
  CheckSquare, UserPlus, X, Search, Trash2, Crown, Eye,
} from 'lucide-react';
import { dataClient as supabase } from '../../lib/dataClient';
import { UnitService } from '../../services/unitService';
import { toast } from 'sonner';

interface ProjectTeamTabProps {
  projectId: string;
  projectName?: string;
}

interface MemberRow {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  unitId?: string;
  avatar?: string;
  source: 'direct' | 'task'; // direct = thêm tay, task = qua assignee
  role?: string;
  taskCount: number;
}

// ── Role labels
const ROLE_LABELS: Record<string, string> = {
  lead: 'Trưởng nhóm',
  member: 'Thành viên',
  observer: 'Quan sát viên',
};
const ROLE_COLORS: Record<string, string> = {
  lead: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  member: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800',
  observer: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

// ── Add Member Modal
interface AddMemberModalProps {
  projectId: string;
  existingIds: string[];
  onClose: () => void;
  onAdded: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ projectId, existingIds, onClose, onAdded }) => {
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, name, email, position, unit_id, avatar')
      .order('name')
      .then(({ data }) => {
        setAllEmployees(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return allEmployees.filter(e =>
      !existingIds.includes(e.id) &&
      (e.name?.toLowerCase().includes(term) || e.email?.toLowerCase().includes(term) || e.position?.toLowerCase().includes(term))
    );
  }, [allEmployees, existingIds, search]);

  const handleAdd = async (emp: any) => {
    setAdding(emp.id);
    try {
      const { error } = await supabase.from('project_members').insert({
        project_id: projectId,
        employee_id: emp.id,
        role: selectedRole[emp.id] || 'member',
      });
      if (error) throw error;
      toast.success(`Đã thêm ${emp.name} vào dự án!`);
      onAdded();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserPlus size={18} className="text-indigo-500" />
              Thêm thành viên
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Chọn nhân sự để thêm vào dự án</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên, email, chức danh..."
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {search ? 'Không tìm thấy nhân sự phù hợp' : 'Tất cả nhân sự đã được thêm'}
            </div>
          ) : (
            filtered.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                <img
                  src={emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=6366f1&color=fff&size=40`}
                  alt={emp.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{emp.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{emp.position || emp.email}</p>
                </div>
                <select
                  value={selectedRole[emp.id] || 'member'}
                  onChange={e => setSelectedRole(prev => ({ ...prev, [emp.id]: e.target.value }))}
                  onClick={e => e.stopPropagation()}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 outline-none"
                >
                  <option value="member">Thành viên</option>
                  <option value="lead">Trưởng nhóm</option>
                  <option value="observer">Quan sát viên</option>
                </select>
                <button
                  onClick={() => handleAdd(emp)}
                  disabled={adding === emp.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-all shrink-0"
                >
                  {adding === emp.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                  Thêm
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Component
const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({ projectId, projectName }) => {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Load units for filter
  useEffect(() => {
    UnitService.getAll().then(units => {
      const map: Record<string, string> = {};
      units.forEach(u => { map[u.id] = u.name; });
      setUnitMap(map);
    }).catch(() => {});
  }, []);

  const loadTeam = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Load direct members từ project_members
      const { data: directRows } = await supabase
        .from('project_members')
        .select('employee_id, role, employees(id, name, email, phone, position, unit_id, avatar)')
        .eq('project_id', projectId);

      // 2. Load task assignees + task count
      const { data: tasks } = await supabase
        .from('tasks')
        .select('assignees')
        .eq('project_id', projectId);

      const taskCountMap: Record<string, number> = {};
      const taskMemberIds = new Set<string>();
      tasks?.forEach(t => {
        if (Array.isArray(t.assignees)) {
          t.assignees.forEach((id: string) => {
            taskMemberIds.add(id);
            taskCountMap[id] = (taskCountMap[id] || 0) + 1;
          });
        }
      });

      // 3. Merge: direct members (có role) + task members (không có trong direct)
      const directIds = new Set<string>();
      const result: MemberRow[] = [];

      (directRows || []).forEach((row: any) => {
        const emp = row.employees;
        if (!emp) return;
        directIds.add(emp.id);
        result.push({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          position: emp.position,
          unitId: emp.unit_id,
          avatar: emp.avatar,
          source: 'direct',
          role: row.role || 'member',
          taskCount: taskCountMap[emp.id] || 0,
        });
      });

      // Task-only members (không có trong direct)
      const taskOnlyIds = Array.from(taskMemberIds).filter(id => !directIds.has(id));
      if (taskOnlyIds.length > 0) {
        const { data: taskEmps } = await supabase
          .from('employees')
          .select('id, name, email, phone, position, unit_id, avatar')
          .in('id', taskOnlyIds);

        (taskEmps || []).forEach((emp: any) => {
          result.push({
            id: emp.id,
            name: emp.name,
            email: emp.email,
            phone: emp.phone,
            position: emp.position,
            unitId: emp.unit_id,
            avatar: emp.avatar,
            source: 'task',
            taskCount: taskCountMap[emp.id] || 0,
          });
        });
      }

      // Sort: direct trước, task sau; trong mỗi nhóm sort theo tên
      result.sort((a, b) => {
        if (a.source !== b.source) return a.source === 'direct' ? -1 : 1;
        return a.name.localeCompare(b.name, 'vi');
      });

      setMembers(result);
    } catch (err) {
      console.error('Error loading project team:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  // Remove direct member
  const handleRemove = async (member: MemberRow) => {
    if (member.source !== 'direct') return;
    setRemovingId(member.id);
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('employee_id', member.id);
      if (error) throw error;
      toast.success(`Đã xóa ${member.name} khỏi dự án!`);
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (err: any) {
      toast.error('Lỗi xóa thành viên: ' + (err.message || err));
    } finally {
      setRemovingId(null);
    }
  };

  // Filtered members
  const filtered = useMemo(() =>
    filterUnit === 'all' ? members : members.filter(m => m.unitId === filterUnit),
    [members, filterUnit]
  );

  // Unique units in team
  const units = useMemo(() => {
    const ids = [...new Set(members.map(m => m.unitId).filter(Boolean))];
    return ids.map(id => ({ id: id!, name: unitMap[id!] || id! }));
  }, [members, unitMap]);

  const existingIds = useMemo(() => members.map(m => m.id), [members]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
            <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100">Nhân sự dự án</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {members.length} thành viên • {members.filter(m => m.source === 'direct').length} thêm trực tiếp
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Unit filter */}
          {units.length > 0 && (
            <div className="relative">
              <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filterUnit}
                onChange={e => setFilterUnit(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tất cả đơn vị</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Add button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm hover:shadow-md hover:shadow-indigo-200 dark:hover:shadow-none active:scale-95"
          >
            <UserPlus size={15} />
            Thêm thành viên
          </button>
        </div>
      </div>

      {/* Members grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Users size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-semibold">
            {filterUnit !== 'all' ? 'Không có thành viên từ đơn vị này' : 'Chưa có thành viên'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {filterUnit !== 'all' ? 'Thử chọn đơn vị khác' : 'Nhấn "Thêm thành viên" để bắt đầu'}
          </p>
          {filterUnit === 'all' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
            >
              <UserPlus size={14} />
              Thêm thành viên đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(member => (
            <div
              key={member.id}
              className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-lg dark:hover:shadow-slate-800/40 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200"
            >
              {/* Source badge + remove button */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {member.source === 'task' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-0.5">
                    <CheckSquare size={9} />
                    Task
                  </span>
                )}
                {member.source === 'direct' && (
                  <button
                    onClick={() => handleRemove(member)}
                    disabled={removingId === member.id}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                    title="Xóa khỏi dự án"
                  >
                    {removingId === member.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                  </button>
                )}
              </div>

              {/* Avatar + Name */}
              <div className="flex items-center gap-3 mb-3">
                <div className="relative shrink-0">
                  <img
                    src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=6366f1&color=fff&size=48`}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                  />
                  {member.role === 'lead' && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                      <Crown size={10} className="text-white" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 dark:text-slate-200 text-sm truncate">{member.name}</h4>
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <Briefcase size={11} />
                    <span className="truncate">{member.position || 'Nhân viên'}</span>
                  </div>
                </div>
              </div>

              {/* Role badge + task count */}
              <div className="flex items-center gap-2 mb-3">
                {member.role && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[member.role] || ROLE_COLORS.member}`}>
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                )}
                {member.taskCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-full">
                    <CheckSquare size={10} />
                    {member.taskCount} task
                  </span>
                )}
              </div>

              {/* Contact */}
              <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    <Mail size={12} className="shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </a>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Phone size={12} className="shrink-0" />
                    <span>{member.phone}</span>
                  </div>
                )}
                {member.unitId && unitMap[member.unitId] && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Building2 size={12} className="shrink-0" />
                    <span className="truncate">{unitMap[member.unitId]}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <AddMemberModal
          projectId={projectId}
          existingIds={existingIds}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            loadTeam();
          }}
        />
      )}
    </div>
  );
};

export default ProjectTeamTab;
