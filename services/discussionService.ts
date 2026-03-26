// Discussion Service — CIC ERP
// Generic discussion/comment service for any entity (contract, task, payment, etc.)

import { dataClient as supabase } from '../lib/dataClient';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
export interface Discussion {
  id: string;
  entity_type: string;
  entity_id: string;
  parent_id?: string;
  user_id: string;
  content: string;
  comment_type: 'user' | 'system' | 'mention';
  reactions: Record<string, string[]>; // { "👍": ["userId1", "userId2"] }
  attachments: DiscussionAttachment[];
  is_pinned: boolean;
  is_edited: boolean;
  created_at: string;
  updated_at: string;

  // Joined
  user_name?: string;
  user_avatar?: string;
  reply_to_name?: string;
  reply_to_content?: string;
  replies?: Discussion[];
}

export interface DiscussionAttachment {
  name: string;
  url: string;
  size: number;
  type: string; // 'image', 'file', 'pdf', etc.
}

export interface CreateDiscussionInput {
  entity_type: string;
  entity_id: string;
  user_id: string;
  content: string;
  parent_id?: string;
  comment_type?: 'user' | 'system' | 'mention';
  attachments?: DiscussionAttachment[];
}

// ═══════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════
export const DiscussionService = {
  /**
   * Get all discussions for an entity, enriched with user names and threaded.
   */
  async getByEntity(entityType: string, entityId: string): Promise<Discussion[]> {
    const { data, error } = await supabase
      .from('discussions')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const comments = (data || []) as Discussion[];

    // Resolve user names
    const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
    let userMap: Record<string, { name: string; avatar?: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, employee_id')
        .in('id', userIds);
      if (profiles) {
        const empIds = profiles.map(p => p.employee_id).filter(Boolean);
        const empMap = new Map();
        if (empIds.length > 0) {
          const { data: employees } = await supabase.from('employees').select('id, name').in('id', empIds);
          if (employees) employees.forEach(e => empMap.set(e.id, e.name));
        }

        for (const p of profiles) {
          const employeeName = p.employee_id ? empMap.get(p.employee_id) : null;
          userMap[p.id] = { name: employeeName || p.full_name || p.id.substring(0,8), avatar: p.avatar_url };
        }
      }
    }

    // Build a lookup for parent names (for reply-to context)
    const commentMap = new Map<string, Discussion>();
    for (const c of comments) {
      commentMap.set(c.id, c);
    }

    // Enrich with user names + reply context (flat list, chronological)
    const enriched = comments.map(c => {
      const replyToComment = c.parent_id ? commentMap.get(c.parent_id) : undefined;
      return {
        ...c,
        user_name: userMap[c.user_id]?.name || 'Người dùng',
        user_avatar: userMap[c.user_id]?.avatar,
        reply_to_name: replyToComment ? (userMap[replyToComment.user_id]?.name || 'Người dùng') : undefined,
        reply_to_content: replyToComment ? replyToComment.content : undefined,
        replies: [] as Discussion[],
      };
    });

    return enriched;
  },

  /**
   * Add a new discussion comment.
   */
  async add(input: CreateDiscussionInput): Promise<Discussion> {
    const { data, error } = await supabase
      .from('discussions')
      .insert({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        user_id: input.user_id,
        content: input.content,
        parent_id: input.parent_id || null,
        comment_type: input.comment_type || 'user',
        attachments: input.attachments || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data as Discussion;
  },

  /**
   * Edit a comment.
   */
  async edit(id: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('discussions')
      .update({ content, is_edited: true })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Delete a comment.
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('discussions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Toggle a reaction on a comment.
   */
  async toggleReaction(commentId: string, emoji: string, userId: string): Promise<void> {
    // Fetch current reactions
    const { data, error: fetchError } = await supabase
      .from('discussions')
      .select('reactions')
      .eq('id', commentId)
      .single();

    if (fetchError) throw fetchError;

    const reactions = (data?.reactions || {}) as Record<string, string[]>;
    const users = reactions[emoji] || [];

    if (users.includes(userId)) {
      reactions[emoji] = users.filter(u => u !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, userId];
    }

    const { error } = await supabase
      .from('discussions')
      .update({ reactions })
      .eq('id', commentId);

    if (error) throw error;
  },

  /**
   * Pin/unpin a comment.
   */
  async togglePin(commentId: string): Promise<void> {
    const { data, error: fetchError } = await supabase
      .from('discussions')
      .select('is_pinned')
      .eq('id', commentId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('discussions')
      .update({ is_pinned: !data?.is_pinned })
      .eq('id', commentId);

    if (error) throw error;
  },

  /**
   * Add a system comment.
   */
  async addSystem(entityType: string, entityId: string, content: string): Promise<Discussion> {
    return this.add({
      entity_type: entityType,
      entity_id: entityId,
      user_id: 'system',
      content,
      comment_type: 'system',
    });
  },

  /**
   * Get comment count for an entity.
   */
  async getCount(entityType: string, entityId: string): Promise<number> {
    const { count, error } = await supabase
      .from('discussions')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('comment_type', 'user');

    if (error) throw error;
    return count || 0;
  },

  /**
   * Get comment counts for multiple entities in batch.
   * Returns a map: entityId -> commentCount
   */
  async getCountsBatch(entityType: string, entityIds: string[]): Promise<Record<string, number>> {
    if (entityIds.length === 0) return {};
    const { data, error } = await supabase
      .from('discussions')
      .select('entity_id')
      .eq('entity_type', entityType)
      .eq('comment_type', 'user')
      .in('entity_id', entityIds);

    if (error) throw error;

    const counts: Record<string, number> = {};
    (data || []).forEach(row => {
      counts[row.entity_id] = (counts[row.entity_id] || 0) + 1;
    });
    return counts;
  },
};
