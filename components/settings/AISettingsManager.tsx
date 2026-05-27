import React, { useState } from 'react';
import { Bot, Shield, Sparkles, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// Lazy-loaded sub-components
const AgentManager = React.lazy(() => import('../AgentManager'));
const AIPermissionManager = React.lazy(() => import('./AIPermissionManager'));
const EmbeddingSettings = React.lazy(() => import('./EmbeddingSettings'));
const AIObservabilityDashboard = React.lazy(() => import('../AIObservabilityDashboard'));

type AITab = 'agents' | 'permissions' | 'embedding' | 'monitoring';

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 md:py-20 gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <Loader2 size={36} className="animate-spin text-indigo-600 dark:text-indigo-400" />
    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">Đang tải cấu hình...</span>
  </div>
);

const AISettingsManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AITab>('agents');

    const TABS = [
        { id: 'agents', label: 'Cấu hình Trợ lý', icon: <Bot size={15} /> },
        { id: 'permissions', label: 'Phân quyền AI', icon: <Shield size={15} /> },
        { id: 'embedding', label: 'Cấu hình Vector', icon: <Sparkles size={15} /> },
        { id: 'monitoring', label: 'Giám sát & Chi phí', icon: <BarChart3 size={15} /> },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Flat Tabs Header */}
            <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-t-xl overflow-hidden shrink-0 p-1 gap-1">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as AITab)}
                        className={cn(
                            "flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold transition-all cursor-pointer rounded-lg",
                            activeTab === tab.id
                                ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-sm border border-slate-200/60 dark:border-slate-800"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content area */}
            <div className="mt-4">
                {activeTab === 'agents' && (
                    <React.Suspense fallback={<LoadingState />}>
                        <AgentManager />
                    </React.Suspense>
                )}
                {activeTab === 'permissions' && (
                    <React.Suspense fallback={<LoadingState />}>
                        <AIPermissionManager />
                    </React.Suspense>
                )}
                {activeTab === 'embedding' && (
                    <React.Suspense fallback={<LoadingState />}>
                        <EmbeddingSettings />
                    </React.Suspense>
                )}
                {activeTab === 'monitoring' && (
                    <React.Suspense fallback={<LoadingState />}>
                        <AIObservabilityDashboard />
                    </React.Suspense>
                )}
            </div>
        </div>
    );
};

export default AISettingsManager;
