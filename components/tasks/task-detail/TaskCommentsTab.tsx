import React from 'react';
import { default as DiscussionBox } from '../../ui/DiscussionBox';

interface TaskCommentsTabProps {
  taskId: string;
}

export const TaskCommentsTab: React.FC<TaskCommentsTabProps> = ({ taskId }) => {
  return (
    <DiscussionBox
      entityType="task"
      entityId={taskId}
      className="border-0 rounded-none h-full"
      maxHeight="100%"
      showHeader={false}
    />
  );
};
