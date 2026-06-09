import React from 'react';
import { Check, X } from 'lucide-react';
import { ContractReview } from '../../types';

interface Props {
    reviews: any[]; // Using any matching the structure from supabase join, or extended ContractReview
}

export const ReviewLog: React.FC<Props> = ({ reviews }) => {
    return (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
            <h5 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-slate-400 rounded-full"></span> Lịch sử Xử lý
            </h5>

            {reviews.length === 0 ? (
                <p className="text-sm text-slate-400 italic pl-4">Chưa có lịch sử phê duyệt.</p>
            ) : (
                <div className="space-y-4">
                    {reviews.map((rv, i) => (
                        <div key={i} className="flex gap-4 relative pl-4 opacity-90 hover:opacity-100 transition-opacity">
                            {/* Timeline Line */}
                            {i < reviews.length - 1 && (
                                <div className="absolute left-[20px] top-6 bottom-[-20px] w-[2px] bg-slate-200 dark:bg-slate-700"></div>
                            )}

                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border z-10 shadow-sm ${rv.action === 'Approve' || rv.action === 'Submit'
                                    ? 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                                    : rv.action === 'Reject'
                                        ? 'bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}>
                                {rv.action === 'Reject' ? <X size={14} /> : <Check size={14} />}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                        {rv.reviewer_profile?.full_name || 'Người dùng'}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${rv.action === 'Approve' || rv.action === 'Submit'
                                            ? 'bg-emerald-50 text-emerald-600'
                                            : 'bg-rose-50 text-rose-600'
                                        }`}>
                                        {rv.action}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                    {rv.comment}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {new Date(rv.created_at).toLocaleString('vi-VN')}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
