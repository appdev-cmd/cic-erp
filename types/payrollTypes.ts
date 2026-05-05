// ============================================================
// Payroll System — TypeScript Types
// Cấu trúc lương, Phiếu lương, Thuế TNCN (7 bậc), Bảo hiểm
// ============================================================

export type SalaryComponentType = 'earning' | 'deduction' | 'benefit';
export type PayrollStatus = 'draft' | 'calculating' | 'review' | 'approved' | 'paid';

// ── 1. Salary Components ──
export interface SalaryComponent {
    id: string;
    name: string;
    code: string;
    type: SalaryComponentType;
    is_taxable: boolean;
    is_fixed: boolean;
    default_amount: number;
    formula: string | null;
    description: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

// ── 2. Payroll Runs ──
export interface PayrollRun {
    id: string;
    month: number;
    year: number;
    unit_id: string | null;
    status: PayrollStatus;
    total_gross: number;
    total_net: number;
    total_insurance: number;
    total_tax: number;
    calculated_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    unit_name?: string;
    calculator_name?: string;
    approver_name?: string;
}

// ── 3. Payslips ──
export interface PayslipItem {
    code: string;
    name: string;
    amount: number;
    is_taxable?: boolean;
}

export interface Payslip {
    id: string;
    payroll_run_id: string;
    employee_id: string;
    work_days: number;
    ot_hours: number;
    basic_salary: number;
    earnings: PayslipItem[];
    deductions: PayslipItem[];

    gross_salary: number;
    insurance_employee: number;
    insurance_employer: number;
    taxable_income: number;
    tax_amount: number;
    net_salary: number;

    notes: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    employee_name?: string;
    employee_code?: string;
    department_name?: string;
}

// ── 4. Insurance & Tax ──
export interface InsuranceRecord {
    id: string;
    employee_id: string;
    month: number;
    year: number;
    bhxh_base: number;
    bhxh_employee: number;
    bhxh_employer: number;
    bhyt_employee: number;
    bhyt_employer: number;
    bhtn_employee: number;
    bhtn_employer: number;
}

export interface TaxRecord {
    id: string;
    employee_id: string;
    month: number;
    year: number;
    taxable_income: number;    // Tổng thu nhập chịu thuế
    dependents_count: number;  // Số người phụ thuộc
    personal_deduction: number;// Giảm trừ bản thân (Fix 11,000,000 VND)
    dependent_deduction: number;// Giảm trừ người phụ thuộc (4,400,000 VND/người)
    total_deductions: number;  // Tổng giảm trừ
    assessable_income: number; // Thu nhập tính thuế = taxable_income - total_deductions
    tax_amount: number;        // Thuế phải nộp sau khi áp lũy tiến
}
