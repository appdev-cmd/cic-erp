import { supabase } from '../lib/supabase';
import { JobOpening, Candidate, CandidateApplication, ApplicationStage, ApplicationEvaluation } from '../types/hrmTypes';
import { OnboardingService } from './onboardingService';

export const recruitmentService = {
  // ── Job Openings ──
  async getJobOpenings(): Promise<JobOpening[]> {
    const { data, error } = await supabase
      .from('job_openings')
      .select(`
        *,
        unit:units(name),
        requester:employees!requester_id(name),
        recruiter:employees!recruiter_id(name),
        applications:applications(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((item: any) => ({
      ...item,
      unit_name: item.unit?.name,
      requester_name: item.requester?.name,
      recruiter_name: item.recruiter?.name,
      application_count: item.applications?.[0]?.count || 0
    })) as JobOpening[];
  },

  async getJobOpeningById(id: string): Promise<JobOpening | null> {
    const { data, error } = await supabase
      .from('job_openings')
      .select(`
        *,
        unit:units(name),
        requester:employees!requester_id(name),
        recruiter:employees!recruiter_id(name)
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
      requester_name: data.requester?.name,
      recruiter_name: data.recruiter?.name
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

  async deleteJobOpening(id: string): Promise<void> {
    const { error } = await supabase
      .from('job_openings')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ── Candidates ──
  async getCandidates(): Promise<Candidate[]> {
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        applications (
          id,
          stage,
          job_opening:job_openings(title)
        )
      `)
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

  async deleteCandidate(id: string): Promise<void> {
    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async uploadResume(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop() || '';
    const fileName = `resume_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `resumes/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
    return data.publicUrl;
  },

  // ── Applications (Pipeline) ──
  async getApplicationsByCandidate(candidateId: string): Promise<CandidateApplication[]> {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        job_opening:job_openings(*)
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as CandidateApplication[];
  },

  async getApplicationsByJob(jobOpeningId: string): Promise<CandidateApplication[]> {
    let query = supabase
      .from('applications')
      .select(`
        *,
        candidate:candidates(*),
        job_opening:job_openings(title)
      `)
      .order('stage_updated_at', { ascending: false });

    if (jobOpeningId && jobOpeningId !== 'all') {
      query = query.eq('job_opening_id', jobOpeningId);
    }

    const { data, error } = await query;
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

  async updateApplicationNotes(id: string, notes: string | null, rating: number | null): Promise<CandidateApplication> {
    const { data, error } = await supabase
      .from('applications')
      .update({
        interview_notes: notes,
        rating: rating,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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
      .select(`*, candidate:candidates(*), job_opening:job_openings(title, department)`)
      .single();

    if (error) throw error;

    // Trigger Onboarding if Hired
    if (stage === 'hired' && data.candidate) {
      try {
        // 1. Convert candidate to Employee
        const { data: newEmp, error: empError } = await supabase
          .from('employees')
          .insert({
            name: data.candidate.full_name,
            email: data.candidate.email,
            phone: data.candidate.phone,
            employee_code: `NV${Math.floor(1000 + Math.random() * 9000)}`,
            position: data.job_opening?.title || 'New Hire',
            status: 'active',
            join_date: new Date().toISOString().split('T')[0]
          })
          .select()
          .single();

        if (empError) throw empError;

        // 2. Fetch default onboarding template
        const templates = await OnboardingService.getTemplates();
        const defaultTemplate = templates.find(t => t.is_default) || templates[0];

        if (defaultTemplate) {
          await OnboardingService.launchOnboarding(
            newEmp.id,
            defaultTemplate.id,
            new Date().toISOString().split('T')[0],
            data.id
          );
        }
      } catch (e) {
        console.error('Lỗi khi tự động trigger onboarding:', e);
      }
    }

    return data as CandidateApplication;
  },

  async deleteApplication(id: string): Promise<void> {
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ── Evaluations ──
  async getEvaluations(applicationId: string): Promise<ApplicationEvaluation[]> {
    const { data, error } = await supabase
      .from('application_evaluations')
      .select(`
        *,
        evaluator:employees!evaluator_id(id, name, position)
      `)
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ApplicationEvaluation[];
  },

  async upsertEvaluation(evaluation: Partial<ApplicationEvaluation>): Promise<ApplicationEvaluation> {
    const { data, error } = await supabase
      .from('application_evaluations')
      .upsert({
        id: evaluation.id || undefined, // Allow Supabase to generate if missing
        application_id: evaluation.application_id,
        evaluator_id: evaluation.evaluator_id,
        rating: evaluation.rating,
        notes: evaluation.notes,
        criteria_scores: evaluation.criteria_scores,
        updated_at: new Date().toISOString()
      }, { onConflict: 'application_id, evaluator_id' })
      .select(`
        *,
        evaluator:employees!evaluator_id(id, name, position)
      `)
      .single();

    if (error) throw error;
    return data as ApplicationEvaluation;
  }
};
