import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, Loader2, FileText, BarChart3 } from 'lucide-react';
import { AnalyticsTab, TAB_LABELS, TAB_ORDER } from './cardRegistry';

export interface ExportDialogOptions {
    sections: AnalyticsTab[];
    includeCharts: boolean;
}

interface ExportReportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** Kỳ & phạm vi hiển thị để user xác nhận trước khi xuất. */
    periodLabel: string;
    unitName: string;
    filterSummary: { label: string; value: string }[];
    /** Tab có ít nhất 1 card hiển thị (theo quyền + cá nhân hoá). */
    availableTabs: AnalyticsTab[];
    onExport: (opts: ExportDialogOptions, onProgress: (message: string) => void) => Promise<void>;
}

/**
 * Hộp thoại tuỳ chọn xuất PDF Báo cáo Quản trị:
 * chọn phần nội dung, kiểu báo cáo (Đầy đủ/Rút gọn), xem phạm vi dữ liệu.
 */
const ExportReportDialog: React.FC<ExportReportDialogProps> = ({
    isOpen, onClose, periodLabel, unitName, filterSummary, availableTabs, onExport,
}) => {
    const [selectedTabs, setSelectedTabs] = useState<AnalyticsTab[]>(availableTabs);
    const [includeCharts, setIncludeCharts] = useState(true);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    // Theme tại thời điểm bấm xuất — dùng cho lớp phủ inline (không đổi theo class `dark`).
    const [coverDark, setCoverDark] = useState(false);

    // Reset lựa chọn mỗi lần mở
    useEffect(() => {
        if (isOpen) {
            setSelectedTabs(availableTabs);
            setIncludeCharts(true);
            setStatus('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleTab = (tab: AnalyticsTab) => {
        setSelectedTabs(prev =>
            prev.includes(tab) ? prev.filter(t => t !== tab) : [...prev, tab],
        );
    };

    const handleExport = async () => {
        if (selectedTabs.length === 0 || busy) return;
        // Ghi lại theme hiện tại trước khi quá trình chụp tạm ép sang light mode.
        setCoverDark(document.documentElement.classList.contains('dark'));
        setBusy(true);
        try {
            await onExport(
                { sections: TAB_ORDER.filter(t => selectedTabs.includes(t)), includeCharts },
                setStatus,
            );
            onClose();
        } finally {
            setBusy(false);
            setStatus('');
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={busy ? undefined : onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                            <FileDown size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Xuất Báo cáo Quản trị (PDF)</h3>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Chuẩn báo cáo doanh nghiệp · A4 dọc</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Phạm vi dữ liệu */}
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm">
                        <div className="flex justify-between gap-3 py-0.5">
                            <span className="font-bold text-slate-500 dark:text-slate-400">Kỳ báo cáo</span>
                            <span className="font-black text-slate-800 dark:text-slate-100 text-right">{periodLabel}</span>
                        </div>
                        <div className="flex justify-between gap-3 py-0.5">
                            <span className="font-bold text-slate-500 dark:text-slate-400">Đơn vị</span>
                            <span className="font-black text-slate-800 dark:text-slate-100 text-right">{unitName}</span>
                        </div>
                        {filterSummary.map(f => (
                            <div key={f.label} className="flex justify-between gap-3 py-0.5">
                                <span className="font-bold text-slate-500 dark:text-slate-400">{f.label}</span>
                                <span className="font-bold text-orange-600 dark:text-orange-400 text-right truncate max-w-[260px]" title={f.value}>{f.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Chọn phần nội dung */}
                    <div>
                        <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Phần nội dung</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {TAB_ORDER.filter(t => availableTabs.includes(t)).map(tab => (
                                <label
                                    key={tab}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors text-sm font-bold ${
                                        selectedTabs.includes(tab)
                                            ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-slate-800 dark:text-slate-100'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTabs.includes(tab)}
                                        onChange={() => toggleTab(tab)}
                                        disabled={busy}
                                        className="accent-orange-600 w-4 h-4"
                                    />
                                    {TAB_LABELS[tab]}
                                </label>
                            ))}
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                            Báo cáo luôn gồm Trang bìa, Tóm tắt điều hành (KPI) và Trang phê duyệt.
                        </p>
                    </div>

                    {/* Kiểu nội dung */}
                    <div>
                        <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Kiểu báo cáo</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setIncludeCharts(true)}
                                disabled={busy}
                                className={`flex flex-col items-start gap-1 px-3.5 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                                    includeCharts
                                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <span className="flex items-center gap-1.5 text-sm font-black text-slate-800 dark:text-slate-100">
                                    <BarChart3 size={15} className="text-orange-500" /> Đầy đủ
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Biểu đồ + bảng số liệu chính</span>
                            </button>
                            <button
                                onClick={() => setIncludeCharts(false)}
                                disabled={busy}
                                className={`flex flex-col items-start gap-1 px-3.5 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                                    !includeCharts
                                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <span className="flex items-center gap-1.5 text-sm font-black text-slate-800 dark:text-slate-100">
                                    <FileText size={15} className="text-orange-500" /> Rút gọn
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Chỉ bảng số liệu — xuất nhanh</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 min-h-[16px] flex-1 truncate">
                        {busy ? status : 'Tài liệu lưu hành nội bộ'}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={onClose}
                            disabled={busy}
                            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                        >
                            Huỷ
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={busy || selectedTabs.length === 0}
                            className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors cursor-pointer text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                            {busy ? 'Đang xuất…' : 'Xuất PDF'}
                        </button>
                    </div>
                </div>
            </div>

            {/*
              Lớp phủ toàn màn hình khi đang xuất. Quá trình chụp biểu đồ tạm gỡ
              class `dark` để PDF có nền trắng → nền trang phía sau sẽ nhấp nháy
              sáng/tối. Lớp phủ mờ đục này (dùng inline-style nên KHÔNG đổi theo
              class `dark`) che toàn bộ chuyển đổi đó; người dùng chỉ thấy trạng
              thái "đang xử lý".
            */}
            {busy && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 120,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 18,
                        background: coverDark ? '#0f172a' : '#f8fafc',
                        color: coverDark ? '#e2e8f0' : '#1e293b',
                    }}
                >
                    <Loader2 size={30} className="animate-spin" style={{ color: '#ea580c' }} />
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{status || 'Đang xuất báo cáo…'}</div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>Vui lòng giữ nguyên tab này trong khi xuất</div>
                </div>
            )}
        </div>,
        document.body,
    );
};

export default ExportReportDialog;
