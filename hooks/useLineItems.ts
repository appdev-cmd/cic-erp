import { useState, useCallback } from 'react';
import { LineItem, DirectCostDetail } from '../types';

/**
 * Shared hook for managing line items with direct costs.
 * Used by both ContractForm and ContractBusinessPlanTab.
 */
export function useLineItems(initialItems: LineItem[] = []) {
    const [lineItems, setLineItems] = useState<LineItem[]>(
        initialItems.length > 0 ? initialItems : [{
            id: '1', name: '', quantity: 1,
            inputPrice: 0, outputPrice: 0, directCosts: 0,
            directCostDetails: [], supplier: '',
            vatRate: 0
        }]
    );

    // Direct cost modal state
    const [activeCostModalIndex, setActiveCostModalIndex] = useState<number | null>(null);
    const [tempCostDetails, setTempCostDetails] = useState<DirectCostDetail[]>([]);

    const addLineItem = useCallback(() => {
        setLineItems(prev => [...prev, {
            id: Date.now().toString(),
            name: '', quantity: 1,
            inputPrice: 0, outputPrice: 0, directCosts: 0,
            directCostDetails: [], supplier: '',
            manufacturer: '', manufacturerId: undefined,
            vatRate: 0
        }]);
    }, []);

    const removeLineItem = useCallback((id: string) => {
        setLineItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const updateLineItem = useCallback((index: number, field: keyof LineItem, value: any) => {
        setLineItems(prev => {
            const newList = [...prev];
            (newList[index] as any)[field] = value;
            return newList;
        });
    }, []);

    const openCostModal = useCallback((index: number) => {
        setActiveCostModalIndex(index);
        setTempCostDetails(lineItems[index].directCostDetails || []);
    }, [lineItems]);

    const saveCostModal = useCallback(() => {
        if (activeCostModalIndex === null) return;

        const totalAmount = tempCostDetails.reduce((acc, item) => acc + item.amount, 0);

        setLineItems(prev => {
            const newList = [...prev];
            newList[activeCostModalIndex].directCostDetails = tempCostDetails;
            newList[activeCostModalIndex].directCosts = totalAmount;
            return newList;
        });
        setActiveCostModalIndex(null);
    }, [activeCostModalIndex, tempCostDetails]);

    const closeCostModal = useCallback(() => {
        setActiveCostModalIndex(null);
    }, []);

    return {
        lineItems, setLineItems,
        addLineItem, removeLineItem, updateLineItem,
        // Cost modal
        activeCostModalIndex, tempCostDetails, setTempCostDetails,
        openCostModal, saveCostModal, closeCostModal,
    };
}
