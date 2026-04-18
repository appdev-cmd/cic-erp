import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, File, Image, FileText, Trash2, Download, X, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { dataClient } from '../../../lib/dataClient';
import { formatDateTime } from '../../../utils/formatters';

interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by?: string;
  created_at: string;
  uploader_name?: string;
  url?: string;
}

interface TaskAttachmentTabProps {
  taskId: string;
  currentUserId: string;
}

const BUCKET = 'task-attachments';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): React.ReactNode {
  if (mimeType.startsWith('image/')) return <Image size={20} className="text-violet-500" />;
  if (mimeType === 'application/pdf') return <FileText size={20} className="text-rose-500" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText size={20} className="text-blue-500" />;
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText size={20} className="text-emerald-500" />;
  return <File size={20} className="text-slate-400" />;
}

const TaskAttachmentTab: React.FC<TaskAttachmentTabProps> = ({ taskId, currentUserId }) => {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Load list ─────────────────────────────────────────────────────────────
  const loadAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await dataClient
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (data) {
        // Resolve uploader names in one batch
        const uploaderIds = [...new Set(data.map((a: any) => a.uploaded_by).filter(Boolean))];
        let nameMap: Record<string, string> = {};
        if (uploaderIds.length > 0) {
          const { data: emps } = await dataClient
            .from('employees')
            .select('id, name')
            .in('id', uploaderIds);
          emps?.forEach((e: any) => { nameMap[e.id] = e.name; });
        }

        // Generate signed URLs
        const enriched: TaskAttachment[] = await Promise.all(
          data.map(async (a: any) => {
            let url: string | undefined;
            try {
              const { data: urlData } = await dataClient.storage
                .from(BUCKET)
                .createSignedUrl(a.storage_path, 3600);
              url = urlData?.signedUrl;
            } catch { /* use download fallback */ }
            return {
              ...a,
              uploader_name: nameMap[a.uploaded_by] || undefined,
              url,
            };
          })
        );
        setAttachments(enriched);
      }
    } catch {
      // Table may not exist yet — silent
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  // ─── Upload ────────────────────────────────────────────────────────────────
  const uploadFiles = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    let uploadedCount = 0;

    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        toast.error(`File "${file.name}" quá lớn (tối đa 50MB)`);
        continue;
      }
      try {
        const ext = file.name.split('.').pop() || '';
        const storagePath = `${taskId}/${Date.now()}_${file.name}`;

        const { error: storageError } = await dataClient.storage
          .from(BUCKET)
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (storageError) throw storageError;

        await dataClient.from('task_attachments').insert({
          task_id: taskId,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || `application/${ext}`,
          storage_path: storagePath,
          uploaded_by: currentUserId,
        });
        uploadedCount++;
      } catch (err: any) {
        toast.error(`Lỗi tải "${file.name}": ${err.message}`);
      }
    }

    if (uploadedCount > 0) {
      toast.success(`Đã tải lên ${uploadedCount} file`);
      loadAttachments();
    }
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (att: TaskAttachment) => {
    if (!window.confirm(`Xóa file "${att.file_name}"?`)) return;
    try {
      await dataClient.storage.from(BUCKET).remove([att.storage_path]);
      await dataClient.from('task_attachments').delete().eq('id', att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      toast.success('Đã xóa file');
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all
          ${dragOver
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/50'
          }`}
      >
        {uploading ? (
          <Loader2 size={28} className="text-indigo-500 animate-spin" />
        ) : (
          <Upload size={28} className={dragOver ? 'text-indigo-500' : 'text-slate-400'} />
        )}
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          {uploading ? 'Đang tải lên…' : 'Kéo thả file hoặc click để chọn'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Tối đa 50MB mỗi file</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* File list */}
      <div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Paperclip size={12} />
          Tệp đính kèm ({attachments.length})
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">
            Chưa có file đính kèm
          </p>
        ) : (
          <div className="space-y-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
              >
                <div className="flex-shrink-0">{getFileIcon(att.mime_type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{att.file_name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {formatBytes(att.file_size)}
                    {att.uploader_name ? ` · ${att.uploader_name}` : ''}
                    {' · '}{formatDateTime(att.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {att.url && (
                    <a
                      href={att.url}
                      download={att.file_name}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title="Tải xuống"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(att)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskAttachmentTab;
