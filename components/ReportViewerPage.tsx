import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportService } from '../services/reportService';
import type { Report } from '../types';
import { ArrowLeft, ExternalLink, Download } from 'lucide-react';
import { toast } from 'sonner';

const ReportViewerPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReport = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const data = await reportService.getById(id);
                setReport(data);
            } catch (error) {
                console.error('Error fetching report:', error);
                toast.error('Không thể tải dữ liệu báo cáo');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Đang tải báo cáo...</p>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ArrowLeft size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Không tìm thấy báo cáo</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Liên kết tới báo cáo không tồn tại hoặc đã bị xóa.</p>
                    <button 
                        onClick={() => navigate('/reports')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                    >
                        Quay lại danh sách
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-slate-50 dark:bg-slate-950">
            {/* Header / Topbar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/60 px-4 py-3 flex items-center justify-between shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/reports')}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Quay lại danh sách"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base tracking-tight">
                            {report.title}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {report.author} • {report.date}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {report.type === 'html_file' && (
                        <a 
                            href={report.fileUrl}
                            download
                            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold"
                            title="Tải file gốc"
                        >
                            <Download size={16} />
                            <span className="hidden sm:inline">Tải về</span>
                        </a>
                    )}
                    <a 
                        href={report.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 px-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-800/40 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold shadow-sm"
                        title="Mở trong tab mới để xem toàn viền"
                    >
                        <ExternalLink size={16} />
                        <span className="hidden sm:inline">Mở rộng</span>
                    </a>
                </div>
            </div>

            {/* Iframe container - flexible height */}
            <div className="flex-1 w-full bg-slate-200/50 dark:bg-slate-950 p-0 sm:p-4 overflow-hidden">
                <div className="w-full h-full bg-white rounded-none sm:rounded-xl shadow-none sm:shadow-lg border border-transparent sm:border-slate-200/60 overflow-hidden relative group">
                    <iframe 
                        src={report.fileUrl}
                        className="absolute inset-0 w-full h-full border-0 bg-white" 
                        title={report.title}
                        sandbox={report.type === 'html_file' ? "allow-same-origin allow-scripts allow-popups allow-forms" : undefined}
                        allowFullScreen
                    />
                </div>
            </div>
        </div>
    );
};

export default ReportViewerPage;
