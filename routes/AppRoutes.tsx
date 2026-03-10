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
    LazyTaskListPage as TaskListPage,
    LazyMyTasksPage as MyTasksPage,
} from '../components/LazyPages';

// Route Configuration
export const router = createBrowserRouter([
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
            { path: 'contracts/:id', element: <ContractDetailPage /> },
            { path: 'contracts/:id/edit', element: <ContractFormPage /> },

            // Payments
            { path: 'payments', element: <PaymentListPage /> },

            // Analytics
            { path: 'analytics', element: <AnalyticsPage /> },

            // Documents
            { path: 'documents', element: <DocumentManagerPage /> },

            // AI Assistant
            { path: 'ai-assistant', element: <AIAssistantPage /> },

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

            // Settings
            { path: 'settings', element: <SettingsPage /> },

            // User Guide
            { path: 'user-guide', element: <UserGuidePage /> },

            // Tasks — visibility controlled by sidebar permissions (email whitelist)
            { path: 'tasks', element: <TaskListPage /> },
            { path: 'tasks/:id', element: <TaskListPage /> },
            { path: 'my-tasks', element: <MyTasksPage /> },

            // 404 Fallback
            { path: '*', element: <Navigate to="/" replace /> },
        ],
    },
]);
