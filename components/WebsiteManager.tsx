import React, { useState } from 'react';
import NewsList from './NewsList'; // Original news module
import ServiceManager from './ServiceManager';
import BannerManager from './BannerManager';
import { Globe, FileText, Component, Image as ImageIcon } from 'lucide-react';

const WebsiteManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'news' | 'services' | 'banners'>('news');

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3 tracking-tight">
                        <Globe className="text-indigo-600 dark:text-indigo-400" size={32} />
                        Quản trị Website
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Quản lý nội dung, hình ảnh và dịch vụ hiển thị trên trang chủ CIC
                    </p>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('news')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'news'
                            ? 'bg-orange-500 text-white shadow-sm dark:bg-orange-600'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                >
                    <FileText size={18} />
                    Tin tức & Sự kiện
                </button>
                <button
                    onClick={() => setActiveTab('services')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'services'
                            ? 'bg-orange-500 text-white shadow-sm dark:bg-orange-600'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                >
                    <Component size={18} />
                    Dịch vụ
                </button>
                <button
                    onClick={() => setActiveTab('banners')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'banners'
                            ? 'bg-orange-500 text-white shadow-sm dark:bg-orange-600'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                >
                    <ImageIcon size={18} />
                    Banners quảng cáo
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="min-h-[500px]">
                {activeTab === 'news' && (
                    <div className="animate-in fade-in duration-300">
                        {/* Wrap existing NewsList inside to isolate it visually if needed, though it might have its own header */}
                        <NewsList />
                    </div>
                )}
                {activeTab === 'services' && (
                    <div className="animate-in fade-in duration-300">
                        <ServiceManager />
                    </div>
                )}
                {activeTab === 'banners' && (
                    <div className="animate-in fade-in duration-300">
                        <BannerManager />
                    </div>
                )}
            </div>
        </div>
    );
};

export default WebsiteManager;
