
import React, { useState, useEffect } from 'react';
import {
    Folder,
    FileText,
    FileSpreadsheet,
    Image as ImageIcon,
    MoreVertical,
    Download,
    ExternalLink,
    Info,
    Grid,
    List,
    Search,
    ArrowLeft,
    File,
    Loader2,
    FolderOpen
} from 'lucide-react';
import { GoogleDriveService, DriveFile } from '../../services/googleDriveService';
import { toast } from 'sonner';
import { formatDate } from '../../utils/formatters';

interface DocumentExplorerProps {
    folderId: string;
    folderName: string;
    onNavigateBack?: () => void;
}

const DocumentExplorer: React.FC<DocumentExplorerProps> = ({
    folderId,
    folderName,
    onNavigateBack
}) => {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentFolderId, setCurrentFolderId] = useState(folderId);
    const [currentFolderName, setCurrentFolderName] = useState(folderName);
    const [history, setHistory] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        // Reset when prop changes
        setCurrentFolderId(folderId);
        setCurrentFolderName(folderName);
        setHistory([]);
    }, [folderId, folderName]);

    useEffect(() => {
        loadFiles(currentFolderId);
    }, [currentFolderId]);

    const loadFiles = async (id: string) => {
        if (!id) return;
        setLoading(true);
        try {
            const data = await GoogleDriveService.listFiles(id);
            setFiles(data);
        } catch (error) {
            console.error('Failed to load files:', error);
            toast.error('Không thể tải danh sách tệp');
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folder: DriveFile) => {
        setHistory(prev => [...prev, { id: currentFolderId, name: currentFolderName }]);
        setCurrentFolderId(folder.id);
        setCurrentFolderName(folder.name);
    };

    const handleBack = () => {
        if (history.length > 0) {
            const prev = history[history.length - 1];
            setHistory(prevHistory => prevHistory.slice(0, -1));
            setCurrentFolderId(prev.id);
            setCurrentFolderName(prev.name);
        } else if (onNavigateBack) {
            onNavigateBack();
        }
    };

    const getFileIcon = (mimeType: string, name: string) => {
        if (mimeType === 'application/vnd.google-apps.folder') return <Folder size={36} className="text-indigo-500" />;
        if (mimeType.includes('sheet') || name.endsWith('.xlsx') || name.endsWith('.csv')) return <FileSpreadsheet size={36} className="text-emerald-500" />;
        if (mimeType.includes('document') || name.endsWith('.docx')) return <FileText size={36} className="text-indigo-600" />;
        if (mimeType.includes('pdf') || name.endsWith('.pdf')) return <FileText size={36} className="text-rose-500" />;
        if (mimeType.includes('image')) return <ImageIcon size={36} className="text-purple-500" />;
        return <File size={36} className="text-slate-400" />;
    };

    const getFileIconSmall = (mimeType: string, name: string) => {
        if (mimeType === 'application/vnd.google-apps.folder') return <Folder size={20} className="text-indigo-500" />;
        if (mimeType.includes('sheet') || name.endsWith('.xlsx')) return <FileSpreadsheet size={20} className="text-emerald-500" />;
        if (mimeType.includes('document') || name.endsWith('.docx')) return <FileText size={20} className="text-indigo-600" />;
        if (mimeType.includes('pdf') || name.endsWith('.pdf')) return <FileText size={20} className="text-rose-500" />;
        if (mimeType.includes('image')) return <ImageIcon size={20} className="text-purple-500" />;
        return <File size={20} className="text-slate-400" />;
    };

    const filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const folders = filteredFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const documents = filteredFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {history.length > 0 && (
                            <button onClick={handleBack} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group">
                                <ArrowLeft size={18} className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                            </button>
                        )}

                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-1.5">
                            {history.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    <button
                                        onClick={() => {
                                            setHistory(prev => prev.slice(0, idx));
                                            setCurrentFolderId(item.id);
                                            setCurrentFolderName(item.name);
                                        }}
                                        className="text-xs font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    >
                                        {item.name}
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-600 text-xs">/</span>
                                </React.Fragment>
                            ))}
                            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Folder className="text-indigo-500" size={18} />
                                {currentFolderName}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 dark:focus:border-indigo-700 outline-none w-48 transition-all focus:w-64 text-slate-700 dark:text-slate-200"
                            />
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Grid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-48 gap-3">
                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                        <span className="text-xs font-bold text-slate-400">Đang tải tài liệu...</span>
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                            <FolderOpen size={40} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-slate-500 dark:text-slate-400">Thư mục trống</p>
                            <p className="text-xs text-slate-400 mt-1">Chưa có tệp nào trong thư mục này</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Folders Section */}
                        {folders.length > 0 && (
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
                                    Thư mục ({folders.length})
                                </h3>
                                <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" : "space-y-1"}>
                                    {folders.map(file => (
                                        <div
                                            key={file.id}
                                            className={`
                                                group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 
                                                hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-none transition-all cursor-pointer
                                                ${viewMode === 'grid' ? 'flex flex-col items-center p-5 text-center rounded-xl' : 'flex items-center p-3 gap-4 rounded-lg'}
                                            `}
                                            onClick={() => handleNavigate(file)}
                                        >
                                            <div className={`${viewMode === 'grid' ? 'w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform' : ''}`}>
                                                {viewMode === 'grid' ? getFileIcon(file.mimeType, file.name) : getFileIconSmall(file.mimeType, file.name)}
                                            </div>
                                            <div className={`min-w-0 ${viewMode === 'grid' ? 'w-full' : 'flex-1'}`}>
                                                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={file.name}>
                                                    {file.name}
                                                </h3>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Files Section */}
                        {documents.length > 0 && (
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
                                    Tệp ({documents.length})
                                </h3>
                                <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" : "space-y-1"}>
                                    {documents.map(file => (
                                        <div
                                            key={file.id}
                                            className={`
                                                group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 
                                                hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-none transition-all cursor-pointer
                                                ${viewMode === 'grid' ? 'flex flex-col items-center p-5 text-center rounded-xl' : 'flex items-center p-3 gap-4 rounded-lg'}
                                            `}
                                            onClick={() => {
                                                window.open(file.webViewLink, '_blank');
                                            }}
                                        >
                                            <div className={viewMode === 'grid' ? 'mb-3 group-hover:scale-110 transition-transform' : ''}>
                                                {viewMode === 'grid' ? getFileIcon(file.mimeType, file.name) : getFileIconSmall(file.mimeType, file.name)}
                                            </div>

                                            <div className={`min-w-0 ${viewMode === 'grid' ? 'w-full' : 'flex-1'}`}>
                                                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={file.name}>
                                                    {file.name}
                                                </h3>
                                                {viewMode === 'list' && (
                                                    <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                                                        {file.size ? `${(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB` : '—'} • {formatDate(file.modifiedTime || '')}
                                                    </p>
                                                )}
                                            </div>

                                            <button
                                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all absolute top-2 right-2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(file.webViewLink, '_blank');
                                                }}
                                            >
                                                <ExternalLink size={14} className="text-indigo-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentExplorer;
