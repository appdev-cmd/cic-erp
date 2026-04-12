import React from 'react';
import { Clock } from 'lucide-react';
import type { Task } from '../../../types/taskTypes';

interface TaskTimeTabProps {
  task: Task;
}

export const TaskTimeTab: React.FC<TaskTimeTabProps> = ({ task }) => {
  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-200 dark:border-slate-700">
        <Clock size={32} className="mx-auto text-indigo-500 mb-3" />
        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Theo dõi thời gian</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Tính năng theo dõi thời gian thực hiện công việc đang được phát triển.</p>
        
        <div className="inline-flex flex-col items-center p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Thời gian dự kiến</span>
          <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
            {task.start_date && task.due_date
              ? Math.max(0, Math.round((new Date(task.due_date).getTime() - new Date(task.start_date).getTime()) / 86400000))
              : '—'} báo cáo ngày
          </span>
        </div>
      </div>
    </div>
  );
};
