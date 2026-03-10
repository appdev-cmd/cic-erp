import React, { useState } from 'react';
import {
    Zap, Plus, X, ChevronDown, ChevronRight, Trash2, ToggleLeft, ToggleRight,
    ArrowRight, AlertCircle, Play, Square
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TASK AUTOMATION — Rule engine for task workflows
// ============================================================================

type TriggerType = 'status_changed' | 'assignee_changed' | 'due_date_passed' | 'task_created' | 'priority_changed';
type ActionType = 'change_status' | 'assign_to' | 'add_comment' | 'send_notification' | 'set_priority' | 'move_to_list';

interface AutomationRule {
    id: string;
    name: string;
    trigger: TriggerType;
    triggerValue?: string;
    action: ActionType;
    actionValue: string;
    enabled: boolean;
}

const TRIGGER_LABELS: Record<TriggerType, { label: string; desc: string; icon: string }> = {
    status_changed: { label: 'Đổi trạng thái', desc: 'Khi trạng thái thay đổi', icon: '🔄' },
    assignee_changed: { label: 'Đổi người phụ trách', desc: 'Khi phân công lại', icon: '👤' },
    due_date_passed: { label: 'Quá hạn', desc: 'Khi task quá ngày hạn', icon: '⏰' },
    task_created: { label: 'Tạo mới', desc: 'Khi task được tạo', icon: '✨' },
    priority_changed: { label: 'Đổi ưu tiên', desc: 'Khi thay đổi mức ưu tiên', icon: '🚩' },
};

const ACTION_LABELS: Record<ActionType, { label: string; desc: string; icon: string }> = {
    change_status: { label: 'Đổi trạng thái', desc: 'Tự động chuyển sang trạng thái khác', icon: '🔄' },
    assign_to: { label: 'Phân công cho', desc: 'Tự động phân công người', icon: '👤' },
    add_comment: { label: 'Thêm bình luận', desc: 'Tự động viết comment', icon: '💬' },
    send_notification: { label: 'Gửi thông báo', desc: 'Gửi thông báo đến người liên quan', icon: '🔔' },
    set_priority: { label: 'Đặt ưu tiên', desc: 'Tự động đặt mức ưu tiên', icon: '🚩' },
    move_to_list: { label: 'Chuyển danh sách', desc: 'Di chuyển task sang danh sách khác', icon: '📋' },
};

interface TaskAutomationProps {
    spaceId: string;
    listId?: string;
}

const TaskAutomation: React.FC<TaskAutomationProps> = ({ spaceId, listId }) => {
    const [rules, setRules] = useState<AutomationRule[]>([
        // Example default rules
        {
            id: 'auto-1',
            name: 'Tự động hoàn thành khi done',
            trigger: 'status_changed',
            triggerValue: 'status_done',
            action: 'send_notification',
            actionValue: 'Task đã hoàn thành!',
            enabled: true,
        },
        {
            id: 'auto-2',
            name: 'Thông báo khi quá hạn',
            trigger: 'due_date_passed',
            action: 'set_priority',
            actionValue: 'urgent',
            enabled: true,
        },
    ]);

    const [showAddRule, setShowAddRule] = useState(false);
    const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
    const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
        trigger: 'status_changed',
        action: 'change_status',
        name: '',
        actionValue: '',
        enabled: true,
    });

    const toggleRule = (id: string) => {
        setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    };

    const deleteRule = (id: string) => {
        setRules(prev => prev.filter(r => r.id !== id));
        toast.success('Đã xóa quy tắc');
    };

    const addRule = () => {
        if (!newRule.name?.trim() || !newRule.actionValue?.trim()) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }
        const rule: AutomationRule = {
            id: `auto-${Date.now()}`,
            name: newRule.name!,
            trigger: newRule.trigger as TriggerType,
            triggerValue: newRule.triggerValue,
            action: newRule.action as ActionType,
            actionValue: newRule.actionValue!,
            enabled: true,
        };
        setRules(prev => [...prev, rule]);
        setShowAddRule(false);
        setNewRule({ trigger: 'status_changed', action: 'change_status', name: '', actionValue: '', enabled: true });
        toast.success('Đã thêm quy tắc mới');
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedRules);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedRules(next);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                        <Zap size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Tự động hóa</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{rules.filter(r => r.enabled).length} quy tắc đang hoạt động</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddRule(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
                >
                    <Plus size={14} /> Thêm quy tắc
                </button>
            </div>

            {/* Rules list */}
            <div className="space-y-2">
                {rules.map(rule => (
                    <div
                        key={rule.id}
                        className={`rounded-xl border transition-all ${rule.enabled
                            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-60'
                            }`}
                    >
                        {/* Rule header */}
                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleExpand(rule.id)}>
                            <button className="text-slate-400 dark:text-slate-500">
                                {expandedRules.has(rule.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{rule.name}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                        {TRIGGER_LABELS[rule.trigger]?.icon} {TRIGGER_LABELS[rule.trigger]?.label}
                                    </span>
                                    <ArrowRight size={10} className="text-slate-400" />
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                        {ACTION_LABELS[rule.action]?.icon} {ACTION_LABELS[rule.action]?.label}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleRule(rule.id); }}
                                className={`p-1 rounded transition-colors ${rule.enabled ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`}
                            >
                                {rule.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteRule(rule.id); }}
                                className="p-1 rounded text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Expanded detail */}
                        {expandedRules.has(rule.id) && (
                            <div className="px-4 pb-3 pt-0 border-t border-slate-100 dark:border-slate-700/50">
                                <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Khi:</span>
                                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{TRIGGER_LABELS[rule.trigger]?.desc}</p>
                                        {rule.triggerValue && (
                                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400">= {rule.triggerValue}</span>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Thì:</span>
                                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{ACTION_LABELS[rule.action]?.desc}</p>
                                        <span className="text-[10px] text-emerald-500 dark:text-emerald-400">→ {rule.actionValue}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {rules.length === 0 && (
                    <div className="text-center py-8">
                        <Zap size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có quy tắc tự động</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Thêm quy tắc để tối ưu hóa quy trình làm việc</p>
                    </div>
                )}
            </div>

            {/* Add rule modal */}
            {showAddRule && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 p-4 space-y-3">
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Thêm quy tắc mới</h4>

                    <input
                        autoFocus
                        value={newRule.name || ''}
                        onChange={e => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Tên quy tắc..."
                        className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <div className="grid grid-cols-2 gap-3">
                        {/* Trigger */}
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Khi</label>
                            <select
                                value={newRule.trigger}
                                onChange={e => setNewRule(prev => ({ ...prev, trigger: e.target.value as TriggerType }))}
                                className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                            >
                                {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.icon} {v.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Action */}
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Thì</label>
                            <select
                                value={newRule.action}
                                onChange={e => setNewRule(prev => ({ ...prev, action: e.target.value as ActionType }))}
                                className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                            >
                                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.icon} {v.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <input
                        value={newRule.actionValue || ''}
                        onChange={e => setNewRule(prev => ({ ...prev, actionValue: e.target.value }))}
                        placeholder="Giá trị hành động (VD: status_done, urgent...)"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setShowAddRule(false)}
                            className="text-xs px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >Hủy</button>
                        <button
                            onClick={addRule}
                            className="text-xs px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
                        >Thêm</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskAutomation;
