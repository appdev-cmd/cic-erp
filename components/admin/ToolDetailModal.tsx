import React, { useState, useEffect } from 'react';
import { X, Save, FileJson, AlertCircle } from 'lucide-react';
import type { OpenClawTool } from '../../services/ai/openclaw/types';
import { AgentToolConfigService } from '../../services/ai/agentToolConfigService';
import { toast } from 'sonner';

interface ToolDetailModalProps {
  tool: OpenClawTool | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ToolDetailModal: React.FC<ToolDetailModalProps> = ({ tool, onClose, onSaved }) => {
  const [customDesc, setCustomDesc] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tool) return;
    setLoading(true);
    // Fetch override config from DB
    AgentToolConfigService.getAll().then(configs => {
      const conf = configs.find(c => c.tool_name === tool.name);
      if (conf) {
        setCustomDesc(conf.custom_description || '');
        setIsActive(conf.is_active !== false);
      } else {
        setCustomDesc('');
        setIsActive(true);
      }
    }).catch(err => {
      console.error('Error loading tool config:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [tool]);

  if (!tool) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await AgentToolConfigService.update(tool.name, {
        custom_description: customDesc.trim() || null,
        is_active: isActive
      });
      toast.success('Đã lưu cấu hình tool');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Lỗi khi lưu cấu hình tool: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-[70] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileJson size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">{tool.name}</h3>
              <p className="text-xs text-slate-500">Cấu hình Tool Agent</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Default Description */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mô tả hệ thống (Mặc định)</h4>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 font-mono">
              {tool.description}
            </div>
          </div>

          {/* Custom Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Mô tả tuỳ chỉnh (Ghi đè)</h4>
              <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded font-medium border border-amber-200">
                <AlertCircle size={10} className="inline mr-1" />
                Dùng để hướng dẫn AI
              </span>
            </div>
            <textarea
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Nhập nội dung ghi đè mô tả mặc định (để trống nếu muốn dùng mặc định)..."
              rows={4}
              disabled={loading}
              className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          {/* JSON Schema */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tham số (JSON Schema)</h4>
            <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-xs overflow-x-auto">
              {JSON.stringify(tool.schema, null, 2)}
            </pre>
          </div>
          
          {/* Active Status */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Trạng thái Tool</p>
              <p className="text-xs text-slate-500">Tắt tool này sẽ vô hiệu hoá nó trên toàn hệ thống.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">
            Đóng
          </button>
          <button onClick={handleSave} disabled={saving || loading} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors">
            {saving ? 'Đang lưu...' : <><Save size={16} /> Lưu Cấu hình</>}
          </button>
        </div>
      </div>
    </>
  );
};
