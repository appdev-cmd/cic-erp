import { dataClient as supabase } from '../lib/dataClient';
import { Space, Folder, TaskList } from '../types';

// ============================================================================
// SPACE SERVICE — Manage Spaces, Folders, Lists hierarchy
// ============================================================================

export const SpaceService = {
    // --- SPACES ---
    async listSpaces(): Promise<Space[]> {
        const { data, error } = await supabase
            .from('spaces')
            .select('*, folders(id, name, sort_order, is_archived), lists(id, name, folder_id, sort_order, is_archived)')
            .order('sort_order', { ascending: true });

        if (error) throw error;

        return (data || []).map((s: any) => ({
            ...s,
            folders: (s.folders || [])
                .filter((f: any) => !f.is_archived)
                .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)),
            lists: (s.lists || [])
                .filter((l: any) => !l.is_archived)
                .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)),
        }));
    },

    async getSpace(id: string): Promise<Space | null> {
        const { data, error } = await supabase
            .from('spaces')
            .select('*, folders(*, lists(*)), lists(*)')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    },

    async createSpace(space: Partial<Space>): Promise<Space> {
        const { data, error } = await supabase
            .from('spaces')
            .insert({
                name: space.name,
                description: space.description,
                unit_id: space.unit_id,
                color: space.color || '#6366f1',
                icon: space.icon || 'folder',
                is_private: space.is_private || false,
                settings: space.settings || {},
                sort_order: space.sort_order || 0,
                created_by: space.created_by,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateSpace(id: string, updates: Partial<Space>): Promise<Space> {
        const { data, error } = await supabase
            .from('spaces')
            .update({
                ...(updates.name !== undefined && { name: updates.name }),
                ...(updates.description !== undefined && { description: updates.description }),
                ...(updates.color !== undefined && { color: updates.color }),
                ...(updates.icon !== undefined && { icon: updates.icon }),
                ...(updates.is_private !== undefined && { is_private: updates.is_private }),
                ...(updates.settings !== undefined && { settings: updates.settings }),
                ...(updates.sort_order !== undefined && { sort_order: updates.sort_order }),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteSpace(id: string): Promise<void> {
        const { error } = await supabase.from('spaces').delete().eq('id', id);
        if (error) throw error;
    },

    // --- FOLDERS ---
    async createFolder(folder: Partial<Folder>): Promise<Folder> {
        const { data, error } = await supabase
            .from('folders')
            .insert({
                space_id: folder.space_id,
                name: folder.name,
                description: folder.description,
                color: folder.color,
                sort_order: folder.sort_order || 0,
                contract_id: folder.contract_id,
                project_id: folder.project_id,
                created_by: folder.created_by,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder> {
        const { data, error } = await supabase
            .from('folders')
            .update({
                ...(updates.name !== undefined && { name: updates.name }),
                ...(updates.description !== undefined && { description: updates.description }),
                ...(updates.color !== undefined && { color: updates.color }),
                ...(updates.is_archived !== undefined && { is_archived: updates.is_archived }),
                ...(updates.sort_order !== undefined && { sort_order: updates.sort_order }),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteFolder(id: string): Promise<void> {
        const { error } = await supabase.from('folders').delete().eq('id', id);
        if (error) throw error;
    },

    // --- LISTS ---
    async getListsBySpace(spaceId: string): Promise<TaskList[]> {
        const { data, error } = await supabase
            .from('lists')
            .select('*')
            .eq('space_id', spaceId)
            .eq('is_archived', false)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async createList(list: Partial<TaskList>): Promise<TaskList> {
        const { data, error } = await supabase
            .from('lists')
            .insert({
                space_id: list.space_id,
                folder_id: list.folder_id,
                name: list.name,
                description: list.description,
                statuses: list.statuses,
                default_assignee_id: list.default_assignee_id,
                sort_order: list.sort_order || 0,
                created_by: list.created_by,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateList(id: string, updates: Partial<TaskList>): Promise<TaskList> {
        const { data, error } = await supabase
            .from('lists')
            .update({
                ...(updates.name !== undefined && { name: updates.name }),
                ...(updates.description !== undefined && { description: updates.description }),
                ...(updates.statuses !== undefined && { statuses: updates.statuses }),
                ...(updates.is_archived !== undefined && { is_archived: updates.is_archived }),
                ...(updates.sort_order !== undefined && { sort_order: updates.sort_order }),
                ...(updates.wip_limits !== undefined && { wip_limits: updates.wip_limits }),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteList(id: string): Promise<void> {
        const { error } = await supabase.from('lists').delete().eq('id', id);
        if (error) throw error;
    },
};
