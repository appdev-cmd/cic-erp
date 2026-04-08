import { supabase } from '../lib/supabase';
import { JobOpening, Candidate, CandidateApplication, ApplicationStage } from '../types/hrmTypes';

export const recruitmentService = {
  // ── Job Openings ──
  async getJobOpenings(): Promise<JobOpening[]> {
    const { data, error } = await supabase
      .from('job_openings')
      .select(`
        *,
        unit:units(name),
        requester:employees!requester_id(full_name),
        recruiter:employees!recruiter_id(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Map joined fields
    return data.map((item: any) => ({
      ...item,
      unit_name: item.unit?.name,
      requester_name: item.requester?.full_name,
      recruiter_name: item.recruiter?.full_name
    })) as JobOpening[];
  },

  async getJobOpeningById(id: string): Promise<JobOpening | null> {
    const { data, error } = await supabase
      .from('job_openings')
      .select(`
        *,
        unit:units(name),
        requester:employees!requester_id(full_name),
        recruiter:employees!recruiter_id(full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw error;
    }

    return {
      ...data,
      unit_name: data.unit?.name,
      requester_name: data.requester?.full_name,
      recruiter_name: data.recruiter?.full_name
    } as JobOpening;
  },

  async createJobOpening(job: Partial<JobOpening>): Promise<JobOpening> {
    const { data, error } = await supabase
      .from('job_openings')
      .insert(job)
      .select()
      .single();

    if (error) throw error;
    return data as JobOpening;
  },

  async updateJobOpening(id: string, updates: Partial<JobOpening>): Promise<JobOpening> {
    const { data, error } = await supabase
      .from('job_openings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as JobOpening;
  },

  // ── Candidates ──
  async getCandidates(): Promise<Candidate[]> {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Candidate[];
  },

  async createCandidate(candidate: Partial<Candidate>): Promise<Candidate> {
    const { data, error } = await supabase
      .from('candidates')
      .insert(candidate)
      .select()
      .single();

    if (error) throw error;
    return data as Candidate;
  },

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate> {
    const { data, error } = await supabase
      .from('candidates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Candidate;
  },

  // ── Applications (Pipeline) ──
  async getApplicationsByJob(jobOpeningId: string): Promise<CandidateApplication[]> {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        candidate:candidates(*)
      `)
      .eq('job_opening_id', jobOpeningId)
      .order('stage_updated_at', { ascending: false });

    if (error) throw error;
    return data as CandidateApplication[];
  },

  async createApplication(application: Partial<CandidateApplication>): Promise<CandidateApplication> {
    const { data, error } = await supabase
      .from('applications')
      .insert({
        ...application,
        stage: application.stage || 'applied',
        stage_updated_at: new Date().toISOString()
      })
      .select(`*, candidate:candidates(*)`)
      .single();

    if (error) throw error;
    return data as CandidateApplication;
  },

  async moveStage(id: string, stage: ApplicationStage): Promise<CandidateApplication> {
    const { data, error } = await supabase
      .from('applications')
      .update({
        stage,
        stage_updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`*, candidate:candidates(*)`)
      .single();

    if (error) throw error;
    return data as CandidateApplication;
  }
};
