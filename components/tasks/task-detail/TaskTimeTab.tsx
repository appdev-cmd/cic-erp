import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock, Play, Square, Plus, Trash2, Edit3, Check, X,
  Timer, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { Task } from '../../../types/taskTypes';
import { TaskTimeService, type TimeEntry } from '../../../services/taskTimeService';
import { formatDate } from '../../../utils/formatters';

interface TaskTimeTabProps {
  task: Task;
  currentUserId: string;
}

// ── Helper: local datetime string từ ISO → "yyyy-MM-ddTHH:mm"
const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ── Subcomponent: EditEntryForm
const EditEntryForm: React.FC<{
  entry: TimeEntry;
  onSave: (patch: { started_at: string; ended_at: string; description?: string }) => void;
  onCancel: () => void;
}> = ({ entry, onSave, onCancel }) => {
  const [start, setStart] = useState(entry.started_at ? toDatetimeLocal(entry.started_at) : '');
  const [end, setEnd] = useState(entry.ended_at ? toDatetimeLocal(entry.ended_at) : '');
  const [desc, setDesc] = useState(entry.description || '');

  const handleSave = () => {
    if (!start || !end) { toast.error('Vui lòng nhập đủ giờ bắt đầu và kết thúc'); return; }
    if (new Date(start) >= new Date(end)) { toast.error('Giờ kết thúc phải sau giờ bắt đầu'); return; }
    onSave({
      started_at: new Date(start).toISOString(),
      ended_at: new Date(end).toISOString(),
      description: desc.trim() || undefined,
    });
  };

  return (
    <div className="space-y-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bắt đầu</label>
          <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}
            className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Kết thúc</label>
          <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}
            className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </div>
      </div>
      <input
        type="text" value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="Mô tả nội dung công việc..."
        className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">Hủy</button>
        <button onClick={handleSave} className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer transition-colors flex items-center gap-1">
          <Check size={11} /> Lưu
        </button>
      </div>
    </div>
  );
};

// ── Subcomponent: AddEntryForm
const AddEntryForm: React.FC<{
  onAdd: (started_at: string, ended_at: string, desc?: string) => void;
  onCancel: () => void;
}> = ({ onAdd, onCancel }) => {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000);
  const [start, setStart] = useState(toDatetimeLocal(hourAgo.toISOString()));
  const [end, setEnd] = useState(toDatetimeLocal(now.toISOString()));
  const [desc, setDesc] = useState('');

  const handleAdd = () => {
    if (!start || !end) { toast.error('Vui lòng nhập đủ giờ bắt đầu và kết thúc'); return; }
    if (new Date(start) >= new Date(end)) { toast.error('Giờ kết thúc phải sau giờ bắt đầu'); return; }
    onAdd(new Date(start).toISOString(), new Date(end).toISOString(), desc.trim() || undefined);
  };

  return (
    <div className="space-y-2 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5">
        <Plus size={13} className="text-indigo-500" /> Log thời gian thủ công
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bắt đầu</label>
          <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Kết thúc</label>
          <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </div>
      </div>
      <input
        type="text" value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="Mô tả nội dung đã làm..."
        className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      />
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors">Hủy</button>
        <button onClick={handleAdd} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5">
          <Plus size={12} /> Thêm
        </button>
      </div>
    </div>
  );
};

// ════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════
export const TaskTimeTab: React.FC<TaskTimeTabProps> = ({ task, currentUserId }) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Find currently running entry for the current user
  const runningEntry = entries.find(e => e.is_running && e.user_id === currentUserId);

  const load = useCallback(async () => {
    try {
      const data = await TaskTimeService.getEntries(task.id);
      setEntries(data);
    } catch {
      toast.error('Không thể tải dữ liệu thời gian');
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime timer tick
  useEffect(() => {
    if (runningEntry) {
      const elapsed = Math.floor((Date.now() - new Date(runningEntry.started_at).getTime()) / 1000);
      setTimerSeconds(elapsed);
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      setTimerSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [runningEntry?.id]);

  const handleStart = async () => {
    try {
      const entry = await TaskTimeService.startTimer(task.id, currentUserId);
      setEntries(prev => [entry, ...prev.filter(e => !(e.is_running && e.user_id === currentUserId))]);
      toast.success('Đã bắt đầu đếm giờ');
    } catch {
      toast.error('Không thể bắt đầu timer');
    }
  };

  const handleStop = async () => {
    if (!runningEntry) return;
    try {
      const updated = await TaskTimeService.stopTimer(runningEntry.id);
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      toast.success(`Đã log ${TaskTimeService.formatDuration(updated.duration_minutes ?? 0)}`);
    } catch {
      toast.error('Không thể dừng timer');
    }
  };

  const handleAddManual = async (startedAt: string, endedAt: string, desc?: string) => {
    try {
      const entry = await TaskTimeService.createEntry(task.id, currentUserId, startedAt, endedAt, desc);
      setEntries(prev => [entry, ...prev]);
      setShowAddForm(false);
      toast.success('Đã thêm log thời gian');
    } catch {
      toast.error('Không thể thêm log thời gian');
    }
  };

  const handleUpdate = async (entryId: string, patch: { started_at: string; ended_at: string; description?: string }) => {
    try {
      const updated = await TaskTimeService.updateEntry(entryId, patch);
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
      setEditingId(null);
      toast.success('Đã cập nhật');
    } catch {
      toast.error('Không thể cập nhật');
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await TaskTimeService.deleteEntry(entryId);
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast.success('Đã xóa');
    } catch {
      toast.error('Không thể xóa');
    }
  };

  const totalMinutes = TaskTimeService.sumMinutes(entries);
  const estimate = task.time_estimate ?? 0; // giờ
  const estimateMinutes = estimate * 60;
  const progressPct = estimateMinutes > 0 ? Math.min(100, Math.round((totalMinutes / estimateMinutes) * 100)) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">

      {/* ── Progress Overview ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Clock size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Theo dõi thời gian</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Tổng thời gian đã log cho công việc này</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {TaskTimeService.formatDuration(totalMinutes)}
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Đã log</div>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <div className="text-xl font-black text-slate-700 dark:text-slate-300">
              {estimate > 0 ? `${estimate}h` : '—'}
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Dự kiến</div>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <div className={`text-xl font-black ${progressPct != null && progressPct > 100 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {progressPct != null ? `${progressPct}%` : '—'}
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Tiến độ</div>
          </div>
        </div>

        {progressPct != null && (
          <div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressPct > 100 ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
            {progressPct > 100 && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1">
                <AlertCircle size={11} /> Vượt {progressPct - 100}% so với ước tính
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Timer Controls ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${runningEntry ? 'bg-red-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
            <div>
              <div className={`text-2xl font-mono font-black tabular-nums ${runningEntry ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {TaskTimeService.formatSeconds(timerSeconds)}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {runningEntry ? 'Đang chạy...' : 'Timer dừng'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runningEntry ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer transition-colors shadow-md shadow-red-200 dark:shadow-red-900/20"
              >
                <Square size={14} fill="currentColor" /> Dừng
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer transition-colors shadow-md shadow-emerald-200 dark:shadow-emerald-900/20"
              >
                <Play size={14} fill="currentColor" /> Bắt đầu
              </button>
            )}
            <button
              onClick={() => { setShowAddForm(v => !v); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold cursor-pointer transition-colors"
            >
              <Plus size={14} /> Log thủ công
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="mt-4">
            <AddEntryForm onAdd={handleAddManual} onCancel={() => setShowAddForm(false)} />
          </div>
        )}
      </div>

      {/* ── Entry List ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Timer size={14} className="text-indigo-500" />
            Lịch sử
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
              {entries.length}
            </span>
          </h4>
        </div>

        {entries.length === 0 ? (
          <div className="py-10 text-center text-slate-400 dark:text-slate-500">
            <Clock size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Chưa có log thời gian nào</p>
            <p className="text-xs mt-1">Bấm "Bắt đầu" hoặc "Log thủ công" để thêm</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {entries.map(entry => {
              const isEditing = editingId === entry.id;
              const isOwn = entry.user_id === currentUserId;
              const employeeName = entry.employee?.name || 'Nhân viên';
              const avatar = entry.employee?.avatar;

              return (
                <div key={entry.id} className="px-5 py-3">
                  {isEditing ? (
                    <EditEntryForm
                      entry={entry}
                      onSave={(patch) => handleUpdate(entry.id, patch)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-start gap-3 group">
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-bold overflow-hidden flex-shrink-0">
                        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : employeeName.charAt(0).toUpperCase()}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{employeeName}</span>
                          {entry.is_running ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> Đang chạy
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                              {TaskTimeService.formatDuration(entry.duration_minutes ?? 0)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {entry.started_at && formatDate(entry.started_at)}
                          {entry.ended_at && ` → ${new Date(entry.ended_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                        {entry.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{entry.description}</p>
                        )}
                      </div>

                      {/* Actions — own entries only */}
                      {isOwn && !entry.is_running && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => setEditingId(entry.id)}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
