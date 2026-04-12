import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskCommentService } from '../../services/taskCommentService';
import { dataClient } from '../../lib/dataClient';

// Mock Supabase
vi.mock('../../lib/dataClient', () => {
    const mockSupabase = {
        from: vi.fn(),
    };
    return { dataClient: mockSupabase };
});

describe('TaskCommentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockCommentRow = {
        id: 'cm1',
        task_id: 't1',
        user_id: 'u1',
        content: 'Hello',
        parent_comment_id: null,
        comment_type: 'user',
        reactions: null,
        is_pinned: false,
        created_at: '2026-01-01T00:00:00Z',
    };

    const mockChildRow = {
        ...mockCommentRow,
        id: 'cm2',
        parent_comment_id: 'cm1',
        content: 'Reply'
    };

    const mockEmployeeRow = {
        id: 'u1',
        name: 'Nguyen Van A',
        avatar: '/avatar.jpg'
    };

    const setupRestMock = (commentsData: any, error: any = null, employeeData: any = [mockEmployeeRow]) => {
         const resolved = Promise.resolve({ data: commentsData, error });
         const chain: any = Object.assign(resolved, {
             select: vi.fn().mockReturnThis(),
             eq: vi.fn().mockReturnThis(),
             in: vi.fn().mockReturnThis(),
             order: vi.fn().mockReturnThis(),
             insert: vi.fn().mockReturnThis(),
             update: vi.fn().mockReturnThis(),
             delete: vi.fn().mockReturnThis(),
             single: vi.fn().mockResolvedValue({ data: commentsData ? (Array.isArray(commentsData) ? commentsData[0] : commentsData) : null, error }),
         });

         Object.keys(chain).forEach(key => {
             if (typeof chain[key].mockReturnThis === 'function' && key !== 'single') {
                 chain[key].mockReturnValue(chain);
             }
         });

         // specially for delete().eq() returning promise
         chain.delete.mockReturnValue({
             eq: vi.fn().mockResolvedValue({ error })
         });
         
         // Mock 'employees' resolving differently
         let callCount = 0;
         const fromMock = vi.fn().mockImplementation((table) => {
             if (table === 'employees') {
                  const empChain: any = Object.assign(Promise.resolve({ data: employeeData, error: null }), {
                      select: vi.fn().mockReturnThis(),
                      in: vi.fn().mockReturnThis(),
                  });
                  empChain.select.mockReturnValue(empChain);
                  empChain.in.mockReturnValue(empChain);
                  return empChain;
             }
             if (table === 'task_comments' && !Array.isArray(commentsData) && typeof commentsData === 'object' && commentsData !== null) {
                  // For count queries like getCommentCount
                  if (commentsData.count !== undefined) {
                      const countChain: any = Object.assign(Promise.resolve({ count: commentsData.count, error }), {
                           select: vi.fn().mockReturnThis(),
                           eq: vi.fn().mockReturnThis(),
                      });
                      countChain.select.mockReturnValue(countChain);
                      countChain.eq.mockReturnValue(countChain);
                      return countChain;
                  }
             }

             return chain;
         });
         
         (dataClient.from as any) = fromMock;
         return chain;
    };

    describe('getComments', () => {
        it('should build hierarchical tree of comments and bind users', async () => {
             setupRestMock([mockCommentRow, mockChildRow]);
             const tree = await TaskCommentService.getComments('t1');
             expect(tree).toHaveLength(1);
             expect(tree[0].id).toBe('cm1');
             expect(tree[0].user_name).toBe('Nguyen Van A');
             expect(tree[0].replies).toHaveLength(1);
             expect(tree[0].replies[0].id).toBe('cm2');
        });
    });

    describe('addComment / addSystemComment', () => {
        it('should create new comment', async () => {
             setupRestMock(mockCommentRow);
             const res = await TaskCommentService.addComment({ task_id: 't1', user_id: 'u1', content: 'Hello' });
             expect(res.id).toBe('cm1');
             expect(dataClient.from).toHaveBeenCalledWith('task_comments');
        });
        it('should create system comment', async () => {
             setupRestMock({ ...mockCommentRow, comment_type: 'system', user_id: 'system' });
             const res = await TaskCommentService.addSystemComment('t1', 'System Event');
             expect(res.comment_type).toBe('system');
        });
    });

    describe('deleteComment', () => {
        it('should delete existing comment', async () => {
             setupRestMock(null);
             await TaskCommentService.deleteComment('cm1');
             expect(dataClient.from).toHaveBeenCalledWith('task_comments');
        });
    });

    describe('toggleReaction', () => {
        it('should add reaction if not existing', async () => {
             const chain = setupRestMock({ reactions: { "👍": ["u2"] } });
             await TaskCommentService.toggleReaction('cm1', '👍', 'u1');
             // Assert update triggered
             expect(chain.update).toHaveBeenCalledWith({ reactions: { "👍": ["u2", "u1"] } });
        });

        it('should remove reaction if already existing', async () => {
             const chain = setupRestMock({ reactions: { "👍": ["u1", "u2"] } });
             await TaskCommentService.toggleReaction('cm1', '👍', 'u1');
             expect(chain.update).toHaveBeenCalledWith({ reactions: { "👍": ["u2"] } });
        });
        
        it('should clear reaction entirely when last user unreacts', async () => {
             const chain = setupRestMock({ reactions: { "👍": ["u1"] } });
             await TaskCommentService.toggleReaction('cm1', '👍', 'u1');
             expect(chain.update).toHaveBeenCalledWith({ reactions: {} });
        });
    });

    describe('togglePin', () => {
        it('should toggle pin state', async () => {
             const chain = setupRestMock({ is_pinned: false });
             await TaskCommentService.togglePin('cm1');
             expect(chain.update).toHaveBeenCalledWith({ is_pinned: true });
        });
    });

    describe('updateComment', () => {
        it('should update content', async () => {
             const chain = setupRestMock(null);
             await TaskCommentService.updateComment('cm1', 'New text');
             expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ content: 'New text' }));
        });
    });

    describe('getCommentCount', () => {
        it('should return scalar count', async () => {
             setupRestMock({ count: 5 });
             const c = await TaskCommentService.getCommentCount('t1');
             expect(c).toBe(5);
        });
    });

    describe('getCommentCountsBatch', () => {
        it('should return aggregated counts', async () => {
             setupRestMock([
                 { task_id: 't1' }, { task_id: 't1' }, { task_id: 't2' }
             ]);
             const batch = await TaskCommentService.getCommentCountsBatch(['t1', 't2']);
             expect(batch['t1']).toBe(2);
             expect(batch['t2']).toBe(1);
        });
        it('empty case', async () => {
             const batch = await TaskCommentService.getCommentCountsBatch([]);
             expect(batch).toEqual({});
        });
    });
});
