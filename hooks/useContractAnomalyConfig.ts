import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ContractAnomalyConfigService } from '../services/contractAnomalyConfigService';
import { usePermissionCheck } from './usePermissions';
import { DEFAULT_ANOMALY_RULES } from '../lib/contractAnomalies';
import type { AnomalyRuleConfig } from '../types/contractAnomaly';

const QUERY_KEY = ['contract-anomaly-rules'] as const;

/**
 * Hook cấu hình luật rà soát hợp đồng bất thường.
 *  - `rules`: danh mục luật đã merge với mặc định (fallback DEFAULT khi chưa load).
 *  - `save(rules)`: Admin ghi cấu hình mới.
 *  - `reset()`: khôi phục mặc định (xóa bản ghi DB).
 */
export function useContractAnomalyConfig() {
    const { employeeId } = usePermissionCheck();
    const queryClient = useQueryClient();

    const { data: rules = DEFAULT_ANOMALY_RULES, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: () => ContractAnomalyConfigService.getRules(),
        staleTime: 10 * 60 * 1000,
    });

    const saveMutation = useMutation({
        mutationFn: (next: AnomalyRuleConfig[]) =>
            ContractAnomalyConfigService.saveRules(next, employeeId || undefined),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });

    const resetMutation = useMutation({
        mutationFn: () => ContractAnomalyConfigService.resetRules(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });

    // Trả Promise để UI await được kết quả thật (thành công/lỗi), tránh báo nhầm.
    const save = useCallback((next: AnomalyRuleConfig[]) => saveMutation.mutateAsync(next), [saveMutation]);
    const reset = useCallback(() => resetMutation.mutateAsync(), [resetMutation]);

    return {
        rules,
        isLoading,
        save,
        reset,
        isSaving: saveMutation.isPending,
    };
}
