// ============================================================
// Core HR Service — CIC ERP
// CRUD for Employee Contracts, Salary History,
// Qualifications, and Assets
// ============================================================

import { dataClient as supabase } from '../lib/dataClient';
import type {
    EmployeeContract,
    CreateContractInput,
    SalaryHistory,
    CreateSalaryHistoryInput,
    EmployeeQualification,
    CreateQualificationInput,
    EmployeeAsset,
    CreateAssetInput,
} from '../types/coreHrTypes';

export const CoreHrService = {

    // ══════════════════════════════════════════
    // Employee Contracts
    // ══════════════════════════════════════════

    async getContractsByEmployee(employeeId: string): Promise<EmployeeContract[]> {
        const { data, error } = await supabase
            .from('employee_contracts')
            .select('*')
            .eq('employee_id', employeeId)
            .order('start_date', { ascending: false });
        if (error) throw error;
        return (data || []) as EmployeeContract[];
    },

    async getActiveContract(employeeId: string): Promise<EmployeeContract | null> {
        const { data, error } = await supabase
            .from('employee_contracts')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('status', 'active')
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data as EmployeeContract | null;
    },

    async createContract(input: CreateContractInput): Promise<EmployeeContract> {
        const { data, error } = await supabase
            .from('employee_contracts')
            .insert({
                ...input,
                status: 'active',
            })
            .select()
            .single();
        if (error) throw error;
        return data as EmployeeContract;
    },

    async updateContract(id: string, updates: Partial<CreateContractInput> & { status?: string }): Promise<EmployeeContract> {
        const { data, error } = await supabase
            .from('employee_contracts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as EmployeeContract;
    },

    async deleteContract(id: string): Promise<void> {
        const { error } = await supabase
            .from('employee_contracts')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // ══════════════════════════════════════════
    // Salary History
    // ══════════════════════════════════════════

    async getSalaryHistory(employeeId: string): Promise<SalaryHistory[]> {
        const { data, error } = await supabase
            .from('employee_salary_history')
            .select(`
        *,
        approver:employees!approved_by(name)
      `)
            .eq('employee_id', employeeId)
            .order('effective_date', { ascending: false });
        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            approver_name: row.approver?.name,
        })) as SalaryHistory[];
    },

    async createSalaryRecord(input: CreateSalaryHistoryInput): Promise<SalaryHistory> {
        const totalSalary = input.total_salary || input.basic_salary;
        const { data, error } = await supabase
            .from('employee_salary_history')
            .insert({
                ...input,
                total_salary: totalSalary,
            })
            .select()
            .single();
        if (error) throw error;
        return data as SalaryHistory;
    },

    async updateSalaryRecord(id: string, updates: Partial<CreateSalaryHistoryInput>): Promise<SalaryHistory> {
        const { data, error } = await supabase
            .from('employee_salary_history')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as SalaryHistory;
    },

    async deleteSalaryRecord(id: string): Promise<void> {
        const { error } = await supabase
            .from('employee_salary_history')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getLatestSalary(employeeId: string): Promise<SalaryHistory | null> {
        const { data, error } = await supabase
            .from('employee_salary_history')
            .select('*')
            .eq('employee_id', employeeId)
            .order('effective_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data as SalaryHistory | null;
    },

    // ══════════════════════════════════════════
    // Qualifications (Bằng cấp, chứng chỉ)
    // ══════════════════════════════════════════

    async getQualifications(employeeId: string): Promise<EmployeeQualification[]> {
        const { data, error } = await supabase
            .from('employee_qualifications')
            .select('*')
            .eq('employee_id', employeeId)
            .order('issue_date', { ascending: false });
        if (error) throw error;
        return (data || []) as EmployeeQualification[];
    },

    async createQualification(input: CreateQualificationInput): Promise<EmployeeQualification> {
        const { data, error } = await supabase
            .from('employee_qualifications')
            .insert(input)
            .select()
            .single();
        if (error) throw error;
        return data as EmployeeQualification;
    },

    async updateQualification(id: string, updates: Partial<CreateQualificationInput>): Promise<EmployeeQualification> {
        const { data, error } = await supabase
            .from('employee_qualifications')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as EmployeeQualification;
    },

    async deleteQualification(id: string): Promise<void> {
        const { error } = await supabase
            .from('employee_qualifications')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // ══════════════════════════════════════════
    // Employee Assets (Tài sản bàn giao)
    // ══════════════════════════════════════════

    async getAssetsByEmployee(employeeId: string): Promise<EmployeeAsset[]> {
        const { data, error } = await supabase
            .from('employee_assets')
            .select(`
        *,
        assigned_by_emp:employees!assigned_by(name)
      `)
            .eq('employee_id', employeeId)
            .order('handover_date', { ascending: false });
        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            assigned_by_name: row.assigned_by_emp?.name,
        })) as EmployeeAsset[];
    },

    async getAllAssets(filters?: {
        status?: string;
        asset_type?: string;
        search?: string;
    }): Promise<EmployeeAsset[]> {
        let query = supabase
            .from('employee_assets')
            .select(`
        *,
        employee:employees!employee_id(name),
        assigned_by_emp:employees!assigned_by(name)
      `)
            .order('handover_date', { ascending: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.asset_type) query = query.eq('asset_type', filters.asset_type);
        if (filters?.search) {
            query = query.or(`asset_name.ilike.%${filters.search}%,asset_code.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            employee_name: row.employee?.name,
            assigned_by_name: row.assigned_by_emp?.name,
        })) as EmployeeAsset[];
    },

    async createAsset(input: CreateAssetInput): Promise<EmployeeAsset> {
        const { data, error } = await supabase
            .from('employee_assets')
            .insert({
                ...input,
                status: 'assigned',
            })
            .select()
            .single();
        if (error) throw error;
        return data as EmployeeAsset;
    },

    async updateAsset(id: string, updates: Partial<CreateAssetInput> & { status?: string; return_date?: string }): Promise<EmployeeAsset> {
        const { data, error } = await supabase
            .from('employee_assets')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as EmployeeAsset;
    },

    async returnAsset(id: string): Promise<EmployeeAsset> {
        const { data, error } = await supabase
            .from('employee_assets')
            .update({
                status: 'returned',
                return_date: new Date().toISOString().split('T')[0],
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as EmployeeAsset;
    },

    async deleteAsset(id: string): Promise<void> {
        const { error } = await supabase
            .from('employee_assets')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // ══════════════════════════════════════════
    // Dashboard Stats
    // ══════════════════════════════════════════

    async getAssetStats(): Promise<{
        total: number;
        assigned: number;
        returned: number;
        byType: Record<string, number>;
    }> {
        const { data, error } = await supabase
            .from('employee_assets')
            .select('status, asset_type');
        if (error) throw error;

        const items = data || [];
        const byType: Record<string, number> = {};
        let assigned = 0;
        let returned = 0;

        items.forEach((item: any) => {
            if (item.status === 'assigned') assigned++;
            if (item.status === 'returned') returned++;
            byType[item.asset_type] = (byType[item.asset_type] || 0) + 1;
        });

        return { total: items.length, assigned, returned, byType };
    },
};
