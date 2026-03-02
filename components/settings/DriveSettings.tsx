import React, { useState, useEffect } from 'react';
import {
    HardDrive, FolderPlus, CheckCircle, AlertCircle, Loader2,
    ExternalLink, RefreshCw, Trash2, FolderTree
} from 'lucide-react';
import { DriveInitService, InitProgress } from '../../services/driveInitService';
import {
    UNIT_FOLDER_MAP,
    ROOT_FOLDER_NAME,
    getUnitSubfolders
} from '../../services/googleDriveService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

/**
 * DriveSettings — Admin panel to initialize and manage Google Drive folder structure
 * Only visible to Admin/Leadership roles
 */
const DriveSettings: React.FC = () => {
    const { user } = useAuth();
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [progress, setProgress] = useState<InitProgress>({
        total: 0,
        current: 0,
        currentItem: '',
        status: 'idle',
    });
    const [mappings, setMappings] = useState<any[]>([]);
    const [showMappings, setShowMappings] = useState(false);
    const [loading, setLoading] = useState(true);

    // Check initialization status on mount
    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const initialized = await DriveInitService.isInitialized();
            setIsInitialized(initialized);
            if (initialized) {
                const allMappings = await DriveInitService.getAllMappings();
                setMappings(allMappings);
            }
        } catch (err: any) {
            console.error('[DriveSettings] Status check error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInitialize = async () => {
        try {
            setProgress({ total: 0, current: 0, currentItem: 'Đang bắt đầu...', status: 'running' });
            const result = await DriveInitService.initializeFullStructure(
                (p) => setProgress(p),
                user?.id
            );
            toast.success(`Đã tạo ${result.totalCreated} thư mục trên Google Drive!`);
            setIsInitialized(true);
            const allMappings = await DriveInitService.getAllMappings();
            setMappings(allMappings);
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`);
            setProgress(prev => ({ ...prev, status: 'error', error: err.message }));
        }
    };

    const handleClearAndReinit = async () => {
        if (!window.confirm('Xóa tất cả folder mappings và khởi tạo lại? (Folders trên Drive sẽ không bị xóa)')) return;
        try {
            await DriveInitService.clearMappings();
            setIsInitialized(false);
            setMappings([]);
            toast.success('Đã xóa mappings. Bạn có thể khởi tạo lại.');
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`);
        }
    };

    // Group mappings by entity
    const unitMappings = mappings.filter(m => m.entity_type === 'unit');
    const rootMappings = mappings.filter(m => m.entity_type === 'root');
    const contractMappings = mappings.filter(m => m.entity_type === 'contract');

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-orange-500" size={24} />
                <span className="ml-2 text-slate-500 dark:text-slate-400">Đang kiểm tra...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                    <HardDrive size={20} className="text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Google Drive Integration</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Quản lý cấu trúc thư mục trên Google Drive
                    </p>
                </div>
            </div>

            {/* Status Card */}
            <div className={`p-4 rounded-lg border ${isInitialized
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}>
                <div className="flex items-center gap-3">
                    {isInitialized ? (
                        <>
                            <CheckCircle className="text-emerald-600" size={20} />
                            <div>
                                <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                                    Đã khởi tạo thành công
                                </p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                    {mappings.length} folder mappings • {unitMappings.length} đơn vị • {contractMappings.length} hợp đồng
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="text-amber-600" size={20} />
                            <div>
                                <p className="font-semibold text-amber-800 dark:text-amber-200">
                                    Chưa khởi tạo
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    Click nút bên dưới để tạo cấu trúc thư mục trên Google Drive
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Folder Structure Preview */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <FolderTree size={16} className="text-orange-500" />
                    Cấu trúc thư mục: {ROOT_FOLDER_NAME}
                </h4>
                <div className="text-xs font-mono space-y-1 text-slate-600 dark:text-slate-400 max-h-48 overflow-y-auto">
                    <div className="font-bold text-orange-600 dark:text-orange-400">📁 {ROOT_FOLDER_NAME}/</div>
                    {Object.entries(UNIT_FOLDER_MAP).map(([id, prefix]) => {
                        const subfolders = getUnitSubfolders(id);
                        return (
                            <div key={id}>
                                <div className="pl-4">
                                    📁 {prefix}/
                                    <span className="text-slate-400 dark:text-slate-500 ml-2">
                                        ({subfolders.join(', ')})
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div className="pl-4 text-slate-500 dark:text-slate-500">
                        📁 _KhachHang/ • 📁 _NhanSu/ • 📁 _BaoCaoTongHop/ • 📁 _Templates/
                    </div>
                </div>
            </div>

            {/* Progress Bar (during init) */}
            {progress.status === 'running' && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="animate-spin text-orange-500" size={16} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {progress.currentItem}
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.total > 0 ? (progress.current / progress.total * 100) : 0}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {progress.current} / {progress.total}
                    </p>
                </div>
            )}

            {/* Error display */}
            {progress.status === 'error' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="text-red-600" size={16} />
                        <span className="text-sm text-red-800 dark:text-red-200 font-medium">
                            {progress.error}
                        </span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                {!isInitialized ? (
                    <button
                        onClick={handleInitialize}
                        disabled={progress.status === 'running'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors font-semibold text-sm"
                    >
                        {progress.status === 'running' ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <FolderPlus size={16} />
                        )}
                        Khởi tạo thư mục Google Drive
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => setShowMappings(!showMappings)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                        >
                            <FolderTree size={16} />
                            {showMappings ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                        </button>

                        <button
                            onClick={checkStatus}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                        >
                            <RefreshCw size={16} />
                            Làm mới
                        </button>

                        <button
                            onClick={handleClearAndReinit}
                            className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium ml-auto"
                        >
                            <Trash2 size={16} />
                            Reset Mappings
                        </button>
                    </>
                )}
            </div>

            {/* Mappings Detail Table */}
            {showMappings && mappings.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Loại</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Entity</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Folder Type</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Tên Drive</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Link</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {mappings.map((m: any) => (
                                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-3 py-1.5">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${m.entity_type === 'root' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                : m.entity_type === 'unit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : m.entity_type === 'contract' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                }`}>
                                                {m.entity_type}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-mono">{m.entity_id || '—'}</td>
                                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{m.folder_type || '—'}</td>
                                        <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200 font-medium">{m.drive_folder_name || '—'}</td>
                                        <td className="px-3 py-1.5">
                                            {m.drive_folder_url && (
                                                <a
                                                    href={m.drive_folder_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline"
                                                >
                                                    <ExternalLink size={12} />
                                                    Mở
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriveSettings;
