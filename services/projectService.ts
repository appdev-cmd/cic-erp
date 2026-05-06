/**
 * Project Service — CRUD for BIM Consulting Projects
 */

import { dataClient } from '../lib/dataClient';
import { BIMProject, BIMProjectStatus } from '../types';

// ── Snake ↔ Camel mapping ──────────────────────────────────
function toProject(row: any): BIMProject {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    thumbnailUrl: row.thumbnail_url,
    status: row.status as BIMProjectStatus,
    location: row.location,
    progress: Number(row.progress) || 0,
    clientName: row.client_name,
    customerId: row.customer_id,
    unitId: row.unit_id,
    startDate: row.start_date,
    endDate: row.end_date,
    description: row.description,
    contractValue: Number(row.contract_value) || 0,
    notes: row.notes,
    folderPotentialUrl: row.folder_potential_url,
    folderOngoingUrl: row.folder_ongoing_url,
    serviceType: row.service_type,
    projectGroup: row.project_group,
    constructionType: row.construction_type,
    constructionGrade: row.construction_grade,
    area: Number(row.area) || 0,
    buildingArea: Number(row.building_area) || 0,
    projectPhase: row.project_phase,
    contractId: row.contract_id,

    // Web Integration
    isPublishedWeb: row.is_published_web,
    isFeaturedWeb: row.is_featured_web,
    slug: row.slug,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    webCategory: row.web_category,
    webClientName: row.web_client_name,
    webStats: row.web_stats,
    viewCount: row.view_count,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(project: Partial<BIMProject>): Record<string, any> {
  const row: Record<string, any> = {};
  if (project.code !== undefined) row.code = project.code;
  if (project.name !== undefined) row.name = project.name;
  if (project.thumbnailUrl !== undefined) row.thumbnail_url = project.thumbnailUrl;
  if (project.status !== undefined) row.status = project.status;
  if (project.location !== undefined) row.location = project.location;
  if (project.progress !== undefined) row.progress = project.progress;
  if (project.clientName !== undefined) row.client_name = project.clientName;
  if (project.customerId !== undefined) row.customer_id = project.customerId;
  if (project.unitId !== undefined) row.unit_id = project.unitId;
  if (project.startDate !== undefined) row.start_date = project.startDate;
  if (project.endDate !== undefined) row.end_date = project.endDate;
  if (project.description !== undefined) row.description = project.description;
  if (project.contractValue !== undefined) row.contract_value = project.contractValue;
  if (project.notes !== undefined) row.notes = project.notes;
  if (project.folderPotentialUrl !== undefined) row.folder_potential_url = project.folderPotentialUrl;
  if (project.folderOngoingUrl !== undefined) row.folder_ongoing_url = project.folderOngoingUrl;
  if (project.serviceType !== undefined) row.service_type = project.serviceType;
  if (project.projectGroup !== undefined) row.project_group = project.projectGroup;
  if (project.constructionType !== undefined) row.construction_type = project.constructionType;
  if (project.constructionGrade !== undefined) row.construction_grade = project.constructionGrade;
  if (project.area !== undefined) row.area = project.area;
  if (project.buildingArea !== undefined) row.building_area = project.buildingArea;
  if (project.projectPhase !== undefined) row.project_phase = project.projectPhase;
  if (project.contractId !== undefined) row.contract_id = project.contractId;

  if (project.isPublishedWeb !== undefined) row.is_published_web = project.isPublishedWeb;
  if (project.isFeaturedWeb !== undefined) row.is_featured_web = project.isFeaturedWeb;
  if (project.slug !== undefined) row.slug = project.slug;
  if (project.seoTitle !== undefined) row.seo_title = project.seoTitle;
  if (project.seoDescription !== undefined) row.seo_description = project.seoDescription;
  if (project.webCategory !== undefined) row.web_category = project.webCategory;
  if (project.webClientName !== undefined) row.web_client_name = project.webClientName;
  if (project.webStats !== undefined) row.web_stats = project.webStats;

  return row;
}

// ── Service ────────────────────────────────────────────────
export const ProjectService = {
  async getAll(): Promise<BIMProject[]> {
    const { data, error } = await dataClient
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toProject);
  },

  async getById(id: string): Promise<BIMProject | null> {
    const { data, error } = await dataClient
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data ? toProject(data) : null;
  },

  async create(project: Partial<BIMProject>): Promise<BIMProject> {
    const row = toRow(project);
    const { data, error } = await dataClient
      .from('projects')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return toProject(data);
  },

  async update(id: string, project: Partial<BIMProject>): Promise<BIMProject> {
    const row = toRow(project);
    row.updated_at = new Date().toISOString();
    const { data, error } = await dataClient
      .from('projects')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toProject(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await dataClient
      .from('projects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ── Project Member Service ─────────────────────────────────
export const ProjectMemberService = {
  async getByProject(projectId: string): Promise<any[]> {
    const { data, error } = await dataClient
      .from('project_members')
      .select(`
        *,
        employees:employee_id (*)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Ngôn ngữ ứng dụng sử dụng camelCase nên ta map lại 
    return (data || []).map(row => ({
      id: row.id,
      projectId: row.project_id,
      employeeId: row.employee_id,
      role: row.role,
      createdAt: row.created_at,
      employee: {
        id: row.employees?.id,
        name: row.employees?.name,
        email: row.employees?.email,
        phone: row.employees?.phone,
        avatar: row.employees?.avatar,
        position: row.employees?.position,
        department: row.employees?.department,
        unitId: row.employees?.unit_id,
      }
    }));
  },

  async addMember(projectId: string, employeeId: string, role: string = 'Member'): Promise<any> {
    const { data, error } = await dataClient
      .from('project_members')
      .insert({
        project_id: projectId,
        employee_id: employeeId,
        role: role
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeMember(id: string): Promise<void> {
    const { error } = await dataClient
      .from('project_members')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async updateRole(id: string, role: string): Promise<any> {
    const { data, error } = await dataClient
      .from('project_members')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
