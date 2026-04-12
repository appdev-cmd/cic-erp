import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TaskTimeTab } from '../../../../components/tasks/task-detail/TaskTimeTab';

describe('TaskTimeTab component', () => {
    it('renders placeholder correctly', () => {
        const mockTask = { id: 'T1' } as any;
        render(<TaskTimeTab task={mockTask} />);
        expect(screen.getByText('Theo dõi thời gian')).toBeInTheDocument();
        expect(screen.getByText('— báo cáo ngày')).toBeInTheDocument();
    });

    it('calculates duration correctly when both start and due dates exist', () => {
        const mockTask = { 
            id: 'T1',
            start_date: '2026-04-01',
            due_date: '2026-04-03' 
        } as any;
        render(<TaskTimeTab task={mockTask} />);
        expect(screen.getByText(/2 báo cáo ngày/i)).toBeInTheDocument();
    });
});
