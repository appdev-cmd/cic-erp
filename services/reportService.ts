import { supabase } from '../lib/supabase';
import type { Report, ReportType } from '../types';

export const reportService = {
  // Get all reports, ordered by date descending
  async getAll(): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }

    // Convert snake_case from DB to camelCase for frontend
    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      author: row.author,
      date: row.date,
      type: row.type as ReportType,
      fileUrl: row.file_url,
      filePath: row.file_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  // Get a single report by ID
  async getById(id: string): Promise<Report | null> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching report ${id}:`, error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      author: data.author,
      date: data.date,
      type: data.type as ReportType,
      fileUrl: data.file_url,
      filePath: data.file_path,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  // Create a new report
  async create(report: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<Report> {
    const dbReport = {
      title: report.title,
      description: report.description,
      author: report.author,
      date: report.date,
      type: report.type,
      file_url: report.fileUrl,
      file_path: report.filePath,
    };

    const { data, error } = await supabase
      .from('reports')
      .insert(dbReport)
      .select()
      .single();

    if (error) {
      console.error('Error creating report:', error);
      throw error;
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      author: data.author,
      date: data.date,
      type: data.type as ReportType,
      fileUrl: data.file_url,
      filePath: data.file_path,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  // Update an existing report
  async update(id: string, updates: Partial<Omit<Report, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Report> {
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.author !== undefined) dbUpdates.author = updates.author;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.fileUrl !== undefined) dbUpdates.file_url = updates.fileUrl;
    if (updates.filePath !== undefined) dbUpdates.file_path = updates.filePath;
    
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('reports')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating report ${id}:`, error);
      throw error;
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      author: data.author,
      date: data.date,
      type: data.type as ReportType,
      fileUrl: data.file_url,
      filePath: data.file_path,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  // Delete a report and its associated file if applicable
  async delete(id: string, filePath?: string): Promise<void> {
    // 1. Delete file from storage if it exists
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('reports')
        .remove([filePath]);
      
      if (storageError) {
        console.error(`Error deleting file from storage for report ${id}:`, storageError);
        // Continue to delete DB record even if storage deletion fails
      }
    }

    // 2. Delete record from database
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting report ${id}:`, error);
      throw error;
    }
  },

  // Upload HTML file to Supabase Storage
  async uploadHtmlFile(file: File): Promise<{ url: string; path: string }> {
    // Generate unique filename to avoid collisions
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `html_reports/${fileName}`;

    // Upload to 'reports' bucket
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'text/html' // explicitly set content type
      });

    if (uploadError) {
      console.error('Error uploading HTML file:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data } = supabase.storage
      .from('reports')
      .getPublicUrl(filePath);

    return {
      url: data.publicUrl,
      path: filePath
    };
  }
};
