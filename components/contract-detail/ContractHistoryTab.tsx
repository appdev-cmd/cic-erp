// ContractHistoryTab — Full audit log timeline for a contract
// Displays all history entries from audit_logs table with rich formatting

import React, { useState, useEffect, useCallback } from 'react';
import {
  History, ChevronDown, ShieldCheck, Trash2, Edit3, Plus,
  FileText, ArrowRight, Loader2,
} from 'lucide-react';
import { AuditLogService } from '../../services';
import type { AuditLog } from '../../services/auditLogService';
import { formatDate } from '../../utils/formatters';

interface ContractHistoryTabProps {
  contractId: string;
}

const PAGE_SIZE = 20;

const ContractHistoryTab: React.FC<ContractHistoryTabProps> = ({ contractId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AuditLogService.getByRecordId('contracts', contractId);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Listen for contract-updated events to refresh logs
  useEffect(() => {
    const handleUpdate = () => loadLogs();
    window.addEventListener('contract-updated', handleUpdate);
    return () => window.removeEventListener('contract-updated', handleUpdate);
  }, [loadLogs]);

  const displayedLogs = showAll ? logs : logs.slice(0, PAGE_SIZE);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT': return <Plus size={12} className="text-white" />;
      case 'DELETE': return <Trash2 size={12} className="text-white" />;
      case 'UPDATE': return <Edit3 size={12} className="text-white" />;
      case 'APPROVE_LEGAL':
      case 'APPROVE_FINANCE':
        return <ShieldCheck size={12} className="text-white" />;
      default: return <FileText size={12} className="text-white" />;
    }
  };

  const getDotColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-emerald-500';
      case 'DELETE': case 'REJECT': return 'bg-rose-500';
      case 'APPROVE_LEGAL': case 'APPROVE_FINANCE': return 'bg-emerald-500';
      case 'SUBMIT_LEGAL': return 'bg-blue-500';
      default: return 'bg-orange-500';
    }
  };

  const getActionBadge = (action: string) => {
    const map: Record<string, { label: string; color: string }> = {
      INSERT: { label: 'Tạo mới', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
      UPDATE: { label: 'Cập nhật', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
      DELETE: { label: 'Xóa', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' },
      APPROVE_LEGAL: { label: 'Duyệt PL', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
      APPROVE_FINANCE: { label: 'Duyệt TC', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
      REJECT: { label: 'Từ chối', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' },
      SUBMIT_LEGAL: { label: 'Gửi duyệt', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
    };
    return map[action] || { label: action, color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' };
  };

  // Group logs by date
  const groupedLogs = displayedLogs.reduce<Record<string, AuditLog[]>>((groups, log) => {
    const dateKey = formatDate(log.created_at);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(log);
    return groups;
  }, {});

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <History size={18} className="text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Lịch sử tác động</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full font-semibold">
              {logs.length}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <History size={24} className="text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm text-slate-400 dark:text-slate-500">Chưa có lịch sử tác động</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Mọi thay đổi trên hợp đồng sẽ được ghi nhận ở đây</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedLogs).map(([dateKey, dayLogs]) => (
                <div key={dateKey}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full whitespace-nowrap">
                      {dateKey}
                    </div>
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  </div>

                  {/* Timeline entries for this date */}
                  <div className="relative space-y-4 ml-3 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                    {dayLogs.map((log) => {
                      const { date, time } = AuditLogService.formatDateTime(log.created_at);
                      const eventText = AuditLogService.formatAction(log.action, log.old_data, log.new_data);
                      const badge = getActionBadge(log.action);

                      return (
                        <div key={log.id} className="flex gap-4 relative group">
                          {/* Timeline dot */}
                          <div className={`w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 z-10 flex-shrink-0 flex items-center justify-center shadow-sm ${getDotColor(log.action)}`}>
                            {getActionIcon(log.action)}
                          </div>

                          {/* Content card */}
                          <div className="flex-1 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-colors -mt-0.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                {/* Action description */}
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                                  {eventText}
                                </p>
                                {/* User + time */}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                                    {log.user_name || 'Hệ thống'}
                                  </span>
                                  <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">{time}</span>
                                </div>
                                {/* Comment if any */}
                                {log.comment && (
                                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-700 italic">
                                    "{log.comment}"
                                  </div>
                                )}
                              </div>
                              {/* Action badge */}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Show more button */}
              {!showAll && logs.length > PAGE_SIZE && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setShowAll(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
                  >
                    <ChevronDown size={14} />
                    Xem thêm {logs.length - PAGE_SIZE} mục
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractHistoryTab;
