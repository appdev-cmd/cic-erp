import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Trash2, Calendar, User, Search, UserCircle2 } from 'lucide-react';
import { TaskTemplateService } from '../../services/taskTemplateService';
import { EmployeeService } from '../../services';
import type { TaskTemplate } from '../../services/taskTemplateService';
import type { Employee } from '../../types';
import DateInput from '../ui/DateInput';
import { CreateTaskInput } from '../../types/taskTypes';

interface ContractFormStep4Props {
  selectedTaskTemplateId: string | null;
  setSelectedTaskTemplateId: (id: string | null) => void;
  customTasks: Partial<CreateTaskInput>[];
  setCustomTasks: React.Dispatch<React.SetStateAction<Partial<CreateTaskInput>[]>>;
}

export const ContractFormStep4: React.FC<ContractFormStep4Props> = ({
  selectedTaskTemplateId, setSelectedTaskTemplateId,
  customTasks, setCustomTasks
}) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true);
        const [templatesData, employeesData] = await Promise.all([
          TaskTemplateService.getByEntityType('contract'),
          EmployeeService.getAll()
        ]);
        setTemplates(templatesData);
        setEmployees(employeesData);
      } catch (error) {
        console.error("Failed to load options for tasks step:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOptions();
  }, []);

  const handleAddCustomTask = () => {
    setCustomTasks(prev => [...prev, {
      title: '',
      description: '',
      assignees: [],
    }]);
  };

  const handleRemoveCustomTask = (index: number) => {
    setCustomTasks(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomTask = (index: number, field: keyof CreateTaskInput, value: any) => {
    setCustomTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Briefcase size={16} className="text-indigo-500" />
          Quy trình mẫu (Áp dụng tự động)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Chọn Mẫu quy trình (Tuỳ chọn)
            </label>
            <div className="relative">
              <select
                value={selectedTaskTemplateId || ''}
                onChange={(e) => setSelectedTaskTemplateId(e.target.value || null)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-sm text-slate-800 dark:text-slate-200 appearance-none disabled:opacity-50"
                disabled={loading}
              >
                <option value="">-- Không áp dụng quy trình mẫu --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({Array.isArray(t.tasks_json) ? t.tasks_json.length : 0} công việc)</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              Hệ thống sẽ tự động gán các công việc, theo dõi tiến độ và thời hạn dựa trên mẫu này sau khi lưu hợp đồng.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <Plus size={16} className="text-emerald-500" />
            Giao việc thủ công
          </h3>
          <button
            type="button"
            onClick={handleAddCustomTask}
            className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-2"
          >
            <Plus size={14} /> Thêm việc
          </button>
        </div>

        {customTasks.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <UserCircle2 size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Chưa có công việc phụ nào được thêm</p>
          </div>
        ) : (
          <div className="space-y-4">
            {customTasks.map((task, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 items-start">
                <div className="md:col-span-5 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tên công việc <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => updateCustomTask(index, 'title', e.target.value)}
                    placeholder="Nhập tên..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                  />
                </div>
                
                <div className="md:col-span-3 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Người thực hiện</label>
                  <select
                    value={task.assignees?.[0] || ''}
                    onChange={(e) => updateCustomTask(index, 'assignees', e.target.value ? [e.target.value] : [])}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Chưa gắn ai --</option>
                    {employees.map(emp => (
                      <option key={(emp as any).profile_id || emp.id} value={(emp as any).profile_id || emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Hạn chót</label>
                  <div className="relative">
                    <DateInput
                      value={task.due_date ? task.due_date.split('T')[0] : ''}
                      onChange={(val) => updateCustomTask(index, 'due_date', val ? `${val}T23:59:59` : undefined)}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                    />
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="md:col-span-1 flex items-center justify-end h-full pt-6">
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomTask(index)}
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
