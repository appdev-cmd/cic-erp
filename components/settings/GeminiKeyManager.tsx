import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Key, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Play, 
  Eye, 
  EyeOff, 
  ToggleLeft, 
  ToggleRight, 
  Loader2, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../utils/formatters';

interface GeminiKey {
  id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  status: 'active' | 'error' | 'rate_limited';
  usage_count: number;
  error_count: number;
  total_tokens?: number;
  estimated_cost?: number;
  last_used_at: string | null;
  last_error_at: string | null;
  error_message: string | null;
  created_at: string;
}

const GeminiKeyManager: React.FC = () => {
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  
  // Form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');

  // Fetch keys from Supabase
  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gemini_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (err: any) {
      console.error('Error fetching Gemini keys:', err);
      toast.error('Không thể tải danh sách API Keys: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Handle Add Key
  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !newApiKey.trim()) {
      toast.error('Vui lòng nhập đầy đủ tên gợi nhớ và API Key');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('gemini_keys')
        .insert([
          {
            key_name: newKeyName.trim(),
            api_key: newApiKey.trim(),
            is_active: true,
            status: 'active',
          }
        ])
        .select();

      if (error) {
        if (error.code === '23505') {
          throw new Error('API Key này đã tồn tại trong hệ thống.');
        }
        throw error;
      }

      toast.success('Đã thêm Gemini API Key thành công!');
      setNewKeyName('');
      setNewApiKey('');
      fetchKeys();
    } catch (err: any) {
      console.error('Error adding key:', err);
      toast.error(err.message || 'Lỗi khi thêm API Key');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle is_active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('gemini_keys')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      setKeys(prev => 
        prev.map(k => k.id === id ? { ...k, is_active: !currentStatus } : k)
      );
      toast.success(`Đã ${!currentStatus ? 'kích hoạt' : 'vô hiệu hóa'} key thành công`);
    } catch (err: any) {
      console.error('Error toggling active status:', err);
      toast.error('Lỗi khi cập nhật trạng thái: ' + err.message);
    }
  };

  // Delete key
  const handleDeleteKey = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa API Key "${name}" không?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('gemini_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setKeys(prev => prev.filter(k => k.id !== id));
      toast.success('Đã xóa API Key thành công');
    } catch (err: any) {
      console.error('Error deleting key:', err);
      toast.error('Lỗi khi xóa API Key: ' + err.message);
    }
  };

  // Test Connection for a specific Key
  const handleTestKey = async (id: string) => {
    setTestingKeyId(id);
    toast.info('Đang kiểm tra kết nối với Gemini API...');
    
    try {
      // Gửi yêu cầu test qua proxy với header x-use-key-id
      const response = await fetch('/api/ai-proxy/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-use-key-id': id
        },
        body: JSON.stringify({
          model: 'gemini-3.5-flash',
          messages: [{ role: 'user', content: 'Ping connection test. Reply with exactly "pong"' }],
          temperature: 0.1,
          max_tokens: 5,
          stream: false
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const rawError = errData.error;
        let errorMsg = `Lỗi HTTP ${response.status}`;
        
        if (rawError) {
          if (typeof rawError === 'string') {
            errorMsg = rawError;
          } else if (typeof rawError === 'object') {
            errorMsg = rawError.message || JSON.stringify(rawError);
          }
        }
        throw new Error(errorMsg);
      }

      toast.success('Kết nối thành công! Key đang hoạt động tốt.');
    } catch (err: any) {
      console.error('Error testing Gemini key:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Kiểm thử thất bại: ${msg}`);
    } finally {
      setTestingKeyId(null);
      // Refresh to pull updated telemetry from DB (status, last_used, errors...)
      fetchKeys();
    }
  };

  // Helper to mask key: AIzaSyDH...410
  const maskKey = (key: string) => {
    if (key.length <= 12) return '••••••••';
    return `${key.substring(0, 8)}••••${key.substring(key.length - 4)}`;
  };

  return (
    <div className="w-full space-y-4 p-1">
      {/* Main Container: Full width 1 column */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        
        {/* Card Header with Tooltip Help */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
              <Key size={18} />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Danh sách Gemini API Keys</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Quản lý và theo dõi tải của các tài khoản Google API Key</p>
              </div>

              {/* Hover Tooltip for Guidance */}
              <div className="group relative ml-1 inline-block">
                <HelpCircle 
                  size={15} 
                  className="text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 cursor-help transition-colors" 
                />
                
                {/* Tooltip Content box */}
                <div className="absolute top-full left-0 mt-2 w-80 hidden group-hover:block bg-slate-900 dark:bg-slate-800 text-slate-100 dark:text-slate-250 text-[11px] p-4 rounded-xl border border-slate-700 dark:border-slate-600 shadow-xl z-50 pointer-events-none leading-relaxed text-left normal-case font-normal">
                  <h4 className="font-bold text-xs text-indigo-400 mb-2 flex items-center gap-1.5">
                    <Key size={12} />
                    Cách hoạt động của Key Rotation
                  </h4>
                  <div className="space-y-2 text-slate-300 dark:text-slate-400">
                    <p>• **Phân phối tải**: Hệ thống sẽ chọn ngẫu nhiên các key hoạt động để phân tích tin tức. Nhiều key giúp tăng giới hạn xử lý mỗi phút (RPM) lên gấp nhiều lần.</p>
                    <p>• **Tự sửa lỗi (Self-healing)**: Nếu một key bị hết hạn hoặc lỗi kết nối, backend sẽ tự động chuyển sang key khác trong danh sách mà không làm gián đoạn người dùng.</p>
                    <p>• **Bảo mật**: Các API key được lưu trực tiếp trên Supabase Database và chỉ được sử dụng ở backend. Client-side không bao giờ đọc được API Key thô.</p>
                  </div>
                  {/* Tooltip arrow */}
                  <div className="absolute bottom-full left-1.5 -mb-1 border-4 border-transparent border-b-slate-900 dark:border-b-slate-800"></div>
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={fetchKeys} 
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-indigo-600" : ""} />
          </button>
        </div>

        {/* Table list */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
            <span className="text-xs font-medium">Đang tải dữ liệu từ database...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
            <AlertCircle size={28} className="text-slate-400 dark:text-slate-600" />
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Chưa có API Key nào được cài đặt</span>
            <p className="text-xs text-slate-400 max-w-md">Hệ thống đang sử dụng key mặc định từ biến môi trường. Hãy nhập key mới ở dòng dưới đây để kích hoạt cơ chế xoay vòng.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3">Tên gợi nhớ</th>
                  <th className="px-5 py-3 text-center">Trạng thái</th>
                  <th className="px-5 py-3 text-center">Số lần gọi (Lỗi)</th>
                  <th className="px-5 py-3 text-center">Context đã dùng (Tokens)</th>
                  <th className="px-5 py-3 text-center">Chi phí ước tính (USD)</th>
                  <th className="px-5 py-3">Lần cuối hoạt động</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {keys.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    {/* Name */}
                    <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">
                      {item.key_name}
                    </td>
                    
                    {/* Status */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center">
                        {!item.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            Vô hiệu
                          </span>
                        ) : item.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Hoạt động
                          </span>
                        ) : item.status === 'rate_limited' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50" title={item.error_message || ''}>
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Nghẽn (429)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50" title={item.error_message || ''}>
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Lỗi key
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Usage statistics */}
                    <td className="px-5 py-3.5 text-center tabular-nums font-medium">
                      <span className="text-slate-700 dark:text-slate-300 font-bold">{item.usage_count}</span>
                      {item.error_count > 0 && (
                        <span className="text-rose-500 dark:text-rose-400 font-semibold ml-1">
                          ({item.error_count})
                        </span>
                      )}
                    </td>

                    {/* Total Tokens (Context) */}
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                      {(item.total_tokens || 0).toLocaleString('vi-VN')}
                    </td>

                    {/* Estimated Cost */}
                    <td className="px-5 py-3.5 text-center tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      ${(item.estimated_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                    </td>
                    
                    {/* Last used at */}
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                      {item.last_used_at ? formatDateTime(item.last_used_at) : 'Chưa sử dụng'}
                    </td>
                    
                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle Active */}
                        <button
                          onClick={() => handleToggleActive(item.id, item.is_active)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
                          title={item.is_active ? "Vô hiệu hóa" : "Kích hoạt"}
                        >
                          {item.is_active ? (
                            <ToggleRight size={18} className="text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <ToggleLeft size={18} className="text-slate-400 dark:text-slate-600" />
                          )}
                        </button>

                        {/* Test Key */}
                        <button
                          onClick={() => handleTestKey(item.id)}
                          disabled={testingKeyId !== null}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer disabled:opacity-50"
                          title="Kiểm thử kết nối"
                        >
                          {testingKeyId === item.id ? (
                            <Loader2 size={14} className="animate-spin text-indigo-600" />
                          ) : (
                            <Play size={14} className="text-emerald-600 dark:text-emerald-400" />
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteKey(item.id, item.key_name)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                          title="Xóa Key"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* INLINE FORM: Dòng thêm mới key nằm ngang ở dưới cùng của bảng */}
        <div className="bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 p-4 rounded-b-xl">
          <form onSubmit={handleAddKey} className="flex flex-col md:flex-row items-center gap-3">
            <div className="flex-none text-xs font-bold text-slate-700 dark:text-slate-350 whitespace-nowrap">
              Thêm Key mới:
            </div>
            
            {/* Nhãn gợi nhớ */}
            <div className="flex-1 w-full md:w-auto">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Tên gợi nhớ / Tài khoản (ví dụ: Google Acc 1)"
                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                disabled={submitting}
              />
            </div>

            {/* API Key */}
            <div className="flex-1 w-full md:w-auto flex items-center gap-2">
              <input
                type="password"
                value={newApiKey}
                onChange={e => setNewApiKey(e.target.value)}
                placeholder="Nhập Gemini API Key (AIzaSy...)"
                className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                disabled={submitting}
              />
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-0.5 whitespace-nowrap"
                title="Lấy API Key từ Google AI Studio"
              >
                Lấy Key <ExternalLink size={10} />
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto py-2 px-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Đang lưu
                </>
              ) : (
                <>
                  <Plus size={13} />
                  Thêm Key
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default GeminiKeyManager;
