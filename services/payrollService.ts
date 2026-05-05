// ============================================================
// Payroll Service — CIC ERP
// Chịu trách nhiệm tổng hợp công, phụ cấp, bảo hiểm, tính thuế
// ============================================================

import { dataClient as supabase } from '../lib/dataClient';
import type {
    SalaryComponent,
    PayrollRun,
    Payslip,
    InsuranceRecord,
    TaxRecord,
    PayslipItem
} from '../types/payrollTypes';

export const PayrollService = {

    // ══════════════════════════════════════════
    // Salary Components (Danh mục cấu trúc lương)
    // ══════════════════════════════════════════

    async getSalaryComponents(): Promise<SalaryComponent[]> {
        const { data, error } = await supabase
            .from('salary_components')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as SalaryComponent[];
    },

    async updateSalaryComponent(id: string, updates: Partial<SalaryComponent>): Promise<SalaryComponent> {
        const { data, error } = await supabase
            .from('salary_components')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as SalaryComponent;
    },

    // ══════════════════════════════════════════
    // Payroll Runs (Kỳ lương)
    // ══════════════════════════════════════════

    async getPayrollRuns(year: number): Promise<PayrollRun[]> {
        const { data, error } = await supabase
            .from('payroll_runs')
            .select(`
        *,
        unit:units!unit_id(name),
        calc:employees!calculated_by(name),
        app:employees!approved_by(name)
      `)
            .eq('year', year)
            .order('month', { ascending: false });
        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            unit_name: row.unit?.name,
            calculator_name: row.calc?.name,
            approver_name: row.app?.name,
        })) as PayrollRun[];
    },

    async createPayrollRun(month: number, year: number, unitId: string | null): Promise<PayrollRun> {
        // 1. Create the run
        const { data: run, error: runError } = await supabase
            .from('payroll_runs')
            .insert({ month, year, unit_id: unitId, status: 'draft' })
            .select()
            .single();
        if (runError) throw runError;
        return run as PayrollRun;
    },

    async getPayslips(payrollRunId: string): Promise<Payslip[]> {
        const { data, error } = await supabase
            .from('payslips')
            .select(`
        *,
        employee:employees!employee_id(name, employee_code, departments!department_id(name))
      `)
            .eq('payroll_run_id', payrollRunId)
            .order('employee_id', { ascending: true });

        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            employee_name: row.employee?.name,
            employee_code: row.employee?.employee_code,
            department_name: row.employee?.departments?.name,
        })) as Payslip[];
    },

    // ══════════════════════════════════════════
    // Logic Tính toán
    // ══════════════════════════════════════════

    /**
     * Tính Thuế TNCN (Personal Income Tax) 7 bậc theo luật VN
     * @param assessableIncome Thu nhập tính thuế (đã trừ bảo hiểm và giảm trừ)
     * @returns Số thuế phải nộp
     */
    calculatePIT(assessableIncome: number): number {
        if (assessableIncome <= 0) return 0;

        let tax = 0;
        if (assessableIncome <= 5_000_000) {
            tax = assessableIncome * 0.05;
        } else if (assessableIncome <= 10_000_000) {
            tax = assessableIncome * 0.1 - 250_000;
        } else if (assessableIncome <= 18_000_000) {
            tax = assessableIncome * 0.15 - 750_000;
        } else if (assessableIncome <= 32_000_000) {
            tax = assessableIncome * 0.2 - 1_650_000;
        } else if (assessableIncome <= 52_000_000) {
            tax = assessableIncome * 0.25 - 3_250_000;
        } else if (assessableIncome <= 80_000_000) {
            tax = assessableIncome * 0.3 - 5_850_000;
        } else {
            tax = assessableIncome * 0.35 - 9_850_000;
        }

        return Math.max(0, tax);
    },

    /**
     * Calculate payroll for a specific run.
     * NOTE: In a real system, this would be a large background job or Edge Function.
     * For the MVP, we aggregate data straight from Supabase logic here.
     */
    async calculatePayroll(runId: string, month: number, year: number, unitId: string | null): Promise<void> {
        // 1. Update status
        await supabase.from('payroll_runs').update({ status: 'calculating' }).eq('id', runId);

        try {
            // 2. Fetch components
            const components = await this.getSalaryComponents();

            // 3. Dummy logic to simulate gathering all employees, attendance, and contracts.
            // In reality: 
            // - Get all employees in unitId.
            // - Get active contract basic_salary.
            // - Get attendance_records sums (work_days, ot_hours).
            // - Since we lack some of the active contract hooks in this MVP script, we'll fetch employees and use a base dummy contract.
            // TODO: Replace with real contract fetching

            let empQuery = supabase.from('employees').select('id, name, employee_code, dependents_count');
            if (unitId) empQuery = empQuery.eq('unit_id', unitId);
            const { data: emps, error: empError } = await empQuery;
            if (empError) throw empError;

            // Xóa payslips cũ của kỳ này nếu có (tính lại)
            await supabase.from('payslips').delete().eq('payroll_run_id', runId);
            await supabase.from('insurance_records').delete().eq('month', month).eq('year', year);
            await supabase.from('tax_records').delete().eq('month', month).eq('year', year);

            let totalRunGross = 0;
            let totalRunNet = 0;
            let totalRunInsurance = 0;
            let totalRunTax = 0;

            for (const emp of (emps || [])) {
                // Giả lập dữ liệu Hợp đồng LĐ (Thực tế phải join bảng employee_contracts lấy basic_salary)
                const basicSalary = 15_000_000; // Base: 15tr default
                const workDays = 22; // Thực tế: select sum(work_hours)/8 from attendance_records...
                const otHours = 0;

                // Tính các khoản phụ cấp và khấu trừ
                const earnings: PayslipItem[] = [];
                const deductions: PayslipItem[] = [];
                let totalEarnings = 0;
                let totalDeductions = 0;
                let pitTaxableEarnings = 0;

                components.forEach(c => {
                    if (c.type === 'earning') {
                        earnings.push({ code: c.code, name: c.name, amount: c.default_amount, is_taxable: c.is_taxable });
                        totalEarnings += c.default_amount;
                        if (c.is_taxable) pitTaxableEarnings += c.default_amount;
                    } else if (c.type === 'deduction') {
                        deductions.push({ code: c.code, name: c.name, amount: c.default_amount });
                        totalDeductions += c.default_amount;
                    }
                });

                const grossSalary = basicSalary + totalEarnings; // Assume full working month

                // Tính Bảo hiểm xã hội trên nền lương cơ bản (hoặc tối đa 20 tháng Lương cơ sở tùy luật)
                const bhxhBase = basicSalary;
                const bhxhEmployee = bhxhBase * 0.08;
                const bhytEmployee = bhxhBase * 0.015;
                const bhtnEmployee = bhxhBase * 0.01;
                const totalInsuranceEmployee = bhxhEmployee + bhytEmployee + bhtnEmployee;

                const bhxhEmployer = bhxhBase * 0.175;
                const bhytEmployer = bhxhBase * 0.03;
                const bhtnEmployer = bhxhBase * 0.01;

                // Lưu thông tin BH
                await supabase.from('insurance_records').insert({
                    employee_id: emp.id, month, year,
                    bhxh_base: bhxhBase,
                    bhxh_employee: bhxhEmployee, bhxh_employer: bhxhEmployer,
                    bhyt_employee: bhytEmployee, bhyt_employer: bhytEmployer,
                    bhtn_employee: bhtnEmployee, bhtn_employer: bhtnEmployer
                });

                // Tính Thuế TNCN
                const depsCount = emp.dependents_count || 0;
                const pitTaxableIncome = basicSalary + pitTaxableEarnings; // Tổng thu nhập chịu thuế
                const personalDed = 11_000_000;
                const dependentDed = depsCount * 4_400_000;
                const totalTaxDed = personalDed + dependentDed + totalInsuranceEmployee;

                const assessableIncome = pitTaxableIncome - totalTaxDed;
                const taxAmount = this.calculatePIT(Math.max(0, assessableIncome));

                // Lưu thông tin Thuế
                await supabase.from('tax_records').insert({
                    employee_id: emp.id, month, year,
                    taxable_income: pitTaxableIncome,
                    dependents_count: depsCount,
                    personal_deduction: personalDed,
                    dependent_deduction: dependentDed,
                    total_deductions: totalTaxDed,
                    assessable_income: Math.max(0, assessableIncome),
                    tax_amount: taxAmount
                });

                // Tính Net
                const netSalary = grossSalary - totalInsuranceEmployee - taxAmount - totalDeductions;

                // Lưu Payslip
                await supabase.from('payslips').insert({
                    payroll_run_id: runId,
                    employee_id: emp.id,
                    work_days: workDays,
                    ot_hours: otHours,
                    basic_salary: basicSalary,
                    earnings: earnings,
                    deductions: deductions,
                    gross_salary: grossSalary,
                    insurance_employee: totalInsuranceEmployee,
                    insurance_employer: bhxhEmployer + bhytEmployer + bhtnEmployer,
                    taxable_income: pitTaxableIncome,
                    tax_amount: taxAmount,
                    net_salary: netSalary
                });

                totalRunGross += grossSalary;
                totalRunNet += netSalary;
                totalRunInsurance += totalInsuranceEmployee;
                totalRunTax += taxAmount;
            }

            // 4. Update Summary
            await supabase.from('payroll_runs').update({
                status: 'review',
                total_gross: totalRunGross,
                total_net: totalRunNet,
                total_insurance: totalRunInsurance,
                total_tax: totalRunTax
            }).eq('id', runId);

        } catch (e) {
            // Revert status on fail
            await supabase.from('payroll_runs').update({ status: 'draft' }).eq('id', runId);
            throw e;
        }
    },

    async approvePayroll(runId: string, approverId: string, isPaid: boolean = false): Promise<void> {
        await supabase.from('payroll_runs').update({
            status: isPaid ? 'paid' : 'approved',
            approved_by: approverId,
            approved_at: new Date().toISOString()
        }).eq('id', runId);
    }
};
