// Shared types and utilities for ContractForm sub-components
import { Unit, Employee, Customer, Product, LineItem, ContractContact, PaymentSchedule, AdministrativeCosts, DirectCostDetail } from '../../types';

// Props interface for Step 1: General Info
export interface StepInfoProps {
    // Data options
    units: Unit[];
    salespeople: Employee[];
    suppliers: Customer[];

    // Form values
    contractType: string;
    unitId: string;
    coordinatingUnitId: string;
    salespersonId: string;
    customerId: string | null;
    title: string;
    clientName: string;
    signedDate: string;
    contacts: ContractContact[];

    // Setters
    setContractType: (v: string) => void;
    setUnitId: (v: string) => void;
    setCoordinatingUnitId: (v: string) => void;
    setSalespersonId: (v: string) => void;
    setCustomerId: (v: string | null) => void;
    setClientName: (v: string) => void;
    setTitle: (v: string) => void;
    setSignedDate: (v: string) => void;
    setContacts: (v: ContractContact[]) => void;

    // Handlers
    addContact: () => void;
    removeContact: (id: string) => void;
}

// Props interface for Step 2: Business & Costs
export interface StepBusinessProps {
    // Data options
    products: Product[];
    suppliers: Customer[];

    // Line Items
    lineItems: LineItem[];
    setLineItems: (items: LineItem[]) => void;
    addLineItem: () => void;
    removeLineItem: (id: string) => void;




    // Cost Modal
    openCostModal: (index: number) => void;

    // Financial summary
    totals: {
        signingValue: number;
        estimatedRevenue: number;
        totalCosts: number;
        grossProfit: number;
        profitMargin: number;
    };

    // Helpers
    formatVND: (val: number) => string;
}

// Props interface for Step 3: Financial Schedules
export interface StepFinanceProps {
    // Schedules
    paymentSchedules: PaymentSchedule[];
    supplierSchedules: PaymentSchedule[];
    setPaymentSchedules: (schedules: PaymentSchedule[]) => void;
    setSupplierSchedules: (schedules: PaymentSchedule[]) => void;

    // Generate supplier schedules
    generateSupplierSchedules: () => void;

    // Financial summary
    totals: {
        signingValue: number;
        totalCashIn: number;
        totalCashOut: number;
        netCashFlow: number;
    };

    // Helpers
    formatVND: (val: number) => string;
}

// Utility to format VND
export const formatVND = (val: number): string => {
    return new Intl.NumberFormat('vi-VN').format(val);
};
