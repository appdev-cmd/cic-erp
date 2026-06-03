import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractService } from '../../services/contractService';
import { dataClient } from '../../lib/dataClient';

// Mock dependencies
vi.mock('../../lib/dataClient', () => ({
    dataClient: { from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock('../../services/auditLogService', () => ({
    AuditLogService: { create: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../services/telegramNotificationService', () => ({
    TelegramNotificationService: { 
        notifyContractStatusChange: vi.fn(), 
        notifyNewContract: vi.fn(),
        notifyContractChange: vi.fn().mockResolvedValue(null)
    },
}));
vi.mock('../../services/contractTaskDefinitionService', () => ({
    ContractTaskDefinitionService: { onContractStatusChange: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../services/contractTagService', () => ({
    normalizeTag: vi.fn((t: string) => t),
}));
vi.mock('../../services/contract/contractRelations', () => ({
    getRelatedContracts: vi.fn().mockResolvedValue([]),
    getOutgoingPendingLinks: vi.fn().mockResolvedValue([]),
    getIncomingPendingLinks: vi.fn().mockResolvedValue([]),
    linkContracts: vi.fn().mockResolvedValue(false),
    approveLink: vi.fn().mockResolvedValue(false),
    rejectLink: vi.fn().mockResolvedValue(false),
    unlinkContracts: vi.fn().mockResolvedValue(false),
}));

// ─── Shared mock contract DB row ────────────────────────────────────────────
const mockContractRow = {
    id: 'contract-1',
    contract_code: 'CIC-2026-001',
    title: 'Hợp đồng thử nghiệm',
    contract_type: 'HĐ',
    status: 'Processing',
    stage: 'Signed',
    value: 100_000_000,
    has_vat: true,
    vat_rate: 10,
    unit_id: 'unit-A',
    employee_id: 'emp-1',
    party_a: 'Khách hàng A',
    party_b: 'CIC',
    signed_date: '2026-01-15',
    start_date: '2026-01-20',
    end_date: '2026-12-31',
    created_at: '2026-01-15T09:00:00Z',
    payments: [],
    details: { lineItems: [], executionCosts: [], revenueSchedules: [] },
    milestones: [],
    payment_phases: [],
    contacts: [],
    unit_allocations: null,
    employee_allocations: null,
    workflow_steps: null,
    estimated_cost: 70_000_000,
    actual_revenue: 0,
    admin_profit: 0,
    rev_profit: 0,
    cash_received: 0,
};

// ─── Mock builder ────────────────────────────────────────────────────────────
/**
 * Creates a chainable Supabase mock that resolves to { data, error, count }.
 */
const buildChain = (data: any, error: any = null, count: number | null = null) => {
    const chain: any = Object.assign(Promise.resolve({ data, error, count }), {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
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

    // All chaining methods return the same chain object
    ['select','eq','neq','ilike','or','in','not','is','range','order',
     'gte','lte','limit','insert','update','delete'].forEach(k => {
        chain[k].mockReturnValue(chain);
    });

    // delete().eq() returns a plain resolved value
    chain.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error }),
        in: vi.fn().mockResolvedValue({ error }),
    });

    return chain;
};

const setupMock = (data: any, error: any = null, count: number | null = null) => {
    (dataClient.from as any).mockReturnValue(buildChain(data, error, count));
    (dataClient.rpc as any).mockResolvedValue({ data: null, error: null });
    (dataClient.auth as any) = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'test@cic.com.vn' } } }) };
};

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('ContractService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── getAll ──────────────────────────────────────────────────────────────
    describe('getAll', () => {
        it('returns a list of mapped contracts', async () => {
            setupMock([mockContractRow]);
            const result = await ContractService.getAll();
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('contract-1');
            expect(result[0].contractCode).toBe('CIC-2026-001');
            expect(result[0].title).toBe('Hợp đồng thử nghiệm');
        });

        it('maps value and unitId correctly', async () => {
            setupMock([mockContractRow]);
            const [c] = await ContractService.getAll();
            expect(c.value).toBe(100_000_000);
            expect(c.unitId).toBe('unit-A');
            expect(c.salespersonId).toBe('emp-1');
        });

        it('returns empty array when DB returns empty', async () => {
            setupMock([]);
            const result = await ContractService.getAll();
            expect(result).toHaveLength(0);
        });

        it('throws when DB returns error', async () => {
            setupMock(null, { message: 'DB connection failed', code: '500' });
            await expect(ContractService.getAll()).rejects.toThrow();
        });

        it('defaults hasVat to true when not set', async () => {
            setupMock([{ ...mockContractRow, has_vat: undefined }]);
            const [c] = await ContractService.getAll();
            expect(c.hasVat).toBe(true);
        });
    });

    // ── getById ─────────────────────────────────────────────────────────────
    describe('getById', () => {
        it('returns undefined for empty id', async () => {
            const result = await ContractService.getById('');
            expect(result).toBeUndefined();
            expect(dataClient.from).not.toHaveBeenCalled();
        });

        it('returns mapped contract when found', async () => {
            setupMock(mockContractRow);
            const result = await ContractService.getById('contract-1');
            expect(result).toBeDefined();
            expect(result!.id).toBe('contract-1');
            expect(result!.status).toBe('Processing');
        });

        it('returns undefined when not found (PGRST116)', async () => {
            setupMock(null, { code: 'PGRST116', message: 'Not found' });
            const result = await ContractService.getById('non-existent');
            expect(result).toBeUndefined();
        });

        it('returns undefined on other DB errors (graceful degradation)', async () => {
            setupMock(null, { code: '500', message: 'Internal error' });
            const result = await ContractService.getById('contract-1');
            expect(result).toBeUndefined();
        });

        it('syncs payment phase status to Paid when payment status is Tiền về', async () => {
            const payments = [
                { amount: 50_000_000, status: 'Tiền về', payment_type: 'Revenue', voucher_type: 'RECEIPT', phase_id: 'phase-1' },
            ];
            const row = {
                ...mockContractRow,
                payments,
                payment_phases: [{ id: 'phase-1', status: 'Pending', amount: 50_000_000 }],
            };
            setupMock(row);
            const result = await ContractService.getById('contract-1');
            expect(result?.paymentPhases?.[0].status).toBe('Paid');
        });

        it('syncs payment phase status to Advance when payment is Tạm ứng', async () => {
            const payments = [
                { amount: 20_000_000, status: 'Tạm ứng', voucher_type: 'RECEIPT', phase_id: 'phase-2' },
            ];
            const row = {
                ...mockContractRow,
                payments,
                payment_phases: [{ id: 'phase-2', status: 'Pending', amount: 20_000_000 }],
            };
            setupMock(row);
            const result = await ContractService.getById('contract-1');
            expect(result?.paymentPhases?.[0].status).toBe('Advance');
        });
    });

    // ── findByTitle ──────────────────────────────────────────────────────────
    describe('findByTitle', () => {
        it('returns null for empty title', async () => {
            const result = await ContractService.findByTitle('');
            expect(result).toBeNull();
            expect(dataClient.from).not.toHaveBeenCalled();
        });

        it('returns null for title shorter than 3 chars', async () => {
            const result = await ContractService.findByTitle('AB');
            expect(result).toBeNull();
        });

        it('returns mapped contract when title matches', async () => {
            setupMock(mockContractRow);
            const result = await ContractService.findByTitle('Hợp đồng thử nghiệm');
            expect(result).not.toBeNull();
            expect(result!.id).toBe('contract-1');
        });

        it('returns null when no match found', async () => {
            setupMock(null, null);
            const result = await ContractService.findByTitle('Không tồn tại');
            expect(result).toBeNull();
        });
    });

    // ── search ───────────────────────────────────────────────────────────────
    describe('search', () => {
        it('returns mapped contracts matching term', async () => {
            setupMock([mockContractRow]);
            const result = await ContractService.search('CIC');
            expect(result).toHaveLength(1);
            expect(result[0].contractCode).toBe('CIC-2026-001');
        });

        it('returns empty array when no match', async () => {
            setupMock([]);
            const result = await ContractService.search('xyz-no-match');
            expect(result).toHaveLength(0);
        });

        it('throws on DB error', async () => {
            setupMock(null, { message: 'DB error', code: '500' });
            await expect(ContractService.search('test')).rejects.toThrow();
        });

        it('sanitizes special characters in search term', async () => {
            setupMock([]);
            // Should not throw even with special chars
            await expect(ContractService.search('test%_\\')).resolves.toBeDefined();
        });
    });

    // ── list (pure unit filtering) ────────────────────────────────────────
    describe('list — standard mode (all units)', () => {
        it('returns paginated contracts', async () => {
            (dataClient.from as any).mockReturnValue(buildChain([mockContractRow], null, 1));
            (dataClient.rpc as any).mockResolvedValue({ data: null, error: null });

            const result = await ContractService.list({
                page: 1,
                limit: 10,
            });
            expect(result.data).toHaveLength(1);
            expect(result.count).toBe(1);
        });

        it('returns empty page when no data', async () => {
            (dataClient.from as any).mockReturnValue(buildChain([], null, 0));
            (dataClient.rpc as any).mockResolvedValue({ data: null, error: null });

            const result = await ContractService.list({ page: 1, limit: 10 });
            expect(result.data).toHaveLength(0);
            expect(result.count).toBe(0);
        });

        it('throws on DB error', async () => {
            (dataClient.from as any).mockReturnValue(buildChain(null, { message: 'error', code: '500' }, null));
            (dataClient.rpc as any).mockResolvedValue({ data: null, error: null });

            await expect(ContractService.list({ page: 1, limit: 10 })).rejects.toThrow();
        });
    });

    // ── getStatsFallback ──────────────────────────────────────────────────
    describe('getStatsFallback', () => {
        it('returns zero stats when no contracts', async () => {
            setupMock([]);
            const stats = await ContractService.getStatsFallback('all', 'all');
            expect(stats.totalContracts).toBe(0);
            expect(stats.totalValue).toBe(0);
            expect(stats.completedCount).toBe(0);
        });

        it('counts Processing contracts correctly', async () => {
            setupMock([
                { ...mockContractRow, status: 'Processing', value: 100_000_000, actual_revenue: 0, admin_profit: 0, rev_profit: 0, cash_received: 0, category: 'Mới', unit_allocations: null },
            ]);
            const stats = await ContractService.getStatsFallback('all', 'all');
            expect(stats.totalContracts).toBe(1);
            expect(stats.processingCount).toBe(1);
            expect(stats.totalValue).toBe(100_000_000);
        });

        it('counts Completed contracts correctly', async () => {
            setupMock([
                { ...mockContractRow, status: 'Completed', value: 200_000_000, actual_revenue: 180_000_000, admin_profit: 30_000_000, rev_profit: 25_000_000, cash_received: 200_000_000, category: 'Mới', unit_allocations: null },
            ]);
            const stats = await ContractService.getStatsFallback('all', 'all');
            expect(stats.completedCount).toBe(1);
            expect(stats.totalValue).toBe(200_000_000);
        });

        it('applies unit share fraction for unit-scoped view', async () => {
            const contractWithAllocation = {
                ...mockContractRow,
                unit_id: 'unit-A',
                unit_allocations: {
                    allocations: [
                        { unitId: 'unit-A', role: 'lead', percent: 60 },
                        { unitId: 'unit-B', role: 'support', percent: 40 },
                    ],
                },
                value: 100_000_000,
                actual_revenue: 0, admin_profit: 0, rev_profit: 0, cash_received: 0,
                category: 'Mới', status: 'Processing',
            };
            setupMock([contractWithAllocation]);

            const stats = await ContractService.getStatsFallback('unit-A', 'all');
            // unit-A gets 60% share → totalValue = 60M
            expect(stats.totalValue).toBeCloseTo(60_000_000);
        });

        it('returns zero stats when DB errors', async () => {
            setupMock(null, { message: 'error', code: '500' });
            const stats = await ContractService.getStatsFallback('all', 'all');
            expect(stats.totalContracts).toBe(0);
        });
    });

    // ── update ──────────────────────────────────────────────────────────────
    describe('update', () => {
        const mockContract = {
            id: 'contract-1',
            contract_code: 'CIC-2026-001',
            title: 'Hợp đồng thử nghiệm',
            contract_type: 'HĐ',
            status: 'Processing',
            stage: 'Signed',
            value: 100_000_000,
            has_vat: true,
            vat_rate: 10,
            unit_id: 'unit-A',
            employee_id: 'emp-1',
            party_a: 'Khách hàng A',
            party_b: 'CIC',
            signed_date: '2026-01-15',
            start_date: '2026-01-20',
            end_date: '2026-12-31',
            created_at: '2026-01-15T09:00:00Z',
            payments: [],
            details: { lineItems: [], executionCosts: [], revenueSchedules: [] },
            milestones: [],
            payment_phases: [],
            contacts: [],
        };

        it('performs normal update when ID does not change', async () => {
            const selectMock = vi.fn().mockReturnValue(buildChain(mockContract));
            const updateMock = vi.fn().mockReturnValue(buildChain(mockContract));
            
            vi.spyOn(dataClient, 'from').mockImplementation((table: string) => {
                if (table === 'contracts') {
                    return {
                        select: selectMock,
                        update: updateMock,
                    } as any;
                }
                return buildChain(null);
            });

            // Mock getById
            vi.spyOn(ContractService, 'getById').mockResolvedValue({
                id: 'contract-1',
                contractCode: 'CIC-2026-001',
                title: 'Hợp đồng thử nghiệm',
                contractType: 'HĐ',
                unitId: 'unit-A',
                partyA: 'Khách hàng A',
                partyB: 'CIC',
                value: 100_000_000,
                status: 'Processing',
                stage: 'Signed',
                category: 'Mới',
                salespersonId: 'emp-1',
            } as any);

            const result = await ContractService.update('contract-1', { title: 'New Title' });
            expect(result).toBeDefined();
            expect(updateMock).toHaveBeenCalled();
        });

        it('performs PK Migration when ID changes and new ID does not exist', async () => {
            const insertMock = vi.fn().mockReturnValue(buildChain({
                ...mockContract,
                id: 'contract-new',
                contract_code: 'contract-new',
                title: 'Hợp đồng thử nghiệm'
            }));

            const deleteMock = vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null })
            });

            const updateMock = vi.fn().mockReturnValue(buildChain([]));

            vi.spyOn(dataClient, 'from').mockImplementation((table: string) => {
                if (table === 'contracts') {
                    return {
                        select: () => buildChain({ created_at: '2026-01-15T09:00:00Z' }),
                        insert: insertMock,
                        delete: deleteMock,
                    } as any;
                }
                // Mock for relation updates
                return {
                    update: updateMock,
                } as any;
            });

            // Mock getById & exists internally
            vi.spyOn(ContractService, 'getById').mockResolvedValue({
                id: 'contract-1',
                contractCode: 'CIC-2026-001',
                title: 'Hợp đồng thử nghiệm',
                contractType: 'HĐ',
                unitId: 'unit-A',
                partyA: 'Khách hàng A',
                partyB: 'CIC',
                clientInitials: '',
                contacts: [],
                content: '',
                signedDate: '2026-01-15',
                startDate: '2026-01-20',
                endDate: '2026-12-31',
                value: 100_000_000,
                estimatedCost: 70_000_000,
                actualCost: 0,
                status: 'Processing',
                stage: 'Signed',
                category: 'Mới',
                salespersonId: 'emp-1',
            } as any);

            vi.spyOn(ContractService, 'exists').mockResolvedValue(false);

            const result = await ContractService.update('contract-1', { contractCode: 'contract-new' });

            expect(result).toBeDefined();
            expect(result!.id).toBe('contract-new');
            expect(insertMock).toHaveBeenCalled();
            expect(deleteMock).toHaveBeenCalled();
            expect(updateMock).toHaveBeenCalled();
        });

        it('throws duplicate error if new ID already exists', async () => {
            vi.spyOn(ContractService, 'getById').mockResolvedValue({
                id: 'contract-1',
                contractCode: 'CIC-2026-001',
            } as any);
            vi.spyOn(ContractService, 'exists').mockResolvedValue(true);

            await expect(
                ContractService.update('contract-1', { contractCode: 'contract-duplicate' })
            ).rejects.toThrow('Mã hợp đồng đã tồn tại.');
        });
    });
});
