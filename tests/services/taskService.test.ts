import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '../../services/taskService';
import { dataClient } from '../../lib/dataClient';

// Mock dependencies
vi.mock('../../lib/dataClient', () => ({
    dataClient: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('../../services/discussionService', () => ({
    DiscussionService: { add: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../services/telegramNotificationService', () => ({
    TelegramNotificationService: { notifyTaskChange: vi.fn() },
}));

// ─── Shared mock data ────────────────────────────────────────────────────────
const mockStatus = {
    id: 'status-1',
    name: 'Todo',
    color: '#6b7280',
    sort_order: 1,
    is_default: true,
    is_done: false,
    space_id: null,
};

const mockDoneStatus = {
    id: 'status-done',
    name: 'Hoàn thành',
    color: '#22c55e',
    sort_order: 5,
    is_default: false,
    is_done: true,
    space_id: null,
};

const mockTaskRow = {
    id: 'task-1',
    title: 'Công việc thử nghiệm',
    description: 'Mô tả',
    status_id: 'status-1',
    status: mockStatus,
    priority: 'Medium',
    assignees: ['emp-1'],
    watchers: [],
    supporters: [],
    approvers: [],
    tags: [],
    custom_fields: {},
    auto_generated: false,
    is_private: false,
    is_pinned: false,
    time_spent: 0,
    sort_order: 0,
    due_date: '2026-12-31',
    created_by: 'emp-2',
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-01-15T09:00:00Z',
    source_module: 'contracts',
    source_entity_id: 'contract-1',
    approval_status: null,
    approval_parent_id: null,
    approval_mode: 'all',
    approval_comment: null,
    project_id: null,
    parent_id: null,
    space_id: null,
};

// ─── Mock builder ────────────────────────────────────────────────────────────
const buildChain = (data: any, error: any = null) => {
    const chain: any = Object.assign(Promise.resolve({ data, error }), {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
            data: Array.isArray(data) ? (data[0] ?? null) : data,
            error,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
            data: Array.isArray(data) ? (data[0] ?? null) : data,
            error,
        }),
    });

    ['select','eq','neq','or','is','in','not','ilike','order',
     'insert','update'].forEach(k => {
        chain[k].mockReturnValue(chain);
    });

    chain.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error }),
        in: vi.fn().mockResolvedValue({ error }),
    });

    return chain;
};

const setupMock = (data: any, error: any = null) => {
    (dataClient.from as any).mockReturnValue(buildChain(data, error));
};

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('TaskService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── getStatuses ──────────────────────────────────────────────────────────
    describe('getStatuses', () => {
        it('returns list of statuses', async () => {
            setupMock([mockStatus, mockDoneStatus]);
            const result = await TaskService.getStatuses();
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Todo');
        });

        it('returns empty array when no statuses', async () => {
            setupMock([]);
            const result = await TaskService.getStatuses();
            expect(result).toHaveLength(0);
        });

        it('throws on DB error', async () => {
            setupMock(null, { message: 'DB error', code: '500' });
            await expect(TaskService.getStatuses()).rejects.toThrow();
        });

        it('filters by spaceId when provided', async () => {
            setupMock([mockStatus]);
            await TaskService.getStatuses('space-1');
            // Verify the query was made to task_statuses
            expect(dataClient.from).toHaveBeenCalledWith('task_statuses');
        });
    });

    // ── getDefaultStatusId ───────────────────────────────────────────────────
    describe('getDefaultStatusId', () => {
        it('returns the default status id', async () => {
            setupMock({ id: 'status-1' });
            const result = await TaskService.getDefaultStatusId();
            expect(result).toBe('status-1');
        });

        it('returns null when no default status found', async () => {
            setupMock(null, { code: 'PGRST116', message: 'Not found' });
            const result = await TaskService.getDefaultStatusId();
            expect(result).toBeNull();
        });

        it('returns null on DB error (graceful)', async () => {
            setupMock(null, { message: 'error', code: '500' });
            const result = await TaskService.getDefaultStatusId();
            expect(result).toBeNull();
        });
    });

    // ── create ───────────────────────────────────────────────────────────────
    describe('create', () => {
        it('creates a task and returns it mapped', async () => {
            // First call: getDefaultStatusId → returns status-1
            // Second call: insert → returns mockTaskRow
            (dataClient.from as any)
                .mockReturnValueOnce(buildChain({ id: 'status-1' }))  // getDefaultStatusId
                .mockReturnValueOnce(buildChain(mockTaskRow))           // insert
                .mockReturnValue(buildChain(null));                      // DiscussionService / employee lookups

            const result = await TaskService.create({
                title: 'Công việc thử nghiệm',
                assignees: [],
            } as any);

            expect(result.id).toBe('task-1');
            expect(result.title).toBe('Công việc thử nghiệm');
        });

        it('auto-sets status_id when not provided', async () => {
            (dataClient.from as any)
                .mockReturnValueOnce(buildChain({ id: 'status-default' }))
                .mockReturnValueOnce(buildChain({ ...mockTaskRow, status_id: 'status-default' }))
                .mockReturnValue(buildChain(null));

            const input: any = { title: 'Test' };
            delete input.status_id;

            const result = await TaskService.create(input);
            expect(result).toBeDefined();
        });

        it('keeps provided status_id without overriding', async () => {
            // When status_id is provided, getDefaultStatusId should NOT be called
            (dataClient.from as any)
                .mockReturnValueOnce(buildChain(mockTaskRow))  // insert (no getDefaultStatusId call)
                .mockReturnValue(buildChain(null));

            const result = await TaskService.create({
                title: 'Test',
                status_id: 'status-custom',
                assignees: [],
            } as any);

            expect(result).toBeDefined();
        });

        it('throws on DB error', async () => {
            (dataClient.from as any)
                .mockReturnValueOnce(buildChain({ id: 'status-1' })) // getDefaultStatusId
                .mockReturnValue(buildChain(null, { message: 'Insert failed', code: '500' }));

            await expect(TaskService.create({ title: 'Test' } as any)).rejects.toThrow();
        });
    });

    // ── getById ──────────────────────────────────────────────────────────────
    describe('getById', () => {
        it('returns mapped task when found', async () => {
            setupMock(mockTaskRow);
            const result = await TaskService.getById('task-1');
            expect(result).not.toBeNull();
            expect(result!.id).toBe('task-1');
            expect(result!.title).toBe('Công việc thử nghiệm');
        });

        it('returns null when not found (PGRST116)', async () => {
            setupMock(null, { code: 'PGRST116', message: 'Not found' });
            const result = await TaskService.getById('non-existent');
            expect(result).toBeNull();
        });

        it('throws on unexpected DB errors', async () => {
            setupMock(null, { code: '500', message: 'Internal error' });
            await expect(TaskService.getById('task-1')).rejects.toThrow();
        });

        it('maps default values for missing fields', async () => {
            const minimalRow = { id: 'task-min', title: 'Min', status: null };
            setupMock(minimalRow);
            const result = await TaskService.getById('task-min');
            expect(result!.assignees).toEqual([]);
            expect(result!.tags).toEqual([]);
            expect(result!.time_spent).toBe(0);
            expect(result!.auto_generated).toBe(false);
        });
    });

    // ── update ───────────────────────────────────────────────────────────────
    describe('update', () => {
        it('updates and returns the mapped task', async () => {
            const updatedRow = { ...mockTaskRow, title: 'Tiêu đề mới', priority: 'High' };
            setupMock(updatedRow);
            const result = await TaskService.update('task-1', { title: 'Tiêu đề mới', priority: 'High' });
            expect(result.title).toBe('Tiêu đề mới');
            expect(result.priority).toBe('High');
        });

        it('throws on DB error', async () => {
            setupMock(null, { message: 'Update failed', code: '500' });
            await expect(TaskService.update('task-1', { title: 'x' })).rejects.toThrow();
        });
    });

    // ── delete ───────────────────────────────────────────────────────────────
    describe('delete', () => {
        it('deletes task successfully', async () => {
            setupMock(null, null);
            await expect(TaskService.delete('task-1')).resolves.toBeUndefined();
        });

        it('throws on DB error', async () => {
            const chain: any = {
                delete: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
                }),
            };
            (dataClient.from as any).mockReturnValue(chain);
            await expect(TaskService.delete('task-1')).rejects.toThrow();
        });
    });

    // ── bulkDelete ───────────────────────────────────────────────────────────
    describe('bulkDelete', () => {
        it('deletes multiple tasks successfully', async () => {
            setupMock(null, null);
            await expect(TaskService.bulkDelete(['task-1', 'task-2'])).resolves.toBeUndefined();
        });

        it('throws on DB error', async () => {
            const chain: any = {
                delete: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
                }),
            };
            (dataClient.from as any).mockReturnValue(chain);
            await expect(TaskService.bulkDelete(['task-1'])).rejects.toThrow();
        });
    });

    // ── getLinks ─────────────────────────────────────────────────────────────
    describe('getLinks', () => {
        it('returns task links', async () => {
            const links = [{ id: 'link-1', task_id: 'task-1', entity_type: 'contracts', entity_id: 'c1' }];
            setupMock(links);
            const result = await TaskService.getLinks('task-1');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('link-1');
        });

        it('returns empty array when no links', async () => {
            setupMock([]);
            const result = await TaskService.getLinks('task-1');
            expect(result).toHaveLength(0);
        });
    });

    // ── getSubtasks ──────────────────────────────────────────────────────────
    describe('getSubtasks', () => {
        it('returns subtask list', async () => {
            const subtask = { ...mockTaskRow, id: 'task-sub', parent_id: 'task-1' };
            setupMock([subtask]);
            const result = await TaskService.getSubtasks('task-1');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('task-sub');
        });

        it('returns empty array when no subtasks', async () => {
            setupMock([]);
            const result = await TaskService.getSubtasks('task-1');
            expect(result).toHaveLength(0);
        });
    });
});
