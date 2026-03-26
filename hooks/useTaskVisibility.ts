// useTaskVisibility — Hook cho phân quyền theo dõi task theo cấp quản lý
// Trả về context visibility và hàm getVisibleTasks scoped theo user hiện tại

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { TaskService } from '../services/taskService';
import { dataClient as supabase } from '../lib/dataClient';
import type { Task, TaskFilterOptions, TaskVisibilityContext } from '../types/taskTypes';

export function useTaskVisibility() {
  const { profile } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const [managementRank, setManagementRank] = useState(0);
  const [managedUnitIds, setManagedUnitIds] = useState<string[]>([]);

  // Use impersonated user if active, otherwise current user
  const activeProfile = isImpersonating && impersonatedUser ? impersonatedUser : profile;
  const employeeId = activeProfile?.employeeId;

  // Fetch management fields from employees table
  useEffect(() => {
    if (!employeeId) return;
    supabase
      .from('employees')
      .select('management_rank, managed_unit_ids')
      .eq('id', employeeId)
      .single()
      .then(({ data }) => {
        if (data) {
          setManagementRank(data.management_rank || 0);
          setManagedUnitIds(data.managed_unit_ids || []);
        }
      });
  }, [employeeId]);

  const visibilityContext = useMemo((): TaskVisibilityContext => ({
    userId: employeeId || activeProfile?.id || '',
    role: activeProfile?.role || 'NVKD',
    managementRank,
    unitId: activeProfile?.unitId,
    managedUnitIds,
  }), [employeeId, activeProfile, managementRank, managedUnitIds]);

  const getVisibleTasks = useCallback(
    (filters?: TaskFilterOptions) => TaskService.getVisibleTasks(visibilityContext, filters),
    [visibilityContext]
  );

  const getMyTasks = useCallback(
    (filters?: TaskFilterOptions) => TaskService.getMyTasks(visibilityContext.userId, filters),
    [visibilityContext.userId]
  );

  return {
    visibilityContext,
    getVisibleTasks,
    getMyTasks,
    isAdmin: visibilityContext.role === 'Admin',
    isLeadership: visibilityContext.role === 'Leadership' || managementRank >= 100,
    isManager: managementRank >= 50 || ['Admin', 'Leadership', 'UnitLeader', 'AdminUnit'].includes(visibilityContext.role),
    canSeeAllTasks: visibilityContext.role === 'Admin',
  };
}
