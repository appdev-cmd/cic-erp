// ============================================================
// Self-Service Portal — CIC ERP
// Cổng thông tin dành riêng cho User (Nhân viên)
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    User, CalendarDays, Clock, FileText, Settings,
    ChevronRight, MapPin, Briefcase, Mail, Phone, ExternalLink
} from 'lucide-react';

export const SelfServicePortal: React.FC = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'payslips' | 'assets'>('profile');

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
            {/* User Header Profile */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 border border-slate-200 dark:border-slate-800 relative shadow-sm">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 flex items-center justify-center font-black text-4xl text-slate-400 dark:text-slate-600 shadow-md">
                    {profile?.fullName?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">{profile?.fullName || 'Nhân viên mới'}</h1>
                    <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-4">{profile?.role || 'User'}</p>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5"><Mail size={16} /> {profile?.email}</span>
                        <span className="flex items-center gap-1.5"><Briefcase size={16} /> Vai trò hệ thống: {profile?.role}</span>
                        {profile?.unitCode && <span className="flex items-center gap-1.5"><MapPin size={16} /> {profile?.unitCode}</span>}
                    </div>
                </div>
                <button className="hidden md:flex absolute top-6 right-6 items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                    <Settings size={16} /> Chỉnh sửa
                </button>
            </div>

            {/* Quick Action Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickActionBtn icon={<CalendarDays size={24} />} title="Đơn phép" color="text-emerald-500 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-900/20" />
                <QuickActionBtn icon={<Clock size={24} />} title="Đăng ký OT" color="text-amber-500 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/20" />
                <QuickActionBtn icon={<FileText size={24} />} title="Phiếu lương" color="text-indigo-500 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-900/20" />
                <QuickActionBtn icon={<User size={24} />} title="KPI cá nhân" color="text-rose-500 dark:text-rose-400" bg="bg-rose-50 dark:bg-rose-900/20" />
            </div>

            {/* Tabs Content */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                    <button onClick={() => setActiveTab('profile')} className={`flex-1 flex justify-center py-4 text-sm font-bold border-b-2 transition ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Thông tin cá nhân</button>
                    <button onClick={() => setActiveTab('payslips')} className={`flex-1 flex justify-center py-4 text-sm font-bold border-b-2 transition ${activeTab === 'payslips' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Lịch sử nhận lương</button>
                    <button onClick={() => setActiveTab('assets')} className={`flex-1 flex justify-center py-4 text-sm font-bold border-b-2 transition ${activeTab === 'assets' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Tài sản cấp phát</button>
                </div>

                <div className="p-6">
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cập nhật hồ sơ (Demo)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Họ và Tên</label>
                                    <input type="text" readOnly value={profile?.fullName || ''} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mã Hệ Thống Nội Bộ</label>
                                    <input type="text" readOnly value={profile?.employeeId?.slice(0, 8) || 'NV---'} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CCCD / CMND</label>
                                    <input type="text" placeholder="Thêm CCCD..." className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">STK Ngân hàng</label>
                                    <input type="text" placeholder="Số tài khoản nhận lương" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                                </div>
                            </div>
                            <button className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm">Lưu cập nhật</button>
                        </div>
                    )}
                    {activeTab === 'payslips' && (
                        <div className="py-8 text-center">
                            <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">Không có phiếu lương</h3>
                            <p className="text-sm text-slate-500 mt-1">Chưa đến kỳ trả lương hoặc bạn chưa được nhận lương trên hệ thống mới.</p>
                        </div>
                    )}
                    {activeTab === 'assets' && (
                        <div className="py-8 text-center">
                            <Briefcase size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">Tài sản hiện tại trống</h3>
                            <p className="text-sm text-slate-500 mt-1">Bạn chưa được Cấp phát bất kỳ Laptop/Thiết bị nào do công ty quản lý.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const QuickActionBtn: React.FC<{ icon: React.ReactNode, title: string, color: string, bg: string }> = ({ icon, title, color, bg }) => (
    <button className={`group flex flex-col p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-900`}>
        <div className="flex justify-between items-start w-full">
            <div className={`p-3 rounded-xl ${bg} ${color}`}>{icon}</div>
            <ExternalLink size={16} className="text-slate-300 dark:text-slate-700 group-hover:text-indigo-400 transition" />
        </div>
        <div className="mt-4 text-left">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{title}</h4>
        </div>
    </button>
);
