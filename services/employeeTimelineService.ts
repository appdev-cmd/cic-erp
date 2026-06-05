import { dataClient as supabase } from '../lib/dataClient';
import { EmployeeTimeline } from '../types';

const mapTimeline = (t: any): EmployeeTimeline => ({
    id: t.id,
    employeeId: t.employee_id,
    type: t.type,
    title: t.title,
    decisionNumber: t.decision_number || '',
    effectiveDate: t.effective_date || '',
    description: t.description || '',
    attachmentUrl: t.attachment_url || '',
    createdAt: t.created_at || '',
    updatedAt: t.updated_at || '',
});

export const EmployeeTimelineService = {
    getByEmployeeId: async (employeeId: string): Promise<EmployeeTimeline[]> => {
        const { data, error } = await supabase
            .from('employee_timeline')
            .select('*')
            .eq('employee_id', employeeId)
            .order('effective_date', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapTimeline);
    },

    create: async (payload: Omit<EmployeeTimeline, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeTimeline> => {
        const { data, error } = await supabase
            .from('employee_timeline')
            .insert({
                employee_id: payload.employeeId,
                type: payload.type,
                title: payload.title,
                decision_number: payload.decisionNumber || null,
                effective_date: payload.effectiveDate,
                description: payload.description || null,
                attachment_url: payload.attachmentUrl || null,
            })
            .select()
            .single();
        if (error) throw error;
        return mapTimeline(data);
    },

    update: async (id: string, payload: Partial<EmployeeTimeline>): Promise<EmployeeTimeline> => {
        const dbPayload: any = {};
        if (payload.type !== undefined) dbPayload.type = payload.type;
        if (payload.title !== undefined) dbPayload.title = payload.title;
        if (payload.decisionNumber !== undefined) dbPayload.decision_number = payload.decisionNumber || null;
        if (payload.effectiveDate !== undefined) dbPayload.effective_date = payload.effectiveDate;
        if (payload.description !== undefined) dbPayload.description = payload.description || null;
        if (payload.attachmentUrl !== undefined) dbPayload.attachment_url = payload.attachmentUrl || null;

        const { data, error } = await supabase
            .from('employee_timeline')
            .update(dbPayload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapTimeline(data);
    },

    delete: async (id: string): Promise<boolean> => {
        const { error } = await supabase
            .from('employee_timeline')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },
};
