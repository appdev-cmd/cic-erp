import React, { useState, useEffect } from 'react';
import { Plus, GripVertical, CheckCircle2, Play, CornerDownRight } from 'lucide-react';
import { TaskService } from '../../../services/taskService';
import type { Task } from '../../../types/taskTypes';
import { formatDateShort } from '../../../utils/formatters';

interface TaskSubtasksTabProps {
  parentTask: Task;
  onSelectTask?: (id: string) => void;
}

export const TaskSubtasksTab: React.FC<TaskSubtasksTabProps> = ({ parentTask, onSelectTask }) => {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSubtasks();
  }, [parentTask.id]);

  const loadSubtasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getSubtasks(parentTask.id);
      setSubtasks(data);
    } catch (error) {
      console.error('Failed to load subtasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubtask = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      const newTask = await TaskService.create({
        title: newTitle.trim(),
        parent_id: parentTask.id,
        project_id: parentTask.project_id,
        space_id: parentTask.space_id,
        // Nạp thêm các thuộc tính khác mặc định cho subtask
        priority: 'none',
        start_date: new Date().toISOString().split('T')[0], // mặc định hôm nay
        tags: [],
        assignees: parentTask.assignees?.length ? [...parentTask.assignees] : [],
      });
      setSubtasks(prev => [...prev, newTask]);
      setNewTitle('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to create subtask:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSubtaskComplete = async (e: React.MouseEvent, subtask: Task) => {
    e.stopPropagation();
    try {
      const tempTask = { ...subtask, status_id: undefined }; // optimistic update UI can be done here if we had statuses
      // Dùng hàm complete của TaskService
      // Chúng ta sẽ cần userId để complete, nhưng ta có thể không có ở đây
      // Thay vào đó update trực tiếp is_done nếu cần, 
      // Tuy nhiên đây chỉ là toggle status, để đơn giản ta gọi một function external hoặc update qua TaskService
      // Rất tiếc không có hàm toggle hoàn chỉnh không cần userId ở local này. Ta sẽ skip việc toggle inline cho an toàn.
      // Tuy nhiên user có thể bấm vào detail của subtask để đổi trạng thái.
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <CornerDownRight size={16} className="text-indigo-500" />
          Danh sách công việc con ({subtasks.length})
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
        >
          <Plus size={14} /> Thêm việc con
        </button>
      </div>

      <div className="overflow-y-auto flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Đang tải...</div>
        ) : subtasks.length === 0 && !showAddForm ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 italic">
            Chưa có công việc con nào.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {subtasks.map(task => (
              <div 
                key={task.id} 
                onClick={() => onSelectTask?.(task.id)}
                className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
              >
                <GripVertical size={14} className="text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100" />
                
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${task.completed_at ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                    {task.due_date && <span>Hạn: {formatDateShort(task.due_date)}</span>}
                    {task.tags?.length > 0 && <span>• {task.tags.length} tags</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                      <Play size={14} />
                   </button>
                </div>
              </div>
            ))}
            
            {showAddForm && (
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border-t border-slate-100 dark:border-slate-800/50">
                <input
                  type="text"
                  autoFocus
                  placeholder="Nhập tên việc con và Enter..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateSubtask();
                    if (e.key === 'Escape') setShowAddForm(false);
                  }}
                  disabled={submitting}
                  className="w-full text-sm px-3 py-2 rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex justify-end gap-2 mt-2">
                   <button onClick={() => setShowAddForm(false)} className="text-xs font-semibold px-2 py-1 text-slate-500 cursor-pointer">Hủy</button>
                   <button onClick={handleCreateSubtask} disabled={submitting || !newTitle.trim()} className="text-xs font-semibold px-3 py-1 bg-indigo-600 text-white rounded cursor-pointer hover:bg-indigo-700">Lưu</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
