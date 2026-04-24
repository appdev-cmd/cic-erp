import React, { useEffect, useState, useCallback } from 'react';
import { History, RefreshCw, User, Shield, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { dataClient } from '../../lib/dataClient';
import { formatDate } from '../../utils/formatters';

interface AuditEntry {
    id: string;
    user_id: string | null;
    table_name: string;
    record_id: string;
    action: string;
    old_data: any;
    new_data: any;
    comment: string | null;
    created_at: string;
    actor_name?: string;
    target_name?: string;
}

const ACTION_COLORS: Record<string, string> = {
    UPDATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    INSERT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const TABLE_LABELS: Record<string, string> = {
    user_permissions: 'Phân quyền',
    employees: 'Nhân viên (role)',
    cross_unit_visibility: 'Quyền xem đơn vị',
};

const RESOURCE_LABELS: Record<string, string> = {
    contracts: 'Hợp đồng', customers: 'Khách hàng', products: 'Sản phẩm/DV',
    tasks: 'Công việc', payments: 'Tài chính', employees: 'Nhân sự',
    units: 'Đơn vị', settings: 'Cài đặt', permissions: 'Phân quyền',
    reports: 'Báo cáo', news: 'Tin tức', projects: 'Dự án (BIM)',
    requests: 'Đề xuất', leaves: 'Nghỉ phép', recruitment: 'Tuyển dụng',
};

const ACTION_LABELS: Record<string, string> = { view: 'Xem', create: 'Thêm', update: 'Sửa', delete: 'Xóa' };

const ROLE_LABELS: Record<string, string> = {
    Admin: 'Quản trị HT', Leadership: 'Ban lãnh đạo', UnitLeader: 'Lãnh đạo ĐV',
    AdminUnit: 'Admin ĐV', NVKD: 'NV Kinh doanh', NVKT: 'NV Kỹ thuật',
    Accountant: 'Kế toán', ChiefAccountant: 'KT Trưởng', Legal: 'Pháp chế', Marketing: 'Marketing',
};

const PermissionAuditLog: React.FC = () => {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [tableFilter, setTableFilter] = useState<string>('all');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            let query = dataClient
                .from('audit_logs')
                .select('*')
                .in('table_name', ['user_permissions', 'employees', 'cross_unit_visibility'])
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);

            const { data, error } = await query;
            if (error || !data) { setLogs([]); return; }

            // Batch resolve actor names
            const actorIds = [...new Set(data.map((l: any) => l.user_id).filter(Boolean))] as string[];
            const targetIds = [...new Set(data.map((l: any) => l.record_id).filter(Boolean))] as string[];

            const [actorRes, targetRes] = await Promise.all([
                actorIds.length > 0
                    ? dataClient.from('profiles').select('id, full_name').in('id', actorIds)
                    : Promise.resolve({ data: [] }),
                targetIds.length > 0
                    ? dataClient.from('employees').select('id, name').in('id', targetIds)
                    : Promise.resolve({ data: [] }),
            ]);

            const actorMap = new Map((actorRes.data || []).map((p: any) => [p.id, p.full_name]));
            const targetMap = new Map((targetRes.data || []).map((e: any) => [e.id, e.name]));

            setLogs(data.map((l: any) => ({
                ...l,
                actor_name: l.user_id ? (actorMap.get(l.user_id) || 'Người dùng') : 'Hệ thống',
                target_name: targetMap.get(l.record_id) || l.record_id?.substring(0, 8) + '…',
            })));
        } catch {
            setLogs([]);
        }
        setLoading(false);
    }, [page, tableFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const filtered = logs.filter(l =>
        !search ||
        l.actor_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.target_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.comment?.toLowerCase().includes(search.toLowerCase())
    );

    const renderDiff = (entry: AuditEntry) => {
        if (entry.table_name === 'user_permissions') {
            const oldActions: string[] = entry.old_data?.actions || [];
            const newActions: string[] = entry.new_data?.actions || [];
            const resource = entry.new_data?.resource || entry.old_data?.resource || '';
            const added = newActions.filter(a => !oldActions.includes(a));
            const removed = oldActions.filter(a => !newActions.includes(a));
            return (
                <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Module: <span className="font-bold">{RESOURCE_LABELS[resource] || resource}</span>
                    </p>
                    {added.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">+Thêm:</span>
                            {added.map(a => (
                                <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-medium">
                                    {ACTION_LABELS[a] || a}
                                </span>
                            ))}
                        </div>
                    )}
                    {removed.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-red-500 dark:text-red-400 font-bold">−Bỏ:</span>
                            {removed.map(a => (
                                <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400 font-medium">
                                    {ACTION_LABELS[a] || a}
                                </span>
                            ))}
                        </div>
                    )}
                    {added.length === 0 && removed.length === 0 && (
                        <p className="text-xs text-slate-400">Không thay đổi quyền cụ thể</p>
                    )}
                </div>
            );
        }
        if (entry.table_name === 'employees') {
            const oldRole = entry.old_data?.role;
            const newRole = entry.new_data?.role;
            if (oldRole && newRole) {
                return (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 font-medium">
                            {ROLE_LABELS[oldRole] || oldRole}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-bold">
                            {ROLE_LABELS[newRole] || newRole}
                        </span>
                    </div>
                );
            }
        }
        if (entry.table_name === 'cross_unit_visibility') {
            const unitName = (entry.new_data || entry.old_data)?.unit_name || 'đơn vị';
            return (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                    {entry.action === 'INSERT' ? '✅ Cấp quyền xem' : '❌ Thu hồi quyền xem'}{' '}
                    <strong>{unitName}</strong>
                </p>
            );
        }
        return <p className="text-xs text-slate-400">Không có chi tiết</p>;
    };

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm theo tên, ghi chú..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                </div>
                <select
                    value={tableFilter}
                    onChange={e => { setTableFilter(e.target.value); setPage(0); }}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-orange-500 cursor-pointer"
                >
                    <option value="all">Tất cả loại</option>
                    {Object.entries(TABLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
                <button
                    onClick={() => fetchLogs()}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Làm mới
                </button>
            </div>

            {/* Log list */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw size={20} className="animate-spin text-indigo-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <History size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Chưa có lịch sử thay đổi</p>
                    <p className="text-xs mt-1">Các thay đổi phân quyền sẽ được ghi lại tại đây</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(entry => (
                        <div
                            key={entry.id}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-all"
                        >
                            <button
                                className="w-full flex items-start gap-3 p-4 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            >
                                {/* Icon */}
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {entry.table_name === 'user_permissions' ? (
                                        <Shield size={15} className="text-indigo-500" />
                                    ) : (
                                        <User size={15} className="text-slate-500" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTION_COLORS[entry.action] || 'bg-slate-100 text-slate-600'}`}>
                                            {TABLE_LABELS[entry.table_name] || entry.table_name}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                            {entry.comment || `${entry.action} on ${entry.record_id}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                                        <span className="font-medium text-slate-500 dark:text-slate-400">{entry.actor_name}</span>
                                        <span>•</span>
                                        <span>{formatDate(entry.created_at)}</span>
                                    </div>
                                </div>

                                <div className="flex-shrink-0 text-slate-400 mt-1">
                                    {expandedId === entry.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </div>
                            </button>

                            {/* Expanded detail */}
                            {expandedId === entry.id && (
                                <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                                    <div className="mt-3 space-y-3">
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="font-semibold text-slate-500 dark:text-slate-400">Người thực hiện:</span>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">{entry.actor_name}</p>
                                            </div>
                                            <div>
                                                <span className="font-semibold text-slate-500 dark:text-slate-400">Đối tượng:</span>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">{entry.target_name}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chi tiết thay đổi</span>
                                            <div className="mt-1.5 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                                {renderDiff(entry)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && (
                <div className="flex items-center justify-between pt-2">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        ← Trước
                    </button>
                    <span className="text-xs text-slate-400">Trang {page + 1}</span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={filtered.length < PAGE_SIZE}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Sau →
                    </button>
                </div>
            )}
        </div>
    );
};

export default PermissionAuditLog;
