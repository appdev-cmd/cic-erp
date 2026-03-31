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
    projectPhase: row.project_phase,
    contractId: row.contract_id,
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
  if (project.projectPhase !== undefined) row.project_phase = project.projectPhase;
  if (project.contractId !== undefined) row.contract_id = project.contractId;
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
