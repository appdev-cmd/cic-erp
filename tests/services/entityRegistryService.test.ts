import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntityRegistryService } from '../../services/entityRegistryService';
import { dataClient } from '../../lib/dataClient';

// Mock the Supabase client
vi.mock('../../lib/dataClient', () => {
    const mockSupabase = {
        from: vi.fn(),
    };
    return { dataClient: mockSupabase };
});

describe('EntityRegistryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        EntityRegistryService.clearCache();
    });

    const mockData = [
        { entity_type: 'contract', label: 'Hợp đồng', url_pattern: '/contracts/:id', icon: 'FileText', color: 'blue' },
        { entity_type: 'customer', label: 'Khách hàng', url_pattern: '/customers/:id', icon: 'Users', color: 'green' }
    ];

    const setupMock = (data: any = mockData, error: any = null) => {
        const selectMock = vi.fn().mockReturnThis();
        const eqMock = vi.fn().mockReturnThis();
        const orderMock = vi.fn().mockResolvedValue({ data, error });
        
        // Single/insert operations
        const insertMock = vi.fn().mockReturnThis();
        const updateMock = vi.fn().mockReturnThis();
        const singleMock = vi.fn().mockResolvedValue({ data: data ? data[0] : null, error });

        // Build the chain
        const fromMock = vi.fn().mockReturnValue({
            select: selectMock,
            eq: eqMock,
            order: orderMock,
            insert: insertMock,
            update: updateMock,
            single: singleMock
        });

        (dataClient.from as any) = fromMock;
    };

    describe('getAll', () => {
        it('fetches from database and caches result', async () => {
            setupMock();
            const result1 = await EntityRegistryService.getAll();
            expect(result1).toHaveLength(2);
            expect(dataClient.from).toHaveBeenCalledTimes(1);

            // Second call should use cache
            const result2 = await EntityRegistryService.getAll();
            expect(result2).toEqual(result1);
            expect(dataClient.from).toHaveBeenCalledTimes(1); // Still 1, cache was used
        });

        it('throws error if db fails', async () => {
            setupMock(null, new Error('DB Error'));
            await expect(EntityRegistryService.getAll()).rejects.toThrow('DB Error');
        });
    });

    describe('getByType', () => {
        it('returns correct entity info by type', async () => {
            setupMock();
            const result = await EntityRegistryService.getByType('contract');
            expect(result?.label).toBe('Hợp đồng');
            
            const notFound = await EntityRegistryService.getByType('unknown');
            expect(notFound).toBeNull();
        });
    });

    describe('resolveUrl', () => {
        it('replaces :id in url pattern', async () => {
            setupMock();
            const url = await EntityRegistryService.resolveUrl('contract', '123');
            expect(url).toBe('/contracts/123');
        });

        it('replaces extra params', async () => {
            setupMock([{ entity_type: 'task', url_pattern: '/tasks/:id/edit/:tab' }]);
            const url = await EntityRegistryService.resolveUrl('task', '555', { tab: 'comments' });
            expect(url).toBe('/tasks/555/edit/comments');
        });

        it('returns null if entity type not found or no url_pattern', async () => {
            setupMock();
            const url = await EntityRegistryService.resolveUrl('unknown', '123');
            expect(url).toBeNull();
        });
    });

    describe('getIconMap', () => {
        it('returns map of entity_type to icon string', async () => {
            setupMock();
            const icons = await EntityRegistryService.getIconMap();
            expect(icons['contract']).toBe('FileText');
            expect(icons['customer']).toBe('Users');
        });
    });

    describe('getColorMap', () => {
        it('returns map of entity_type to color string', async () => {
            setupMock();
            const colors = await EntityRegistryService.getColorMap();
            expect(colors['contract']).toBe('blue');
            expect(colors['customer']).toBe('green');
        });
    });

    describe('create', () => {
        it('inserts new entity and clears cache', async () => {
            const newItem = { entity_type: 'new_type', label: 'New Type' };
            setupMock([newItem]);
            
            const result = await EntityRegistryService.create(newItem);
            expect(result.entity_type).toBe('new_type');
            expect(dataClient.from).toHaveBeenCalledWith('entity_registry');
        });
        
        it('throws error if insert fails', async () => {
            const newItem = { entity_type: 'new_type', label: 'New Type' };
            setupMock(null, new Error('Insert Error'));
            await expect(EntityRegistryService.create(newItem)).rejects.toThrow('Insert Error');
        });
    });

    describe('update', () => {
        it('updates entity and clears cache', async () => {
            const updatedItem = { entity_type: 'contract', label: 'Updated Label' };
            setupMock([updatedItem]);
            
            const result = await EntityRegistryService.update('contract', { label: 'Updated Label' });
            expect(result).toEqual(updatedItem);
        });

        it('throws error if update fails', async () => {
            setupMock(null, new Error('Update Error'));
            await expect(EntityRegistryService.update('contract', { label: 'Updated Label' })).rejects.toThrow('Update Error');
        });
    });
});
