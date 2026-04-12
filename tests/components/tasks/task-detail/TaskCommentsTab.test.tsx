import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskCommentsTab } from '../../../../components/tasks/task-detail/TaskCommentsTab';

// Mock the DiscussionBox since it's an external component that relies on Supabase and Auth Context
vi.mock('../../../../components/ui/DiscussionBox', () => ({
    default: ({ entityId }: { entityId: string }) => <div data-testid="discussion-box">Discussion Box {entityId}</div>
}));

describe('TaskCommentsTab component', () => {
    it('renders the DiscussionBox correctly with the provided taskId', () => {
        const { getByTestId } = render(<TaskCommentsTab taskId="TASK-123" />);
        expect(getByTestId('discussion-box')).toHaveTextContent('Discussion Box TASK-123');
    });
});
