/**
 * EmbeddingSettings — Admin panel to configure AI Embedding Provider
 *
 * Cho phép Admin chọn:
 * - Local Ollama (miễn phí, cần cài Ollama + model nomic-embed-text)
 * - Gemini API (cloud, cần API Key, miễn phí 1500 req/phút)
 *
 * Lưu vào localStorage, ragService sẽ đọc từ đó.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Cloud, Server, Key, CheckCircle, XCircle, Loader2, TestTube, RefreshCw, FileText, Database, Sparkles } from 'lucide-react';

type EmbeddingProvider = 'local' | 'gemini';

interface TestResult {
  status: 'success' | 'error';
  message: string;
  dims?: number;
  latency?: number;
}

const EmbeddingSettings: React.FC = () => {
  const [provider, setProvider] = useState<EmbeddingProvider>('local');
  const [geminiKey, setGeminiKey] = useState('');
  const [localUrl, setLocalUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(false);

  // Load from localStorage
  useEffect(() => {
    setProvider((localStorage.getItem('cic-embedding-provider') as EmbeddingProvider) || 'local');
    setGeminiKey(localStorage.getItem('cic-gemini-api-key') || '');
    setLocalUrl(localStorage.getItem('cic-local-ai-base-url') || '/api/vllm');
  }, []);

  const handleSave = useCallback(() => {
    localStorage.setItem('cic-embedding-provider', provider);
    if (geminiKey) localStorage.setItem('cic-gemini-api-key', geminiKey);
    if (localUrl) localStorage.setItem('cic-local-ai-base-url', localUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [provider, geminiKey, localUrl]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    const start = Date.now();

    try {
      if (provider === 'gemini') {
        if (!geminiKey) {
          setTestResult({ status: 'error', message: 'Chưa nhập Gemini API Key' });
          return;
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/text-embedding-004',
              content: { parts: [{ text: 'Kiểm tra kết nối embedding CIC ERP' }] },
              taskType: 'RETRIEVAL_DOCUMENT',
              outputDimensionality: 768,
            })
          }
        );

        if (!response.ok) {
          const err = await response.text();
          setTestResult({ status: 'error', message: `Lỗi Gemini: ${err.substring(0, 120)}` });
          return;
        }

        const data = await response.json();
        const dims = data?.embedding?.values?.length || 0;
        setTestResult({
          status: 'success',
          message: `Gemini text-embedding-004 hoạt động tốt!`,
          dims,
          latency: Date.now() - start,
        });
      } else {
        // Test Local API
        let baseURL = localUrl || '/api/vllm';
        if (!baseURL.endsWith('/v1')) {
          baseURL = baseURL.replace(/\/$/, '') + '/v1';
        }

        const response = await fetch(`${baseURL}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer local-embedding'
          },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            input: 'Kiểm tra kết nối embedding CIC ERP'
          })
        });

        if (!response.ok) {
          setTestResult({ status: 'error', message: `Local API lỗi: ${response.statusText}. Đã bật Local API chưa?` });
          return;
        }

        const data = await response.json();
        const dims = data?.data?.[0]?.embedding?.length || 0;
        setTestResult({
          status: 'success',
          message: `Local API nomic-embed-text hoạt động tốt!`,
          dims,
          latency: Date.now() - start,
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: provider === 'local'
          ? `Không kết nối được Local API.`
          : `Lỗi kết nối: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  }, [provider, geminiKey, localUrl]);

  const providerOptions = [
    {
      id: 'local' as EmbeddingProvider,
      name: 'Local API',
      desc: 'Chạy trên máy tính, miễn phí, bảo mật dữ liệu',
      icon: <Server size={20} className="text-emerald-500" />,
      model: 'nomic-embed-text',
      color: 'emerald',
    },
    {
      id: 'gemini' as EmbeddingProvider,
      name: 'Gemini API (Cloud)',
      desc: 'Google AI, 1500 req/phút miễn phí, nhanh',
      icon: <Cloud size={20} className="text-indigo-500" />,
      model: 'text-embedding-004',
      color: 'indigo',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div>
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          Embedding Provider
        </h4>
        <div className="grid grid-cols-2 gap-4">
          {providerOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setProvider(opt.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                provider === opt.id
                  ? `border-${opt.color}-500 bg-${opt.color}-50 dark:bg-${opt.color}-900/20 shadow-md`
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                {opt.icon}
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  {opt.name}
                </span>
                {provider === opt.id && (
                  <CheckCircle size={14} className="text-emerald-500 ml-auto" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">{opt.desc}</p>
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                {opt.model}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Provider Config */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        {provider === 'gemini' ? (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              <Key size={12} className="inline mr-1" />
              Gemini API Key
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIza... (lấy từ aistudio.google.com)"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-700 dark:text-slate-300"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Lấy key miễn phí tại <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline">aistudio.google.com</a>. Giới hạn 1500 req/phút.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Local API Base URL
            </label>
            <input
              type="text"
              value={localUrl}
              onChange={e => setLocalUrl(e.target.value)}
              placeholder="/api/vllm"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-slate-700 dark:text-slate-300"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Cài đặt Embedding: Sử dụng nomic-embed-text qua LiteLLM/vLLM.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all flex items-center gap-2"
        >
          {saved ? <CheckCircle size={14} /> : <Database size={14} />}
          {saved ? 'Đã lưu!' : 'Lưu cài đặt'}
        </button>

        <button
          onClick={handleTest}
          disabled={testing}
          className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
          {testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
        </button>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`rounded-xl p-4 border ${
          testResult.status === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-start gap-2">
            {testResult.status === 'success' ? (
              <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-xs font-bold ${
                testResult.status === 'success'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}>
                {testResult.message}
              </p>
              {testResult.dims && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Dimensions: {testResult.dims} | Latency: {testResult.latency}ms
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/40">
        <div className="flex items-start gap-2">
          <FileText size={14} className="text-indigo-500 shrink-0 mt-0.5" />
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 space-y-1">
            <p className="font-bold">Embedding Provider dùng để làm gì?</p>
            <p>Khi bạn bấm "AI đọc" tài liệu, hệ thống sẽ trích xuất văn bản, chia nhỏ thành các đoạn (chunks), rồi chuyển thành vector nhúng (embedding) để AI có thể tìm kiếm ngữ nghĩa (RAG). Provider này quyết định dùng máy chủ nào để tạo vector.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddingSettings;
