import React, { useState, useEffect } from 'react';
import { Users, Filter, Loader2, Mail, Phone, Building2, Briefcase } from 'lucide-react';
import { dataClient as supabase } from '../../lib/dataClient';
import { EmployeeService } from '../../services';
import { Employee } from '../../types';

interface ProjectTeamTabProps {
  projectId: string;
  projectName?: string;
}

const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({ projectId, projectName }) => {
  const [members, setMembers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState<string>('all'); // 'all', 'bim', 'bgd'

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        setLoading(true);
        // 1. Fetch all tasks for this project to get assignees
        const { data: tasks, error: taskError } = await supabase
          .from('tasks')
          .select('assignees')
          .eq('project_id', projectId);

        if (taskError) throw taskError;

        // 2. Extract unique employee IDs
        const memberIds = new Set<string>();
        tasks?.forEach((task) => {
          if (Array.isArray(task.assignees)) {
            task.assignees.forEach((id: string) => memberIds.add(id));
          }
        });

        if (memberIds.size === 0) {
          setMembers([]);
          return;
        }

        // 3. Fetch employee details
        const ids = Array.from(memberIds);
        const { data: employeesData, error: empError } = await supabase
          .from('employees')
          .select('*')
          .in('id', ids);

        if (empError) throw empError;

        // Map using EmployeeService mapping pattern if available, or just use raw data
        const mappedMembers = employeesData.map((emp) => ({
          id: emp.id,
          name: emp.name,
          email: emp.email || '',
          phone: emp.phone || '',
          position: emp.position || '',
          department: emp.department || '',
          unitId: emp.unit_id || '',
          avatar: emp.avatar || '',
        })) as Employee[];

        setMembers(mappedMembers);
      } catch (error) {
        console.error('Error fetching project team:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [projectId]);

  const filteredMembers = members.filter((m) => {
    if (filterUnit === 'all') return true;
    return m.unitId === filterUnit;
  });

  if (loading) {
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
            Danh sách nhân sự được nội suy từ những người được giao task trong dự án {projectName}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <Filter size={14} className="text-slate-400 ml-2" />
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="bg-transparent border-none text-sm font-semibold text-slate-700 dark:text-slate-300 focus:ring-0 py-1.5 pl-1 pr-6 cursor-pointer"
          >
            <option value="all">Tất cả đơn vị</option>
            <option value="bim">Trung tâm BIM</option>
            <option value="bgd">Ban Giám đốc</option>
          </select>
        </div>
      </div>

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
                  src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=6366f1&color=fff`}
                  alt={member.name}
                  className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 group-hover:ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 transition-all"
                />
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">{member.name}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <Briefcase size={12} />
                    <span>{member.position || 'Nhân viên'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-auto">
                {member.unitId && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Building2 size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{member.unitId === 'bim' ? 'Trung tâm BIM' : member.unitId === 'bgd' ? 'Ban Giám đốc' : member.unitId}</span>
                  </div>
                )}
                {member.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <a href={`mailto:${member.email}`} className="truncate hover:text-indigo-500 transition-colors">
                      {member.email}
                    </a>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <a href={`tel:${member.phone}`} className="hover:text-indigo-500 transition-colors">
                      {member.phone}
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
