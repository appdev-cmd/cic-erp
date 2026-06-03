import { useState, useCallback } from 'react';
import { LineItem, DirectCostDetail } from '../types';

// Auto-cost IDs & name patterns (mirroring DirectCostModal)
const AUTO_TAX_ID = '__auto_contractor_tax__';
const AUTO_TRANSFER_ID = '__auto_transfer_fee__';
const TAX_NAMES = ['thuế nhà thầu', 'thue nha thau'];
const TRANSFER_NAMES = ['phí chuyển tiền', 'phi chuyen tien'];
const isAutoTaxEntry = (d: DirectCostDetail) => d.id === AUTO_TAX_ID || TAX_NAMES.some(n => d.name.toLowerCase().includes(n));
const isAutoTransferEntry = (d: DirectCostDetail) => d.id === AUTO_TRANSFER_ID || TRANSFER_NAMES.some(n => d.name.toLowerCase().includes(n));

/**
 * Recalculates auto-calculated costs (contractor tax, transfer fee) for a list of line items.
 * Accounts for supplier total value changes and redistribution.
 */
export function recalculateAutoCostsForList(items: LineItem[]): LineItem[] {
    // Group items by supplier to calculate supplierTotalValue
    const supplierGroups: Record<string, { totalVal: number; items: LineItem[] }> = {};
    items.forEach(item => {
        if (!item.supplier) return;
        if (!supplierGroups[item.supplier]) {
            supplierGroups[item.supplier] = { totalVal: 0, items: [] };
        }
        const itemVal = (item.quantity || 0) * (item.inputPrice || 0);
        supplierGroups[item.supplier].totalVal += itemVal;
        supplierGroups[item.supplier].items.push(item);
    });

    return items.map(item => {
        const itemValue = (item.quantity || 0) * (item.inputPrice || 0);
        const details = item.directCostDetails || [];
        
        const hasTax = details.some(d => isAutoTaxEntry(d));
        const transferEntry = details.find(d => isAutoTransferEntry(d));
        
        if (!hasTax && !transferEntry) {
            return item;
        }

        // Detect transfer fee type and USD rate
        let transferType: 'none' | 'domestic' | 'international' = 'none';
        let usdRate = 25400; // default rate
        if (transferEntry) {
            transferType = (transferEntry.name.includes('nước ngoài') || transferEntry.name.includes('international')) 
                ? 'international' 
                : 'domestic';
            
            if (item.foreignCurrency?.rate && item.foreignCurrency.currency === 'USD') {
                usdRate = item.foreignCurrency.rate;
            } else if (transferEntry.formula) {
                // Try to extract USD rate from formula
                const match = transferEntry.formula.match(/\+10\*(\d+)/);
                if (match) {
                    usdRate = Number(match[1]);
                }
            }
        }

        // Clean up current auto entries, keeping locked ones
        const lockedTax = details.find(d => isAutoTaxEntry(d) && d.isLocked);
        const lockedTransfer = details.find(d => isAutoTransferEntry(d) && d.isLocked);

        let newDetails = details.filter(d => !isAutoTaxEntry(d) && !isAutoTransferEntry(d));

        // 1. Calculate Contractor Tax
        if (hasTax) {
            if (lockedTax) {
                newDetails = [lockedTax, ...newDetails];
            } else {
                const taxAmount = Math.round(itemValue / 0.9 * 0.1);
                newDetails = [
                    { id: AUTO_TAX_ID, name: 'Thuế nhà thầu', amount: taxAmount, formula: `${itemValue}/0.9*0.1` },
                    ...newDetails
                ];
            }
        }

        // 2. Calculate Transfer Fee
        if (transferType !== 'none' && item.supplier) {
            if (lockedTransfer) {
                const insertIdx = newDetails.findIndex(d => d.id === AUTO_TAX_ID);
                if (insertIdx >= 0) {
                    newDetails.splice(insertIdx + 1, 0, lockedTransfer);
                } else {
                    newDetails = [lockedTransfer, ...newDetails];
                }
            } else {
                const group = supplierGroups[item.supplier];
                const supplierTotalValue = group ? group.totalVal : itemValue;
                const stv = Math.max(supplierTotalValue, itemValue, 1);

                let fee = 0;
                let formula = '';
                if (transferType === 'domestic') {
                    const totalSupplierFee = Math.max(Math.round(stv * 0.0007), 22000);
                    fee = Math.round(totalSupplierFee * (itemValue / stv));
                    formula = stv > itemValue
                        ? `Max(${stv}*0.07%,22k)*(${itemValue}/${stv})`
                        : `Max(${itemValue}*0.07%,22k)`;
                } else if (transferType === 'international') {
                    fee = Math.round(itemValue * 0.005 + 10 * usdRate * (itemValue / stv));
                    formula = stv > itemValue
                        ? `${itemValue}*0.5%+10*${usdRate}*(${itemValue}/${stv})`
                        : `${itemValue}*0.5%+10*${usdRate}`;
                }

                const label = transferType === 'domestic'
                    ? 'Phí chuyển tiền trong nước'
                    : 'Phí chuyển tiền nước ngoài';

                const insertIdx = newDetails.findIndex(d => d.id === AUTO_TAX_ID);
                const newTransferEntry = { id: AUTO_TRANSFER_ID, name: label, amount: fee, formula };
                if (insertIdx >= 0) {
                    newDetails.splice(insertIdx + 1, 0, newTransferEntry);
                } else {
                    newDetails = [newTransferEntry, ...newDetails];
                }
            }
        }

        const totalAmount = newDetails.reduce((acc, d) => acc + d.amount, 0);

        return {
            ...item,
            directCostDetails: newDetails,
            directCosts: totalAmount
        };
    });
}

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
            name: '', productId: undefined, productName: '',
            quantity: 1,
            inputPrice: 0, outputPrice: 0, directCosts: 0,
            directCostDetails: [], supplier: '',
            manufacturer: '', manufacturerId: undefined,
            vatRate: 0
        }]);
    }, []);

    const removeLineItem = useCallback((id: string) => {
        setLineItems(prev => {
            const newList = prev.filter(item => item.id !== id);
            return recalculateAutoCostsForList(newList);
        });
    }, []);

    const updateLineItem = useCallback((index: number, field: keyof LineItem, value: any) => {
        setLineItems(prev => {
            const newList = [...prev];
            (newList[index] as any)[field] = value;
            return recalculateAutoCostsForList(newList);
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
            // Recalculate other items from the same supplier as supplierTotalValue may have changed
            return recalculateAutoCostsForList(newList);
        });
        setActiveCostModalIndex(null);
    }, [activeCostModalIndex, tempCostDetails]);

    const closeCostModal = useCallback(() => {
        setActiveCostModalIndex(null);
    }, []);

    const applySupplierAutoCosts = useCallback((
        supplier: string,
        tax: boolean,
        transferType: 'none' | 'domestic' | 'international',
        rate: number
    ) => {
        if (!supplier) return;
        
        setLineItems(prev => {
            // 1. Calculate supplier-level metrics
            const supplierItems = prev.filter(item => item.supplier === supplier);
            const supplierTotalValue = supplierItems.reduce((acc, item) => acc + (item.quantity || 0) * (item.inputPrice || 0), 0);

            const calculated = prev.map(item => {
                if (item.supplier !== supplier) return item;

                const itemValue = (item.quantity || 0) * (item.inputPrice || 0);
                
                // Filter out current auto costs
                let newDetails = (item.directCostDetails || []).filter(d => !isAutoTaxEntry(d) && !isAutoTransferEntry(d));

                // Add tax if checked
                if (tax) {
                    const taxAmount = Math.round(itemValue / 0.9 * 0.1);
                    newDetails = [
                        { id: AUTO_TAX_ID, name: 'Thuế nhà thầu', amount: taxAmount, formula: `${itemValue}/0.9*0.1` },
                        ...newDetails
                    ];
                }

                // Add transfer fee if checked
                if (transferType !== 'none') {
                    let fee = 0;
                    let formula = '';
                    if (transferType === 'domestic') {
                        const stv = Math.max(supplierTotalValue, itemValue, 1);
                        const totalSupplierFee = Math.max(Math.round(stv * 0.0007), 22000);
                        fee = Math.round(totalSupplierFee * (itemValue / stv));
                        formula = stv > itemValue
                            ? `Max(${stv}*0.07%,22k)*(${itemValue}/${stv})`
                            : `Max(${itemValue}*0.07%,22k)`;
                    } else if (transferType === 'international') {
                        const stv = Math.max(supplierTotalValue, itemValue, 1);
                        fee = Math.round(itemValue * 0.005 + 10 * rate * (itemValue / stv));
                        formula = stv > itemValue
                            ? `${itemValue}*0.5%+10*${rate}*(${itemValue}/${stv})`
                            : `${itemValue}*0.5%+10*${rate}`;
                    }

                    const label = transferType === 'domestic'
                        ? 'Phí chuyển tiền trong nước'
                        : 'Phí chuyển tiền nước ngoài';

                    // Insert after tax if present
                    const insertIdx = newDetails.findIndex(d => d.id === AUTO_TAX_ID);
                    const transferEntry = { id: AUTO_TRANSFER_ID, name: label, amount: fee, formula };
                    if (insertIdx >= 0) {
                        newDetails.splice(insertIdx + 1, 0, transferEntry);
                    } else {
                        newDetails = [transferEntry, ...newDetails];
                    }
                }

                const totalAmount = newDetails.reduce((acc, d) => acc + d.amount, 0);

                return {
                    ...item,
                    directCostDetails: newDetails,
                    directCosts: totalAmount
                };
            });

            return recalculateAutoCostsForList(calculated);
        });
    }, []);

    return {
        lineItems, setLineItems,
        addLineItem, removeLineItem, updateLineItem,
        // Cost modal
        activeCostModalIndex, tempCostDetails, setTempCostDetails,
        openCostModal, saveCostModal, closeCostModal,
        applySupplierAutoCosts,
    };
}

