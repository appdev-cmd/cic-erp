import { dataClient as supabase } from '../lib/dataClient';
import type { InternalRequest, CreateInternalRequestInput, InternalRequestStatus } from '../types/hrmTypes';
// InternalRequestStatus used for nextStatus typing in submit()

function mapRequest(row: any): InternalRequest {
  return {
    ...row,
    employee_name: row.employees?.name || row.employee_name,
    employee_avatar: row.employees?.avatar || row.employee_avatar,
    unit_name: row.units?.name || row.unit_name,
    facility: row.facility,
  };
}

export const RequestService = {
  async create(input: CreateInternalRequestInput): Promise<InternalRequest> {
    const { data, error } = await supabase
      .from('internal_requests')
      .insert({
        ...input,
        status: 'draft' as InternalRequestStatus,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as InternalRequest;
  },

  async update(id: string, updates: Partial<CreateInternalRequestInput>): Promise<InternalRequest> {
    const { data, error } = await supabase
      .from('internal_requests')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as InternalRequest;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('internal_requests')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async submit(id: string): Promise<InternalRequest> {
    // Lấy type để xác định bước duyệt tiếp theo
    const { data: current, error: fetchErr } = await supabase
      .from('internal_requests')
      .select('type')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    // meeting_room bỏ qua bước Leader, chuyển thẳng đến HCNS
    const nextStatus: InternalRequestStatus =
      current.type === 'meeting_room' ? 'pending_admin' : 'pending_unit';

    const { data, error } = await supabase
      .from('internal_requests')
      .update({ status: nextStatus })
      .eq('id', id)
      .eq('status', 'draft')
      .select('*')
      .single();

    if (error) throw error;
    return data as InternalRequest;
  },

  async approveDirectly(id: string, approverId: string): Promise<InternalRequest> {
    const { data, error } = await supabase
      .from('internal_requests')
      .update({ status: 'approved', approver_admin_id: approverId })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as InternalRequest;
  },

  async cancel(id: string): Promise<void> {
    const { error } = await supabase
      .from('internal_requests')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;
  },

  async approveUnit(id: string, approverId: string): Promise<InternalRequest> {
    const { data, error } = await supabase
      .from('internal_requests')
      .update({
        status: 'pending_admin',
        approver_unit_id: approverId,
      })
      .eq('id', id)
      .eq('status', 'pending_unit')
      .select('*')
      .single();

    if (error) throw error;
    return data as InternalRequest;
  },

  async approveAdmin(id: string, approverId: string): Promise<InternalRequest> {
    const { data, error } = await supabase
      .from('internal_requests')
      .update({
        status: 'approved',
        approver_admin_id: approverId,
      })
      .eq('id', id)
      .eq('status', 'pending_admin')
      .select('*')
      .single();

    if (error) throw error;
    return data as InternalRequest;
  },

  async reject(id: string, approverId: string, reason: string, stage: 'unit' | 'admin' = 'admin'): Promise<InternalRequest> {
    const approverField = stage === 'unit' ? 'approver_unit_id' : 'approver_admin_id';
    const { data, error } = await supabase
      .from('internal_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        [approverField]: approverId,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as InternalRequest;
  },

  async getByEmployee(employeeId: string): Promise<InternalRequest[]> {
    const { data, error } = await supabase
      .from('internal_requests')
      .select('*, employees!internal_requests_employee_id_fkey(name, avatar), units!internal_requests_unit_id_fkey(name), facility:facilities(*)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRequest);
  },

  async getPendingForUnit(unitId: string): Promise<InternalRequest[]> {
    const { data, error } = await supabase
      .from('internal_requests')
      .select('*, employees!internal_requests_employee_id_fkey(name, avatar), units!internal_requests_unit_id_fkey(name), facility:facilities(*)')
      .eq('unit_id', unitId)
      .eq('status', 'pending_unit')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRequest);
  },

  async getPendingForAdmin(): Promise<InternalRequest[]> {
    const { data, error } = await supabase
      .from('internal_requests')
      .select('*, employees!internal_requests_employee_id_fkey(name, avatar), units!internal_requests_unit_id_fkey(name), facility:facilities(*)')
      .eq('status', 'pending_admin')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRequest);
  },

  async getAllPending(): Promise<InternalRequest[]> {
    const { data, error } = await supabase
      .from('internal_requests')
      .select('*, employees!internal_requests_employee_id_fkey(name, avatar), units!internal_requests_unit_id_fkey(name)')
      .in('status', ['pending_unit', 'pending_admin'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRequest);
  },
};
