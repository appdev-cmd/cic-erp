import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from '../../services/projectService';
import { dataClient } from '../../lib/dataClient';
import { BIMProjectStatus } from '../../types';

// Mock the Supabase client
vi.mock('../../lib/dataClient', () => {
    const mockSupabase = {
        from: vi.fn(),
    };
    return { dataClient: mockSupabase };
});

describe('ProjectService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockRow = {
        id: 'p1',
        code: 'PROJ-01',
        name: 'Test Project',
        thumbnail_url: '/img.png',
        status: 'TIEM_NANG' as BIMProjectStatus,
        location: 'Hanoi',
        progress: 50,
        client_name: 'Client A',
        customer_id: 'c1',
        unit_id: 'u1',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        description: 'Test description',
        contract_value: 1000000,
        notes: 'Some notes',
        folder_potential_url: '/potential',
        folder_ongoing_url: '/ongoing',
        service_type: 'BIM',
        project_group: 'Group A',
        construction_type: 'Civil',
        construction_grade: 'Grade 1',
        area: 500,
        project_phase: 'Design',
        contract_id: 'contract1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
    };

    const setupMock = (data: any = [mockRow], error: any = null) => {
        const selectMock = vi.fn().mockReturnThis();
        const eqMock = vi.fn().mockReturnThis();
        const orderMock = vi.fn().mockResolvedValue({ data, error });
        
        const insertMock = vi.fn().mockReturnThis();
        const updateMock = vi.fn().mockReturnThis();
        const deleteEqMock = vi.fn().mockResolvedValue({ error });
        const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });
        const singleMock = vi.fn().mockResolvedValue({ data: data ? (Array.isArray(data) ? data[0] : data) : null, error });

        const fromMock = vi.fn().mockReturnValue({
            select: selectMock,
            eq: eqMock,
            order: orderMock,
            insert: insertMock,
            update: updateMock,
            delete: deleteMock,
            single: singleMock
        });

        (dataClient.from as any) = fromMock;
    };

    describe('getAll', () => {
        it('should map rows to projects', async () => {
            setupMock([mockRow]);
            const projects = await ProjectService.getAll();
            expect(dataClient.from).toHaveBeenCalledWith('projects');
            expect(projects).toHaveLength(1);
            expect(projects[0].id).toBe('p1');
            expect(projects[0].name).toBe('Test Project');
            expect(projects[0].contractValue).toBe(1000000);
        });

        it('should throw an error if db fails', async () => {
            setupMock(null, new Error('DB Error GetAll'));
            await expect(ProjectService.getAll()).rejects.toThrow('DB Error GetAll');
        });
    });

    describe('getById', () => {
        it('should retrieve a single project by id', async () => {
            setupMock(mockRow); // return a single object (mock single() logic handles it)
            const project = await ProjectService.getById('p1');
            expect(project).not.toBeNull();
            expect(project?.id).toBe('p1');
        });

        it('should return null if not found', async () => {
            setupMock(null);
            const project = await ProjectService.getById('p2');
            expect(project).toBeNull();
        });

        it('should throw an error if db fails', async () => {
            setupMock(null, new Error('DB Error GetById'));
            await expect(ProjectService.getById('p1')).rejects.toThrow('DB Error GetById');
        });
    });

    describe('create', () => {
        it('should insert and map to project', async () => {
            setupMock(mockRow);
            const newProjectData = { name: 'Test Project', code: 'PROJ-01' };
            const project = await ProjectService.create(newProjectData);
            expect(project.id).toBe('p1');
            expect(dataClient.from).toHaveBeenCalledWith('projects');
        });

        it('should throw an error if insert fails', async () => {
            setupMock(null, new Error('DB Error Create'));
            await expect(ProjectService.create({ name: 'Test' })).rejects.toThrow('DB Error Create');
        });
    });

    describe('update', () => {
        it('should update and return project', async () => {
            setupMock(mockRow);
            const project = await ProjectService.update('p1', { name: 'Updated Name', progress: 80 });
            expect(project.id).toBe('p1');
            expect(dataClient.from).toHaveBeenCalledWith('projects');
        });

        it('should throw an error if update fails', async () => {
            setupMock(null, new Error('DB Error Update'));
            await expect(ProjectService.update('p1', { name: 'Test' })).rejects.toThrow('DB Error Update');
        });
    });

    describe('delete', () => {
        it('should delete project', async () => {
            setupMock();
            await ProjectService.delete('p1');
            expect(dataClient.from).toHaveBeenCalledWith('projects');
        });

        it('should throw an error if delete fails', async () => {
            setupMock(null, new Error('DB Error Delete'));
            await expect(ProjectService.delete('p1')).rejects.toThrow('DB Error Delete');
        });
    });
});
