import React, { useState } from 'react';
import { CheckSquare, Copy, Plus } from 'lucide-react';
import TasksPage from './TasksPage';
import { TaskTemplateModal } from './TaskTemplateModal';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import CreateTaskPanel from './CreateTaskPanel';
import { useTaskVisibility } from '../../hooks/useTaskVisibility';

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
  const { openPanel, closePanel } = useSlidePanel();
  const { visibilityContext } = useTaskVisibility();

  const handleAddTaskClick = () => {
    openPanel({
      title: 'Thêm công việc',
      component: <CreateTaskPanel
        currentUserId={visibilityContext.userId}
        initialData={{ source_module: entityType, source_entity_id: entityId }}
        onTaskCreated={() => {
          setRefreshKey(prev => prev + 1);
          closePanel();
        }}
        onClose={() => closePanel()}
      />
    });
  };

  return (
    <div className={`bg-white dark:bg-slate-800 relative flex flex-col h-full overflow-hidden ${className}`}>
      {/* Header riêng khôi phục lại */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" />
          Quản lý công việc
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm"
            title="Áp dụng mẫu công việc có sẵn"
          >
            <Copy size={13} /> Áp dụng Mẫu
          </button>
          <button
            onClick={handleAddTaskClick}
            className="text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg shadow-sm"
          >
            <Plus size={14} /> Thêm việc
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
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
