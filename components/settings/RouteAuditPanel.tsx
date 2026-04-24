import React from 'react';
import { ShieldCheck, Globe, Lock, AlertTriangle } from 'lucide-react';
import { PUBLIC_ROUTES, ROUTE_PERMISSION_MAP } from '../../routes/routePermissions';

/**
 * RouteAuditPanel — Bảng kiểm tra trực quan tất cả route trong hệ thống.
 * Hiển thị:
 * - Route nào là PUBLIC (ai cũng vào được)
 * - Route nào PROTECTED (cần quyền cụ thể)
 * - Cảnh báo nếu phát hiện bất thường
 * 
 * Chỉ Admin mới nhìn thấy panel này (trong Settings).
 */
const RouteAuditPanel: React.FC = () => {
    const protectedByModule = ROUTE_PERMISSION_MAP.reduce<Record<string, typeof ROUTE_PERMISSION_MAP>>((acc, entry) => {
        if (!acc[entry.module]) acc[entry.module] = [];
        acc[entry.module].push(entry);
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Deny-by-Default Banner */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-sm text-emerald-700 dark:text-emerald-400">
                    <p className="font-bold">Chế độ: Deny-by-Default</p>
                    <p className="text-xs mt-1 opacity-80">
                        Mọi URL không nằm trong danh sách dưới đây sẽ bị <b>tự động chặn</b>. 
                        Khi thêm phân hệ mới, lập trình viên phải khai báo route trong file <code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded">routePermissions.ts</code>.
                    </p>
                </div>
            </div>

            {/* Public Routes */}
            <div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Globe size={16} className="text-blue-500" />
                    Route công khai ({PUBLIC_ROUTES.length})
                    <span className="text-[10px] font-medium text-slate-400">— ai đăng nhập cũng vào được</span>
                </h4>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">URL</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mô tả</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {PUBLIC_ROUTES.map((route, i) => (
                                <tr key={route.pattern} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-900">
                                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">{route.pattern}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{route.label}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                            <Globe size={10} /> PUBLIC
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Protected Routes by Module */}
            <div className="mt-8">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Lock size={16} className="text-rose-500" />
                    Route được bảo vệ ({ROUTE_PERMISSION_MAP.length})
                    <span className="text-[10px] font-medium text-slate-400">— yêu cầu quyền truy cập</span>
                </h4>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phân hệ</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">URL</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mô tả</th>
                                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quyền cần</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {Object.entries(protectedByModule).map(([module, entries]) => (
                                <React.Fragment key={module}>
                                    {entries.map((entry, i) => (
                                        <tr key={entry.pattern} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-900">
                                            {i === 0 && (
                                                <td
                                                    className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 align-top border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                                    rowSpan={entries.length}
                                                >
                                                    {module}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 font-mono text-xs text-rose-600 dark:text-rose-400">{entry.pattern}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{entry.label}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-mono">
                                                    {entry.resource}.{entry.action}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-bold mb-1">Lưu ý cho lập trình viên:</p>
                    <ul className="list-disc list-inside space-y-0.5 opacity-80">
                        <li>Mọi route mới <b>phải</b> được khai báo trong <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">routes/routePermissions.ts</code></li>
                        <li>Route không khai báo sẽ bị <b>chặn tự động</b> (deny by default)</li>
                        <li>Thêm vào <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">PUBLIC_ROUTES</code> nếu ai cũng truy cập được</li>
                        <li>Thêm vào <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">ROUTE_PERMISSION_MAP</code> nếu cần kiểm tra quyền</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default RouteAuditPanel;
