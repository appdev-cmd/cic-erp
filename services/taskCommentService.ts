// Task Comment Service — CIC ERP
// Discussion thread: comments, threaded replies, reactions, system messages

import { dataClient as supabase } from '../lib/dataClient';
import type { TaskComment, CreateCommentInput } from '../types/taskTypes';

export const TaskCommentService = {
  /**
   * Get all comments for a task, with replies nested under parents.
   */
  async getComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    const comments = (data || []) as TaskComment[];

    // Resolve user names from employees
    const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
    let userMap: Record<string, { name: string; avatar?: string }> = {};
    if (userIds.length > 0) {
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, avatar')
        .in('id', userIds);
      if (employees) {
        for (const emp of employees) {
          userMap[emp.id] = { name: emp.name, avatar: emp.avatar };
        }
      }
    }

    // Enrich with user names and build tree
    const enriched = comments.map(c => ({
      ...c,
      user_name: userMap[c.user_id]?.name || c.user_id,
      user_avatar: userMap[c.user_id]?.avatar,
      replies: [] as TaskComment[],
    }));

    // Build parent → child tree (1 level deep)
    const topLevel: TaskComment[] = [];
    const childMap: Record<string, TaskComment[]> = {};

    for (const comment of enriched) {
      if (comment.parent_comment_id) {
        if (!childMap[comment.parent_comment_id]) {
          childMap[comment.parent_comment_id] = [];
        }
        childMap[comment.parent_comment_id].push(comment);
      } else {
        topLevel.push(comment);
      }
    }

    // Attach replies
    for (const comment of topLevel) {
      comment.replies = childMap[comment.id] || [];
    }

    return topLevel;
  },

  /**
   * Add a comment (user or system).
   */
  async addComment(input: CreateCommentInput): Promise<TaskComment> {
    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: input.task_id,
        user_id: input.user_id,
        content: input.content,
        parent_comment_id: input.parent_comment_id || null,
        comment_type: input.comment_type || 'user',
        attachments: input.attachments || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data as TaskComment;
  },

  /**
   * Add a system-generated comment (e.g., "Task created from HĐ_015/DCS").
   */
  async addSystemComment(taskId: string, message: string): Promise<TaskComment> {
    return this.addComment({
      task_id: taskId,
      user_id: 'system',
      content: message,
      comment_type: 'system',
    });
  },

  /**
   * Delete a comment (only owner or admin).
   */
  async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  },

  /**
   * Toggle a reaction on a comment.
   * reactions format: { "👍": ["userId1", "userId2"], "❤️": ["userId3"] }
   */
  async toggleReaction(commentId: string, emoji: string, userId: string): Promise<void> {
    // Get current reactions
    const { data, error: fetchError } = await supabase
      .from('task_comments')
      .select('reactions')
      .eq('id', commentId)
      .single();

    if (fetchError) throw fetchError;

    const reactions: Record<string, string[]> = (data?.reactions as Record<string, string[]>) || {};
    const currentUsers = reactions[emoji] || [];

    if (currentUsers.includes(userId)) {
      // Remove reaction
      reactions[emoji] = currentUsers.filter(id => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      // Add reaction
      reactions[emoji] = [...currentUsers, userId];
    }

    const { error: updateError } = await supabase
      .from('task_comments')
      .update({ reactions })
      .eq('id', commentId);

    if (updateError) throw updateError;
  },

  /**
   * Pin/unpin a comment.
   */
  async togglePin(commentId: string): Promise<void> {
    const { data, error: fetchError } = await supabase
      .from('task_comments')
      .select('is_pinned')
      .eq('id', commentId)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from('task_comments')
      .update({ is_pinned: !data?.is_pinned })
      .eq('id', commentId);

    if (updateError) throw updateError;
  },

  /**
   * Update comment content.
   */
  async updateComment(commentId: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('task_comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', commentId);

    if (error) throw error;
  },

  /**
   * Get comment count for a task (used in task list views).
   */
  async getCommentCount(taskId: string): Promise<number> {
    const { count, error } = await supabase
      .from('task_comments')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId);

    if (error) throw error;
    return count || 0;
  },
  /**
   * Get comment counts for multiple tasks (batch — avoids N+1 queries).
   * Returns a map: taskId → commentCount
   */
  async getCommentCountsBatch(taskIds: string[]): Promise<Record<string, number>> {
    if (taskIds.length === 0) return {};
    const { data, error } = await supabase
      .from('task_comments')
      .select('task_id')
      .in('task_id', taskIds); console.log('Batch result from DB:', data, error);

    if (error) throw error;

    const counts: Record<string, number> = {};
    (data || []).forEach(row => {
      counts[row.task_id] = (counts[row.task_id] || 0) + 1;
    });
    return counts;
  },
};
