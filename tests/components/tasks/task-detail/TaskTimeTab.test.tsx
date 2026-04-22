import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskTimeTab } from '../../../../components/tasks/task-detail/TaskTimeTab';

const mockGetEntries = vi.fn();
const mockSumMinutes = vi.fn();
const mockFormatDuration = vi.fn();
const mockFormatSeconds = vi.fn();

vi.mock('../../../../services/taskTimeService', () => ({
    TaskTimeService: {
        getEntries: (...args: any[]) => mockGetEntries(...args),
        startTimer: vi.fn(),
        stopTimer: vi.fn(),
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
        deleteEntry: vi.fn(),
        sumMinutes: (...args: any[]) => mockSumMinutes(...args),
        formatDuration: (...args: any[]) => mockFormatDuration(...args),
        formatSeconds: (...args: any[]) => mockFormatSeconds(...args),
    },
}));

describe('TaskTimeTab component', () => {
    beforeEach(() => {
        mockGetEntries.mockReset();
        mockSumMinutes.mockReset();
        mockFormatDuration.mockReset();
        mockFormatSeconds.mockReset();

        mockGetEntries.mockResolvedValue([]);
        mockSumMinutes.mockReturnValue(0);
        mockFormatDuration.mockImplementation((minutes: number) => `${minutes} phút`);
        mockFormatSeconds.mockReturnValue('0:00');
    });

    it('renders loaded empty state correctly', async () => {
        const mockTask = { id: 'T1' } as any;

        render(<TaskTimeTab task={mockTask} currentUserId="U1" />);

        expect(await screen.findByText('Theo dõi thời gian')).toBeInTheDocument();
        expect(screen.getByText('Chưa có log thời gian nào')).toBeInTheDocument();
        expect(mockGetEntries).toHaveBeenCalledWith('T1');
    });

    it('renders logged duration and estimate after loading', async () => {
        mockGetEntries.mockResolvedValue([
            {
                id: 'E1',
                task_id: 'T1',
                user_id: 'U1',
                started_at: '2026-04-01T08:00:00.000Z',
                ended_at: '2026-04-01T10:00:00.000Z',
                duration_minutes: 120,
                description: null,
                is_running: false,
                created_at: '2026-04-01T10:00:00.000Z',
                updated_at: '2026-04-01T10:00:00.000Z',
            },
        ]);
        mockSumMinutes.mockReturnValue(120);
        mockFormatDuration.mockImplementation((minutes: number) => {
            if (minutes === 120) return '2h';
            return `${minutes} phút`;
        });

        const mockTask = {
            id: 'T1',
            time_estimate: 2,
        } as any;

        render(<TaskTimeTab task={mockTask} currentUserId="U1" />);

        const durationLabels = await screen.findAllByText('2h');
        expect(durationLabels).toHaveLength(3);
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('Lịch sử')).toBeInTheDocument();
    });
});
