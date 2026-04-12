import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerService } from '../../services/customerService';
import { dataClient } from '../../lib/dataClient';

// Mock Supabase
vi.mock('../../lib/dataClient', () => {
    const mockSupabase = {
        from: vi.fn(),
        rpc: vi.fn(),
    };
    return { dataClient: mockSupabase };
});

describe('CustomerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockCustomerRow = {
        id: 'c1',
        name: 'Test Customer',
        short_name: 'Test C',
        industry: '["IT", "Software"]',
        contact_person: 'John Doe',
        phone: '123456789',
        email: 'john@test.com',
        address: '123 Street',
        tax_code: '1234567890',
        website: 'test.com',
        notes: 'test note',
        bank_name: 'Bank A',
        bank_branch: 'Branch B',
        bank_account: '000000',
        founded_date: '2000-01-01',
        type: 'Customer',
        rating: 'Standard',
        source: 'Web',
        payment_terms: 'Net 30',
        credit_limit: 1000,
        contract_count: 5,
        total_value: 5000,
        total_revenue: 2000,
        active_contracts_count: 2
    };

    const mockContactRow = {
        id: 'cont1',
        customer_id: 'c1',
        name: 'Jane Doe',
        position: 'Manager',
        department: 'Sales',
        phone: '987654321',
        email: 'jane@test.com',
        is_primary: true,
        notes: 'Contact info',
        created_at: '2026-01-01T00:00:00Z'
    };

    const setupRestMock = (data: any, error: any = null) => {
        const resolved = Promise.resolve({ data, error });
        const chain: any = Object.assign(resolved, {
             select: vi.fn().mockReturnThis(),
             eq: vi.fn().mockReturnThis(),
             ilike: vi.fn().mockReturnThis(),
             or: vi.fn().mockReturnThis(),
             in: vi.fn().mockReturnThis(),
             limit: vi.fn().mockReturnThis(),
             order: vi.fn().mockReturnThis(),
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

        // special for delete().eq() returning a promise wrapper:
        chain.delete.mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error })
        });

        const fromMock = vi.fn().mockReturnValue(chain);

        (dataClient.from as any) = fromMock;
    };

    describe('getAll (with RPC)', () => {
        it('should fetch list and count via rpc', async () => {
             const rpcMock = vi.fn().mockImplementation((funcName: string) => {
                 if (funcName === 'get_customers_with_stats') return Promise.resolve({ data: [mockCustomerRow], error: null });
                 if (funcName === 'get_customers_count') return Promise.resolve({ data: 1, error: null });
                 return Promise.resolve({ data: null, error: null });
             });
             (dataClient.rpc as any) = rpcMock;

             const res = await CustomerService.getAll();
             expect(res.total).toBe(1);
             expect(res.data).toHaveLength(1);
             expect(res.data[0].name).toBe('Test Customer');
             expect(res.data[0].stats?.contractCount).toBe(5);
        });
    });

    describe('getById', () => {
        it('should return mapped customer', async () => {
            setupRestMock(mockCustomerRow);
            const res = await CustomerService.getById('c1');
            expect(res?.id).toBe('c1');
            expect(res?.industry).toEqual(['IT', 'Software']); // normalized
        });
    });

    describe('create', () => {
        it('should insert customer', async () => {
            setupRestMock(mockCustomerRow);
            const res = await CustomerService.create({ name: 'Test Customer', shortName: 'xyz', industry: ['IT'], type: 'Customer' } as any);
            expect(res.id).toBe('c1');
            expect(dataClient.from).toHaveBeenCalledWith('customers');
        });
    });

    describe('update', () => {
        it('should update customer', async () => {
            setupRestMock(mockCustomerRow);
            const res = await CustomerService.update('c1', { name: 'Updated Name', creditLimit: 2000 });
            expect(res?.id).toBe('c1');
        });
    });

    describe('delete', () => {
        it('should delete customer', async () => {
            setupRestMock(null);
            const res = await CustomerService.delete('c1');
            expect(res).toBe(true);
        });
    });

    describe('findByTaxCode', () => {
        it('should return null for short code', async () => {
            const res = await CustomerService.findByTaxCode('123');
            expect(res).toBeNull();
        });

        it('should query tax code', async () => {
            setupRestMock(mockCustomerRow);
            const res = await CustomerService.findByTaxCode('1234567890');
            expect(res?.id).toBe('c1');
        });
    });

    describe('search (basic query)', () => {
        it('returns empty if too short', async () => {
            expect(await CustomerService.search('a')).toEqual([]);
        });
        
        it('queries ilike when rpc fallback fails', async () => {
            (dataClient.rpc as any) = vi.fn().mockRejectedValue(new Error('RPC failed'));
            setupRestMock([mockCustomerRow]);
            
            const res = await CustomerService.search('Test');
            expect(res).toHaveLength(1);
        });
    });

    describe('findOrCreateSupplier', () => {
        it('finds existing', async () => {
            setupRestMock([mockCustomerRow]); // simulated existing
            const res = await CustomerService.findOrCreateSupplier('Test Customer');
            expect(res.id).toBe('c1');
        });
    });

    describe('Contacts', () => {
        it('getContacts', async () => {
            setupRestMock([mockContactRow]);
            const res = await CustomerService.getContacts('c1');
            expect(res).toHaveLength(1);
            expect(res[0].email).toBe('jane@test.com');
        });

        it('createContact', async () => {
            setupRestMock(mockContactRow);
            const res = await CustomerService.createContact({ customerId: 'c1', name: 'Jane Doe', email: 'jane@test.com', isPrimary: true } as any);
            expect(res.id).toBe('cont1');
        });

        it('updateContact', async () => {
             setupRestMock(mockContactRow);
             const res = await CustomerService.updateContact('cont1', { position: 'Director' });
             expect(res.id).toBe('cont1');
        });

        it('deleteContact', async () => {
             setupRestMock(null);
             const res = await CustomerService.deleteContact('cont1');
             expect(res).toBe(true);
        });
    });
});
