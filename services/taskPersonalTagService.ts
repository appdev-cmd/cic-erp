import { dataClient as supabase } from '../lib/dataClient';

/**
 * Personal Task Tags Service
 * Each user can privately tag tasks for personal organization.
 * Tags are per-user — invisible to other users.
 */

// Normalize tag: lowercase, trim, strip leading #, replace spaces with _
export const normalizeTaskTag = (raw: string): string => {
  let t = raw.trim().toLowerCase();
  if (t.startsWith('#')) t = t.slice(1);
  t = t.trim().replace(/\s+/g, '_');
  t = t.replace(/[^a-zA-Z0-9_àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\-]/g, '');
  return t;
};

export const TaskPersonalTagService = {
  /**
   * Get all personal tags for a specific task (for given user)
   */
  getTagsForTask: async (userId: string, taskId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('task_personal_tags')
        .select('tag')
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[TaskPersonalTagService] getTagsForTask error:', error);
        return [];
      }
      return (data || []).map((r: any) => r.tag);
    } catch (err) {
      console.error('[TaskPersonalTagService] getTagsForTask exception:', err);
      return [];
    }
  },

  /**
   * Get all unique personal tags the user has ever used (for autocomplete)
   */
  getAllUserTags: async (userId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('task_personal_tags')
        .select('tag')
        .eq('user_id', userId);

      if (error) {
        console.error('[TaskPersonalTagService] getAllUserTags error:', error);
        return [];
      }
      const unique = [...new Set((data || []).map((r: any) => r.tag as string))];
      unique.sort();
      return unique;
    } catch (err) {
      console.error('[TaskPersonalTagService] getAllUserTags exception:', err);
      return [];
    }
  },

  /**
   * Add a personal tag to a task
   */
  addTag: async (userId: string, taskId: string, rawTag: string): Promise<boolean> => {
    try {
      const tag = normalizeTaskTag(rawTag);
      if (!tag || tag.length === 0 || tag.length > 50) return false;

      const { error } = await supabase
        .from('task_personal_tags')
        .insert({ user_id: userId, task_id: taskId, tag });

      if (error) {
        if (error.code === '23505') return true; // unique violation = already exists
        console.error('[TaskPersonalTagService] addTag error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[TaskPersonalTagService] addTag exception:', err);
      return false;
    }
  },

  /**
   * Remove a personal tag from a task
   */
  removeTag: async (userId: string, taskId: string, rawTag: string): Promise<boolean> => {
    try {
      const tag = normalizeTaskTag(rawTag);
      const { error } = await supabase
        .from('task_personal_tags')
        .delete()
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .eq('tag', tag);

      if (error) {
        console.error('[TaskPersonalTagService] removeTag error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[TaskPersonalTagService] removeTag exception:', err);
      return false;
    }
  },

  /**
   * Get task IDs that have a specific personal tag (for search)
   */
  getTaskIdsByTag: async (userId: string, rawTag: string): Promise<string[]> => {
    try {
      const tag = normalizeTaskTag(rawTag);
      const { data, error } = await supabase
        .from('task_personal_tags')
        .select('task_id')
        .eq('user_id', userId)
        .eq('tag', tag);

      if (error) {
        console.error('[TaskPersonalTagService] getTaskIdsByTag error:', error);
        return [];
      }
      return (data || []).map((r: any) => r.task_id);
    } catch (err) {
      console.error('[TaskPersonalTagService] getTaskIdsByTag exception:', err);
      return [];
    }
  },

  /**
   * Get personal tags for multiple tasks at once (batch — for list view)
   */
  getTagsForTasks: async (userId: string, taskIds: string[]): Promise<Map<string, string[]>> => {
    const map = new Map<string, string[]>();
    if (!taskIds.length) return map;

    try {
      const { data, error } = await supabase
        .from('task_personal_tags')
        .select('task_id, tag')
        .eq('user_id', userId)
        .in('task_id', taskIds);

      if (error) {
        console.error('[TaskPersonalTagService] getTagsForTasks error:', error);
        return map;
      }
      (data || []).forEach((r: any) => {
        const existing = map.get(r.task_id) || [];
        existing.push(r.tag);
        map.set(r.task_id, existing);
      });
    } catch (err) {
      console.error('[TaskPersonalTagService] getTagsForTasks exception:', err);
    }
    return map;
  },
};
