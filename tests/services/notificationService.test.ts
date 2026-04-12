import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../../services/notificationService';
import { dataClient } from '../../lib/dataClient';

// Mock Dependencies
vi.mock('../../lib/dataClient', () => {
    return { dataClient: { from: vi.fn(), rpc: vi.fn() } };
});

describe('NotificationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Spy on console to avoid cluttering test output
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const setupMock = (responses: Record<string, any>) => {
        const fromMock = vi.fn().mockImplementation((table: string) => {
             const dataBlock = responses[table] || { data: [], error: null, count: 0 };
             const chain: any = Object.assign(Promise.resolve(dataBlock), {
                 select: vi.fn().mockReturnThis(),
                 eq: vi.fn().mockReturnThis(),
                 in: vi.fn().mockReturnThis(),
                 range: vi.fn().mockReturnThis(),
                 order: vi.fn().mockReturnThis(),
                 delete: vi.fn().mockReturnThis(),
                 insert: vi.fn().mockReturnThis(),
                 update: vi.fn().mockReturnThis()
             });
             
             chain.single = vi.fn().mockResolvedValue({ 
                 data: dataBlock.data ? (Array.isArray(dataBlock.data) ? dataBlock.data[0] : dataBlock.data) : null,
                 error: dataBlock.error 
             });
             
             chain.delete.mockReturnValue({
                 eq: vi.fn().mockResolvedValue({ error: dataBlock.error })
             });

             Object.keys(chain).forEach(key => {
                 if (['select', 'eq', 'in', 'range', 'order', 'insert', 'update'].includes(key)) {
                     chain[key].mockReturnValue(chain);
                 }
             });

             return chain;
        });

        (dataClient.from as any) = fromMock;
    };

    describe('CRUD Operations', () => {
        it('create should call insert', async () => {
            setupMock({ notifications: { data: [], error: null } });
            await NotificationService.create('u1', 'SYSTEM' as any, 'T', 'M');
            expect(dataClient.from).toHaveBeenCalledWith('notifications');
        });

        it('createBulk should handle multiple inserts', async () => {
            setupMock({ notifications: { data: [], error: null } });
            await NotificationService.createBulk(['u1', 'u2'], 'SYSTEM' as any, 'T', 'M');
            expect(dataClient.from).toHaveBeenCalledWith('notifications');
        });

        it('getNotifications should slice PAGE_SIZE and set hasMore correctly', async () => {
            // Setup exactly 21 items (PAGE_SIZE + 1) where PAGE_SIZE is 20
            const arr = Array(21).fill({ id: 'note1' });
            setupMock({ notifications: { data: arr, error: null } });
            const res = await NotificationService.getNotifications('u1', 0);
            expect(res.hasMore).toBe(true);
            expect(res.data).toHaveLength(20); // Extracted exactly PAGE_SIZE
        });

        it('getUnreadCount should fetch exact count', async () => {
            setupMock({ notifications: { count: 5, data: null, error: null } });
            const count = await NotificationService.getUnreadCount('u1');
            expect(count).toBe(5);
        });

        it('markAsRead should update a specific notification', async () => {
            setupMock({ notifications: { data: null, error: null } });
            await NotificationService.markAsRead('n1');
            expect(dataClient.from).toHaveBeenCalledWith('notifications');
        });

        it('markAllAsRead should update all unread', async () => {
             setupMock({ notifications: { data: null, error: null } });
             await NotificationService.markAllAsRead('u1');
             expect(dataClient.from).toHaveBeenCalledWith('notifications');
        });

        it('deleteNotification should delete by id', async () => {
             setupMock({ notifications: { data: null, error: null } });
             await NotificationService.deleteNotification('n1');
             expect(dataClient.from).toHaveBeenCalledWith('notifications');
        });
    });

    describe('Dispatchers', () => {
        it('notifyContractEvent should calculate recipients correctly', async () => {
            // Mock contract response
            const contractData = {
                 employee_id: 'emp1',
                 employee_allocations: [{ employeeId: 'emp2' }],
                 unit_id: 'unit1'
            };

            // Mock profile responses
            // call 1: in('employee_id') returns u1 and u2
            // call 2: get leaders returns u3
            let profileCallCount = 0;
            const mockSupabaseFn = vi.fn().mockImplementation((table: string) => {
                 const chain: any = {
                      select: vi.fn().mockReturnThis(),
                      in: vi.fn().mockReturnThis(),
                      eq: vi.fn().mockReturnThis(),
                      insert: vi.fn().mockReturnThis()
                 };

                 if (table === 'contracts') {
                      chain.single = vi.fn().mockResolvedValue({ data: contractData, error: null });
                      return chain;
                 }
                 
                 if (table === 'profiles') {
                      profileCallCount++;
                      return Object.assign(Promise.resolve({ data: [{ id: 'user_a' }, { id: 'user_b' }] }), chain);
                 }

                 if (table === 'notifications') {
                      return Object.assign(Promise.resolve({ error: null }), chain);
                 }

                 return chain;
            });
            (dataClient.from as any) = mockSupabaseFn;

            // Mock createBulk
            const createBulkSpy = vi.spyOn(NotificationService, 'createBulk').mockResolvedValue(undefined);

            await NotificationService.notifyContractEvent('c1', 'STATUS_CHANGE' as any, 'Title', 'Msg', 'user_a');
            
            // Expected to hit createBulk
            expect(createBulkSpy).toHaveBeenCalled();
            // User 'user_a' is excluded, only 'user_b' remaining
            expect(createBulkSpy.mock.calls[0][0]).toEqual(['user_b']);
            
            createBulkSpy.mockRestore();
        });

        it('notifyPaymentEvent avoids notifying actor', async () => {
             const contractData = {
                 employee_id: 'emp1',
                 unit_id: 'unit1'
             };

             const mockSupabaseFn = vi.fn().mockImplementation((table: string) => {
                 const chain: any = {
                      select: vi.fn().mockReturnThis(),
                      in: vi.fn().mockReturnThis(),
                      eq: vi.fn().mockReturnThis()
                 };

                 if (table === 'contracts') {
                      chain.single = vi.fn().mockResolvedValue({ data: contractData, error: null });
                      return chain;
                 }
                 if (table === 'profiles') {
                      // Return 'user_me'
                      return Object.assign(Promise.resolve({ data: [{ id: 'user_me' }] }), chain);
                 }
                 return chain;
             });
             (dataClient.from as any) = mockSupabaseFn;

             const createBulkSpy = vi.spyOn(NotificationService, 'createBulk').mockResolvedValue(undefined);
             // Since 'user_me' is the only recipient and we exclude 'user_me', createBulk shouldn't be called effectively, 
             // but `notifyPaymentEvent` bails if array length is 0.
             await NotificationService.notifyPaymentEvent('c1', 'STATUS_CHANGE' as any, 'T', 'M', 'p1', 'user_me');
             
             expect(createBulkSpy).not.toHaveBeenCalled();

             createBulkSpy.mockRestore();
        });
    });
});
