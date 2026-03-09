// Lazy-loaded page components for code splitting
// This reduces initial bundle size by loading components on demand

import React, { Suspense, lazy } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLayoutContext } from './layout/MainLayout';
import { ROUTES } from '../routes/routes';
import {
    DashboardSkeleton,
    ListPageSkeleton,
    DetailPageSkeleton,
    FormPageSkeleton,
    AnalyticsSkeleton,
} from './ui/PageSkeletons';

// Helper: retry dynamic import with auto-reload on chunk load failure
// After a new Vercel deployment, old chunk files are deleted.
// If a user has a stale tab open, lazy imports will fail with
// "Failed to fetch dynamically imported module". This helper
// auto-reloads the page ONCE to fetch the new HTML with correct chunk refs.
function lazyWithRetry<T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>
) {
    return lazy(() =>
        importFn().catch((error: Error) => {
            const isChunkError =
                error.message.includes('Failed to fetch dynamically imported module') ||
                error.message.includes('Importing a module script failed') ||
                error.message.includes('error loading dynamically imported module');

            const RELOAD_KEY = 'chunk_reload_ts';
            const lastReload = sessionStorage.getItem(RELOAD_KEY);
            const now = Date.now();

            // Only auto-reload once per 30 seconds to prevent infinite loops
            if (isChunkError && (!lastReload || now - Number(lastReload) > 30_000)) {
                sessionStorage.setItem(RELOAD_KEY, String(now));
                window.location.reload();
                // Return a never-resolving promise so React doesn't try to render
                return new Promise(() => { });
            }

            // If not a chunk error or already reloaded, re-throw
            throw error;
        })
    );
}

// Lazy load heavy components (with auto-retry on chunk failure)
const Dashboard = lazyWithRetry(() => import('./Dashboard'));
const ContractList = lazyWithRetry(() => import('./ContractList'));
const ContractDetail = lazyWithRetry(() => import('./ContractDetail'));
const ContractForm = lazyWithRetry(() => import('./ContractForm'));
const PaymentList = lazyWithRetry(() => import('./PaymentList'));
const Analytics = lazyWithRetry(() => import('./Analytics'));
const AIAssistant = lazyWithRetry(() => import('./AIAssistant'));
const PersonnelList = lazyWithRetry(() => import('./PersonnelList'));
const PersonnelDetail = lazyWithRetry(() => import('./PersonnelDetail'));
const CustomerList = lazyWithRetry(() => import('./CustomerList'));
const CustomerDetail = lazyWithRetry(() => import('./CustomerDetail'));
const ProductList = lazyWithRetry(() => import('./ProductList'));
const ProductDetail = lazyWithRetry(() => import('./ProductDetail'));
const UnitList = lazyWithRetry(() => import('./UnitList'));
const UnitDetail = lazyWithRetry(() => import('./UnitDetail'));
const Settings = lazyWithRetry(() => import('./Settings'));
const UserGuide = lazyWithRetry(() => import('./UserGuide'));
const DocumentManager = lazyWithRetry(() => import('./DocumentManager'));
const ToolsPage = lazyWithRetry(() => import('./ToolsPage'));
const ChatPageComponent = lazyWithRetry(() => import('./chat/ChatPage'));
const TaskListPage = lazyWithRetry(() => import('./tasks/TaskList'));
const MyTasksPage = lazyWithRetry(() => import('./tasks/MyTasks'));

// Helper wrapper for Suspense with custom fallback
const withSuspense = (Component: React.ReactNode, fallback?: React.ReactNode) => (
    <Suspense fallback={fallback || <ListPageSkeleton />}>
        {Component}
    </Suspense>
);

// ========================================
// LAZY PAGE EXPORTS
// ========================================

// Dashboard
export const LazyDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedUnit, setSelectedUnit, yearFilter } = useLayoutContext();
    return withSuspense(
        <Dashboard
            selectedUnit={selectedUnit}
            onSelectUnit={setSelectedUnit}
            onSelectContract={(id) => navigate(ROUTES.CONTRACT_DETAIL(id))}
            yearFilter={yearFilter}
        />,
        <DashboardSkeleton />
    );
};

// Contract List
export const LazyContractListPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedUnit } = useLayoutContext();
    return withSuspense(
        <ContractList
            selectedUnit={selectedUnit}
            onSelectContract={(id) => navigate(ROUTES.CONTRACT_DETAIL(encodeURIComponent(id)))}
            onAdd={() => navigate(ROUTES.CONTRACT_NEW)}
            onClone={(contract) => navigate(ROUTES.CONTRACT_NEW, { state: { cloneFrom: contract } })}
            onEdit={(id) => navigate(ROUTES.CONTRACT_EDIT(encodeURIComponent(id)))}  // Quick edit
        />,
        <ListPageSkeleton />
    );
};

// Contract Detail
export const LazyContractDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id: rawId } = useParams<{ id: string }>();
    const id = rawId ? decodeURIComponent(rawId) : undefined;
    if (!id) return <div>Contract not found</div>;
    return withSuspense(
        <ContractDetail
            contractId={id}
            onBack={() => navigate(ROUTES.CONTRACTS)}
            onEdit={() => navigate(ROUTES.CONTRACT_EDIT(encodeURIComponent(id)))}
            onDelete={async () => {
                try {
                    await ContractService.delete(id);
                    toast.success('Đã xóa hợp đồng thành công!');
                    navigate(ROUTES.CONTRACTS);
                } catch (e: any) {
                    toast.error('Lỗi xóa hợp đồng: ' + (e.message || e));
                }
            }}
        />,
        <DetailPageSkeleton />
    );
};

// Contract Form
import { ContractService } from '../services';
import { toast } from 'sonner';
import { Contract } from '../types';
export const LazyContractFormPage: React.FC = () => {
    const navigate = useNavigate();
    const { id: rawId } = useParams<{ id: string }>();
    const id = rawId ? decodeURIComponent(rawId) : undefined;
    const location = useLocation();
    const cloneFrom = location.state?.cloneFrom;

    // State for editing mode - fetch contract from DB
    const [editingContract, setEditingContract] = React.useState<Contract | null>(null);
    const [isLoading, setIsLoading] = React.useState(!!id && !cloneFrom);

    // Fetch contract when editing (id exists and not cloning)
    React.useEffect(() => {
        if (id && !cloneFrom) {
            setIsLoading(true);
            ContractService.getById(id)
                .then(contract => {
                    if (contract) {
                        setEditingContract(contract);
                    } else {
                        toast.error('Không tìm thấy hợp đồng');
                        navigate(ROUTES.CONTRACTS);
                    }
                })
                .catch(err => {
                    console.error('Failed to fetch contract:', err);
                    toast.error('Lỗi tải dữ liệu hợp đồng');
                    navigate(ROUTES.CONTRACTS);
                })
                .finally(() => setIsLoading(false));
        }
    }, [id, cloneFrom, navigate]);

    // Show loading while fetching
    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-600 dark:text-slate-300 font-medium">Đang tải dữ liệu hợp đồng...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
            {withSuspense(
                <ContractForm
                    contract={cloneFrom || editingContract || undefined}
                    isCloning={!!cloneFrom}
                    onSave={async (data) => {
                        try {
                            if (id && !cloneFrom) {
                                await ContractService.update(id, data);
                                toast.success("Cập nhật hợp đồng thành công!");
                                navigate(ROUTES.CONTRACT_DETAIL(encodeURIComponent(id)));
                            } else {
                                const newContract = await ContractService.create(data);
                                toast.success(cloneFrom ? "Nhân bản hợp đồng thành công!" : "Tạo hợp đồng thành công!");
                                if (newContract?.id) {
                                    navigate(ROUTES.CONTRACT_DETAIL(encodeURIComponent(newContract.id)));
                                } else {
                                    navigate(ROUTES.CONTRACTS);
                                }
                            }
                        } catch (e: any) {
                            toast.error("Lỗi: " + (e.message || e));
                        }
                    }}
                    onCancel={() => navigate(-1)}
                />,
                <FormPageSkeleton />
            )}
        </div>
    );
};

// Payment List
export const LazyPaymentListPage: React.FC = () => {
    const navigate = useNavigate();
    return withSuspense(
        <PaymentList onSelectContract={(id) => navigate(ROUTES.CONTRACT_DETAIL(id))} />
    );
};

// Analytics
export const LazyAnalyticsPage: React.FC = () => {
    const { selectedUnit, setSelectedUnit } = useLayoutContext();
    return withSuspense(
        <Analytics selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} />,
        <AnalyticsSkeleton />
    );
};

// AI Assistant
export const LazyAIAssistantPage: React.FC = () => withSuspense(<AIAssistant />);

// Personnel List
export const LazyPersonnelListPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedUnit } = useLayoutContext();
    return withSuspense(
        <PersonnelList
            selectedUnit={selectedUnit}
            onSelectPersonnel={(id) => navigate(ROUTES.PERSONNEL_DETAIL(id))}
        />
    );
};

// Personnel Detail
export const LazyPersonnelDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    if (!id) return <div>Personnel not found</div>;
    return withSuspense(
        <PersonnelDetail
            personnelId={id}
            onBack={() => navigate(ROUTES.PERSONNEL)}
            onViewContract={(contractId) => navigate(ROUTES.CONTRACT_DETAIL(contractId))}
        />,
        <DetailPageSkeleton />
    );
};

// Customer List
export const LazyCustomerListPage: React.FC = () => {
    const navigate = useNavigate();
    return withSuspense(
        <CustomerList
            onSelectCustomer={(id) => navigate(ROUTES.CUSTOMER_DETAIL(id))}
            onSelectProduct={(id) => navigate(ROUTES.PRODUCT_DETAIL(id))}
        />
    );
};

// Customer Detail
export const LazyCustomerDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    if (!id) return <div>Customer not found</div>;
    return withSuspense(
        <CustomerDetail
            customerId={id}
            onBack={() => navigate(ROUTES.CUSTOMERS)}
            onViewContract={(contractId) => navigate(ROUTES.CONTRACT_DETAIL(contractId))}
        />,
        <DetailPageSkeleton />
    );
};

// Product List
export const LazyProductListPage: React.FC = () => {
    const navigate = useNavigate();
    return withSuspense(
        <ProductList onSelectProduct={(id) => navigate(ROUTES.PRODUCT_DETAIL(id))} />
    );
};

// Product Detail
export const LazyProductDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    if (!id) return <div>Product not found</div>;
    return withSuspense(
        <ProductDetail
            productId={id}
            onBack={() => navigate(ROUTES.PRODUCTS)}
            onViewContract={(contractId) => navigate(ROUTES.CONTRACT_DETAIL(contractId))}
        />,
        <DetailPageSkeleton />
    );
};

// Unit List
export const LazyUnitListPage: React.FC = () => {
    const navigate = useNavigate();
    return withSuspense(
        <UnitList onSelectUnit={(id) => navigate(ROUTES.UNIT_DETAIL(id))} />
    );
};

// Unit Detail
export const LazyUnitDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    if (!id) return <div>Unit not found</div>;
    return withSuspense(
        <UnitDetail
            unitId={id}
            onBack={() => navigate(ROUTES.UNITS)}
            onViewContract={(contractId) => navigate(ROUTES.CONTRACT_DETAIL(contractId))}
            onViewPersonnel={(personnelId) => navigate(ROUTES.PERSONNEL_DETAIL(personnelId))}
        />,
        <DetailPageSkeleton />
    );
};

// Settings
export const LazySettingsPage: React.FC = () => withSuspense(<Settings />);

// User Guide
export const LazyUserGuidePage: React.FC = () => withSuspense(<UserGuide />);

// Document Manager
export const LazyDocumentManagerPage: React.FC = () => withSuspense(<DocumentManager />);

// Tools
export const LazyToolsPage: React.FC = () => withSuspense(<ToolsPage />);

// Chat
export const LazyChatPage: React.FC = () => withSuspense(<ChatPageComponent />);

// Task Management
export const LazyTaskListPage: React.FC = () => {
    const { selectedUnit } = useLayoutContext();
    return withSuspense(<TaskListPage selectedUnit={typeof selectedUnit === 'string' ? selectedUnit : selectedUnit?.id} />);
};

export const LazyMyTasksPage: React.FC = () => {
    return withSuspense(<MyTasksPage />);
};
