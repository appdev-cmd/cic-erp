import { dataClient as supabase } from '../lib/dataClient';
import type { Facility, FacilityType, InternalRequest } from '../types/hrmTypes';

export const FacilityService = {
  async getAll(type?: FacilityType): Promise<Facility[]> {
    let query = supabase
      .from('facilities')
      .select('*')
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Facility[];
  },

  async getActive(type?: FacilityType): Promise<Facility[]> {
    let query = supabase
      .from('facilities')
      .select('*')
      .eq('is_active', true)
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Facility[];
  },

  async getById(id: string): Promise<Facility> {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Facility;
  },

  async create(input: Partial<Facility>): Promise<Facility> {
    const { data, error } = await supabase
      .from('facilities')
      .insert([input])
      .select('*')
      .single();

    if (error) throw error;
    return data as Facility;
  },

  async update(id: string, updates: Partial<Facility>): Promise<Facility> {
    const { data, error } = await supabase
      .from('facilities')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as Facility;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('facilities')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },

  async getBookingsByDateRange(startDate: string, endDate: string, type?: FacilityType, facilityId?: string): Promise<InternalRequest[]> {
    let query = supabase
      .from('internal_requests')
      .select('*, employees!internal_requests_employee_id_fkey(name, avatar), units!internal_requests_unit_id_fkey(name), facility:facilities(*)')
      .in('status', ['approved', 'pending_unit', 'pending_admin']) // Only get active/pending bookings
      .neq('status', 'draft')
      .neq('status', 'cancelled')
      .neq('status', 'rejected');

    if (type) {
      query = query.eq('type', type);
    }

    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }

    const { data, error } = await query;
    
    if (error) throw error;

    // Filter by JSONB details on client side since postgrest JSONB range queries are tricky
    const requests = (data || []).map(row => ({
      ...row,
      employee_name: row.employees?.name || row.employee_name,
      employee_avatar: row.employees?.avatar || row.employee_avatar,
      unit_name: row.units?.name || row.unit_name,
    })) as InternalRequest[];

    const startCheck = new Date(startDate).getTime();
    const endCheck = new Date(endDate).getTime();

    return requests.filter(req => {
      if (!req.details?.start_time || !req.details?.end_time) return false;
      const reqStart = new Date(req.details.start_time).getTime();
      const reqEnd = new Date(req.details.end_time).getTime();
      
      // Check for overlap
      return reqStart < endCheck && reqEnd > startCheck;
    });
  },

  async checkConflict(facilityId: string, startTime: string, endTime: string, excludeRequestId?: string): Promise<InternalRequest[]> {
    const { data, error } = await supabase
      .from('internal_requests')
      .select('*, employees!internal_requests_employee_id_fkey(name, avatar), units!internal_requests_unit_id_fkey(name), facility:facilities(*)')
      .eq('facility_id', facilityId)
      .in('status', ['approved', 'pending_unit', 'pending_admin']); // Conflict can happen with pending ones too

    if (error) throw error;

    let requests = (data || []).map(row => ({
      ...row,
      employee_name: row.employees?.name || row.employee_name,
      employee_avatar: row.employees?.avatar || row.employee_avatar,
      unit_name: row.units?.name || row.unit_name,
    })) as InternalRequest[];

    if (excludeRequestId) {
      requests = requests.filter(req => req.id !== excludeRequestId);
    }

    const startCheck = new Date(startTime).getTime();
    const endCheck = new Date(endTime).getTime();

    // Soft conflict detection
    return requests.filter(req => {
      if (!req.details?.start_time || !req.details?.end_time) return false;
      const reqStart = new Date(req.details.start_time).getTime();
      const reqEnd = new Date(req.details.end_time).getTime();
      
      // Check for overlap: CheckStart < ReqEnd AND CheckEnd > ReqStart
      return startCheck < reqEnd && endCheck > reqStart;
    });
  }
};
