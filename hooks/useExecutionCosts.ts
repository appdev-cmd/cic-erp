// Shared hook for managing execution costs (Chi phí thực hiện)
// Used by both ContractForm and ContractBusinessPlanTab
import { useState, useCallback } from 'react';
import { ExecutionCostItem } from '../types';

export function useExecutionCosts(initialCosts: ExecutionCostItem[] = []) {
    const [executionCosts, setExecutionCosts] = useState<ExecutionCostItem[]>(initialCosts);

    const addExecutionCost = useCallback(() => {
        setExecutionCosts(prev => [
            ...prev,
            { id: `exec-${Date.now()}`, name: '', amount: 0, percentage: 0 }
        ]);
    }, []);

    const removeExecutionCost = useCallback((id: string) => {
        setExecutionCosts(prev => prev.filter(c => c.id !== id));
    }, []);

    /**
     * Update a single field. Pass `revenue` to auto-calc percentage↔amount.
     */
    const updateExecutionCost = useCallback((id: string, field: keyof ExecutionCostItem, value: any, revenue?: number) => {
        setExecutionCosts(prev => prev.map(c => {
            if (c.id !== id) return c;
            const newCost = { ...c, [field]: value };

            if (revenue && revenue > 0) {
                if (field === 'amount') {
                    newCost.percentage = Number(((value / revenue) * 100).toFixed(2));
                }
                if (field === 'percentage') {
                    newCost.amount = Math.round((value / 100) * revenue);
                }
            }
            return newCost;
        }));
    }, []);

    return {
        executionCosts,
        setExecutionCosts,
        addExecutionCost,
        removeExecutionCost,
        updateExecutionCost,
    };
}

