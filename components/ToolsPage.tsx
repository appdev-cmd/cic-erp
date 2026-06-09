import React, { useState } from 'react';
import { useLayoutContext } from './layout/MainLayout';
import PAKDManager from './tools/PAKDManager';
import { Activity, LayoutGrid, Wrench } from 'lucide-react';

const ToolsPage: React.FC = () => {
    const { theme } = useLayoutContext();
    const [activeTab, setActiveTabState] = useState<'pakd' | 'other'>(() => {
        return (localStorage.getItem('cic-erp-tools-tab') as any) || 'pakd';
    });

    const setActiveTab = (tab: 'pakd' | 'other') => {
        setActiveTabState(tab);
        localStorage.setItem('cic-erp-tools-tab', tab);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Wrench className="text-orange-500" />
                        Công cụ Tiện ích
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Tổng hợp các loại công cụ tự động hóa và hỗ trợ nghiệp vụ.
                    </p>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('pakd')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'pakd'
                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700'
                        }`}
                >
                    <Activity size={18} />
                    Lập Dự toán (PAKD)
                </button>
                <button
                    onClick={() => setActiveTab('other')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'other'
                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700'
                        }`}
                >
                    <LayoutGrid size={18} />
                    Công cụ khác
                </button>
            </div>

            {/* Tab Content */}
            <div className="mt-6 flex-1 h-[calc(100vh-12rem)] min-h-[600px]">
                {activeTab === 'pakd' && <PAKDManager />}
                {activeTab === 'other' && (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        Các công cụ khác đang được phát triển...
                    </div>
                )}
            </div>
        </div>
    );
};

export default ToolsPage;
