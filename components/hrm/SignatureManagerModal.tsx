import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit, CheckCircle } from 'lucide-react';
import { UserEmailSignature } from '../../types/hrmTypes';
import { recruitmentService } from '../../services/recruitmentService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import RichTextEditor from '../ui/RichTextEditor';

interface SignatureManagerModalProps {
  onClose: () => void;
  onSignaturesChange?: () => void; // Gọi khi danh sách chữ ký thay đổi
}

export default function SignatureManagerModal({ onClose, onSignaturesChange }: SignatureManagerModalProps) {
  const { profile, user } = useAuth();
  const [signatures, setSignatures] = useState<UserEmailSignature[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // States cho form thêm/sửa
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.id || profile?.id) {
      loadSignatures();
    }
  }, [user?.id, profile?.id]);

  const loadSignatures = async () => {
    if (!profile?.id && !user?.id) return;
    setIsLoading(true);
    try {
      const data = await recruitmentService.getUserSignatures(user?.id || profile!.id);
      setSignatures(data);
    } catch (e: any) {
      toast.error('Lỗi khi tải mẫu chữ ký: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditId(null);
    setName('');
    // Mẫu chữ ký mặc định
    setHtmlContent(`
<br><br>
<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-family: sans-serif;">
  <p style="margin: 0; font-weight: bold; color: #1e293b; font-size: 14px;">${profile?.fullName || 'Tên của bạn'}</p>
  <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">${profile?.role || 'Chức vụ'} | CIC Group</p>
  <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Email: <a href="mailto:${profile?.email || ''}" style="color: #4f46e5; text-decoration: none;">${profile?.email || 'email'}</a></p>
</div>
    `);
    setIsDefault(signatures.length === 0);
    setIsEditing(true);
  };

  const handleEdit = (sig: UserEmailSignature) => {
    setEditId(sig.id);
    setName(sig.name);
    setHtmlContent(sig.html_content);
    setIsDefault(sig.is_default);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mẫu chữ ký này?')) return;
    try {
      await recruitmentService.deleteUserSignature(id);
      toast.success('Đã xóa chữ ký');
      loadSignatures();
      if (onSignaturesChange) onSignaturesChange();
    } catch (e: any) {
      toast.error('Lỗi khi xóa: ' + e.message);
    }
  };

  const handleSave = async () => {
    if (!profile?.id && !user?.id) return;
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên mẫu chữ ký');
      return;
    }
    if (!htmlContent.trim()) {
      toast.error('Nội dung chữ ký không được để trống');
      return;
    }

    setIsSaving(true);
    try {
      await recruitmentService.saveUserSignature({
        id: editId || undefined,
        user_id: user?.id || profile!.id,
        name,
        html_content: htmlContent,
        is_default: isDefault
      });
      toast.success('Lưu mẫu chữ ký thành công!');
      setIsEditing(false);
      loadSignatures();
      if (onSignaturesChange) onSignaturesChange();
    } catch (e: any) {
      toast.error('Lỗi khi lưu: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (sig: UserEmailSignature) => {
    try {
      await recruitmentService.saveUserSignature({
        ...sig,
        is_default: true
      });
      toast.success('Đã đặt làm chữ ký mặc định');
      loadSignatures();
      if (onSignaturesChange) onSignaturesChange();
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Quản lý Mẫu Chữ ký
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Tên mẫu chữ ký</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="VD: Chữ ký Tiếng Việt, Chữ ký Tuyển dụng..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Nội dung</label>
                <RichTextEditor
                  value={htmlContent}
                  onChange={setHtmlContent}
                  minHeight="200px"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultSig"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="defaultSig" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  Đặt làm chữ ký mặc định (Tự động chèn khi soạn email)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu lại'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {signatures.length === 0 ? 'Bạn chưa có mẫu chữ ký nào.' : `Bạn đang có ${signatures.length} mẫu chữ ký.`}
                </p>
                <button
                  onClick={handleAddNew}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <Plus size={16} />
                  Tạo mới
                </button>
              </div>

              {isLoading ? (
                <div className="py-8 text-center text-slate-500 text-sm">Đang tải...</div>
              ) : (
                <div className="space-y-3">
                  {signatures.map(sig => (
                    <div key={sig.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-800 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate">{sig.name}</h3>
                          {sig.is_default && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <CheckCircle size={10} /> Mặc định
                            </span>
                          )}
                        </div>
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-900 p-3 rounded border border-slate-100 dark:border-slate-800 max-h-24 overflow-hidden relative"
                        >
                          <div dangerouslySetInnerHTML={{ __html: sig.html_content }} />
                          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        {!sig.is_default && (
                          <button
                            onClick={() => handleSetDefault(sig)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Đặt làm mặc định"
                          >
                            Set mặc định
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(sig)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Sửa"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(sig.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
