import React from 'react';
import { NewsPost, PostStatus } from '../types/news';
import { FileText, Eye, User, Calendar, Tag } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/formatters';

interface NewsDetailProps {
    post: NewsPost;
}

const NewsDetail: React.FC<NewsDetailProps> = ({ post }) => {
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
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col md:flex-row items-start gap-6">
                {post.thumbnailUrl ? (
                    <img 
                        src={post.thumbnailUrl} 
                        alt={post.titleVi} 
                        className="w-full md:w-48 h-32 md:h-48 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                    />
                ) : (
                    <div className="w-full md:w-48 h-32 md:h-48 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <FileText size={40} className="text-slate-400" />
                    </div>
                )}
                
                <div className="flex-1 space-y-3">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">{post.titleVi}</h2>
                        {post.slug && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                /{post.slug}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                        <span className={`inline-flex items-center px-3 py-1 rounded border text-xs font-bold ${getStatusStyle(post.status)}`}>
                            {getStatusText(post.status)}
                        </span>
                        
                        {post.categoryNameVi && (
                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-semibold">
                                {post.categoryNameVi}
                            </span>
                        )}

                        {post.isFeatured && (
                            <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded text-xs font-bold border border-orange-200 dark:border-orange-800/50">
                                Tin nổi bật
                            </span>
                        )}
                        
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-medium">
                            <Eye size={14} /> {post.viewCount || 0} lượt xem
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                        {post.authorName && (
                            <span className="flex items-center gap-1.5"><User size={14} /> {post.authorName}</span>
                        )}
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> Tóm tắt viết ngày: {formatDate(post.createdAt)}</span>
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="font-semibold mr-2 text-slate-500">Mô tả ngắn:</span>
                        <span className="italic">{post.excerptVi || 'Chưa có trích dẫn/mô tả ngắn...'}</span>
                    </div>
                </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-800 my-6"></div>

            {/* Content Details */}
            <div className="grid grid-cols-1 gap-6">
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                        Nội dung bài viết
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-inner overflow-hidden">
                        {post.contentVi ? (
                            <div 
                                className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 dark:[&_*:not(a)]:!text-slate-300 dark:[&_*]:!bg-transparent prose-img:rounded-lg prose-img:max-w-full"
                                dangerouslySetInnerHTML={{ __html: post.contentVi.replace(/\\r\\n|rnrn/g, '<br/>').replace(/>\s*rn\s*</g, '><').replace(/rn\s/g, '') }}
                            />
                        ) : (
                            <p className="text-sm text-slate-400 italic">Bài viết chưa có nội dung...</p>
                        )}
                    </div>
                </div>

                {(post.seoTitleVi || post.seoDescriptionVi || (post.tags && post.tags.length > 0)) && (
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                            SEO & Tags
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 text-sm space-y-3">
                            {post.tags && post.tags.length > 0 && (
                                <div className="flex gap-2">
                                    <span className="font-semibold text-slate-500 w-24 shrink-0 flex items-center gap-1.5"><Tag size={14} /> Tags:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {post.tags.map((tag, idx) => (
                                            <span key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-xs font-medium text-slate-600 dark:text-slate-300">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {post.seoTitleVi && (
                                <div>
                                    <span className="font-semibold text-slate-500 w-24 inline-block">SEO Title:</span>
                                    <span className="text-slate-800 dark:text-slate-200">{post.seoTitleVi}</span>
                                </div>
                            )}
                            
                            {post.seoDescriptionVi && (
                                <div>
                                    <span className="font-semibold text-slate-500 w-24 inline-block align-top">SEO Desc:</span>
                                    <span className="text-slate-800 dark:text-slate-200 inline-block w-[calc(100%-6rem)]">
                                        {post.seoDescriptionVi}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                <div className="text-xs text-slate-400 dark:text-slate-500 flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span>Thời gian tạo: {formatDateTime(post.createdAt || new Date().toISOString())}</span>
                    <span>Cập nhật lần cuối: {formatDateTime(post.updatedAt || new Date().toISOString())}</span>
                </div>
            </div>
            
            <div className="h-4"></div>
        </div>
    );
};

export default NewsDetail;
