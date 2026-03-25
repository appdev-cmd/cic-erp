import { dataClient as supabase } from '../lib/dataClient';

/**
 * Personal Contract Tags Service
 * Each user can privately tag contracts for personal organization.
 * Tags are per-user — invisible to other users.
 * 
 * userId is passed explicitly from components (via AuthContext profile.id)
 * to avoid relying on dataClient.auth.getUser() which may fail.
 */

export interface ContractTag {
  id: string;
  user_id: string;
  contract_id: string;
  tag: string;
  created_at: string;
}

// Normalize tag: lowercase, trim, strip leading #, replace spaces with _
export const normalizeTag = (raw: string): string => {
  let t = raw.trim().toLowerCase();
  if (t.startsWith('#')) t = t.slice(1);
  t = t.trim().replace(/\s+/g, '_'); // spaces → underscores
  t = t.replace(/[^a-zA-Z0-9_àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\-]/g, '');
  return t;
};

export const ContractTagService = {
  /**
   * Get all tags for a specific contract (for given user)
   */
  getTagsForContract: async (userId: string, contractId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('contract_tags')
        .select('tag')
        .eq('user_id', userId)
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ContractTagService] getTagsForContract error:', error);
        return [];
      }
      return (data || []).map((r: any) => r.tag);
    } catch (err) {
      console.error('[ContractTagService] getTagsForContract exception:', err);
      return [];
    }
  },

  /**
   * Get all unique tags the user has ever used (for autocomplete & filter dropdown)
   */
  getAllUserTags: async (userId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('contract_tags')
        .select('tag')
        .eq('user_id', userId);

      if (error) {
        console.error('[ContractTagService] getAllUserTags error:', error);
        return [];
      }
      const unique = [...new Set((data || []).map((r: any) => r.tag as string))];
      unique.sort();
      return unique;
    } catch (err) {
      console.error('[ContractTagService] getAllUserTags exception:', err);
      return [];
    }
  },

  /**
   * Add a tag to a contract.
   */
  addTag: async (userId: string, contractId: string, rawTag: string): Promise<boolean> => {
    try {
      const tag = normalizeTag(rawTag);
      if (!tag || tag.length === 0 || tag.length > 50) return false;

      const { error } = await supabase
        .from('contract_tags')
        .insert({ user_id: userId, contract_id: contractId, tag });

      if (error) {
        // 23505 = unique_violation → tag already exists, treat as success
        if (error.code === '23505') return true;
        console.error('[ContractTagService] addTag error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[ContractTagService] addTag exception:', err);
      return false;
    }
  },

  /**
   * Remove a tag from a contract
   */
  removeTag: async (userId: string, contractId: string, rawTag: string): Promise<boolean> => {
    try {
      const tag = normalizeTag(rawTag);
      const { error } = await supabase
        .from('contract_tags')
        .delete()
        .eq('user_id', userId)
        .eq('contract_id', contractId)
        .eq('tag', tag);

      if (error) {
        console.error('[ContractTagService] removeTag error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[ContractTagService] removeTag exception:', err);
      return false;
    }
  },

  /**
   * Get all contract IDs that have a specific tag (for given user)
   */
  getContractIdsByTag: async (userId: string, rawTag: string): Promise<string[]> => {
    try {
      const tag = normalizeTag(rawTag);
      const { data, error } = await supabase
        .from('contract_tags')
        .select('contract_id')
        .eq('user_id', userId)
        .eq('tag', tag);

      if (error) {
        console.error('[ContractTagService] getContractIdsByTag error:', error);
        return [];
      }
      return (data || []).map((r: any) => r.contract_id);
    } catch (err) {
      console.error('[ContractTagService] getContractIdsByTag exception:', err);
      return [];
    }
  },

  /**
   * Get tags for multiple contracts at once (batch — for list view)
   */
  getTagsForContracts: async (userId: string, contractIds: string[]): Promise<Map<string, string[]>> => {
    const map = new Map<string, string[]>();
    if (!contractIds.length) return map;

    try {
      const { data, error } = await supabase
        .from('contract_tags')
        .select('contract_id, tag')
        .eq('user_id', userId)
        .in('contract_id', contractIds);

      if (error) {
        console.error('[ContractTagService] getTagsForContracts error:', error);
        return map;
      }
      (data || []).forEach((r: any) => {
        const existing = map.get(r.contract_id) || [];
        existing.push(r.tag);
        map.set(r.contract_id, existing);
      });
    } catch (err) {
      console.error('[ContractTagService] getTagsForContracts exception:', err);
    }
    return map;
  },
};
