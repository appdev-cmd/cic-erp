import { useQuery } from '@tanstack/react-query';
import { UnitService } from '../services';
import { queryKeys } from '../lib/queryClient';

// Get all units - cached permanently (staleTime: Infinity)
export function useUnits() {
    return useQuery({
        queryKey: queryKeys.units.all,
        queryFn: () => UnitService.getAll(),
        staleTime: Infinity, // Units rarely change, cache forever
    });
}

// Get units with stats (signing, revenue, profit) - cached 5 minutes
export function useUnitsWithStats(year?: number) {
    return useQuery({
        queryKey: [...queryKeys.units.all, 'withStats', year || new Date().getFullYear()],
        queryFn: () => UnitService.getWithStats(year),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
