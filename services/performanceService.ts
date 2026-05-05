// ============================================================
// Performance Service — CIC ERP
// Service thao tác với data Chu kỳ đánh giá, KPI Goals, Feedback
// ============================================================

import { dataClient as supabase } from '../lib/dataClient';
import type {
    PerformanceCycle,
    KpiGoal,
    PerformanceReview
} from '../types/performanceTypes';

export const PerformanceService = {

    // ══════════════════════════════════════════
    // Cycles
    // ══════════════════════════════════════════

    async getCycles(year?: number): Promise<PerformanceCycle[]> {
        let query = supabase
            .from('performance_cycles')
            .select('*')
            .order('start_date', { ascending: false });

        if (year) query = query.eq('year', year);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as PerformanceCycle[];
    },

    async createCycle(cycle: Partial<PerformanceCycle>): Promise<PerformanceCycle> {
        const { data, error } = await supabase
            .from('performance_cycles')
            .insert(cycle)
            .select()
            .single();

        if (error) throw error;
        return data as PerformanceCycle;
    },

    // ══════════════════════════════════════════
    // KPI Goals
    // ══════════════════════════════════════════

    async getKpisByCycle(cycleId: string): Promise<KpiGoal[]> {
        const { data, error } = await supabase
            .from('kpi_goals')
            .select(`
                *,
                employee:employees!employee_id(name, employee_code, departments!department_id(name))
            `)
            .eq('cycle_id', cycleId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((row: any) => ({
            ...row,
            employee_name: row.employee?.name,
            employee_code: row.employee?.employee_code,
            department_name: row.employee?.departments?.name
        })) as KpiGoal[];
    },

    async getKpisByEmployee(employeeId: string, cycleId?: string): Promise<KpiGoal[]> {
        let query = supabase
            .from('kpi_goals')
            .select('*')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false });

        if (cycleId) query = query.eq('cycle_id', cycleId);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as KpiGoal[];
    },

    async upsertKpi(kpi: Partial<KpiGoal>): Promise<KpiGoal> {
        const payload: any = { ...kpi };
        if (!payload.id) {
            delete payload.id; // Let DB generate
        } else {
            payload.updated_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('kpi_goals')
            .upsert(payload, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;
        return data as KpiGoal;
    },

    async deleteKpi(id: string): Promise<void> {
        const { error } = await supabase.from('kpi_goals').delete().eq('id', id);
        if (error) throw error;
    },

    // ══════════════════════════════════════════
    // Performance Reviews
    // ══════════════════════════════════════════

    async getReviewsByCycle(cycleId: string): Promise<PerformanceReview[]> {
        const { data, error } = await supabase
            .from('performance_reviews')
            .select(`
                *,
                employee:employees!employee_id(name),
                reviewer:employees!reviewer_id(name)
            `)
            .eq('cycle_id', cycleId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((row: any) => ({
            ...row,
            employee_name: row.employee?.name,
            reviewer_name: row.reviewer?.name
        })) as PerformanceReview[];
    },

    async submitReview(review: Partial<PerformanceReview>): Promise<void> {
        const payload: any = {
            ...review,
            status: 'submitted',
            submitted_at: new Date().toISOString()
        };

        if (!payload.id) delete payload.id;

        const { error } = await supabase
            .from('performance_reviews')
            .upsert(payload, { onConflict: 'id' });

        if (error) throw error;
    }
};
