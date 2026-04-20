import React, { useState, useEffect } from 'react';
import { Users, Filter, Loader2, Mail, Phone, Building2, Briefcase, Plus, Trash2, Shield } from 'lucide-react';
import { ProjectMemberService, EmployeeService } from '../../services';
import { UnitService } from '../../services/unitService';
import { Employee } from '../../types';
import Button from '../ui/Button';
import SearchableSelect from '../ui/SearchableSelect';
import { toast } from 'sonner';

interface ProjectTeamTabProps {
  projectId: string;
  projectName?: string;
}

const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({ projectId, projectName }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});

  // Add Member State
  const [isAdding, setIsAdding] = useState(false);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('Member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load units
  useEffect(() => {
    UnitService.getAll().then(units => {
      const map: Record<string, string> = {};
      units.forEach(u => { map[u.id] = u.name; });
      setUnitMap(map);
    }).catch(() => { });
  }, []);

  // Fetch Team
  const fetchTeam = async () => {
    try {
      setLoading(true);
      const data = await ProjectMemberService.getByProject(projectId);
      setMembers(data);
    } catch (error) {
      console.error('Error fetching project team:', error);
      toast.error('Lỗi khi tải danh sách thành viên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [projectId]);

  // Handle Add Member
  const fetchEmployeesForSelect = async () => {
    if (allEmployees.length > 0) return;
    try {
      const emps = await EmployeeService.getAll();

      const getPriority = (position: string = '', unitName: string = '') => {
        const sPos = position.toLowerCase();
        const sUnit = unitName.toLowerCase();

        if (sPos.includes('chủ tịch') || sPos.includes('giám đốc') || sPos.includes('gđ') || sPos.includes('tgđ') || sPos.includes('hđqt') || sUnit.includes('ban giám đốc')) return 1;
        if (sUnit.includes('bim') || sUnit.includes('b.i.m') || sPos.includes('bim')) return 2;
        return 3;
      };

      const sortedEmps = [...emps].sort((a, b) => {
        const priorityA = getPriority(a.position, unitMap[a.unitId || '']);
        const priorityB = getPriority(b.position, unitMap[b.unitId || '']);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.name.localeCompare(b.name);
      });

      const options = sortedEmps.map(e => ({
        id: e.id,
        name: e.name,
        subText: e.position || e.email || '',
      }));
      setAllEmployees(options);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleAddClick = () => {
    setIsAdding(true);
    fetchEmployeesForSelect();
  };

  const handleCreateMember = async () => {
    if (!selectedEmployeeId) {
      toast.error('Vui lòng chọn nhân sự');
      return;
    }
    try {
      setIsSubmitting(true);
      await ProjectMemberService.addMember(projectId, selectedEmployeeId, selectedRole);
      toast.success('Đã thêm thành viên mới');
      setIsAdding(false);
      setSelectedEmployeeId('');
      setSelectedRole('Member');
      fetchTeam();
    } catch (error: any) {
      console.error('Error adding member:', error);
      if (error?.code === '23505') {
        toast.error('Nhân sự này đã có trong dự án');
      } else {
        toast.error('Lỗi khi thêm thành viên');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${name} khỏi dự án?`)) return;
    try {
      await ProjectMemberService.removeMember(id);
      toast.success('Đã xóa thành viên');
      fetchTeam();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Lỗi khi xóa thành viên');
    }
  };

  const roles = [
    { value: 'Manager', label: 'Quản lý (Manager)' },
    { value: 'Member', label: 'Thành viên (Member)' },
    { value: 'Viewer', label: 'Người xem (Viewer)' },
  ];

  const filteredMembers = members.filter((m) => {
    if (filterUnit === 'all') return true;
    return m.employee?.unitId === filterUnit;
  });

  const unitOptions = Object.entries(unitMap);

  if (loading && members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p className="text-sm">Đang tải danh sách nhân sự...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users size={20} className="text-indigo-500" />
            Nhân sự dự án
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý những nhân sự trực tiếp tham gia dự án {projectName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <Filter size={14} className="text-slate-400 ml-2" />
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold text-slate-700 dark:text-slate-300 focus:ring-0 py-1.5 pl-1 pr-6 cursor-pointer"
            >
              <option value="all">Tất cả đơn vị</option>
              {unitOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          <Button variant="primary" onClick={handleAddClick} size="sm" className="whitespace-nowrap shrink-0" leftIcon={<Plus size={16} />}>
            Thêm nhân sự
          </Button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2.5 block">Thêm nhân sự mới</h3>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1">
              <SearchableSelect
                initialOptions={allEmployees}
                onSearch={async (q) => allEmployees.filter(e => e.name.toLowerCase().includes(q.toLowerCase()))}
                value={selectedEmployeeId}
                onChange={(val) => setSelectedEmployeeId(val as string)}
                placeholder="Tìm và chọn nhân sự..."
                size="sm"
              />
            </div>
            <div className="w-full md:w-44">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm focus:ring-indigo-500 py-2 px-3"
              >
                {roles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 min-w-max">
              <Button variant="primary" onClick={handleCreateMember} disabled={!selectedEmployeeId || isSubmitting} size="sm">
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Lưu'}
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)} size="sm">Hủy</Button>
            </div>
          </div>
        </div>
      )}

      {filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">Không có nhân sự</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filterUnit === 'all'
              ? "Dự án này hiện chưa có nhân sự nào được giao task."
              : "Không tìm thấy nhân viên nào thuộc đơn vị này trong danh sách."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <img
                  src={member.employee?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.employee?.name || '')}&background=6366f1&color=fff`}
                  alt={member.employee?.name}
                  className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 group-hover:ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 transition-all"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">{member.employee?.name}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <Briefcase size={12} />
                    <span>{member.employee?.position || 'Nhân viên'}</span>
                  </div>
                </div>

                {/* Role Badge & Actions */}
                <div className="flex flex-col items-end gap-2">
                  <div className={`flex items-center gap-1 px-2 py-1 border rounded-lg shrink-0 text-[11px] font-bold ${member.role === 'Manager' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800' :
                    member.role === 'Viewer' ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' :
                      'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800'
                    }`}>
                    {member.role === 'Manager' ? <Shield size={11} /> : <Users size={11} />}
                    <span>{roles.find(r => r.value === member.role)?.label.split(' (')[0] || member.role}</span>
                  </div>

                  <button
                    onClick={() => handleRemoveMember(member.id, member.employee?.name)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="Xóa khỏi dự án"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-auto">
                {member.employee?.unitId && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Building2 size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{unitMap[member.employee.unitId] || member.employee.unitId}</span>
                  </div>
                )}
                {member.employee?.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <a href={`mailto:${member.employee.email}`} className="truncate hover:text-indigo-500 transition-colors">
                      {member.employee.email}
                    </a>
                  </div>
                )}
                {member.employee?.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <a href={`tel:${member.employee.phone}`} className="hover:text-indigo-500 transition-colors">
                      {member.employee.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectTeamTab;
