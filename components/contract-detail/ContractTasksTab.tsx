import React, { useState, useEffect } from 'react';
import { Contract } from '../../types';
import { ContractTaskDefinition, MilestoneBaseDateType, ContractTaskDefinitionService } from '../../services/contractTaskDefinitionService';
import EntityTaskList from '../tasks/EntityTaskList';
import { Clock, Play, CheckCircle2, AlertCircle, Plus, Edit3, Trash2, X } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { EmployeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import SearchableSelect from '../ui/SearchableSelect';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface ContractTasksTabProps {
  contract: Contract;
}

export default function ContractTasksTab({ contract }: ContractTasksTabProps) {
  const { profile } = useAuth();
  const [definitions, setDefinitions] = useState<ContractTaskDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSavingModal, setIsSavingModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(1);
  const [newTaskBaseDate, setNewTaskBaseDate] = useState<MilestoneBaseDateType>('signed_date');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Load employees for dropdown
  useEffect(() => {
    EmployeeService.getAll().then(setEmployees).catch(() => {});
  }, []);

  const handleEditClick = (def: ContractTaskDefinition) => {
    setEditingTaskId(def.id);
    setNewTaskTitle(def.title);
    setNewTaskDuration(def.duration_days);
    setNewTaskBaseDate(def.base_date_type);
    setNewTaskAssignee(def.assignees && def.assignees.length > 0 ? def.assignees[0] : null);
    setShowAddModal(true);
  };

  const handleAddNewClick = () => {
    setEditingTaskId(null);
    setNewTaskTitle('');
    setNewTaskDuration(1);
    setNewTaskBaseDate('signed_date');
    setNewTaskAssignee(null);
    setShowAddModal(true);
  };

  const handleSaveDormantTask = async () => {
    if (!newTaskTitle) return;
    setIsSavingModal(true);
    try {
      if (editingTaskId) {
        // Cập nhật kế hoạch
        await ContractTaskDefinitionService.update(editingTaskId, {
          title: newTaskTitle,
          duration_days: newTaskDuration,
          base_date_type: newTaskBaseDate,
          assignees: newTaskAssignee ? [newTaskAssignee] : [],
        });
        toast.success('Đã cập nhật kế hoạch công việc');
      } else {
        // Thêm mới
        await ContractTaskDefinitionService.create({
          contract_id: contract.id,
          title: newTaskTitle,
          duration_days: newTaskDuration,
          base_date_type: newTaskBaseDate,
          assignees: newTaskAssignee ? [newTaskAssignee] : [],
          origin: 'manual',
          created_by: profile?.id
        });
        toast.success('Đã thêm kế hoạch công việc mới');
      }
      
      setShowAddModal(false);
      
      // Reset form
      setEditingTaskId(null);
      setNewTaskTitle('');
      setNewTaskDuration(1);
      setNewTaskBaseDate('signed_date');
      setNewTaskAssignee(null);

      // Refresh list
      fetchDefinitions();
    } catch (err: any) {
      toast.error('Lỗi khi lưu: ' + err.message);
    } finally {
      setIsSavingModal(false);
    }
  };

  const fetchDefinitions = async () => {
    setLoading(true);
    try {
      const data = await ContractTaskDefinitionService.getByContract(contract.id);
      setDefinitions(data);
    } catch (error) {
      console.error('Failed to load task definitions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions();
    
    // Listen for updates (when tasks are activated or new ones added)
    const handleUpdate = () => fetchDefinitions();
    window.addEventListener('contract-tasks-updated', handleUpdate);
    return () => window.removeEventListener('contract-tasks-updated', handleUpdate);
  }, [contract.id]);

  // Timeline representation
  const milestones: { id: MilestoneBaseDateType; label: string; date?: string; isPast: boolean }[] = [
    { id: 'signed_date', label: 'Ký HĐ', date: contract.signedDate, isPast: !!contract.signedDate },
    // advance_completed is derived from financials normally, let's just use a loose check if advance exists
    { id: 'advance_completed', label: 'Tạm ứng', date: undefined, isPast: false }, // We don't have exact advance_completed in contract root, skip date
    { id: 'invoice_date', label: 'Xuất HĐ', date: undefined, isPast: false }, 
    { id: 'handover_date', label: 'Bàn giao', date: contract.handoverDate, isPast: !!contract.handoverDate },
    { id: 'acceptance_date', label: 'Nghiệm thu', date: contract.acceptanceDate, isPast: !!contract.acceptanceDate },
    { id: 'completed_date', label: 'Hoàn tất', date: contract.completedDate, isPast: !!contract.completedDate },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* 1. Milestone Timeline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-6">Tiến trình kích hoạt (Milestones)</h3>
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 dark:bg-slate-800 -z-10 rounded-full" />
          {milestones.map((m, i) => (
            <div key={m.id} className="flex flex-col items-center gap-2 bg-white dark:bg-slate-900 px-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                m.isPast 
                  ? 'bg-emerald-100 border-emerald-500 text-emerald-600 dark:bg-emerald-900/40 dark:border-emerald-400 dark:text-emerald-400' 
                  : 'bg-slate-50 border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
              }`}>
                {m.isPast ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              </div>
              <div className="text-center">
                <span className={`text-[11px] font-bold block ${m.isPast ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>{m.label}</span>
                {m.date && <span className="text-[10px] text-slate-500">{formatDate(m.date)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Kế hoạch công việc chờ (Dormant Tasks) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Kế hoạch chờ (Dormant)</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">{definitions.filter(d => d.status === 'dormant').length}</span>
          </div>
          {/* Note: UI logic for Add new Dormant task could go here */}
          <button 
            onClick={handleAddNewClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-lg transition-colors"
          >
            <Plus size={14} /> Thêm kế hoạch
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        ) : definitions.filter(d => d.status === 'dormant').length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <CheckCircle2 size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Không có kế hoạch công việc nào đang chờ.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {definitions.filter(d => d.status === 'dormant').map(def => (
              <div key={def.id} className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors bg-slate-50/50 dark:bg-slate-800 group">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{def.title}</h4>
                  {def.description && (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line line-clamp-3">
                      {def.description}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock size={12} /> {def.duration_days} ngày</span>
                    <span className="flex items-center gap-1">
                      <Play size={12} className="text-amber-500 text-fill-amber" /> 
                      Kích hoạt khi: <b className="text-amber-700 dark:text-amber-400">{milestones.find(m => m.id === def.base_date_type)?.label || def.base_date_type}</b>
                    </span>
                    {/* assignees preview */}
                    {def.assignees && def.assignees.length > 0 && (
                      <span className="flex items-center gap-1 text-slate-400">
                         — {def.assignees.length} người thực hiện
                      </span>
                    )}
                  </div>
                </div>
                {/* Actions context maybe */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity shrink-0 ml-3">
                   <button 
                     onClick={() => handleEditClick(def)}
                     className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                     title="Sửa"
                   >
                      <Edit3 size={14} />
                   </button>
                   <button 
                      onClick={async () => {
                        if (confirm('Bạn có chắc muốn bỏ qua công việc kế hoạch này?')) {
                          await ContractTaskDefinitionService.skip(def.id);
                          fetchDefinitions();
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                      title="Bỏ qua (Skip)"
                    >
                      <Trash2 size={14} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Công việc thực tế (EntityTaskList) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-6">Công việc đang thực hiện</h3>
        <EntityTaskList
          entityType="contract"
          entityId={contract.id}
          className="bg-transparent dark:bg-transparent border-0 rounded-none p-0"
        />
      </div>

      {/* Add/Edit Dormant Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingTaskId ? 'Sửa kế hoạch công việc' : 'Thêm kế hoạch công việc mới'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTaskId(null);
                }} 
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tên công việc <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Nhập tên..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Người thực hiện</label>
                  <SearchableSelect
                    value={newTaskAssignee}
                    onChange={(id) => setNewTaskAssignee(id)}
                    initialOptions={employees.map(emp => ({
                      id: emp.id,
                      name: emp.name
                    }))}
                    onSearch={async (q) => {
                      const lower = q.toLowerCase();
                      return employees
                        .filter(e => e.name.toLowerCase().includes(lower))
                        .map(emp => ({
                          id: emp.id,
                          name: emp.name
                        }));
                    }}
                    placeholder="-- Chưa gắn ai --"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Số ngày HT</label>
                  <input
                    type="number"
                    min="0"
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kích hoạt khi (Mốc)</label>
                <select
                  value={newTaskBaseDate}
                  onChange={(e) => setNewTaskBaseDate(e.target.value as MilestoneBaseDateType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="signed_date">Ký hợp đồng</option>
                  <option value="advance_completed">Xong thủ tục TƯ</option>
                  <option value="handover_date">Bàn giao</option>
                  <option value="acceptance_date">Nghiệm thu</option>
                  <option value="invoice_date">Xuất hoá đơn</option>
                  <option value="completed_date">Hoàn thành HĐ</option>
                  <option value="current_date">Ngay lập tức</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTaskId(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveDormantTask}
                disabled={!newTaskTitle || isSavingModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingModal ? 'Đang lưu...' : (editingTaskId ? 'Cập nhật' : 'Lưu kế hoạch')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
