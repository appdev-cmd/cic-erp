import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layout Component
import MainLayout from '../components/layout/MainLayout';

// Re-export ROUTES for backward compatibility
export { ROUTES } from './routes';

// Lazy-loaded Page Components (Code Splitting)
import {
    LazyDashboardPage as DashboardPage,
    LazyContractListPage as ContractListPage,
    LazyContractDetailPage as ContractDetailPage,
    LazyContractFormPage as ContractFormPage,
    LazyPaymentListPage as PaymentListPage,
    LazyAnalyticsPage as AnalyticsPage,
    LazyAIAssistantPage as AIAssistantPage,
    LazyPersonnelListPage as PersonnelListPage,
    LazyPersonnelDetailPage as PersonnelDetailPage,
    LazyCustomerListPage as CustomerListPage,
    LazyCustomerDetailPage as CustomerDetailPage,
    LazyProductListPage as ProductListPage,
    LazyProductDetailPage as ProductDetailPage,
    LazyUnitListPage as UnitListPage,
    LazyUnitDetailPage as UnitDetailPage,
    LazySettingsPage as SettingsPage,
    LazyUserGuidePage as UserGuidePage,
    LazyDocumentManagerPage as DocumentManagerPage,
    LazyToolsPage as ToolsPage,
    LazyChatPage as ChatPage,
    LazyTasksPage as TasksPage,
    LazyReportListPage as ReportListPage,
    LazyReportViewerPage as ReportViewerPage,
    LazyProjectListPage as ProjectListPage,
    LazyProjectDetailPage as ProjectDetailPage,
    LazyHRMPage as HRMPage,
    LazyRecruitmentPage as RecruitmentPage,
    LazyLeavePage as LeavePage,
    LazyRequestsPage as RequestsPage,
    LazyAgentManagerPage as AgentManagerPage,
    LazyPublicApplicationForm as PublicApplicationForm,
} from '../components/LazyPages';

// ═══════════════════════════════════════════════════════════════════════
// Route Configuration
// 
// QUAN TRỌNG: Bảo vệ phân quyền được xử lý TẬP TRUNG bởi RouteGuard
// trong MainLayout.tsx (sử dụng config từ routePermissions.ts).
// KHÔNG CẦN bọc RequirePermission thủ công ở đây nữa.
//
// Khi thêm route mới: chỉ cần thêm entry vào routePermissions.ts
// (hoặc PUBLIC_ROUTES nếu không cần quyền).
// Nếu quên → route sẽ bị TỰ ĐỘNG CHẶN (deny by default).
// ═══════════════════════════════════════════════════════════════════════

export const router = createBrowserRouter([
    // ════ PUBLIC ROUTES ════
    {
        path: '/jobs/:id/apply',
        element: <PublicApplicationForm />,
    },
    // ════ PRIVATE ROUTES ════
    {
        path: '/',
        element: <MainLayout />,
        children: [
            // Dashboard - Home
            { index: true, element: <DashboardPage /> },
            { path: 'dashboard', element: <Navigate to="/" replace /> },

            // Contracts
            { path: 'contracts', element: <ContractListPage /> },
            { path: 'contracts/new', element: <ContractFormPage /> },
            { path: 'contracts/:id/edit', element: <ContractFormPage /> },
            { path: 'contracts/:id', element: <ContractDetailPage /> },
            { path: 'contracts/:id/:subId', element: <ContractDetailPage /> },

            // Payments
            { path: 'payments', element: <PaymentListPage /> },

            // Analytics
            { path: 'analytics', element: <AnalyticsPage /> },

            // Documents
            { path: 'documents', element: <DocumentManagerPage /> },

            // Reports
            { path: 'reports', element: <ReportListPage /> },
            { path: 'reports/:id', element: <ReportViewerPage /> },

            // AI Assistant (Rendered globally in MainLayout to persist state, dummy route here to prevent 404)
            { path: 'ai-assistant', element: null },

            // Agent Manager
            { path: 'agent-manager', element: <AgentManagerPage /> },

            // Tools
            { path: 'tools/*', element: <ToolsPage /> },

            // Chat
            { path: 'chat', element: <ChatPage /> },

            // Personnel
            { path: 'personnel', element: <PersonnelListPage /> },
            { path: 'personnel/:id', element: <PersonnelDetailPage /> },

            // Customers
            { path: 'customers', element: <CustomerListPage /> },
            { path: 'customers/:id', element: <CustomerDetailPage /> },

            // Products
            { path: 'products', element: <ProductListPage /> },
            { path: 'products/:id', element: <ProductDetailPage /> },

            // Units
            { path: 'units', element: <UnitListPage /> },
            { path: 'units/:id', element: <UnitDetailPage /> },

            // Tasks
            { path: 'tasks', element: <TasksPage /> },

            // Projects (BIM)
            { path: 'projects', element: <ProjectListPage /> },
            { path: 'projects/:id', element: <ProjectDetailPage /> },

            // HRM
            { path: 'hrm', element: <HRMPage /> },
            { path: 'hrm/recruitment', element: <RecruitmentPage /> },
            { path: 'hrm/leave', element: <LeavePage /> },
            { path: 'hrm/requests', element: <RequestsPage /> },

            // Settings
            { path: 'settings', element: <SettingsPage /> },

            // User Guide
            { path: 'user-guide', element: <UserGuidePage /> },

            // 404 Fallback
            { path: '*', element: <Navigate to="/" replace /> },
        ],
    },
]);
