import React, { useState, useEffect, useRef } from 'react';
import { X, Link, FileText, Table, FolderOpen, Plus, AlertCircle, Loader2, RefreshCw, AlertTriangle, Upload, File } from 'lucide-react';

interface AddDocumentLinkDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (doc: { name: string; url: string; type: 'drive' | 'doc' | 'sheet' | 'file' | 'other'; file?: File; docType?: string }) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jyohocjsnsyfgfsmjfqx.supabase.co';

/**
 * Extract document ID from Google URL for default naming
 */
const extractGoogleDocInfo = (url: string): { type: 'doc' | 'sheet' | 'drive' | 'file' | 'other', id: string | null, defaultName: string } => {
    try {
        let type: 'doc' | 'sheet' | 'drive' | 'file' | 'other' = 'other';
        let id: string | null = null;

        if (url.includes('docs.google.com/document')) {
            type = 'doc';
            const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
            id = match ? match[1] : null;
        } else if (url.includes('docs.google.com/spreadsheets')) {
            type = 'sheet';
            const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
            id = match ? match[1] : null;
        } else if (url.includes('drive.google.com')) {
            type = 'drive';
            const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
            id = match ? match[1] : null;
        }

        const typeLabel = type === 'doc' ? 'Google Doc' : type === 'sheet' ? 'Google Sheet' : type === 'drive' ? 'Google Drive' : 'Tài liệu';
        const shortId = id ? id.substring(0, 8) : '';
        const defaultName = id ? `${typeLabel} - ${shortId}...` : typeLabel;

        return { type, id, defaultName };
    } catch {
        return { type: 'other', id: null, defaultName: 'Tài liệu' };
    }
};

/**
 * Dialog để thêm link tài liệu Google Drive/Doc/Sheet
 */
export const AddDocumentLinkDialog: React.FC<AddDocumentLinkDialogProps> = ({
    isOpen,
    onClose,
    onSubmit
}) => {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [docType, setDocType] = useState('HD'); // Default to Contract
    const [file, setFile] = useState<File | null>(null);
    const [mode, setMode] = useState<'link' | 'upload'>('link');
    const [error, setError] = useState('');
    const [isFetchingTitle, setIsFetchingTitle] = useState(false);
    const [fetchFailed, setFetchFailed] = useState(false);
    const debounceRef = useRef<number | null>(null);

    // Auto-set default name when URL changes and try to fetch
    useEffect(() => {
        if (!url) {
            setFetchFailed(false);
            return;
        }

        const { defaultName, type } = extractGoogleDocInfo(url);

        // Set default name immediately
        if (!name && type !== 'other') {
            setName(defaultName);
        }

        // Debounce fetch
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (type !== 'other') {
            debounceRef.current = window.setTimeout(() => {
                fetchTitleFromGoogle(url);
            }, 800);
        }

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [url]);

    const fetchTitleFromGoogle = async (link: string) => {
        setIsFetchingTitle(true);
        setFetchFailed(false);
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch-google-doc-title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: link })
            });

            const data = await response.json();
            if (data.title && data.success) {
                setName(data.title);
                setFetchFailed(false);
            } else {
                setFetchFailed(true);
            }
        } catch (err) {
            console.error('Failed to fetch title:', err);
            setFetchFailed(true);
        } finally {
            setIsFetchingTitle(false);
        }
    };

    if (!isOpen) return null;

    const { type: detectedType } = extractGoogleDocInfo(url);

    const handleSubmit = () => {
        if (!name.trim()) {
            setError('Vui lòng nhập tên tài liệu');
            return;
        }

        if (mode === 'link') {
            if (!url.trim()) {
                setError('Vui lòng nhập link tài liệu');
                return;
            }
            try {
                new URL(url);
            } catch {
                setError('Link không hợp lệ');
                return;
            }
            onSubmit({ name, url, type: detectedType, docType });
        } else {
            if (!file) {
                setError('Vui lòng chọn file');
                return;
            }
            // For file upload, url is empty initially or could be a temporary blob url? 
            // We pass file object. Parent handles upload and gets URL.
            onSubmit({ name, url: '', type: 'file', file, docType });
        }

        setName('');
        setUrl('');
        setFile(null);
        setError('');
        setFetchFailed(false);
        onClose();
    };

    const linkTypeIcon = (type: 'drive' | 'doc' | 'sheet' | 'file' | 'other') => {
        switch (type) {
            case 'doc': return <FileText size={16} className="text-blue-500" />;
            case 'sheet': return <Table size={16} className="text-green-500" />;
            case 'drive': return <FolderOpen size={16} className="text-yellow-500" />;
            case 'file': return <File size={16} className="text-orange-500" />;
            default: return <Link size={16} className="text-slate-500" />;
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (!name) {
                setName(selectedFile.name);
            }
            setError('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <Link size={20} className="text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                            Thêm tài liệu
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-5">
                    <button
                        onClick={() => setMode('link')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${mode === 'link' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        Link Google
                    </button>
                    <button
                        onClick={() => setMode('upload')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${mode === 'upload' ? 'border-orange-600 text-orange-600 dark:text-orange-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        Tải lên File
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {mode === 'link' ? (
                        /* Link Mode */
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Link tài liệu
                            </label>
                            <div className="relative">
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => {
                                        setUrl(e.target.value);
                                        setError('');
                                        setName('');
                                        setFetchFailed(false);
                                    }}
                                    placeholder="https://docs.google.com/..."
                                    className="w-full px-4 py-3 pl-10 rounded-lg border border-slate-300 dark:border-slate-800 dark:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                    {url ? linkTypeIcon(detectedType) : <Link size={16} className="text-slate-400" />}
                                </div>
                            </div>
                            {detectedType !== 'other' && url && (
                                <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                                    {linkTypeIcon(detectedType)}
                                    {detectedType === 'doc' && 'Google Docs'}
                                    {detectedType === 'sheet' && 'Google Sheets'}
                                    {detectedType === 'drive' && 'Google Drive'}
                                </p>
                            )}
                        </div>
                    ) : (
                        /* Upload Mode */
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Chọn File
                            </label>
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-2 pointer-events-none">
                                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                                        <Upload size={24} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {file ? file.name : 'Click hoặc kéo thả file vào đây'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Hỗ trợ PDF, Word, Excel, Ảnh...'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Document Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                            Tên tài liệu
                            {isFetchingTitle && (
                                <span className="text-xs text-indigo-500 flex items-center gap-1">
                                    <Loader2 size={12} className="animate-spin" />
                                    Đang lấy tên...
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setError(''); }}
                                placeholder="Nhập tên tài liệu"
                                className="w-full px-4 py-3 pr-10 rounded-lg border border-slate-300 dark:border-slate-800 dark:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                            />
                            {mode === 'link' && url && detectedType !== 'other' && !isFetchingTitle && (
                                <button
                                    onClick={() => fetchTitleFromGoogle(url)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                    title="Thử lấy lại tên từ Google"
                                >
                                    <RefreshCw size={14} className="text-slate-400" />
                                </button>
                            )}
                        </div>

                        {/* Warning when fetch fails - show share instructions */}
                        {fetchFailed && url && detectedType !== 'other' && mode === 'link' && (
                            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                                    <span>
                                        Không lấy được tên tự động. Vui lòng:<br />
                                        1. Share file → "Anyone with the link"<br />
                                        2. Bấm 🔄 để thử lại hoặc nhập tên thủ công
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle size={14} />
                            {error}
                        </p>
                    )}

                    {/* Document Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Loại tài liệu để đặt tên (VD: HD_001...)
                        </label>
                        <select
                            value={docType}
                            onChange={(e) => setDocType(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="HD">Hợp đồng (HD)</option>
                            <option value="PL">Phụ lục (PL)</option>
                            <option value="BB">Biên bản (BB)</option>
                            <option value="HDON">Hóa đơn (HDON)</option>
                            <option value="BG">Báo giá (BG)</option>
                            <option value="HS">Hồ sơ khác (HS)</option>
                            <option value="PAKD">Phương án KD (PAKD)</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isFetchingTitle}
                        className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 disabled:opacity-50"
                    >
                        <Plus size={16} />
                        Thêm
                    </button>
                </div>
            </div>
        </div>
    );
};
