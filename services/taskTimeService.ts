import { dataClient } from '../lib/dataClient';

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  description: string | null;
  is_running: boolean;
  created_at: string;
  updated_at: string;
  // joined
  employee?: { id: string; name: string; avatar: string | null };
}

export const TaskTimeService = {
  /** Lấy danh sách time entries của một task */
  async getEntries(taskId: string): Promise<TimeEntry[]> {
    const { data, error } = await dataClient
      .from('task_time_entries')
      .select('*, employee:employees(id, name, avatar)')
      .eq('task_id', taskId)
      .order('started_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as TimeEntry[];
  },

  /** Bắt đầu timer mới (tạo entry với is_running=true) */
  async startTimer(taskId: string, userId: string): Promise<TimeEntry> {
    // Stop any existing running timers for this user+task first
    await TaskTimeService.stopAllRunning(taskId, userId);

    const { data, error } = await dataClient
      .from('task_time_entries')
      .insert({
        task_id: taskId,
        user_id: userId,
        started_at: new Date().toISOString(),
        is_running: true,
      })
      .select('*, employee:employees(id, name, avatar)')
      .single();

    if (error) throw error;
    return data as unknown as TimeEntry;
  },

  /** Dừng timer đang chạy (cập nhật ended_at) */
  async stopTimer(entryId: string): Promise<TimeEntry> {
    const { data, error } = await dataClient
      .from('task_time_entries')
      .update({ ended_at: new Date().toISOString(), is_running: false })
      .eq('id', entryId)
      .select('*, employee:employees(id, name, avatar)')
      .single();

    if (error) throw error;
    return data as unknown as TimeEntry;
  },

  /** Dừng tất cả timer đang chạy của user trong task */
  async stopAllRunning(taskId: string, userId: string): Promise<void> {
    const { error } = await dataClient
      .from('task_time_entries')
      .update({ ended_at: new Date().toISOString(), is_running: false })
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .eq('is_running', true);

    if (error) throw error;
  },

  /** Tạo log thời gian thủ công */
  async createEntry(
    taskId: string,
    userId: string,
    startedAt: string,
    endedAt: string,
    description?: string,
  ): Promise<TimeEntry> {
    const { data, error } = await dataClient
      .from('task_time_entries')
      .insert({
        task_id: taskId,
        user_id: userId,
        started_at: startedAt,
        ended_at: endedAt,
        description: description || null,
        is_running: false,
      })
      .select('*, employee:employees(id, name, avatar)')
      .single();

    if (error) throw error;
    return data as unknown as TimeEntry;
  },

  /** Cập nhật một entry (mô tả, thời gian) */
  async updateEntry(
    entryId: string,
    patch: { started_at?: string; ended_at?: string; description?: string },
  ): Promise<TimeEntry> {
    const { data, error } = await dataClient
      .from('task_time_entries')
      .update({ ...patch, is_running: false })
      .eq('id', entryId)
      .select('*, employee:employees(id, name, avatar)')
      .single();

    if (error) throw error;
    return data as unknown as TimeEntry;
  },

  /** Xóa một entry */
  async deleteEntry(entryId: string): Promise<void> {
    const { error } = await dataClient
      .from('task_time_entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;
  },

  /** Tính tổng giờ đã log (phút) */
  sumMinutes(entries: TimeEntry[]): number {
    return entries
      .filter(e => !e.is_running && e.duration_minutes != null)
      .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  },

  /** Format phút thành "Xh Ym" */
  formatDuration(minutes: number): string {
    if (minutes <= 0) return '0 phút';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} phút`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}p`;
  },

  /** Format số giây realtime thành "H:MM:SS" */
  formatSeconds(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  },
};
