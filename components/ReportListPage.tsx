import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Eye, Calendar, User, Download, Search } from 'lucide-react';
import { REPORTS_DATA } from '../data/reports';
import { formatDate } from '../utils/formatters';

const ReportListPage: React.FC = () => {
    const navigate = useNavigate();
    
    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 rounded-lg shadow-lg shadow-indigo-200/50 dark:shadow-none">
                            <FileText size={20} />
                        </div>
                        Báo cáo & Báo giá
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        Danh sách các báo cáo, tài liệu và báo giá định dạng HTML
                    </p>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800/60 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800/60 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                                <th className="px-6 py-4 whitespace-nowrap w-16 text-center">STT</th>
                                <th className="px-6 py-4">Tên tài liệu</th>
                                <th className="px-6 py-4">Nội dung</th>
                                <th className="px-6 py-4 whitespace-nowrap">Người lập</th>
                                <th className="px-6 py-4 whitespace-nowrap">Thời gian lập</th>
                                <th className="px-6 py-4 whitespace-nowrap text-right">Lưu trữ</th>
                                <th className="px-6 py-4 whitespace-nowrap text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {REPORTS_DATA.map((report) => (
                                <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                                    <td className="px-6 py-4 text-center font-bold text-slate-400 dark:text-slate-500">
                                        {report.stt < 10 ? `0${report.stt}` : report.stt}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {report.title}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="line-clamp-2">{report.description}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                                <User size={12} />
                                            </div>
                                            {report.author}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                                            {formatDate(report.date)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40 uppercase tracking-wider">
                                            Nội bộ
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <a 
                                                href={report.fileUrl}
                                                download
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                                title="Tải xuống"
                                            >
                                                <Download size={18} />
                                            </a>
                                            <button 
                                                onClick={() => navigate(`/reports/${report.id}`)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-semibold transition-colors border border-indigo-100/50 dark:border-indigo-800/50"
                                            >
                                                <Eye size={16} />
                                                Xem
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {REPORTS_DATA.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-800">
                                            <FileText size={24} className="text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="font-medium text-slate-600 dark:text-slate-300 mb-1">Chưa có báo cáo nào</p>
                                        <p className="text-sm">Vui lòng yêu cầu quản trị viên cập nhật file báo cáo HTML vào hệ thống.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportListPage;
