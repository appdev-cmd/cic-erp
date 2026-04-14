import React from 'react';
import { CmsService } from '../types/cms';
import { FormLabel } from './ui/FormLabel';
import { Wrench, CheckCircle, XCircle } from 'lucide-react';
import { formatDate } from '../utils/formatters';

interface ServiceDetailProps {
    service: CmsService;
}

const ServiceDetail: React.FC<ServiceDetailProps> = ({ service }) => {
    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-start gap-6">
                {service.thumbnailUrl ? (
                    <img 
                        src={service.thumbnailUrl} 
                        alt={service.nameVi} 
                        className="w-32 h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                    />
                ) : (
                    <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <Wrench size={40} className="text-slate-400" />
                    </div>
                )}
                
                <div className="flex-1 space-y-3">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{service.nameVi}</h2>
                        {service.nameEn && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 italic">{service.nameEn}</p>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            service.isActive 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                            {service.isActive ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {service.isActive ? 'Đang hoạt động' : 'Đang tắt'}
                        </span>
                        
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-semibold">
                            Sắp xếp: {service.sortOrder}
                        </span>
                        
                        <span className="px-3 py-1 font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs">
                            /{service.slug}
                        </span>
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300">
                        <span className="font-semibold mr-2 text-slate-500">Mô tả ngắn:</span>
                        {service.descriptionVi || 'Chưa có mô tả'}
                    </div>
                </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-800 my-6"></div>

            {/* Content Details */}
            <div className="grid grid-cols-1 gap-6">
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                        Nội dung chi tiết
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-inner overflow-hidden">
                        {service.contentVi ? (
                            <div 
                                className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 dark:[&_*:not(a)]:!text-slate-300 dark:[&_*]:!bg-transparent prose-img:rounded-lg prose-img:max-w-full"
                                dangerouslySetInnerHTML={{ __html: service.contentVi.replace(/\\r\\n|rnrn/g, '<br/>').replace(/>\s*rn\s*</g, '><').replace(/\brn\b/g, '') }}
                            />
                        ) : (
                            <p className="text-sm text-slate-400 italic">Chưa có nội dung chuyên sâu</p>
                        )}
                    </div>
                </div>

                {service.seoTitle && (
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                            SEO Meta Data
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 text-sm">
                            <div className="mb-2">
                                <span className="font-semibold text-slate-500 w-24 inline-block">SEO Title:</span>
                                <span className="text-slate-800 dark:text-slate-200">{service.seoTitle}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-slate-500 w-24 inline-block align-top">SEO Desc:</span>
                                <span className="text-slate-800 dark:text-slate-200 inline-block w-[calc(100%-6rem)]">
                                    {service.seoDesc || <span className="text-slate-400 italic">Đang trống</span>}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="text-xs text-slate-400 dark:text-slate-500 flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span>Thời gian tạo: {formatDate(service.createdAt || new Date().toISOString())}</span>
                    <span>Cập nhật lần cuối: {formatDate(service.updatedAt || new Date().toISOString())}</span>
                </div>
            </div>
            
            <div className="h-10"></div>
        </div>
    );
};

export default ServiceDetail;
