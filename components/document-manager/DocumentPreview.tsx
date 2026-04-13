/**
 * DocumentPreview — Panel xem trước chi tiết tài liệu
 *
 * Hiển thị:
 * - Metadata: title, category, tags, entity link
 * - AI Status: indexed/not, số chunks, ngày index
 * - Content Preview: 800 ký tự đầu
 * - Actions: AI đọc, mở link, xóa
 */

import React, { useState, useEffect } from 'react';
import {
  X, Bot, FileText, Tag, Calendar, HardDrive, ExternalLink,
  Sparkles, Loader2, CheckCircle2, AlertCircle, Link2, User, Database
} from 'lucide-react';
import { DocumentRegistryItem, DOC_CATEGORY_LABELS, DOC_CATEGORY_COLORS, DocCategory } from '../../services/documentRegistryService';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { dataClient as supabase } from '../../lib/dataClient';

interface DocumentPreviewProps {
  document: DocumentRegistryItem;
  onClose: () => void;
  onIndexAI?: (doc: DocumentRegistryItem) => void;
  isIndexing?: boolean;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ document: doc, onClose, onIndexAI, isIndexing }) => {
  const [chunkCount, setChunkCount] = useState<number | null>(null);

  useEffect(() => {
    // Lấy số chunks đã index
    const loadChunks = async () => {
      if (!doc.isAiIndexed) return;
      try {
        const { count } = await supabase
          .from('document_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('document_id', doc.id);
        setChunkCount(count || 0);
      } catch { /* ignore */ }
    };
    loadChunks();
  }, [doc.id, doc.isAiIndexed]);

  const color = DOC_CATEGORY_COLORS[doc.docCategory] || 'slate';
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`p-2.5 rounded-xl bg-${color}-50 dark:bg-${color}-900/20 shrink-0`}>
              <FileText size={20} className={`text-${color}-500`} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate pr-4" title={doc.title}>
                {doc.title}
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">{doc.fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* AI Status Card */}
          <div className={`rounded-xl p-4 border ${
            doc.isAiIndexed
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/40'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {doc.isAiIndexed ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : (
                <AlertCircle size={16} className="text-slate-400" />
              )}
              <span className={`text-xs font-bold ${doc.isAiIndexed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {doc.isAiIndexed ? 'AI đã đọc' : 'Chưa được AI đọc'}
              </span>
            </div>
            {doc.isAiIndexed && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                {doc.aiIndexedAt && <p>Ngày index: {formatDateTime(doc.aiIndexedAt)}</p>}
                {chunkCount !== null && <p>Số chunks: {chunkCount} đoạn văn bản</p>}
              </div>
            )}
            {!doc.isAiIndexed && onIndexAI && (
              <button
                onClick={() => onIndexAI(doc)}
                disabled={isIndexing}
                className="mt-2 flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/40 rounded-lg transition-all disabled:opacity-50"
              >
                {isIndexing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isIndexing ? 'Đang xử lý...' : 'Cho AI đọc ngay'}
              </button>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thông tin</h4>
            <div className="grid grid-cols-2 gap-3">
              <MetaItem icon={<Tag size={12} />} label="Danh mục" value={DOC_CATEGORY_LABELS[doc.docCategory] || doc.docCategory} />
              <MetaItem icon={<HardDrive size={12} />} label="Dung lượng" value={formatFileSize(doc.fileSize)} />
              <MetaItem icon={<Calendar size={12} />} label="Ngày tạo" value={formatDate(doc.createdAt)} />
              <MetaItem icon={<Database size={12} />} label="Nguồn" value={doc.sourceType === 'drive' ? 'Google Drive' : doc.sourceType === 'supabase_storage' ? 'Storage' : doc.sourceType === 'external_link' ? 'Link ngoài' : 'Text'} />
              {doc.entityType && (
                <MetaItem icon={<Link2 size={12} />} label="Liên kết" value={`${doc.entityType}/${doc.entityId?.substring(0, 8)}...`} />
              )}
              {doc.uploadedBy && (
                <MetaItem icon={<User size={12} />} label="Người tải" value={doc.uploadedBy.substring(0, 8) + '...'} />
              )}
            </div>
          </div>

          {/* Tags */}
          {doc.tags && doc.tags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tags</h4>
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full border border-slate-200 dark:border-slate-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {doc.description && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô tả</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{doc.description}</p>
            </div>
          )}

          {/* Content Preview */}
          {doc.contentPreview && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Xem trước nội dung</h4>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
                  {doc.contentPreview.substring(0, 800)}
                  {doc.contentPreview.length > 800 && '...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          {doc.sourceUrl && (
            <a
              href={doc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-all flex-1 justify-center"
            >
              <ExternalLink size={13} />
              Mở tài liệu
            </a>
          )}
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// Small helper component
const MetaItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2">
    <div className="text-slate-400 mt-0.5 shrink-0">{icon}</div>
    <div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{value}</p>
    </div>
  </div>
);

export default DocumentPreview;
