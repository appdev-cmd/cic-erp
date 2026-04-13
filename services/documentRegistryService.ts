/**
 * Document Registry Service — CIC ERP
 *
 * CRUD + search + filter + stats cho bảng document_registry.
 * Đây là trung tâm metadata cho toàn bộ tài liệu trong hệ thống.
 */

import { dataClient as supabase } from '../lib/dataClient';

// ============================================
// Types
// ============================================

export type DocCategory = 'contract' | 'invoice' | 'report' | 'hr' | 'template' | 'policy' | 'meeting' | 'general';
export type SourceType = 'drive' | 'supabase_storage' | 'external_link' | 'pasted_text';
export type EntityType = 'contract' | 'employee' | 'unit' | 'project' | 'customer' | null;

export interface DocumentRegistryItem {
  id: string;
  title: string;
  description: string | null;
  docCategory: DocCategory;
  tags: string[];

  sourceType: SourceType;
  sourceUrl: string | null;
  driveFileId: string | null;
  storagePath: string | null;

  fileName: string;
  mimeType: string | null;
  fileSize: number;

  entityType: EntityType;
  entityId: string | null;

  isAiIndexed: boolean;
  aiIndexedAt: string | null;
  contentPreview: string | null;
  fullTextContent: string | null;

  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRegistryCreatePayload {
  title: string;
  description?: string;
  docCategory?: DocCategory;
  tags?: string[];

  sourceType: SourceType;
  sourceUrl?: string;
  driveFileId?: string;
  storagePath?: string;

  fileName: string;
  mimeType?: string;
  fileSize?: number;

  entityType?: EntityType;
  entityId?: string;

  contentPreview?: string;
  fullTextContent?: string;
  uploadedBy?: string;
}

export interface DocumentRegistryFilter {
  search?: string;
  docCategory?: DocCategory;
  entityType?: EntityType;
  entityId?: string;
  tags?: string[];
  isAiIndexed?: boolean;
  uploadedBy?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'file_size';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface StorageStats {
  totalDocuments: number;
  totalSize: number; // bytes
  aiIndexedCount: number;
  byCategory: Record<string, { count: number; size: number }>;
}

// ============================================
// Mapper
// ============================================

const mapRow = (d: any): DocumentRegistryItem => ({
  id: d.id,
  title: d.title,
  description: d.description,
  docCategory: d.doc_category,
  tags: d.tags || [],
  sourceType: d.source_type,
  sourceUrl: d.source_url,
  driveFileId: d.drive_file_id,
  storagePath: d.storage_path,
  fileName: d.file_name,
  mimeType: d.mime_type,
  fileSize: d.file_size || 0,
  entityType: d.entity_type,
  entityId: d.entity_id,
  isAiIndexed: d.is_ai_indexed || false,
  aiIndexedAt: d.ai_indexed_at,
  contentPreview: d.content_preview,
  fullTextContent: d.full_text_content || null,
  uploadedBy: d.uploaded_by,
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

// ============================================
// Category Labels
// ============================================

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  contract: 'Hợp đồng',
  invoice: 'Hóa đơn',
  report: 'Báo cáo',
  hr: 'Nhân sự',
  template: 'Biểu mẫu',
  policy: 'Quy định',
  meeting: 'Biên bản',
  general: 'Chung',
};

export const DOC_CATEGORY_COLORS: Record<DocCategory, string> = {
  contract: 'indigo',
  invoice: 'amber',
  report: 'purple',
  hr: 'emerald',
  template: 'cyan',
  policy: 'rose',
  meeting: 'orange',
  general: 'slate',
};

// ============================================
// Service
// ============================================

export const DocumentRegistryService = {
  /**
   * Alias cho list() — tương thích với DocumentManager và AI Agent tool
   */
  async getAll(params?: { searchTerm?: string; docCategory?: DocCategory; entityType?: string; entityId?: string }): Promise<{ data: DocumentRegistryItem[]; count: number }> {
    return this.list({
      search: params?.searchTerm,
      docCategory: params?.docCategory,
      entityType: params?.entityType as EntityType || undefined,
      entityId: params?.entityId,
    });
  },

  /**
   * Lấy danh sách tài liệu với filter + search + phân trang
   */
  async list(filter: DocumentRegistryFilter = {}): Promise<{ data: DocumentRegistryItem[]; count: number }> {
    const {
      search, docCategory, entityType, entityId, tags,
      isAiIndexed, uploadedBy,
      sortBy = 'created_at', sortOrder = 'desc',
      limit = 50, offset = 0,
    } = filter;

    let query = supabase
      .from('document_registry')
      .select('*', { count: 'exact' });

    // Filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,file_name.ilike.%${search}%,content_preview.ilike.%${search}%`);
    }
    if (docCategory) query = query.eq('doc_category', docCategory);
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    if (isAiIndexed !== undefined) query = query.eq('is_ai_indexed', isAiIndexed);
    if (uploadedBy) query = query.eq('uploaded_by', uploadedBy);
    if (tags && tags.length > 0) query = query.overlaps('tags', tags);

    // Sort + Paginate
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: (data || []).map(mapRow),
      count: count || 0,
    };
  },

  /**
   * Lấy 1 tài liệu theo ID
   */
  async getById(id: string): Promise<DocumentRegistryItem | null> {
    const { data, error } = await supabase
      .from('document_registry')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return mapRow(data);
  },

  /**
   * Tạo mới tài liệu trong registry
   */
  async create(payload: DocumentRegistryCreatePayload): Promise<DocumentRegistryItem> {
    const { data, error } = await supabase
      .from('document_registry')
      .insert({
        title: payload.title,
        description: payload.description || null,
        doc_category: payload.docCategory || 'general',
        tags: payload.tags || [],
        source_type: payload.sourceType,
        source_url: payload.sourceUrl || null,
        drive_file_id: payload.driveFileId || null,
        storage_path: payload.storagePath || null,
        file_name: payload.fileName,
        mime_type: payload.mimeType || null,
        file_size: payload.fileSize || 0,
        entity_type: payload.entityType || null,
        entity_id: payload.entityId || null,
        content_preview: payload.contentPreview || null,
        full_text_content: payload.fullTextContent || null,
        uploaded_by: payload.uploadedBy || null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapRow(data);
  },

  /**
   * Cập nhật metadata tài liệu
   */
  async update(id: string, payload: Partial<DocumentRegistryCreatePayload>): Promise<DocumentRegistryItem> {
    const dbPayload: Record<string, any> = {};

    if (payload.title !== undefined) dbPayload.title = payload.title;
    if (payload.description !== undefined) dbPayload.description = payload.description;
    if (payload.docCategory !== undefined) dbPayload.doc_category = payload.docCategory;
    if (payload.tags !== undefined) dbPayload.tags = payload.tags;
    if (payload.sourceUrl !== undefined) dbPayload.source_url = payload.sourceUrl;
    if (payload.entityType !== undefined) dbPayload.entity_type = payload.entityType;
    if (payload.entityId !== undefined) dbPayload.entity_id = payload.entityId;
    if (payload.contentPreview !== undefined) dbPayload.content_preview = payload.contentPreview;
    if (payload.fullTextContent !== undefined) dbPayload.full_text_content = payload.fullTextContent;

    const { data, error } = await supabase
      .from('document_registry')
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapRow(data);
  },

  /**
   * Xóa tài liệu (chỉ Admin)
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('document_registry')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  /**
   * Đánh dấu tài liệu đã được AI index
   */
  async markAsIndexed(id: string): Promise<void> {
    const { error } = await supabase
      .from('document_registry')
      .update({ is_ai_indexed: true, ai_indexed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Thống kê dung lượng lưu trữ thực tế
   */
  async getStorageStats(): Promise<StorageStats> {
    const { data, error } = await supabase
      .from('document_registry')
      .select('doc_category, file_size, is_ai_indexed');

    if (error) throw error;

    const docs = data || [];
    const byCategory: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;
    let aiIndexedCount = 0;

    for (const doc of docs) {
      totalSize += doc.file_size || 0;
      if (doc.is_ai_indexed) aiIndexedCount++;

      const cat = doc.doc_category || 'general';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, size: 0 };
      byCategory[cat].count++;
      byCategory[cat].size += doc.file_size || 0;
    }

    return {
      totalDocuments: docs.length,
      totalSize,
      aiIndexedCount,
      byCategory,
    };
  },

  /**
   * Lấy tài liệu gần đây (cho widget dashboard)
   */
  async getRecent(limit = 5): Promise<DocumentRegistryItem[]> {
    const { data, error } = await supabase
      .from('document_registry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapRow);
  },

  /**
   * Tìm tài liệu theo entity (ví dụ: tất cả tài liệu của 1 hợp đồng)
   */
  async getByEntity(entityType: string, entityId: string): Promise<DocumentRegistryItem[]> {
    const { data, error } = await supabase
      .from('document_registry')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRow);
  },

  /**
   * Lấy tất cả tags đang dùng (cho autocomplete)
   */
  async getAllTags(): Promise<string[]> {
    const { data, error } = await supabase
      .from('document_registry')
      .select('tags');

    if (error) throw error;

    const tagSet = new Set<string>();
    for (const row of data || []) {
      for (const tag of row.tags || []) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  },
};
