// CustomerDetail — Overview Tab
import React from 'react';
import {
    Phone, Mail, Users, Plus, Target, CreditCard,
    TrendingUp, BarChart3, StickyNote
} from 'lucide-react';
import { Customer } from '../../types';

interface CustomerOverviewTabProps {
    customer: Customer;
    stats: {
        totalValue: number;
        totalRevenue: number;
        avgContractValue: number;
        completedContracts: number;
    };
    paymentStats: { pendingAmount: number; count: number };
    revenueRate: number;
    formatCurrency: (val: number) => string;
    setActiveTab: (tab: 'overview' | 'contacts' | 'contracts' | 'payments' | 'notes') => void;
}

const CustomerOverviewTab: React.FC<CustomerOverviewTabProps> = React.memo(({
    customer, stats, paymentStats, revenueRate, formatCurrency, setActiveTab
}) => (
    <div className="space-y-5">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
            {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                    <Phone size={14} />Gọi điện
                </a>
            )}
            {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                    <Mail size={14} />Gửi email
                </a>
            )}
            <button onClick={() => setActiveTab('contacts')} className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-bold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                <Users size={14} />Danh bạ
            </button>
            <button onClick={() => setActiveTab('contracts')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                <Plus size={14} />Xem HĐ
            </button>
        </div>

        {/* Revenue Progress */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                    <BarChart3 size={13} />Tỷ lệ thu hồi doanh thu
                </h3>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{revenueRate.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${revenueRate}%` }}
                />
            </div>
            <div className="flex justify-between mt-2 text-[11px] text-slate-500">
                <span>Doanh thu: {formatCurrency(stats.totalRevenue)}</span>
                <span>Giá trị HĐ: {formatCurrency(stats.totalValue)}</span>
            </div>
        </div>

        {/* CRM Info */}
        {(customer.source || customer.paymentTerms || (customer.creditLimit && customer.creditLimit > 0)) && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Target size={13} />CRM
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {customer.source && (
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Nguồn KH</p>
                            <p className="font-medium text-sm text-slate-700 dark:text-slate-300 mt-0.5">{customer.source}</p>
                        </div>
                    )}
                    {customer.paymentTerms && (
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Điều khoản TT</p>
                            <p className="font-medium text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                                <CreditCard size={12} className="inline mr-1 text-slate-400" />
                                {customer.paymentTerms}
                            </p>
                        </div>
                    )}
                    {customer.creditLimit !== undefined && customer.creditLimit > 0 && (
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Hạn mức TD</p>
                            <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(customer.creditLimit)}</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Customer Health Indicators */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <TrendingUp size={13} />Chỉ số khách hàng
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <p className="text-[10px] text-slate-400 uppercase">Giá trị TB/HĐ</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(stats.avgContractValue)}</p>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase">HĐ hoàn thành</p>
                    <p className="font-bold text-sm text-blue-600 dark:text-blue-400 mt-0.5">{stats.completedContracts}</p>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase">Công nợ</p>
                    <p className={`font-bold text-sm mt-0.5 ${paymentStats.pendingAmount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {paymentStats.pendingAmount > 0 ? formatCurrency(paymentStats.pendingAmount) : 'Không có'}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 uppercase">Thanh toán</p>
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">{paymentStats.count} lần</p>
                </div>
            </div>
        </div>

        {/* Notes Preview */}
        {customer.notes && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                        <StickyNote size={13} />Ghi chú
                    </h3>
                    <button onClick={() => setActiveTab('notes')} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                        Chỉnh sửa →
                    </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{customer.notes}</p>
            </div>
        )}
    </div>
));

CustomerOverviewTab.displayName = 'CustomerOverviewTab';
export default CustomerOverviewTab;
