import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Crown, Edit3, Eye, Plus, ShieldCheck, User, Users, X, XCircle } from 'lucide-react';
import { DatePickerField, PersonBadge, type PersonInfo, PRIORITIES } from '../TaskDetailSubComponents';
import PeoplePickerPopover from '../PeoplePickerPopover';
import type { Task, TaskStatus, ApprovalStep, ApprovalMode } from '../../../types/taskTypes';
import { formatDate, formatDateTime } from '../../../utils/formatters';

interface TaskSidebarProps {
  task: Task;
  statuses: TaskStatus[];
  currentStatus?: { color: string };
  currentPriority: { bg: string; darkBg: string; color: string; darkColor: string };
  isOverdue: boolean;
  overdueDays: number;
  openPicker: string | null;
  setOpenPicker: (val: any) => void;
  bufferChange: (field: string, value: any) => void;
  getPersonInfo: (id: string) => PersonInfo | undefined;
  ensurePeopleLoaded: (ids: string[]) => void;
  editingStepLevel: number | null;
  setEditingStepLevel: (val: number | null) => void;
  isPendingApproval: boolean;
}

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
  task,
  statuses,
  currentStatus,
  currentPriority,
  isOverdue,
  overdueDays,
  openPicker,
  setOpenPicker,
  bufferChange,
  getPersonInfo,
  ensurePeopleLoaded,
  editingStepLevel,
  setEditingStepLevel,
  isPendingApproval,
}) => {
  return (
    <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
      <div className="p-4 space-y-4">
        {/* Overdue banner */}
        {isOverdue && (
          <div className="rounded-xl bg-red-500 dark:bg-red-600 p-3 text-white shadow-lg shadow-red-500/20">
            <div className="flex items-center gap-2 text-sm font-bold">
              <AlertTriangle size={16} />
              Quá hạn {overdueDays} ngày!
            </div>
            <div className="text-xs opacity-80 mt-0.5">Deadline: {formatDate(task.due_date!)}</div>
          </div>
        )}

        {/* Status */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Trạng thái</label>
          <select
            value={task.status_id || ''}
            onChange={e => bufferChange('status_id', e.target.value)}
            className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            style={currentStatus ? { borderColor: currentStatus.color, color: currentStatus.color } : {}}
          >
            {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Ưu tiên</label>
          <select
            value={task.priority}
            onChange={e => bufferChange('priority', e.target.value)}
            className={`w-full text-sm font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 ${currentPriority.bg} ${currentPriority.darkBg} ${currentPriority.color} ${currentPriority.darkColor} cursor-pointer`}
          >
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Dates */}
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Ngày bắt đầu</label>
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
              <DatePickerField value={task.start_date} onChange={val => bufferChange('start_date', val)} textClassName="text-sm font-semibold text-slate-700 dark:text-slate-200" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Deadline</label>
            <div className={`px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border ${isOverdue ? 'border-red-400 dark:border-red-600' : 'border-slate-200 dark:border-slate-600'}`}>
              <DatePickerField
                value={task.due_date}
                onChange={val => bufferChange('due_date', val)}
                textClassName={`text-sm font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Số ngày dự kiến</label>
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center gap-1">
              <input
                type="number" min={0}
                defaultValue={(() => {
                  if (task.start_date && task.due_date) {
                    const diff = Math.round((new Date(task.due_date).getTime() - new Date(task.start_date).getTime()) / 86400000);
                    return diff >= 0 ? diff : '';
                  }
                  return '';
                })()}
                key={`${task.start_date}-${task.due_date}`}
                onBlur={e => {
                  const days = parseInt(e.target.value);
                  if (!isNaN(days) && days >= 0 && task.start_date) {
                    const start = new Date(task.start_date);
                    start.setDate(start.getDate() + days);
                    bufferChange('due_date', start.toISOString().split('T')[0]);
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="—"
                className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent border-none outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">ngày</span>
            </div>
          </div>
        </div>

        {/* People */}
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          {/* Người giao việc */}
          {task.created_by && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Crown size={10} /> Người giao việc
              </label>
              <PersonBadge person={getPersonInfo(task.created_by)!} />
            </div>
          )}

          {/* Người thực hiện chính (assignees) */}
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1"><User size={10} /> Người thực hiện</span>
              <button onClick={() => setOpenPicker(openPicker === 'assignees' ? null : 'assignees')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer" title="Thay đổi người">
                <Edit3 size={12} />
              </button>
            </label>
            {task.assignees?.length > 0 ? (
              task.assignees.map(id => <PersonBadge key={id} person={getPersonInfo(id)!} />)
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">Chưa phân công</span>
            )}
            {openPicker === 'assignees' && (
              <PeoplePickerPopover
                align="left"
                currentIds={task.assignees || []}
                onChange={ids => {
                  const newId = ids[ids.length - 1];
                  if (newId) {
                    const oldAssignee = task.assignees?.[0];
                    const currentSupporters = (task.supporters || []).filter(id => id !== newId);
                    if (oldAssignee && oldAssignee !== newId && !currentSupporters.includes(oldAssignee)) {
                      bufferChange('supporters', [...currentSupporters, oldAssignee]);
                    } else if (currentSupporters.length !== (task.supporters || []).length) {
                      bufferChange('supporters', currentSupporters);
                    }
                    bufferChange('assignees', [newId]);
                    ensurePeopleLoaded([newId]);
                    setOpenPicker(null);
                  }
                }}
                onClose={() => setOpenPicker(null)}
              />
            )}
          </div>

          {/* Người phối hợp (supporters) */}
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 justify-between">
              <span className="flex items-center gap-1"><Users size={10} /> Người phối hợp</span>
              <button onClick={() => setOpenPicker(openPicker === 'supporters' ? null : 'supporters')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"><Plus size={12} /></button>
            </label>
            {task.supporters?.length > 0 ? (
              task.supporters.map(id => <PersonBadge key={id} person={getPersonInfo(id)!} onRemove={() => bufferChange('supporters', task.supporters.filter(x => x !== id))} />)
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">Không có</span>
            )}
            {openPicker === 'supporters' && (
              <PeoplePickerPopover
                align="left"
                currentIds={task.supporters || []}
                onChange={ids => { bufferChange('supporters', ids); ensurePeopleLoaded(ids); }}
                onClose={() => setOpenPicker(null)}
              />
            )}
          </div>

          {/* Người theo dõi (watchers) */}
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 justify-between">
              <span className="flex items-center gap-1"><Eye size={10} /> Người theo dõi</span>
              <button onClick={() => setOpenPicker(openPicker === 'watchers' ? null : 'watchers')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"><Plus size={12} /></button>
            </label>
            {task.watchers?.length > 0 ? (
              task.watchers.map(id => <PersonBadge key={id} person={getPersonInfo(id)!} onRemove={() => bufferChange('watchers', task.watchers.filter(x => x !== id))} />)
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">Không có</span>
            )}
            {openPicker === 'watchers' && (
              <PeoplePickerPopover
                inline
                currentIds={task.watchers || []}
                onChange={ids => { bufferChange('watchers', ids); ensurePeopleLoaded(ids); }}
                onClose={() => setOpenPicker(null)}
              />
            )}
          </div>

          {/* Phê duyệt (approvers / multi-level) */}
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1 justify-between">
              <span className="flex items-center gap-1"><ShieldCheck size={10} /> Phê duyệt</span>
            </label>

            {(() => {
              const steps: ApprovalStep[] = task.custom_fields?.approval_steps || [];
              const currentLevel: number | undefined = task.custom_fields?.current_approval_level;
              const hasMultiLevel = steps.length > 0;

              // ─── Multi-level stepper ───
              if (hasMultiLevel) {
                const sortedSteps = [...steps].sort((a, b) => a.level - b.level);
                return (
                  <div className="space-y-2">
                    {sortedSteps.map((step, idx) => {
                      const isActive = currentLevel === step.level;
                      const isDoneLvl = currentLevel !== undefined && step.level < currentLevel;
                      const isFullyDone = task.approval_status === 'approved';
                      const isRejected = task.approval_status === 'rejected';

                      let dotClass = 'bg-slate-300 dark:bg-slate-600';
                      let lineClass = 'bg-slate-200 dark:bg-slate-700';
                      if (isDoneLvl || isFullyDone) { dotClass = 'bg-emerald-500'; lineClass = 'bg-emerald-300 dark:bg-emerald-700'; }
                      else if (isActive && !isRejected) { dotClass = 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-800'; }
                      else if (isRejected && isActive) { dotClass = 'bg-red-500'; }

                      return (
                        <div key={step.level} className="flex gap-2">
                          {/* Stepper dot + line */}
                          <div className="flex flex-col items-center flex-shrink-0 w-4">
                            <div className={`w-3 h-3 rounded-full ${dotClass} flex items-center justify-center`}>
                              {(isDoneLvl || isFullyDone) && <CheckCircle2 size={8} className="text-white" />}
                            </div>
                            {idx < sortedSteps.length - 1 && <div className={`w-0.5 flex-1 mt-0.5 min-h-[16px] ${lineClass}`} />}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-1">
                              <span className={`text-[11px] font-semibold ${
                                isDoneLvl || isFullyDone ? 'text-emerald-600 dark:text-emerald-400' :
                                isActive && !isRejected ? 'text-amber-600 dark:text-amber-400' :
                                isRejected && isActive ? 'text-red-600 dark:text-red-400' :
                                'text-slate-400 dark:text-slate-500'
                              }`}>{step.label || `Cấp ${step.level}`}</span>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500">({step.mode === 'any' ? '1 duyệt' : 'tất cả'})</span>
                              {!isPendingApproval && (
                                <button
                                  onClick={() => {
                                    const newSteps = steps
                                      .filter(s => s.level !== step.level)
                                      .sort((a, b) => a.level - b.level)
                                      .map((s, i) => ({ ...s, level: i + 1, label: `Cấp ${i + 1}` }));
                                    bufferChange('custom_fields', { ...task.custom_fields, approval_steps: newSteps });
                                  }}
                                  className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 cursor-pointer ml-auto"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {step.approver_ids.map(id => (
                                <span key={id} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {getPersonInfo(id)?.name || id.slice(0, 6)}
                                </span>
                              ))}
                              {!isPendingApproval && (
                                <button
                                  onClick={() => {
                                    setEditingStepLevel(step.level);
                                    setOpenPicker('approvers');
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer flex items-center gap-0.5"
                                >
                                  <Edit3 size={8} /> sửa
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add new level button */}
                    {!isPendingApproval && (
                      <button
                        onClick={() => {
                          const maxLevel = Math.max(0, ...steps.map(s => s.level));
                          const newStep: ApprovalStep = {
                            level: maxLevel + 1,
                            label: `Cấp ${maxLevel + 1}`,
                            approver_ids: [],
                            mode: 'all',
                          };
                          bufferChange('custom_fields', {
                            ...task.custom_fields,
                            approval_steps: [...steps, newStep],
                          });
                          setEditingStepLevel(maxLevel + 1);
                          setOpenPicker('approvers');
                        }}
                        className="flex items-center gap-1 text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer ml-6"
                      >
                        <Plus size={10} /> Thêm cấp phê duyệt
                      </button>
                    )}

                    {/* Approval status */}
                    {task.approval_status && (
                      <div className={`mt-1 text-[10px] font-semibold px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                        task.approval_status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                        task.approval_status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {task.approval_status === 'pending' && <><Clock size={10} /> Đang chờ — {steps.find(s => s.level === currentLevel)?.label || `Cấp ${currentLevel}`}</>}
                        {task.approval_status === 'approved' && <><CheckCircle2 size={10} /> Đã phê duyệt</>}
                        {task.approval_status === 'rejected' && <><XCircle size={10} /> Bị từ chối</>}
                      </div>
                    )}
                  </div>
                );
              }

              // ─── Simple mode (flat approvers[]) ───
              return (
                <>
                  <div className="flex items-center gap-1 mb-1">
                    <button onClick={() => setOpenPicker(openPicker === 'approvers' ? null : 'approvers')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer text-[10px] flex items-center gap-0.5">
                      <Plus size={10} /> Thêm người
                    </button>
                    <button
                      onClick={() => {
                        const newStep: ApprovalStep = {
                          level: 1,
                          label: 'Cấp 1',
                          approver_ids: task.approvers || [],
                          mode: (task.approval_mode || 'all') as ApprovalMode,
                        };
                        bufferChange('custom_fields', {
                          ...task.custom_fields,
                          approval_steps: [newStep],
                        });
                      }}
                      className="text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 cursor-pointer text-[10px] flex items-center gap-0.5 ml-2"
                      title="Chuyển sang phê duyệt nhiều cấp"
                    >
                      <ShieldCheck size={10} /> Nhiều cấp
                    </button>
                  </div>
                  {task.approvers?.length > 0 ? (
                    <>
                      {task.approvers.map(id => <PersonBadge key={id} person={getPersonInfo(id)!} onRemove={() => bufferChange('approvers', task.approvers.filter(x => x !== id))} />)}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Chế độ:</span>
                        <select
                          value={task.approval_mode || 'all'}
                          onChange={e => bufferChange('approval_mode', e.target.value as ApprovalMode)}
                          className="text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                        >
                          <option value="all">Tất cả phải duyệt</option>
                          <option value="any">Chỉ cần 1 duyệt</option>
                        </select>
                      </div>
                      {task.approval_status && (
                        <div className={`mt-1.5 text-[10px] font-semibold px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                          task.approval_status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                          task.approval_status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {task.approval_status === 'pending' && <><Clock size={10} /> Đang chờ phê duyệt</>}
                          {task.approval_status === 'approved' && <><CheckCircle2 size={10} /> Đã phê duyệt</>}
                          {task.approval_status === 'rejected' && <><XCircle size={10} /> Bị từ chối</>}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">Không có</span>
                  )}
                </>
              );
            })()}

            {openPicker === 'approvers' && (
              <PeoplePickerPopover
                currentIds={(() => {
                  const steps: ApprovalStep[] = task.custom_fields?.approval_steps || [];
                  if (steps.length > 0 && editingStepLevel !== null) {
                    const targetStep = steps.find(s => s.level === editingStepLevel);
                    return targetStep?.approver_ids || [];
                  }
                  return task.approvers || [];
                })()}
                onChange={ids => {
                  const steps: ApprovalStep[] = task.custom_fields?.approval_steps || [];
                  if (steps.length > 0 && editingStepLevel !== null) {
                    const updated = steps.map(s =>
                      s.level === editingStepLevel ? { ...s, approver_ids: ids } : s
                    );
                    bufferChange('custom_fields', { ...task.custom_fields, approval_steps: updated });
                  } else {
                    bufferChange('approvers', ids);
                  }
                  ensurePeopleLoaded(ids);
                }}
                onClose={() => { setOpenPicker(null); setEditingStepLevel(null); }}
              />
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400 dark:text-slate-500">Tạo lúc</span>
            <span className="text-slate-600 dark:text-slate-400 font-semibold">{formatDateTime(task.created_at)}</span>
          </div>
          {task.completed_at && (
            <div className="flex justify-between">
              <span className="text-emerald-500 dark:text-emerald-400">Hoàn thành</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatDateTime(task.completed_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
