// CustomerDetail — Profile Card (Header gradient + Company Info + Contact + Bank)
import React from 'react';
import {
    Building2, Mail, Phone, MapPin, Globe, Hash, User, Star,
    CreditCard, Calendar, CheckCircle, FileText, Banknote
} from 'lucide-react';
import { Customer, Contract } from '../../types';

interface CustomerProfileCardProps {
    customer: Customer;
    contractCount: number;
    getIndustryColor: (industry: string) => string;
    getRatingColor: (rating?: string) => string;
}

const CustomerProfileCard: React.FC<CustomerProfileCardProps> = React.memo(({
    customer, contractCount, getIndustryColor, getRatingColor
}) => (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header gradient */}
        <div className="h-28 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 relative">
            {customer.rating && customer.rating !== 'Standard' && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white">
                    <Star size={16} />
                    <span className="font-bold text-sm">{customer.rating}</span>
                </div>
            )}
        </div>

        {/* Profile content */}
        <div className="px-6 py-5">
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Logo/Avatar */}
                <div className="w-20 h-20 -mt-14 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-black text-xl shadow-xl border-4 border-white dark:border-slate-900 flex-shrink-0 relative z-10">
                    {(customer.shortName || customer.name || '?').substring(0, 3)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                                {customer.name}
                            </h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                {customer.shortName}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {(Array.isArray(customer.industry) ? customer.industry : [customer.industry]).filter(Boolean).map((ind: string) => (
                                <span key={ind} className={`px-3 py-1 rounded-lg text-xs font-bold ${getIndustryColor(ind)}`}>
                                    {ind}
                                </span>
                            ))}
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                <FileText size={12} />
                                {contractCount} hợp đồng
                            </span>
                            {customer.rating && (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${getRatingColor(customer.rating)}`}>
                                    <Star size={12} />
                                    {customer.rating}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contact & Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                        {customer.taxCode && (
                            <div className="flex items-center gap-2 text-sm">
                                <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg"><Hash size={14} className="text-slate-500" /></div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">MST</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">{customer.taxCode}</p>
                                </div>
                            </div>
                        )}
                        {customer.contactPerson && (
                            <div className="flex items-center gap-2 text-sm">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><User size={14} className="text-purple-500" /></div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Liên hệ</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">{customer.contactPerson}</p>
                                </div>
                            </div>
                        )}
                        {customer.email && (
                            <div className="flex items-center gap-2 text-sm">
                                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Mail size={14} className="text-blue-500" /></div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Email</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{customer.email}</p>
                                </div>
                            </div>
                        )}
                        {customer.phone && (
                            <div className="flex items-center gap-2 text-sm">
                                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><Phone size={14} className="text-emerald-500" /></div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">SĐT</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">{customer.phone}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Address & Website */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                        {customer.address && (
                            <div className="flex items-start gap-2 text-sm">
                                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg mt-0.5"><MapPin size={14} className="text-amber-500" /></div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Địa chỉ</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">{customer.address}</p>
                                </div>
                            </div>
                        )}
                        {customer.website && (
                            <div className="flex items-center gap-2 text-sm">
                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg"><Globe size={14} className="text-indigo-500" /></div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Website</p>
                                    <a href={`https://${customer.website}`} target="_blank" rel="noopener noreferrer"
                                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                        {customer.website}
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Extended Info */}
                    {(customer.representative || customer.internationalName || customer.businessType || customer.businessStatus || customer.foundedDate) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            {customer.representative && (
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg"><User size={14} className="text-violet-500" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Người đại diện</p>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">{customer.representative}</p>
                                    </div>
                                </div>
                            )}
                            {customer.internationalName && (
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-lg"><Globe size={14} className="text-sky-500" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Tên quốc tế</p>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">{customer.internationalName}</p>
                                    </div>
                                </div>
                            )}
                            {customer.businessType && (
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="p-1.5 bg-teal-100 dark:bg-teal-900/30 rounded-lg"><Building2 size={14} className="text-teal-500" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Loại hình DN</p>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">{customer.businessType}</p>
                                    </div>
                                </div>
                            )}
                            {customer.businessStatus && (
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><CheckCircle size={14} className="text-emerald-500" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Tình trạng</p>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">{customer.businessStatus}</p>
                                    </div>
                                </div>
                            )}
                            {customer.foundedDate && (
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg"><Calendar size={14} className="text-orange-500" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Ngày hoạt động</p>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">
                                            {new Date(customer.foundedDate).toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bank Info */}
                    {(customer.bankName || customer.bankAccount) && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            {customer.bankName && (
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg"><Banknote size={14} className="text-cyan-500" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Ngân hàng</p>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">{customer.bankName}</p>
                                    </div>
                                </div>
                            )}
                            {customer.bankBranch && (
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg"><MapPin size={14} className="text-cyan-500" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Chi nhánh</p>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">{customer.bankBranch}</p>
                                    </div>
                                </div>
                            )}
                            {customer.bankAccount && (
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg"><CreditCard size={14} className="text-cyan-500" /></div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Số TK</p>
                                        <p className="font-medium text-slate-700 dark:text-slate-300">{customer.bankAccount}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
));

CustomerProfileCard.displayName = 'CustomerProfileCard';
export default CustomerProfileCard;
