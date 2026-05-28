import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, MoreVertical, Edit2, Trash2, Eye, ExternalLink, RefreshCw, FileText } from 'lucide-react';
import { NewsService } from '../services/newsService';
import { NewsPost, PostStatus } from '../types/news';
import NewsForm from './NewsForm';
import NewsDetail from './NewsDetail';
import { formatDate } from '../utils/formatters';
import ConfirmDialog, { useConfirmDialog } from './ui/ConfirmDialog';
import { toast } from 'sonner';
import { useSlidePanel } from '../contexts/SlidePanelContext';
import { useEffectiveProfile } from '../contexts/ImpersonationContext';

const NewsList: React.FC = () => {
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [categories, setCategories] = useState<any[]>([]);
    
    // Form state
    const [editingPost, setEditingPost] = useState<NewsPost | undefined>(undefined);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    
    const confirmDialog = useConfirmDialog();
    const { openPanel, closePanel } = useSlidePanel();
    const { profile: effectiveProfile } = useEffectiveProfile();
    // Impersonation-aware role check
    const hasEffectiveRole = (roles: string[]) => roles.includes(effectiveProfile?.role || '');

    const fetchPosts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await NewsService.getAll();
            setPosts(data);
        } catch (error: any) {
            toast.error('Lỗi tải danh sách bài viết: ' + (error.message || error));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        NewsService.getCategories().then(setCategories).catch(console.error);
        fetchPosts();
    }, [fetchPosts]);

    const filteredPosts = useMemo(() => {
        return posts.filter(post => {
            const matchesSearch = post.titleVi.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  (post.slug && post.slug.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || post.categoryId === categoryFilter;
            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [posts, searchQuery, statusFilter, categoryFilter]);

    const handleAdd = () => {
        setEditingPost(undefined);
        openPanel({
            title: 'Tạo bài viết mới',
            icon: <Plus className="text-indigo-600" />,
            component: <NewsForm 
                        isInsidePanel={true} 
                        onClose={closePanel} 
                        onSave={async (data) => {
                            await handleSave(data);
                            closePanel();
                        }} 
                     />,
            width: '1000px'
        });
    };

    const handleEdit = (post: NewsPost) => {
        setEditingPost(post);
        setActionMenuId(null);
        openPanel({
            title: 'Chỉnh sửa bài viết',
            icon: <Edit2 className="text-indigo-600" />,
            component: <NewsForm 
                        isInsidePanel={true} 
                        post={post} 
                        onClose={closePanel} 
                        onSave={async (data) => {
                            await handleSave(data, post.id);
                            closePanel();
                        }} 
                     />,
            width: '1000px'
        });
    };

    const showDetailPanel = (post: NewsPost) => {
        setActionMenuId(null);
        openPanel({
            title: 'Chi tiết Tin tức',
            icon: <FileText className="text-orange-500" size={20} />,
            component: (
                <div className="flex flex-col h-full bg-white dark:bg-slate-900">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <NewsDetail post={post} />
                    </div>
                    {/* Footer for actions in detail view */}
                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                        <button
                            onClick={() => closePanel()}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg"
                        >
                            Đóng
                        </button>
                        <button
                            onClick={() => {
                                handleEdit(post);
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-lg"
                        >
                            <Edit2 size={16} /> Chỉnh sửa
                        </button>
                    </div>
                </div>
            ),
            width: '1000px'
        });
    };

    const handleDelete = async (id: string) => {
        setActionMenuId(null);
        const confirmed = await confirmDialog.confirm({
            title: 'Xóa bài viết',
            message: 'Bạn có chắc chắn muốn xóa bài viết này?',
            variant: 'danger',
        });
        
        if (confirmed) {
            try {
                await NewsService.delete(id);
                toast.success('Xóa bài viết thành công!');
                setPosts(prev => prev.filter(p => p.id !== id));
            } catch (error: any) {
                toast.error('Lỗi khi xóa bài viết: ' + (error.message || error));
            }
        }
    };

    const handleSave = async (data: Partial<NewsPost>, id?: string) => {
        try {
            if (id) {
                const updated = await NewsService.update(id, data);
                setPosts(prev => prev.map(p => p.id === id ? updated : p));
                toast.success('Cập nhật bài viết thành công!');
            } else {
                const created = await NewsService.create(data);
                setPosts(prev => [created, ...prev]);
                toast.success('Tạo bài viết thành công!');
            }
        } catch (error: any) {
            toast.error('Lỗi lưu bài viết: ' + (error.message || error));
            throw error; // Let the form handle the failure
        }
    };

    const handleToggleWebVisibility = async (post: NewsPost) => {
        const newStatus = post.status === 'published' ? 'draft' : 'published';
        try {
            const updated = await NewsService.update(post.id, { status: newStatus });
            setPosts(prev => prev.map(p => p.id === post.id ? updated : p));
            if (newStatus === 'published') {
                toast.success(`Đã hiển thị "${post.titleVi}" trên website.`);
            } else {
                toast.info(`Đã ẩn "${post.titleVi}" khỏi website.`);
            }
        } catch (error: any) {
            toast.error('Lỗi cập nhật trạng thái: ' + (error.message || error));
        }
    };

    const handleApprove = async (id: string) => {
        try {
            const updated = await NewsService.update(id, { status: 'approved' });
            setPosts(prev => prev.map(p => p.id === id ? updated : p));
            toast.success('Đã duyệt bài viết. Quản lý Marketing có thể đăng lên website.');
        } catch (error: any) {
            toast.error('Lỗi khi duyệt bài: ' + (error.message || error));
        }
    };

    const getStatusStyle = (status: PostStatus) => {
        switch (status) {
            case 'published': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
            case 'approved': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800/50';
            case 'pending_approval': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
            case 'draft': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            case 'archived': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
        }
    };

    const getStatusText = (status: PostStatus) => {
        switch (status) {
            case 'published': return 'Đã xuất bản';
            case 'approved': return 'Đã duyệt';
            case 'pending_approval': return 'Chờ duyệt';
            case 'draft': return 'Bản nháp';
            case 'archived': return 'Lưu trữ';
            default: return 'Không rõ';
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
                        Quản trị Tin tức
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                        {posts.length} bài viết
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchPosts}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:border-indigo-400 transition-colors"
                        title="Làm mới"
                    >
                        <RefreshCw size={15} />
                    </button>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        <Plus size={15} />
                        Tạo bài viết
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tiêu đề..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900 dark:text-slate-100"
                    />
                </div>
                
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">Tất cả chuyên mục</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nameVi}</option>
                    ))}
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="published">Đã xuất bản</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="pending_approval">Chờ duyệt</option>
                    <option value="draft">Bản nháp</option>
                    <option value="archived">Lưu trữ</option>
                </select>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p>Đang tải dữ liệu...</p>
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                        <p>Không tìm thấy bài viết nào.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 w-12 text-center">STT</th>
                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">Tiêu đề & Chuyên mục</th>
                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 w-32">Thống kê</th>
                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 w-32 text-center">Hiển thị Web</th>
                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 w-32">Ngày tạo</th>
                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 w-16"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPosts.map((post, idx) => (
                                    <tr 
                                        key={post.id} 
                                        onClick={() => showDetailPanel(post)}
                                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                        <td className="py-3 px-4 text-center text-xs text-slate-500 font-medium">
                                            {idx + 1}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">{post.titleVi}</span>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {post.categoryNameVi && (
                                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                            {post.categoryNameVi}
                                                        </span>
                                                    )}
                                                    {post.isFeatured && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50">
                                                            Nổi bật
                                                        </span>
                                                    )}
                                                    {post.tags && post.tags.length > 0 && (
                                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
                                                            +{post.tags.length} từ khóa
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                                <Eye size={14} className="text-slate-400" />
                                                <span>{post.viewCount} lượt xem</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex flex-col items-center gap-1.5">
                                                {post.status === 'pending_approval' && hasEffectiveRole(['Admin', 'Leadership']) ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleApprove(post.id); }}
                                                        className="px-2 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                                                        title="Nhấn để duyệt bài"
                                                    >
                                                        Duyệt bài
                                                    </button>
                                                ) : (['approved', 'published', 'draft'].includes(post.status)) && hasEffectiveRole(['Admin', 'Marketing']) ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleToggleWebVisibility(post); }}
                                                        title={post.status === 'published' ? 'Nhấn để ẩn bài viết' : 'Nhấn để xuất bản lên Web'}
                                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 transition-colors duration-200 outline-none
                                                        ${post.status === 'published' ? 'bg-emerald-500 border-emerald-500 dark:border-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-200
                                                            ${post.status === 'published' ? 'translate-x-2' : '-translate-x-2'}`}
                                                        />
                                                    </button>
                                                ) : null}
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusStyle(post.status)}`}>
                                                    {getStatusText(post.status)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                                            {formatDate(post.createdAt)}
                                        </td>
                                        <td className="py-3 px-4 relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === post.id ? null : post.id); }}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded transition-all"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            
                                            {actionMenuId === post.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                                                    <div className="absolute right-8 top-full -mt-8 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(post); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2 bg-transparent text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                        >
                                                            <Edit2 size={14} /> Chỉnh sửa
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                                                            className="w-full flex items-center gap-2 px-4 py-2 bg-transparent text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                        >
                                                            <Trash2 size={14} /> Xóa bài
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsList;
