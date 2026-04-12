import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskLinksTab } from '../../../../components/tasks/task-detail/TaskLinksTab';

// Setup Mocks
vi.mock('../../../../services/taskService', () => ({
    TaskService: {
        addLink: vi.fn(),
        updateLink: vi.fn(),
        removeLink: vi.fn(),
    }
}));

vi.mock('../../../../services/entityRegistryService', () => ({
    EntityRegistryService: {
        getAll: vi.fn().mockResolvedValue([{ entity_type: 'project', label: 'Dự án' }])
    }
}));

vi.mock('../../../../services/entitySearchService', () => ({
    EntitySearchService: {
        search: vi.fn()
    }
}));

// Mock LinkItem because it triggers other fetch effects if fully rendered
vi.mock('../../../../components/tasks/TaskDetailSubComponents', () => ({
    LinkItem: ({ link }: any) => (
        <div data-testid="mock-link-item">{link.entity_type}</div>
    )
}));

// Mock SearchableSelect 
vi.mock('../../../../components/ui/SearchableSelect', () => ({
    default: () => <div data-testid="searchable-select">Searchable Select</div>
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

describe('TaskLinksTab component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders no links placeholder correctly when empty', () => {
        const mockTask = { id: 'T1' } as any;
        const setLinks = vi.fn();
        const bufferChange = vi.fn();
        
        render(<TaskLinksTab task={mockTask} links={[]} setLinks={setLinks} profile={{}} bufferChange={bufferChange} />);
        
        expect(screen.getByText('Chưa có liên kết phụ nào')).toBeInTheDocument();
        expect(screen.getByText(/Thêm liên kết chính/i)).toBeInTheDocument();
    });

    it('renders links if provided', () => {
        const mockTask = { id: 'T1' } as any;
        const setLinks = vi.fn();
        const bufferChange = vi.fn();
        const links = [
            { id: 'L1', task_id: 'T1', entity_type: 'contract', entity_id: 'C1', entity_label: 'Hợp đồng 1' }
        ];

        render(<TaskLinksTab task={mockTask} links={links} setLinks={setLinks} profile={{}} bufferChange={bufferChange} />);
        
        // LinkItem is mocked, check for the mock rendering output
        expect(screen.getByTestId('mock-link-item')).toHaveTextContent('contract');
        expect(screen.getByText(/Liên kết khác/i)).toBeInTheDocument();
    });

    it('allows opening the add link form', () => {
        const mockTask = { id: 'T1' } as any;
        const setLinks = vi.fn();
        const bufferChange = vi.fn();

        render(<TaskLinksTab task={mockTask} links={[]} setLinks={setLinks} profile={{}} bufferChange={bufferChange} />);
        
        const addBtn = screen.getByText('Thêm liên kết');
        fireEvent.click(addBtn);

        expect(screen.getByText('Loại liên kết')).toBeInTheDocument();
        expect(screen.getByText('Thêm liên kết mới')).toBeInTheDocument();
    });
});
