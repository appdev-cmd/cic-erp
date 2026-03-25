import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Eye, Calendar, User, Download, Plus, Search, Edit, Trash2, Link as LinkIcon, X } from 'lucide-react';
import { reportService } from '../services/reportService';
import { formatDate } from '../utils/formatters';
import type { Report } from '../types';
import ReportFormModal from './ReportFormModal';
import { toast } from 'sonner';

const ReportListPage: React.FC = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReport, setEditingReport] = useState<Report | null>(null);

    const loadReports = async () => {
        setLoading(true);
        try {
            const data = await reportService.getAll();
            setReports(data);
        } catch (error) {
            console.error('Failed to load reports:', error);
            toast.error('Lỗi khi tải danh sách báo cáo');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const handleEdit = (report: Report) => {
        setEditingReport(report);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, filePath?: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa báo cáo này?')) return;

        try {
            await reportService.delete(id, filePath);
            toast.success('Đã xóa báo cáo');
            loadReports();
        } catch (error) {
            toast.error('Lỗi khi xóa báo cáo');
        }
    };

    const openCreateModal = () => {
        setEditingReport(null);
        setIsModalOpen(true);
    };

    // Filter reports by search term
    const filteredReports = reports.filter(report => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            report.title.toLowerCase().includes(term) ||
            (report.description || '').toLowerCase().includes(term) ||
            report.author.toLowerCase().includes(term)
        );
    });

    return (
        <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 pb-4">
            {/* Header — match ContractList pattern */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Báo cáo & Biểu mẫu</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-bold mt-1">
                        Danh sách các báo cáo, tài liệu và báo giá
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreateModal}
                        className="flex items-center justify-center gap-2 bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-800 transition-all shadow-xl shadow-indigo-100 dark:shadow-none text-sm cursor-pointer"
                    >
                        <Plus size={16} /> Thêm mới
                    </button>
                </div>
            </div>

            {/* Search Bar — match ContractList */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[240px] relative">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên báo cáo, nội dung, người lập..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-10 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900 dark:text-slate-100"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
                            title="Xoá tìm kiếm"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* TABLE — match ContractList */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg transition-colors overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="z-20">
                            {[
                                { label: 'STT', align: 'center', width: 'w-14' },
                                { label: 'Tên tài liệu', align: 'left', width: '' },
                                { label: 'Nội dung', align: 'left', width: '' },
                                { label: 'Người lập', align: 'left', width: 'w-36' },
                                { label: 'Thời gian lập', align: 'center', width: 'w-32' },
                                { label: 'Loại', align: 'center', width: 'w-28' },
                                { label: '', align: 'center', width: 'w-36' },
                            ].map((col, idx) => (
                                <th
                                    key={idx}
                                    className={`sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300
                                        ${col.align === 'center' ? 'text-center' : 'text-left'}
                                        ${col.width}`}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <tr key={i} className={`border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${i % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}`}>
                                    <td className="px-4 py-4"><div className="w-8 h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto"></div></td>
                                    <td className="px-4 py-4"><div className="w-40 h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div></td>
                                    <td className="px-4 py-4"><div className="w-full h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div></td>
                                    <td className="px-4 py-4"><div className="w-24 h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div></td>
                                    <td className="px-4 py-4"><div className="w-20 h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto"></div></td>
                                    <td className="px-4 py-4"><div className="w-16 h-5 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse mx-auto"></div></td>
                                    <td className="px-4 py-4"><div className="w-24 h-5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mx-auto"></div></td>
                                </tr>
                            ))
                        ) : filteredReports.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-slate-500 dark:text-slate-400">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                            <FileText size={22} className="text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="font-bold text-slate-600 dark:text-slate-300">
                                            {searchTerm ? 'Không tìm thấy báo cáo phù hợp' : 'Chưa có báo cáo nào'}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {searchTerm ? 'Thử từ khóa khác hoặc xóa bộ lọc.' : 'Nhấn "Thêm mới" để bắt đầu.'}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredReports.map((report, index) => (
                            <tr
                                key={report.id}
                                className={`border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group ${index % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}
                                onClick={() => navigate(`/reports/${report.id}`)}
                            >
                                {/* STT */}
                                <td className="px-4 py-3 text-center">
                                    <span className="font-black text-slate-400 dark:text-slate-500 text-xs">
                                        {index + 1 < 10 ? `0${index + 1}` : index + 1}
                                    </span>
                                </td>

                                {/* Tên tài liệu */}
                                <td className="px-4 py-3">
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                                        {report.title}
                                    </p>
                                </td>

                                {/* Nội dung */}
                                <td className="px-4 py-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                        {report.description || '—'}
                                    </p>
                                </td>

                                {/* Người lập */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <User size={12} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{report.author}</span>
                                    </div>
                                </td>

                                {/* Thời gian lập */}
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        {formatDate(report.date)}
                                    </span>
                                </td>

                                {/* Loại */}
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                    {report.type === 'external_link' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                            <LinkIcon size={10} /> Link
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                            <FileText size={10} /> HTML
                                        </span>
                                    )}
                                </td>

                                {/* Thao tác */}
                                <td className="px-4 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => navigate(`/reports/${report.id}`)}
                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded transition-colors"
                                            title="Xem báo cáo"
                                        >
                                            <Eye size={16} />
                                        </button>

                                        {report.type === 'html_file' && (
                                            <a
                                                href={report.fileUrl}
                                                download
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30 rounded transition-colors"
                                                title="Tải xuống"
                                            >
                                                <Download size={16} />
                                            </a>
                                        )}

                                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

                                        <button
                                            onClick={() => handleEdit(report)}
                                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/30 rounded transition-colors"
                                            title="Chỉnh sửa"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(report.id, report.filePath)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded transition-colors"
                                            title="Xóa báo cáo"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Form Modal */}
            <ReportFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSaved={loadReports}
                initialData={editingReport}
            />
        </div>
    );
};

export default ReportListPage;
