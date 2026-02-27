import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, BarChart3, Brain, Smartphone, Shield, ArrowRight, Sun, Moon, Monitor } from 'lucide-react';
import CICLogo from './CICLogo';

/**
 * Modern Auth Component — Split-Screen Layout
 * 
 * Left: Hero panel with gradient + brand messaging (hidden on mobile)
 * Right: Clean login card with solid bg
 * 
 * Design: Professional Enterprise SaaS
 * Fully responsive, WCAG AA compliant contrast
 */
const Auth = () => {
    const [isLoading, setIsLoading] = useState(false);

    // Theme toggle (standalone, same key as MainLayout)
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('contract-pro-theme');
        if (saved === 'light' || saved === 'dark') return saved;
        if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('dark');
        if (theme === 'dark') root.classList.add('dark');
        // Also apply accent from saved preference
        root.classList.remove('accent-blue');
        const savedAccent = localStorage.getItem('contract-pro-accent');
        if (savedAccent === 'blue') root.classList.add('accent-blue');
        localStorage.setItem('contract-pro-theme', theme);
    }, [theme]);

    const cycleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const themeIcon = theme === 'light' ? <Moon size={18} /> : <Sun size={18} />;
    const themeLabel = theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng';

    const handleGoogleLogin = async () => {
        try {
            setIsLoading(true);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    scopes: 'https://www.googleapis.com/auth/drive.file',
                    queryParams: {
                        prompt: 'consent',       // Force re-consent to get new scope
                        access_type: 'offline',   // Request refresh token
                        hd: 'cic.com.vn',        // Restrict to CIC Google Workspace domain
                    },
                },
            });
            if (error) throw error;
        } catch (error: any) {
            alert('Error logging in: ' + error.message);
            setIsLoading(false);
        }
    };

    const features = [
        {
            icon: <BarChart3 size={22} />,
            title: 'Biểu đồ trực quan',
            desc: 'Dashboard phân tích doanh thu, lợi nhuận theo thời gian thực',
        },
        {
            icon: <Brain size={22} />,
            title: 'AI phân tích thông minh',
            desc: 'Tự động phát hiện xu hướng và đề xuất chiến lược kinh doanh',
        },
        {
            icon: <Smartphone size={22} />,
            title: 'Đa nền tảng',
            desc: 'Truy cập mọi lúc trên desktop, tablet và điện thoại',
        },
        {
            icon: <Shield size={22} />,
            title: 'Bảo mật doanh nghiệp',
            desc: 'Phân quyền chi tiết, kiểm soát truy cập theo vai trò',
        },
    ];

    return (
        <div className="min-h-screen flex">
            {/* ===== LEFT: Hero Panel ===== */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950">
                {/* Geometric decorations — CSS only */}
                <div className="absolute inset-0">
                    {/* Large circle */}
                    <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full border border-white/5" />
                    <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full border border-white/10" />

                    {/* Bottom circle */}
                    <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full border border-orange-500/10" />
                    <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border border-orange-500/5" />

                    {/* Grid dots pattern */}
                    <div className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
                            backgroundSize: '32px 32px'
                        }}
                    />

                    {/* Gradient overlay for depth */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/20" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
                    {/* Top: Logo */}
                    <div>
                        <CICLogo size="lg" variant="full" className="[&_span]:!text-white [&_span]:!text-slate-300" />
                    </div>

                    {/* Middle: Brand messaging */}
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight">
                                Quản trị<br />
                                <span className="text-orange-400">thông minh.</span>
                            </h1>
                            <p className="text-xl text-slate-300 mt-3 font-medium">
                                Tối ưu lợi nhuận, kiểm soát doanh thu.
                            </p>
                        </div>

                        {/* Feature highlights */}
                        <div className="space-y-4">
                            {features.map((feat, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-4 p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/5 hover:bg-white/10 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 flex-shrink-0 group-hover:bg-orange-500/30 transition-colors">
                                        {feat.icon}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">{feat.title}</p>
                                        <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{feat.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom: Stats or branding */}
                    <div className="flex items-center gap-6 text-slate-500 text-xs font-medium">
                        <span>Phiên bản 2.5</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span>Bảo mật SSL 256-bit</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span>99.9% Uptime</span>
                    </div>
                </div>
            </div>

            {/* ===== RIGHT: Login Form ===== */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-8 bg-white dark:bg-slate-950 relative">
                {/* Theme toggle */}
                <button
                    onClick={cycleTheme}
                    className="absolute top-4 right-4 lg:top-6 lg:right-6 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all z-10"
                    title={themeLabel}
                >
                    {themeIcon}
                </button>
                {/* Mobile: Mini brand banner at top */}
                <div className="absolute top-0 left-0 right-0 lg:hidden">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-orange-950 px-6 py-4 flex items-center justify-between">
                        <CICLogo size="sm" variant="full" className="[&_span]:!text-white [&_span]:!text-slate-300" />
                        <span className="text-xs text-slate-400 font-medium">v2.5</span>
                    </div>
                </div>

                <div className="w-full max-w-sm mt-16 lg:mt-0">
                    {/* Logo — Desktop only (sidebar logo shown on mobile banner) */}
                    <div className="hidden lg:block text-center mb-10">
                        <div className="flex justify-center mb-4">
                            <CICLogo size="xl" variant="compact" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            CIC ERP
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                            Quản trị Hợp đồng & Doanh thu
                        </p>
                    </div>

                    {/* Mobile: Title */}
                    <div className="lg:hidden text-center mb-8">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            Đăng nhập
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                            Quản trị Hợp đồng & Doanh thu
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-4 bg-white dark:bg-slate-950 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                                Đăng nhập
                            </span>
                        </div>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 
                                   bg-white dark:bg-slate-800 
                                   border border-slate-200 dark:border-slate-800 
                                   hover:bg-slate-50 dark:hover:bg-slate-700 
                                   hover:border-slate-300 dark:hover:border-slate-600
                                   hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50
                                   text-slate-700 dark:text-slate-200 
                                   font-semibold py-4 px-6 rounded-lg 
                                   transition-all duration-300 
                                   hover:scale-[1.01] active:scale-[0.99] 
                                   disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                                   group"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin text-orange-500" size={22} />
                        ) : (
                            <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="Google"
                                className="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
                            />
                        )}
                        <span className="text-sm">
                            {isLoading ? 'Đang kết nối...' : 'Đăng nhập với Google'}
                        </span>
                        {!isLoading && (
                            <ArrowRight size={16} className="text-slate-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                        )}
                    </button>

                    {/* Footer Text */}
                    <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Bằng việc đăng nhập, bạn đồng ý với{' '}
                        <span className="text-orange-600 dark:text-orange-400 hover:underline cursor-pointer font-semibold">
                            Quy định bảo mật
                        </span>{' '}
                        và{' '}
                        <span className="text-orange-600 dark:text-orange-400 hover:underline cursor-pointer font-semibold">
                            Điều khoản sử dụng
                        </span>{' '}
                        của hệ thống CIC.
                    </p>

                    {/* Bottom Branding */}
                    <div className="mt-10 text-center">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            © 2025 CIC Corporation. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
