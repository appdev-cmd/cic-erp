import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmployeeService } from '../../services/employeeService';
import { dataClient } from '../../lib/dataClient';

// Mock Supabase
vi.mock('../../lib/dataClient', () => {
    const mockSupabase = {
        from: vi.fn(),
        rpc: vi.fn(),
    };
    return { dataClient: mockSupabase };
});

describe('EmployeeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockEmployeeRow = {
        id: 'emp1',
        name: 'John Doe',
        unit_id: 'unit1',
        employee_code: 'EMP001',
        email: 'john@test.com',
        phone: '123456789',
        position: 'Developer',
        department: 'IT',
        role_code: 'DEV',
        date_joined: '2025-01-01',
        slug: 'john-doe',
        target: { signing: 1000, revenue: 800, adminProfit: 100, revProfit: 100, cash: 50 },
        telegram: 'johndoe_tg',
        telegram_verified: true
    };

    const mockTargetRow = {
        id: 't1',
        employee_id: 'emp1',
        year: 2026,
        signing: 2000,
        revenue: 1500,
        admin_profit: 200,
        rev_profit: 200,
        cash: 100
    };

    const mockContractRow = {
        id: 'c1',
        value: 500,
        actual_revenue: 300,
        admin_profit: 50,
        rev_profit: 50,
        status: 'Processing',
        employee_id: 'emp1',
        employee_allocations: [],
        signed_date: '2026-06-01'
    };

    const setupRestMock = (data: any, error: any = null, count: number = 1, rpcData: any = null) => {
        const resolved = Promise.resolve({ data, error, count });
        const chain: any = Object.assign(resolved, {
             select: vi.fn().mockReturnThis(),
             eq: vi.fn().mockReturnThis(),
             ilike: vi.fn().mockReturnThis(),
             or: vi.fn().mockReturnThis(),
             in: vi.fn().mockReturnThis(),
             range: vi.fn().mockReturnThis(),
             order: vi.fn().mockReturnThis(),
             gte: vi.fn().mockReturnThis(),
             lte: vi.fn().mockReturnThis(),
             delete: vi.fn().mockReturnThis(),
             insert: vi.fn().mockReturnThis(),
             update: vi.fn().mockReturnThis(),
             single: vi.fn().mockResolvedValue({ data: data ? (Array.isArray(data) ? data[0] : data) : null, error }),
             maybeSingle: vi.fn().mockResolvedValue({ data: data ? (Array.isArray(data) ? data[0] : data) : null, error })
        });
        
        // Ensure returning 'this' resolves to the chain object
        Object.keys(chain).forEach(key => {
            if(typeof chain[key].mockReturnThis === 'function' && key !== 'single' && key !== 'maybeSingle') {
                chain[key].mockReturnValue(chain);
            }
        });

        // special for delete().eq()
        chain.delete.mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error })
        });

        // If from('employee_targets') we might want target data. We'll simplify and say if data is an array of tables, handle it
        const fromMock = vi.fn().mockImplementation((table: string) => {
             if (table === 'employee_targets' && typeof data === 'object' && data !== null && 'signing' in data) {
                 // return target
                 const targetChain = Object.assign(Promise.resolve({ data, error, count }), chain);
                 targetChain.single = vi.fn().mockResolvedValue({ data, error });
                 targetChain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
                 return targetChain;
             }
             if (table === 'contracts' && Array.isArray(data) && data.length > 0 && 'status' in data[0]) {
                 return Object.assign(Promise.resolve({ data, error, count }), chain);
             }
             return chain;
        });

        (dataClient.from as any) = fromMock;

        const rpcMock = vi.fn().mockImplementation((funcName: string) => {
            return Promise.resolve({ data: rpcData || null, error: null });
        });
        (dataClient.rpc as any) = rpcMock;
    };

    describe('getAll', () => {
        it('should fetch all employees', async () => {
            setupRestMock([mockEmployeeRow]);
            const employees = await EmployeeService.getAll();
            expect(employees).toHaveLength(1);
            expect(employees[0].id).toBe('emp1');
            expect(employees[0].employeeCode).toBe('EMP001');
        });
    });

    describe('getById', () => {
        it('should return employee by id', async () => {
            setupRestMock(mockEmployeeRow);
            const emp = await EmployeeService.getById('emp1');
            expect(emp?.id).toBe('emp1');
        });
        
        it('should ignore id not found', async () => {
             setupRestMock(null, new Error('Not found'));
             const emp = await EmployeeService.getById('x');
             expect(emp).toBeUndefined();
        });
    });

    describe('getBySlugOrId', () => {
        it('uses getById if uuid', async () => {
            setupRestMock(mockEmployeeRow);
            const emp = await EmployeeService.getBySlugOrId('123e4567-e89b-12d3-a456-426614174000');
            expect(emp?.id).toBe('emp1');
        });

        it('uses getBySlug if not uuid', async () => {
            setupRestMock(mockEmployeeRow);
            const emp = await EmployeeService.getBySlugOrId('john-doe');
            expect(emp?.slug).toBe('john-doe');
        });
    });

    describe('getByUnitId', () => {
        it('filters by unit', async () => {
            setupRestMock([mockEmployeeRow]);
            const res = await EmployeeService.getByUnitId('unit1');
            expect(res[0].unitId).toBe('unit1');
        });
        it('returns all if unitId is all', async () => {
             setupRestMock([mockEmployeeRow]);
             const res = await EmployeeService.getByUnitId('all');
             expect(res[0].id).toBe('emp1');
        });
    });

    describe('list', () => {
        it('supports pagination and search via unaccent rpc', async () => {
             setupRestMock([mockEmployeeRow], null, 1, [{id: 'emp1'}]);
             const res = await EmployeeService.list({ search: 'John', unitId: 'unit1' });
             expect(dataClient.rpc).toHaveBeenCalledWith('search_employees_unaccent', { search_term: 'John' });
             expect(res.data).toHaveLength(1);
             expect(res.total).toBe(1);
        });

        it('falls back to ilike if RPC returns empty', async () => {
             // If RPC throws or returns nothing
             setupRestMock([mockEmployeeRow]);
             (dataClient.rpc as any).mockRejectedValueOnce(new Error('no rpc'));
             const res = await EmployeeService.list({ search: 'John' });
             // Should fallback to ilike query chain (mocked)
             expect(res.data).toHaveLength(1);
        });
    });

    describe('create & update & delete', () => {
        it('create inserts data', async () => {
             setupRestMock(mockEmployeeRow);
             const res = await EmployeeService.create({ name: 'John Doe', email: 'j@t.com' } as any);
             expect(res.name).toBe('John Doe');
        });
        it('update modfiies data', async () => {
             setupRestMock(mockEmployeeRow);
             const res = await EmployeeService.update('emp1', { phone: '999' });
             expect(res.id).toBe('emp1');
        });
        it('delete removes data', async () => {
             setupRestMock(null);
             const res = await EmployeeService.delete('emp1');
             expect(res).toBe(true);
        });
    });

    describe('getStats', () => {
        it('calculates stats fetching target and contracts', async () => {
             // Mock multiple table returns
             const mockSupabaseCountFn = vi.fn().mockImplementation((table: string) => {
                 const chain: any = {
                     select: vi.fn().mockReturnThis(),
                     eq: vi.fn().mockReturnThis(),
                     maybeSingle: vi.fn(),
                     gte: vi.fn().mockReturnThis(),
                     lte: vi.fn().mockReturnThis()
                 };
                 // mock returning chain itself on async await
                 Object.assign(chain, Promise.resolve({ data: [], error: null }));
                 
                 if (table === 'employees') {
                      chain.single = vi.fn().mockResolvedValue({ data: mockEmployeeRow });
                      return chain;
                 }
                 if (table === 'employee_targets') {
                      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockTargetRow });
                      return chain;
                 }
                 if (table === 'contracts') {
                      // resolve with contracts
                      return Object.assign(Promise.resolve({ data: [mockContractRow] }), chain);
                 }
                 return chain;
             });
             (dataClient.from as any) = mockSupabaseCountFn;

             const stats = await EmployeeService.getStats('emp1', 2026);
             expect(stats.totalSigning).toBe(500);
             expect(stats.target.signing).toBe(2000);
             expect(stats.signingProgress).toBe(25); // 500/2000 * 100
             expect(stats.contractCount).toBe(1);
        });
    });

    describe('getWithStats', () => {
        it('uses rpc by default', async () => {
             // Returns mapped rpc dataset
             setupRestMock(null, null, 1, [{
                  id: 'emp1',
                  name: 'John Doe',
                  total_signing: 1000,
                  total_revenue: 500,
                  total_profit: 100,
                  total_cash: 50
             }]);
             const res = await EmployeeService.getWithStats('all', '', 2026);
             expect(res[0].id).toBe('emp1');
             expect(res[0].stats?.totalSigning).toBe(1000);
        });

        it('falls back to JS aggregation if periodFilter is provided', async () => {
             const mockSupabaseFn = vi.fn().mockImplementation((table: string) => {
                 const chain: any = {
                     select: vi.fn().mockReturnThis(),
                     eq: vi.fn().mockReturnThis(),
                     gte: vi.fn().mockReturnThis(),
                     lte: vi.fn().mockReturnThis()
                 };
                 if (table === 'employees') {
                      return Object.assign(Promise.resolve({ data: [mockEmployeeRow] }), chain);
                 }
                 if (table === 'contracts') {
                      return Object.assign(Promise.resolve({ data: [mockContractRow] }), chain);
                 }
                 return chain;
             });
             (dataClient.from as any) = mockSupabaseFn;

             const res = await EmployeeService.getWithStats('all', '', 2026, 'M6');
             expect(res[0].id).toBe('emp1');
             expect(res[0].stats?.totalSigning).toBe(500); // from mockContractRow
        });
    });
});
