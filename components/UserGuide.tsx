import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../routes/routes';
import {
    Book, Keyboard, Search, FileText, Users, Building2, Package,
    LayoutDashboard, CreditCard, BarChart3, Bot, ChevronRight,
    ChevronDown, Lightbulb, Zap, HelpCircle, Sparkles,
    Copy, Edit, Plus, Filter, ArrowRight, Play, Settings, CheckCircle2,
    Circle, Rocket, Phone, Mail, MessageCircle, X, ClipboardCheck,
    ArrowRightCircle, Clock, UserCheck, Scale, Send, FileCheck
} from 'lucide-react';

// ============================================
// USER GUIDE - Compact Collapsible Design
// ============================================

const UserGuide: React.FC = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
    const [expandedModule, setExpandedModule] = useState<string | null>('contracts');

    // Onboarding progress
    const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
        const saved = localStorage.getItem('cic-onboarding-progress');
        return saved ? JSON.parse(saved) : [];
    });

    const onboardingSteps = [
        { id: 'dashboard', label: 'Xem Dashboard', path: ROUTES.DASHBOARD },
        { id: 'contracts', label: 'Xem danh sách Hợp đồng', path: ROUTES.CONTRACTS },
        { id: 'create', label: 'Tạo hợp đồng đầu tiên', path: ROUTES.CONTRACT_NEW },
        { id: 'search', label: 'Thử tìm kiếm với Ctrl+K', action: 'search' },
        { id: 'personnel', label: 'Xem danh sách Nhân sự', path: ROUTES.PERSONNEL },
    ];

    const progress = Math.round((completedSteps.length / onboardingSteps.length) * 100);

    const markStepComplete = (stepId: string) => {
        if (!completedSteps.includes(stepId)) {
            const newSteps = [...completedSteps, stepId];
            setCompletedSteps(newSteps);
            localStorage.setItem('cic-onboarding-progress', JSON.stringify(newSteps));
        }
    };

    const handleStepClick = (step: typeof onboardingSteps[0]) => {
        markStepComplete(step.id);
        if (step.path) {
            navigate(step.path);
        } else if (step.action === 'search') {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        }
    };

    // Keyboard shortcut to show shortcuts modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                    e.preventDefault();
                    setShowShortcuts(true);
                }
            }
            if (e.key === 'Escape') {
                setShowShortcuts(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // FAQ data
    const faqs = [
        { id: 'create', q: 'Làm sao tạo hợp đồng mới?', a: 'Vào Hợp đồng → Nhấn "+ Tạo mới" hoặc dùng phím Alt+N.' },
        { id: 'edit', q: 'Làm sao sửa hợp đồng?', a: 'Mở chi tiết hợp đồng rồi nhấn nút "Chỉnh sửa".' },
        { id: 'copy', q: 'Làm sao copy mã hợp đồng?', a: 'Click trực tiếp vào mã hợp đồng (ví dụ: HD_001/...). Hệ thống tự copy vào clipboard.' },
        { id: 'search', q: 'Làm sao tìm hợp đồng nhanh?', a: 'Nhấn Ctrl+K để mở tìm kiếm toàn cục, gõ mã HĐ hoặc tên khách hàng.' },
        // CRM: Approval FAQ hidden — will be re-enabled in CRM module
        { id: 'export', q: 'Làm sao xuất Excel?', a: 'Ở danh sách hợp đồng, nhấn nút "Xuất Excel" ở góc phải.' },
    ];

    const filteredFaqs = searchQuery
        ? faqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
        : faqs;

    // Module guides data
    const moduleGuides: ModuleGuideData[] = [
        {
            id: 'contracts',
            title: 'Hợp đồng',
            icon: <FileText size={18} />,
            color: 'orange',
            path: ROUTES.CONTRACTS,
            guides: [
                { title: 'Tạo hợp đồng mới', steps: ['Nhấn "+ Tạo mới" hoặc Alt+N', 'Điền thông tin: Loại HĐ, Đơn vị, KH', 'Thêm sản phẩm/dịch vụ', 'Cài đặt lịch thu tiền', 'Lưu'] },
                { title: 'Sửa hợp đồng', steps: ['Mở chi tiết hợp đồng', 'Nhấn nút "Chỉnh sửa"', 'Cập nhật → Lưu'] },
                { title: 'Nhân bản hợp đồng', steps: ['Ở danh sách, nhấn icon 📋', 'Chỉnh sửa thông tin mới', 'Lưu như HĐ mới'] },
                { title: 'Lọc & Xuất Excel', steps: ['Dùng bộ lọc: Năm, Đơn vị, Trạng thái', 'Click tiêu đề cột để sắp xếp', 'Nhấn "Xuất Excel"'] },
            ],
            // CRM: Approval workflow hidden — will be re-enabled in CRM module
        },
        {
            id: 'dashboard',
            title: 'Dashboard',
            icon: <LayoutDashboard size={18} />,
            color: 'indigo',
            path: ROUTES.DASHBOARD,
            guides: [
                { title: 'Xem tổng quan KPI', steps: ['Mở Dashboard từ sidebar', 'Xem các thẻ KPI ở đầu trang', 'So sánh với cùng kỳ năm trước'] },
                { title: 'Lọc theo đơn vị/năm', steps: ['Chọn đơn vị từ dropdown', 'Chọn năm cần xem', 'Biểu đồ tự động cập nhật'] },
            ]
        },
        {
            id: 'payments',
            title: 'Thanh toán',
            icon: <CreditCard size={18} />,
            color: 'emerald',
            path: ROUTES.PAYMENTS,
            guides: [
                { title: 'Theo dõi thanh toán', steps: ['Vào module Thanh toán', 'Xem danh sách đợt thu/chi', 'Lọc theo trạng thái'] },
                { title: 'Ghi nhận tiền về', steps: ['Tìm đợt thanh toán cần ghi nhận', 'Nhấn nút "Ghi nhận"', 'Nhập số tiền thực nhận'] },
            ]
        },
        {
            id: 'personnel',
            title: 'Nhân sự',
            icon: <Users size={18} />,
            color: 'cyan',
            path: ROUTES.PERSONNEL,
            guides: [
                { title: 'Xem danh sách nhân viên', steps: ['Vào module Nhân sự', 'Tìm kiếm theo tên/mã NV', 'Lọc theo đơn vị, chức vụ'] },
                { title: 'Thêm nhân viên mới', steps: ['Nhấn "+ Thêm nhân viên"', 'Điền thông tin cá nhân', 'Chọn đơn vị, chức vụ, lưu'] },
            ]
        },
        {
            id: 'customers',
            title: 'Khách hàng',
            icon: <Building2 size={18} />,
            color: 'blue',
            path: ROUTES.CUSTOMERS,
            guides: [
                { title: 'Quản lý khách hàng', steps: ['Vào module Khách hàng', 'Tìm kiếm theo tên/MST', 'Click để xem lịch sử HĐ'] },
                { title: 'Thêm khách hàng mới', steps: ['Nhấn "+ Thêm khách hàng"', 'Điền tên, MST, địa chỉ', 'Lưu thông tin'] },
            ]
        },
        {
            id: 'products',
            title: 'Sản phẩm',
            icon: <Package size={18} />,
            color: 'rose',
            path: ROUTES.PRODUCTS,
            guides: [
                { title: 'Xem danh mục SP/DV', steps: ['Vào module Sản phẩm', 'Tìm kiếm theo tên/mã', 'Xem giá & đơn vị tính'] },
                { title: 'Thêm sản phẩm mới', steps: ['Nhấn "+ Thêm sản phẩm"', 'Điền tên, mã, giá', 'Chọn danh mục, lưu'] },
            ]
        },
        {
            id: 'ai',
            title: 'AI Assistant',
            icon: <Bot size={18} />,
            color: 'violet',
            path: ROUTES.AI_ASSISTANT,
            guides: [
                { title: 'Hỏi đáp với AI', steps: ['Vào module AI Assistant', 'Gõ câu hỏi vào ô chat', 'AI phân tích và trả lời'] },
                { title: 'Phân tích dữ liệu', steps: ['Yêu cầu AI tóm tắt báo cáo', 'Hỏi về xu hướng doanh thu', 'Nhận gợi ý hành động'] },
            ]
        },
        {
            id: 'analytics',
            title: 'Phân tích',
            icon: <BarChart3 size={18} />,
            color: 'purple',
            path: ROUTES.ANALYTICS,
            guides: [
                { title: 'Xem báo cáo', steps: ['Vào module Phân tích', 'Chọn loại báo cáo', 'Lọc theo thời gian/đơn vị'] },
                { title: 'Xuất báo cáo', steps: ['Chọn dữ liệu cần xuất', 'Nhấn "Xuất PDF/Excel"', 'Tải file về máy'] },
            ]
        },
    ];

    const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
        orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
        indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
        emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
        cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
        blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
        rose: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
        violet: { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
        purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center py-4">
                <div className="inline-flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg shadow-lg">
                        <Book size={24} className="text-white" />
                    </div>
                    <div className="text-left">
                        <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">Hướng dẫn sử dụng</h1>
                        <p className="text-xs text-slate-500">CIC ERP Contract v2.1</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative max-w-md mx-auto">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm hướng dẫn..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-2">
                <QuickBtn icon={<Play size={16} />} label="Tour" onClick={() => alert('🚧 Đang phát triển')} />
                <QuickBtn icon={<Keyboard size={16} />} label="Phím tắt" onClick={() => setShowShortcuts(true)} />
                <QuickBtn icon={<Search size={16} />} label="Ctrl+K" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))} />
                <QuickBtn icon={<Plus size={16} />} label="Tạo HĐ" onClick={() => navigate(ROUTES.CONTRACT_NEW)} />
            </div>

            {/* Onboarding Progress - Compact */}
            {progress < 100 && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Rocket size={16} className="text-indigo-500" /> Làm quen hệ thống
                        </span>
                        <span className="text-xs font-bold text-indigo-600">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {onboardingSteps.map((step) => (
                            <button
                                key={step.id}
                                onClick={() => handleStepClick(step)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${completedSteps.includes(step.id)
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                    }`}
                            >
                                {completedSteps.includes(step.id) ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                                {step.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Module Guides - Tab Layout */}
            <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Lightbulb size={16} className="text-amber-500" /> Hướng dẫn theo module
                </h3>

                {/* Tab Headers */}
                <div className="flex overflow-x-auto gap-1 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-thin">
                    {moduleGuides.map((module) => (
                        <button
                            key={module.id}
                            onClick={() => setExpandedModule(module.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap transition-all border-b-2 ${expandedModule === module.id
                                ? `${colorClasses[module.color].bg} ${colorClasses[module.color].text} border-current`
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            <span className={expandedModule === module.id ? '' : 'opacity-60'}>{module.icon}</span>
                            {module.title}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {moduleGuides.map((module) => (
                    expandedModule === module.id && (
                        <div key={module.id} className={`p-4 rounded-lg border ${colorClasses[module.color].border} bg-slate-50 dark:bg-slate-900/50`}>
                            {/* Workflow (if exists) */}
                            {module.workflow && (
                                <div className="mb-4 p-4 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/70 dark:to-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                                        <ClipboardCheck size={16} className={colorClasses[module.color].text} /> {module.workflow.title}
                                    </h5>
                                    {module.workflow.description && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{module.workflow.description}</p>
                                    )}

                                    {/* Flow Diagram */}
                                    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-white dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
                                        {module.workflow.steps.map((step, i) => (
                                            <React.Fragment key={i}>
                                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${colorClasses[module.color].bg} ${colorClasses[module.color].text}`}>
                                                    {step.icon}
                                                    <span>{step.status}</span>
                                                </div>
                                                {i < module.workflow!.steps.length - 1 && (
                                                    <ArrowRightCircle size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>

                                    {/* Detailed Steps Table */}
                                    <div className="space-y-2">
                                        {module.workflow.steps.map((step, i) => (
                                            <div key={i} className="flex items-start gap-3 p-2 bg-white dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
                                                <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClasses[module.color].bg} ${colorClasses[module.color].text}`}>
                                                    {step.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{step.status}</span>
                                                        {step.who && (
                                                            <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-medium">
                                                                👤 {step.who}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">{step.desc}</p>
                                                    {(step.action || step.condition) && (
                                                        <div className="flex flex-wrap gap-2 text-[10px]">
                                                            {step.action && (
                                                                <span className="text-emerald-600 dark:text-emerald-400">
                                                                    ▶ {step.action}
                                                                </span>
                                                            )}
                                                            {step.condition && (
                                                                <span className="text-amber-600 dark:text-amber-400">
                                                                    ⚡ {step.condition}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Guides Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {module.guides.map((guide, i) => (
                                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                        <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2">{guide.title}</h5>
                                        <ol className="space-y-1">
                                            {guide.steps.map((step, j) => (
                                                <li key={j} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                                                    <span className="bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 px-1 rounded text-[10px] font-bold">{j + 1}</span>
                                                    {step}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ))}
                            </div>

                            {/* Go to module button */}
                            <button
                                onClick={() => navigate(module.path)}
                                className={`w-full mt-3 py-2 rounded-lg text-xs font-bold transition-colors ${colorClasses[module.color].bg} ${colorClasses[module.color].text} hover:opacity-80`}
                            >
                                Đi đến {module.title} →
                            </button>
                        </div>
                    )
                ))}
            </div>

            {/* FAQ - Compact */}
            <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <HelpCircle size={16} className="text-rose-500" /> Câu hỏi thường gặp
                </h3>
                <div className="space-y-1">
                    {filteredFaqs.map(faq => (
                        <div key={faq.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <button
                                onClick













                                ={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                                className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{faq.q}</span>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedFaq === faq.id ? 'rotate-180' : ''}`} />
                            </button>
                            {expandedFaq === faq.id && (
                                <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-400">{faq.a}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tips - Compact */}
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                    <Sparkles size={14} /> Mẹo hay
                </h3>
                <ul className="grid grid-cols-2 gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <li>• <kbd className="px-1 bg-white dark:bg-slate-800 rounded">Alt+N</kbd> tạo HĐ mới</li>
                    <li>• <kbd className="px-1 bg-white dark:bg-slate-800 rounded">/</kbd> focus ô tìm kiếm</li>
                    <li>• Click <strong>mã HĐ</strong> để copy</li>
                    <li>• <kbd className="px-1 bg-white dark:bg-slate-800 rounded">?</kbd> xem phím tắt</li>
                    <li>• <kbd className="px-1 bg-white dark:bg-slate-800 rounded">G</kbd> → <kbd className="px-1 bg-white dark:bg-slate-800 rounded">D</kbd> đến Dashboard</li>
                    <li>• <kbd className="px-1 bg-white dark:bg-slate-800 rounded">G</kbd> → <kbd className="px-1 bg-white dark:bg-slate-800 rounded">C</kbd> đến Hợp đồng</li>
                </ul>
            </div>

            {/* Contact - Compact */}
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Phone size={14} className="text-green-500" /> Cần hỗ trợ?
                </span>
                <div className="flex gap-2">
                    <a href="tel:0123456789" className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:shadow transition-all">Hotline</a>
                    <a href="mailto:support@cic.vn" className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:shadow transition-all">Email</a>
                </div>
            </div>

            {/* Keyboard Shortcuts Modal */}
            {showShortcuts && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Keyboard size={18} className="text-indigo-500" /> Phím tắt
                            </h3>
                            <button onClick={() => setShowShortcuts(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <ShortcutRow keys={['Ctrl', 'K']} desc="Tìm kiếm toàn cục" />
                            <ShortcutRow keys={['Alt', 'N']} desc="Tạo hợp đồng mới" />
                            <ShortcutRow keys={['/']} desc="Focus ô tìm kiếm" />
                            <ShortcutRow keys={['?']} desc="Mở bảng phím tắt" />
                            <ShortcutRow keys={['Esc']} desc="Đóng modal/popup" />
                            <div className="border-t border-slate-100 dark:border-slate-800 my-2 pt-2">
                                <p className="text-xs font-bold text-slate-500 mb-2">Điều hướng (nhấn G rồi phím tiếp theo)</p>
                            </div>
                            <ShortcutRow keys={['G', 'D']} desc="Đi đến Dashboard" />
                            <ShortcutRow keys={['G', 'C']} desc="Đi đến Hợp đồng" />
                            <ShortcutRow keys={['G', 'P']} desc="Đi đến Nhân sự" />
                            <ShortcutRow keys={['G', 'H']} desc="Đi đến Hướng dẫn" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// Types
// ============================================
interface ModuleGuideData {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    path: string;
    guides: { title: string; steps: string[] }[];
    workflow?: {
        title: string;
        description?: string;
        steps: {
            status: string;
            desc: string;
            icon: React.ReactNode;
            who?: string;
            action?: string;
            condition?: string;
        }[];
    };
}

// ============================================
// Helper Components
// ============================================
const QuickBtn = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center gap-1 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 hover:shadow-md hover:scale-[1.02] transition-all"
    >
        <span className="text-indigo-500">{icon}</span>
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
    </button>
);

const ShortcutRow = ({ keys, desc }: { keys: string[]; desc: string }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
            {keys.map((key, i) => (
                <React.Fragment key={i}>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-xs font-mono">{key}</kbd>
                    {i < keys.length - 1 && <span className="text-slate-400 text-xs">+</span>}
                </React.Fragment>
            ))}
        </div>
        <span className="text-sm text-slate-600 dark:text-slate-400">{desc}</span>
    </div>
);

export default UserGuide;
