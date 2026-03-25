import { dataClient as supabase } from '../lib/dataClient';

/**
 * Personal Contract Tags Service
 * Each user can privately tag contracts for personal organization.
 * Tags are per-user — invisible to other users.
 */

export interface ContractTag {
  id: string;
  user_id: string;
  contract_id: string;
  tag: string;
  created_at: string;
}

// Normalize tag: lowercase, trim, strip leading #
const normalizeTag = (raw: string): string => {
  let t = raw.trim().toLowerCase();
  if (t.startsWith('#')) t = t.slice(1);
  return t.trim();
};

const getCurrentUserId = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  if (!data?.user?.id) throw new Error('Chưa đăng nhập');
  return data.user.id;
};

export const ContractTagService = {
  /**
   * Get all tags for a specific contract (current user only)
   */
  getTagsForContract: async (contractId: string): Promise<string[]> => {
    const userId = await getCurrentUserId();
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
  },

  /**
   * Get all unique tags the current user has ever used (for autocomplete & filter dropdown)
   */
  getAllUserTags: async (): Promise<string[]> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('contract_tags')
      .select('tag')
      .eq('user_id', userId);

    if (error) {
      console.error('[ContractTagService] getAllUserTags error:', error);
      return [];
    }
    // Deduplicate
    const unique = [...new Set((data || []).map((r: any) => r.tag as string))];
    unique.sort();
    return unique;
  },

  /**
   * Add a tag to a contract. Silently skips if already exists.
   */
  addTag: async (contractId: string, rawTag: string): Promise<boolean> => {
    const tag = normalizeTag(rawTag);
    if (!tag || tag.length === 0 || tag.length > 50) return false;

    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('contract_tags')
      .upsert(
        { user_id: userId, contract_id: contractId, tag },
        { onConflict: 'user_id,contract_id,tag', ignoreDuplicates: true }
      );

    if (error) {
      console.error('[ContractTagService] addTag error:', error);
      return false;
    }
    return true;
  },

  /**
   * Remove a tag from a contract
   */
  removeTag: async (contractId: string, rawTag: string): Promise<boolean> => {
    const tag = normalizeTag(rawTag);
    const userId = await getCurrentUserId();
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
  },

  /**
   * Get all contract IDs that have a specific tag (current user)
   * Used for filtering in ContractList
   */
  getContractIdsByTag: async (rawTag: string): Promise<string[]> => {
    const tag = normalizeTag(rawTag);
    const userId = await getCurrentUserId();
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
  },

  /**
   * Get tags for multiple contracts at once (batch — for list view)
   * Returns a Map<contractId, tags[]>
   */
  getTagsForContracts: async (contractIds: string[]): Promise<Map<string, string[]>> => {
    const map = new Map<string, string[]>();
    if (!contractIds.length) return map;

    const userId = await getCurrentUserId();
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
    return map;
  },
};
