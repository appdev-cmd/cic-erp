import { dataClient as supabase } from '../lib/dataClient';
import {
    UserPermission,
    PermissionAction,
    PermissionResource,
    UserRole,
    DEFAULT_ROLE_PERMISSIONS
} from '../types';

// Helper to convert snake_case DB response to camelCase
const mapDbToPermission = (row: any): UserPermission => ({
    id: row.id,
    userId: row.user_id,
    resource: row.resource,
    actions: row.actions || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const PermissionService = {
    /**
     * Get all permissions for a user
     */
    async getByUserId(userId: string): Promise<UserPermission[]> {
        const { data, error } = await supabase
            .from('user_permissions')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        return (data || []).map(mapDbToPermission);
    },

    /**
     * Get permissions for multiple users (for admin view)
     */
    async getAll(): Promise<UserPermission[]> {
        const { data, error } = await supabase
            .from('user_permissions')
            .select('*');

        if (error) throw error;
        return (data || []).map(mapDbToPermission);
    },

    /**
     * Update or create permission for a user on a resource
     */
    async upsert(userId: string, resource: PermissionResource, actions: PermissionAction[]): Promise<UserPermission> {
        const { data, error } = await supabase
            .from('user_permissions')
            .upsert({
                user_id: userId,
                resource,
                actions,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,resource'
            })
            .select()
            .single();

        if (error) throw error;
        return mapDbToPermission(data);
    },

    /**
     * Initialize default permissions for a user based on their role
     */
    async initializeForUser(userId: string, role: UserRole): Promise<void> {
        const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role];
        if (!defaultPerms) return;

        const permissions = Object.entries(defaultPerms).map(([resource, actions]) => ({
            user_id: userId,
            resource,
            actions: actions || [],
            updated_at: new Date().toISOString(),
        }));

        if (permissions.length === 0) return;

        const { error } = await supabase
            .from('user_permissions')
            .upsert(permissions, { onConflict: 'user_id,resource' });

        if (error) throw error;
    },

    /**
     * Check if user has specific permission
     */
    async hasPermission(userId: string, resource: PermissionResource, action: PermissionAction): Promise<boolean> {
        const { data, error } = await supabase
            .from('user_permissions')
            .select('actions')
            .eq('user_id', userId)
            .eq('resource', resource)
            .single();

        if (error || !data) return false;
        return (data.actions || []).includes(action);
    },

    /**
     * Delete all permissions for a user
     */
    async deleteByUserId(userId: string): Promise<void> {
        const { error } = await supabase
            .from('user_permissions')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;
    },

    /**
     * Get default permissions for a role (without DB call)
     */
    getDefaultPermissions(role: UserRole): Partial<Record<PermissionResource, PermissionAction[]>> {
        return DEFAULT_ROLE_PERMISSIONS[role] || {};
    },
};
