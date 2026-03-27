import React, { useState } from 'react';
import { CheckSquare, Copy } from 'lucide-react';
import TasksPage from './TasksPage';
import { TaskTemplateModal } from './TaskTemplateModal';

interface EntityTaskListProps {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  className?: string;
}

const EntityTaskList: React.FC<EntityTaskListProps> = ({
  entityType,
  entityId,
  className = '',
}) => {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 relative flex flex-col ${className}`}>
      {/* Nút Nhúng: Áp dụng Mẫu Công việc (Đặt nổi góc phài) */}
      <div className="absolute right-4 top-4 z-10">
        <button
          onClick={() => setIsTemplateModalOpen(true)}
          className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm"
          title="Áp dụng mẫu công việc có sẵn"
        >
          <Copy size={13} /> Áp dụng Mẫu
        </button>
      </div>

      <div className="flex-1 min-h-[500px]">
        {/* Truyền refreshKey vào key để có thể ép load lại nếu áp dụng mẫu */}
        <TasksPage 
          key={refreshKey}
          isEmbedded={true} 
          sourceModule={entityType} 
          sourceEntityId={entityId} 
        />
      </div>

      {isTemplateModalOpen && (
         <TaskTemplateModal 
            isOpen={isTemplateModalOpen} 
            onClose={() => setIsTemplateModalOpen(false)} 
            entityType={entityType} 
            entityId={entityId} 
            onApplied={(count) => {
              if (count > 0) setRefreshKey(prev => prev + 1);
            }} 
         />
      )}
    </div>
  );
};

export default EntityTaskList;
