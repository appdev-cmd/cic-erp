// Lazy-loaded page components for code splitting
// This reduces initial bundle size by loading components on demand

import React, { Suspense, lazy, useCallback, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLayoutContext } from '../contexts/LayoutContext';
import { ROUTES } from '../routes/routes';
import { useSlidePanel } from '../contexts/SlidePanelContext';
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
const AgentManager = lazyWithRetry(() => import('./AgentManager'));
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
const TasksPageComponent = lazyWithRetry(() => import('./tasks/TasksPage'));
const ProjectList = lazyWithRetry(() => import('./ProjectList'));
const ProjectDetail = lazyWithRetry(() => import('./ProjectDetail'));
const ProjectForm = lazyWithRetry(() => import('./ProjectForm'));
const ReportListPage = lazyWithRetry(() => import('./ReportListPage'));
const ReportViewerPage = lazyWithRetry(() => import('./ReportViewerPage'));
const HRMPage = lazyWithRetry(() => import('./hrm/HRMPage'));
const RecruitmentPage = lazyWithRetry(() => import('./hrm/RecruitmentPage'));
const LeavePage = lazyWithRetry(() => import('./hrm/LeavePage'));
const RequestsPage = lazyWithRetry(() => import('./hrm/RequestsPage'));
const PublicApplicationForm = lazyWithRetry(() => import('./hrm/PublicApplicationForm'));
const WebsiteManager = lazyWithRetry(() => import('./WebsiteManager'));
const NewsList = lazyWithRetry(() => import('./NewsList'));
const AIObservabilityDashboard = lazyWithRetry(() => import('./AIObservabilityDashboard'));
const AttendanceSettingsPanel = lazyWithRetry(() => import('./hrm/AttendanceSettings').then(m => ({ default: m.AttendanceSettingsPanel })));
const OvertimeRequestsPanel = lazyWithRetry(() => import('./hrm/OvertimeRequests').then(m => ({ default: m.OvertimeRequestsPanel })));
const PayrollPage = lazyWithRetry(() => import('./hrm/PayrollPage').then(m => ({ default: m.PayrollPage })));
const InsuranceDashboard = lazyWithRetry(() => import('./hrm/InsuranceDashboard').then(m => ({ default: m.InsuranceDashboard })));
const OnboardingPage = lazyWithRetry(() => import('./hrm/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const PerformancePage = lazyWithRetry(() => import('./hrm/PerformancePage').then(m => ({ default: m.PerformancePage })));
const SelfServicePortal = lazyWithRetry(() => import('./hrm/SelfServicePortal').then(m => ({ default: m.SelfServicePortal })));
const HRAnalyticsDashboard = lazyWithRetry(() => import('./hrm/HRAnalyticsDashboard').then(m => ({ default: m.HRAnalyticsDashboard })));

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
    const { selectedUnit, setSelectedUnit, yearFilter, periodFilter } = useLayoutContext();
    const openPersonnelPanel = useOpenPersonnelPanel();
    const { openPanel, closePanel } = useSlidePanel();
    const openContractPanel = useOpenContractPanel();

    const handleSelectPerformanceUnit = useCallback((unitId: string) => {
        openPanel({
            title: 'Chi tiết Đơn vị',
            url: ROUTES.UNIT_DETAIL(unitId),
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <UnitDetail
                            unitId={unitId}
                            onBack={() => closePanel()}
                            onViewContract={openContractPanel}
                            onViewPersonnel={openPersonnelPanel}
                            yearFilter={yearFilter}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel, openContractPanel, openPersonnelPanel, yearFilter]);

    return withSuspense(
        <Dashboard
            selectedUnit={selectedUnit}
            onSelectUnit={setSelectedUnit}
            onSelectContract={(id) => navigate(ROUTES.CONTRACT_DETAIL(id))}
            onSelectEmployee={openPersonnelPanel}
            onSelectPerformanceUnit={handleSelectPerformanceUnit}
            yearFilter={yearFilter}
            periodFilter={periodFilter}
        />,
        <DashboardSkeleton />
    );
};

// ========================================
// WEBSITE MODULE
// ========================================
export const LazyWebsiteManagerPage: React.FC = () => {
    return withSuspense(<WebsiteManager />);
};

// ═══════════════════════════════════════════════════════════════════════
// CONTRACT MODULE — Slide Panel Integration (Bitrix24-style)
// ═══════════════════════════════════════════════════════════════════════

// Contract List — opens detail/form in slide panels
export const LazyContractListPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedUnit } = useLayoutContext();
    const { openPanel, closePanel } = useSlidePanel();

    const handleSelectContract = useCallback((id: string) => {
        openPanel({
            title: id,
            url: ROUTES.CONTRACT_DETAIL(id),
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <ContractDetail
                            contractId={id}
                            onBack={() => closePanel()}
                            onEdit={(contract) => {
                                openPanel({
                                    title: `Chỉnh sửa ${contract.contractCode}`,
                                    url: `${ROUTES.CONTRACT_DETAIL(contract.id)}?edit=true`,
                                    component: (
                                        <Suspense fallback={<FormPageSkeleton />}>
                                            <ContractFormInSlidePanel contractId={contract.id} />
                                        </Suspense>
                                    ),
                                });
                            }}
                            onDelete={async () => {
                                try {
                                    await ContractService.delete(id);
                                    toast.success('Đã xóa hợp đồng thành công!');
                                    closePanel();
                                } catch (e: any) {
                                    toast.error('Lỗi xóa hợp đồng: ' + (e.message || e));
                                }
                            }}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel]);

    const handleAddContract = useCallback(() => {
        openPanel({
            title: 'Tạo hợp đồng mới',
            url: `${ROUTES.CONTRACTS}/new`,
            component: (
                <Suspense fallback={<FormPageSkeleton />}>
                    <ContractFormInSlidePanel />
                </Suspense>
            ),
        });
    }, [openPanel]);

    const handleCloneContract = useCallback((contract: any) => {
        openPanel({
            title: 'Nhân bản hợp đồng',
            url: `${ROUTES.CONTRACTS}/new?clone=${contract.id}`,
            component: (
                <Suspense fallback={<FormPageSkeleton />}>
                    <ContractFormInSlidePanel cloneFrom={contract} />
                </Suspense>
            ),
        });
    }, [openPanel]);

    return withSuspense(
        <ContractList
            selectedUnit={selectedUnit}
            onSelectContract={handleSelectContract}
            onAdd={handleAddContract}
            onClone={handleCloneContract}
        />,
        <ListPageSkeleton />
    );
};

// Contract Detail — for direct URL access (/contracts/:id or /contracts/:id/:subId)
export const LazyContractDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id: rawId, subId } = useParams<{ id: string; subId: string }>();
    // Handle contract IDs containing slashes (e.g., VV_038/DCS_2026)
    const rawFullId = rawId && subId ? `${rawId}/${subId}` : rawId;
    const id = rawFullId ? decodeURIComponent(rawFullId) : undefined;
    const { openPanel, closePanel } = useSlidePanel();
    if (!id) return <div>Contract not found</div>;
    return withSuspense(
        <ContractDetail
            contractId={id}
            onBack={() => navigate(ROUTES.CONTRACTS)}
            onEdit={(contract) => {
                openPanel({
                    title: `Chỉnh sửa ${contract.contractCode}`,
                    url: `${ROUTES.CONTRACT_DETAIL(contract.id)}?edit=true`,
                    component: (
                        <Suspense fallback={<FormPageSkeleton />}>
                            <ContractFormInSlidePanel contractId={contract.id} />
                        </Suspense>
                    ),
                });
            }}
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

// ── Contract Form rendered inside a slide panel ──────────────────────────────
const ContractFormInSlidePanel: React.FC<{ contractId?: string; cloneFrom?: any }> = ({ contractId, cloneFrom }) => {
    const { closePanel, lockPanel, unlockPanel, setOnCloseBlocked, forceClosePanel } = useSlidePanel();
    const [contract, setContract] = React.useState<Contract | null>(cloneFrom || null);
    const [loading, setLoading] = React.useState(!!contractId && !cloneFrom);
    const isDirtyRef = React.useRef(false);

    // Dirty-state based lock: only lock when form has actual changes
    const handleDirtyChange = React.useCallback((isDirty: boolean) => {
        isDirtyRef.current = isDirty;
        if (isDirty) {
            lockPanel();
        } else {
            unlockPanel();
        }
    }, [lockPanel, unlockPanel]);

    // Show discard confirmation toast (shared between panel close & form X button)
    const showDiscardConfirmation = React.useCallback(() => {
        toast('Bạn có thay đổi chưa lưu', {
            description: 'Vui lòng lưu hoặc bỏ thay đổi trước khi đóng.',
            id: 'panel-save-confirm',
            duration: 5000,
            action: {
                label: 'Bỏ thay đổi',
                onClick: () => {
                    forceClosePanel();
                },
            },
        });
    }, [forceClosePanel]);

    // Register callback for when panel close is blocked
    React.useEffect(() => {
        setOnCloseBlocked(undefined, showDiscardConfirmation);
        return () => { setOnCloseBlocked(undefined, null); };
    }, [setOnCloseBlocked, showDiscardConfirmation]);

    // Cleanup: unlock on unmount
    React.useEffect(() => {
        return () => { unlockPanel(); };
    }, [unlockPanel]);

    React.useEffect(() => {
        if (contractId && !cloneFrom) {
            setLoading(true);
            ContractService.getById(contractId)
                .then(data => { if (data) setContract(data); })
                .catch(err => toast.error('Lỗi tải hợp đồng: ' + err))
                .finally(() => setLoading(false));
        }
    }, [contractId, cloneFrom]);

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Đang tải dữ liệu...</p>
            </div>
        );
    }

    const handleClose = () => {
        unlockPanel();
        setTimeout(() => closePanel(), 10);
    };

    // onCancel: if dirty → show confirmation; if clean → close immediately
    const handleCancel = () => {
        if (isDirtyRef.current) {
            showDiscardConfirmation();
        } else {
            handleClose();
        }
    };

    return (
        <ContractForm
            contract={contract || undefined}
            isCloning={!!cloneFrom}
            isInsidePanel={true}
            onDirtyChange={handleDirtyChange}
            onSave={async (data) => {
                try {
                    if (contractId && !cloneFrom) {
                        await ContractService.update(contractId, data);
                        toast.success('Cập nhật hợp đồng thành công!');
                        // Notify listeners (e.g. ContractDetail) to refetch
                        window.dispatchEvent(new CustomEvent('contract-updated', { detail: { contractId } }));
                    } else {
                        const newContract = await ContractService.create(data);
                        // Trigger AutoTaskEngine để tạo tasks thiết yếu (Review, PAKD)
                        window.dispatchEvent(new CustomEvent('contract-created', {
                            detail: {
                                id: newContract?.id,
                                contractNumber: data.contractCode || '',
                                name: data.title || '',
                                title: data.title || '',
                                partyA: data.partyA || '',
                                employee_id: data.salespersonId || '',
                                unit_id: data.unitId || '',
                                assigneeIds: data.employeeAllocations?.map((a: any) => a.employeeId).filter(Boolean) || [],
                            }
                        }));
                        toast.success(cloneFrom ? 'Nhân bản hợp đồng thành công!' : 'Tạo hợp đồng thành công!');
                    }
                    handleClose();
                } catch (e: any) {
                    toast.error('Lỗi: ' + (e.message || e));
                }
            }}
            onCancel={handleCancel}
        />
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
                                // Trigger AutoTaskEngine để tạo tasks thiết yếu (Review, PAKD)
                                window.dispatchEvent(new CustomEvent('contract-created', {
                                    detail: {
                                        id: newContract?.id,
                                        contractNumber: data.contractCode || '',
                                        name: data.title || '',
                                        title: data.title || '',
                                        partyA: data.partyA || '',
                                        employee_id: data.salespersonId || '',
                                        unit_id: data.unitId || '',
                                        assigneeIds: data.employeeAllocations?.map((a: any) => a.employeeId).filter(Boolean) || [],
                                    }
                                }));
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

// ═══════════════════════════════════════════════════════════════════════
// SHARED PANEL HELPERS — reusable across modules
// ═══════════════════════════════════════════════════════════════════════

// Opens a Contract detail in a slide panel (used by Personnel, Customer, Product, Unit, Payment)
function useOpenContractPanel() {
    const { openPanel, closePanel } = useSlidePanel();
    return useCallback((contractId: string) => {
        openPanel({
            title: contractId,
            url: ROUTES.CONTRACT_DETAIL(contractId),
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <ContractDetail
                            contractId={contractId}
                            onBack={() => closePanel()}
                            onEdit={(contract) => {
                                openPanel({
                                    title: `Chỉnh sửa ${contract.contractCode}`,
                                    url: `${ROUTES.CONTRACT_DETAIL(contract.id)}?edit=true`,
                                    component: (
                                        <Suspense fallback={<FormPageSkeleton />}>
                                            <ContractFormInSlidePanel contractId={contract.id} />
                                        </Suspense>
                                    ),
                                });
                            }}
                            onDelete={async () => {
                                try {
                                    await ContractService.delete(contractId);
                                    toast.success('Đã xóa hợp đồng thành công!');
                                    closePanel();
                                } catch (e: any) {
                                    toast.error('Lỗi xóa hợp đồng: ' + (e.message || e));
                                }
                            }}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel]);
}

// Opens a Personnel detail in a slide panel (used by Unit, Dashboard)
function useOpenPersonnelPanel() {
    const { openPanel, closePanel } = useSlidePanel();
    const openContractPanel = useOpenContractPanel();
    return useCallback((personnelIdOrSlug: string) => {
        openPanel({
            title: 'Chi tiết Nhân viên',
            url: ROUTES.PERSONNEL_DETAIL(personnelIdOrSlug),
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <PersonnelDetail
                            personnelId={personnelIdOrSlug}
                            onBack={() => closePanel()}
                            onViewContract={openContractPanel}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel, openContractPanel]);
}

// Opens a Product detail in a slide panel (used by Customer)
function useOpenProductPanel() {
    const { openPanel, closePanel } = useSlidePanel();
    const openContractPanel = useOpenContractPanel();
    return useCallback((productId: string) => {
        openPanel({
            title: 'Chi tiết Sản phẩm/DV',
            url: ROUTES.PRODUCT_DETAIL(productId),
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <ProductDetail
                            productId={productId}
                            onBack={() => closePanel()}
                            onViewContract={openContractPanel}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel, openContractPanel]);
}

// ═══════════════════════════════════════════════════════════════════════
// PAYMENT MODULE — Slide Panel Integration
// ═══════════════════════════════════════════════════════════════════════

// Payment List — opens contract detail in slide panel
export const LazyPaymentListPage: React.FC = () => {
    const openContractPanel = useOpenContractPanel();
    return withSuspense(
        <PaymentList onSelectContract={openContractPanel} />
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

// Agent Manager
export const LazyAgentManagerPage: React.FC = () => withSuspense(<AgentManager />);

// ═══════════════════════════════════════════════════════════════════════
// PERSONNEL MODULE — Slide Panel Integration
// ═══════════════════════════════════════════════════════════════════════

// Personnel List — opens detail in slide panel
export const LazyPersonnelListPage: React.FC = () => {
    const { selectedUnit } = useLayoutContext();
    const openPersonnelPanel = useOpenPersonnelPanel();
    return withSuspense(
        <PersonnelList
            selectedUnit={selectedUnit}
            onSelectPersonnel={openPersonnelPanel}
        />
    );
};

// Personnel Detail — fallback for direct URL access (/personnel/:id)
export const LazyPersonnelDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const openContractPanel = useOpenContractPanel();
    if (!id) return <div>Personnel not found</div>;
    return withSuspense(
        <PersonnelDetail
            personnelId={id}
            onBack={() => navigate(ROUTES.PERSONNEL)}
            onViewContract={openContractPanel}
        />,
        <DetailPageSkeleton />
    );
};

// ═══════════════════════════════════════════════════════════════════════
// CUSTOMER MODULE — Slide Panel Integration
// ═══════════════════════════════════════════════════════════════════════

// Customer List — opens detail in slide panel
export const LazyCustomerListPage: React.FC = () => {
    const { openPanel, closePanel } = useSlidePanel();
    const openContractPanel = useOpenContractPanel();
    const openProductPanel = useOpenProductPanel();

    const handleSelectCustomer = useCallback((id: string) => {
        openPanel({
            title: 'Chi tiết Khách hàng',
            url: ROUTES.CUSTOMER_DETAIL(id),
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <CustomerDetail
                            customerId={id}
                            onBack={() => closePanel()}
                            onViewContract={openContractPanel}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel, openContractPanel]);

    return withSuspense(
        <CustomerList
            onSelectCustomer={handleSelectCustomer}
            onSelectProduct={openProductPanel}
        />
    );
};

// Customer Detail — fallback for direct URL access (/customers/:id)
export const LazyCustomerDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const openContractPanel = useOpenContractPanel();
    if (!id) return <div>Customer not found</div>;
    return withSuspense(
        <CustomerDetail
            customerId={id}
            onBack={() => navigate(ROUTES.CUSTOMERS)}
            onViewContract={openContractPanel}
        />,
        <DetailPageSkeleton />
    );
};

// ═══════════════════════════════════════════════════════════════════════
// PRODUCT MODULE — Slide Panel Integration
// ═══════════════════════════════════════════════════════════════════════

// Product List — opens detail in slide panel
export const LazyProductListPage: React.FC = () => {
    const openProductPanel = useOpenProductPanel();
    return withSuspense(
        <ProductList onSelectProduct={openProductPanel} />
    );
};

// ═══════════════════════════════════════════════════════════════════════
// GENERIC OPENER — For EntityPicker and Generic Task Links
// ═══════════════════════════════════════════════════════════════════════
export function useOpenEntityPanel() {
    const openContract = useOpenContractPanel();
    const openPersonnel = useOpenPersonnelPanel();
    const openProduct = useOpenProductPanel();
    const { openPanel, closePanel } = useSlidePanel();

    return useCallback((entityType: string, entityId: string) => {
        if (!entityId) return;
        switch (entityType.toLowerCase()) {
            case 'contract':
                openContract(entityId);
                break;
            case 'employee':
                openPersonnel(entityId);
                break;
            case 'product':
                openProduct(entityId);
                break;
            case 'customer':
                openPanel({
                    title: 'Chi tiết Khách hàng',
                    url: ROUTES.CUSTOMER_DETAIL(entityId),
                    component: (
                        <Suspense fallback={<DetailPageSkeleton />}>
                            <div className="p-4 md:p-6 lg:p-8">
                                <CustomerDetail customerId={entityId} onBack={() => closePanel()} onViewContract={openContract} />
                            </div>
                        </Suspense>
                    )
                });
                break;
            case 'project':
                openPanel({
                    title: 'Chi tiết Dự án',
                    url: ROUTES.PROJECT_DETAIL(entityId),
                    component: (
                        <Suspense fallback={<DetailPageSkeleton />}>
                            <div className="p-4 md:p-6 lg:p-8">
                                <ProjectDetail
                                    projectId={entityId}
                                    onBack={() => closePanel()}
                                    onEdit={(project) => {
                                        openPanel({
                                            title: 'Chỉnh sửa dự án',
                                            url: `/projects/${project.id}/edit`,
                                            component: (
                                                <Suspense fallback={<DetailPageSkeleton />}>
                                                    <div className="p-4 md:p-6 lg:p-8">
                                                        <ProjectForm
                                                            project={project}
                                                            onSave={() => closePanel()}
                                                            onCancel={() => closePanel()}
                                                        />
                                                    </div>
                                                </Suspense>
                                            ),
                                        });
                                    }}
                                />
                            </div>
                        </Suspense>
                    )
                });
                break;
            case 'unit':
            case 'department':
                openPanel({
                    title: 'Chi tiết Đơn vị',
                    url: ROUTES.UNIT_DETAIL(entityId),
                    component: (
                        <Suspense fallback={<DetailPageSkeleton />}>
                            <div className="p-4 md:p-6 lg:p-8">
                                <UnitDetail unitId={entityId} onBack={() => closePanel()} onViewContract={openContract} onViewPersonnel={openPersonnel} yearFilter={new Date().getFullYear().toString()} />
                            </div>
                        </Suspense>
                    )
                });
                break;
            default:
                import('../services/entityRegistryService').then(m => {
                    m.EntityRegistryService.resolveUrl(entityType, entityId).then(url => {
                        if (url) window.location.href = url;
                    });
                });
                break;
        }
    }, [openContract, openPersonnel, openProduct, openPanel, closePanel]);
}

// Product Detail — fallback for direct URL access (/products/:id)
export const LazyProductDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const openContractPanel = useOpenContractPanel();
    if (!id) return <div>Product not found</div>;
    return withSuspense(
        <ProductDetail
            productId={id}
            onBack={() => navigate(ROUTES.PRODUCTS)}
            onViewContract={openContractPanel}
        />,
        <DetailPageSkeleton />
    );
};

// ═══════════════════════════════════════════════════════════════════════
// UNIT MODULE — Slide Panel Integration
// ═══════════════════════════════════════════════════════════════════════

// Unit List — opens detail in slide panel
export const LazyUnitListPage: React.FC = () => {
    const { openPanel, closePanel } = useSlidePanel();
    const { yearFilter } = useLayoutContext();
    const openContractPanel = useOpenContractPanel();
    const openPersonnelPanel = useOpenPersonnelPanel();

    const handleSelectUnit = useCallback((id: string) => {
        openPanel({
            title: 'Chi tiết Đơn vị',
            url: ROUTES.UNIT_DETAIL(id),
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <UnitDetail
                            unitId={id}
                            onBack={() => closePanel()}
                            onViewContract={openContractPanel}
                            onViewPersonnel={openPersonnelPanel}
                            yearFilter={yearFilter}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel, openContractPanel, openPersonnelPanel, yearFilter]);

    return withSuspense(
        <UnitList onSelectUnit={handleSelectUnit} />
    );
};

// Unit Detail — fallback for direct URL access (/units/:id)
export const LazyUnitDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { yearFilter } = useLayoutContext();
    const openContractPanel = useOpenContractPanel();
    const openPersonnelPanel = useOpenPersonnelPanel();
    if (!id) return <div>Unit not found</div>;
    return withSuspense(
        <UnitDetail
            unitId={id}
            onBack={() => navigate(ROUTES.UNITS)}
            onViewContract={openContractPanel}
            onViewPersonnel={openPersonnelPanel}
            yearFilter={yearFilter}
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

// Reports
export const LazyReportListPage: React.FC = () => withSuspense(<ReportListPage />);
export const LazyReportViewerPage: React.FC = () => withSuspense(<ReportViewerPage />);

// Tasks
export const LazyTasksPage: React.FC = () => withSuspense(<TasksPageComponent />);

// ═══════════════════════════════════════════════════════════════════════
// PROJECT MODULE (BIM) — Slide Panel Integration
// ═══════════════════════════════════════════════════════════════════════

export const LazyProjectListPage: React.FC = () => {
    const { openPanel, closePanel } = useSlidePanel();
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

    const handleSelectProject = useCallback((id: string) => {
        openPanel({
            title: 'Chi tiết Dự án',
            url: ROUTES.PROJECT_DETAIL(id),
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <ProjectDetail
                            projectId={id}
                            onBack={() => closePanel()}
                            onEdit={(project) => {
                                closePanel();
                                setTimeout(() => handleEditProject(project), 100);
                            }}
                            onDelete={() => {
                                closePanel();
                                refresh();
                            }}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel, refresh]);

    const handleCreateProject = useCallback(() => {
        openPanel({
            title: 'Tạo dự án mới',
            url: '/projects/new',
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <ProjectForm
                            onSave={() => {
                                closePanel();
                                refresh();
                            }}
                            onCancel={() => closePanel()}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel, refresh]);

    const handleEditProject = useCallback((project: any) => {
        openPanel({
            title: 'Chỉnh sửa dự án',
            url: `/projects/${project.id}/edit`,
            component: (
                <Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        <ProjectForm
                            project={project}
                            onSave={() => {
                                closePanel();
                                refresh();
                            }}
                            onCancel={() => closePanel()}
                        />
                    </div>
                </Suspense>
            ),
        });
    }, [openPanel, closePanel, refresh]);

    return withSuspense(
        <ProjectList
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            refreshKey={refreshKey}
        />,
        <ListPageSkeleton />
    );
};

export const LazyProjectDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { openPanel, closePanel } = useSlidePanel();

    // Guard: nếu id không phải UUID hợp lệ (vd: "new", "edit") → về danh sách
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !UUID_REGEX.test(id)) {
        navigate('/projects', { replace: true });
        return null;
    }
    return withSuspense(
        <ProjectDetail
            projectId={id}
            onBack={() => navigate(ROUTES.PROJECTS)}
            onDelete={() => navigate(ROUTES.PROJECTS)}
            onEdit={(project) => {
                openPanel({
                    title: 'Chỉnh sửa dự án',
                    url: `/projects/${project.id}/edit`,
                    component: (
                        <Suspense fallback={<DetailPageSkeleton />}>
                            <div className="p-4 md:p-6 lg:p-8">
                                <ProjectForm
                                    project={project}
                                    onSave={() => {
                                        closePanel();
                                        window.location.reload();
                                    }}
                                    onCancel={() => closePanel()}
                                />
                            </div>
                        </Suspense>
                    ),
                });
            }}
        />,
        <DetailPageSkeleton />
    );
};

// HRM
export const LazyHRMPage: React.FC = () => withSuspense(<HRMPage />);
export const LazyRecruitmentPage: React.FC = () => withSuspense(<RecruitmentPage />);
export const LazyLeavePage: React.FC = () => withSuspense(<LeavePage />);
export const LazyRequestsPage: React.FC = () => withSuspense(<RequestsPage />);

export const LazyAttendanceSettingsPage: React.FC = () => {
    return withSuspense(
        <div className="max-w-4xl mx-auto p-4 md:p-6"><AttendanceSettingsPanel /></div>
    );
};

export const LazyOvertimeRequestsPage: React.FC = () => {
    return withSuspense(
        <div className="max-w-6xl mx-auto p-4 md:p-6"><OvertimeRequestsPanel /></div>
    );
};

export const LazyPayrollPage: React.FC = () => {
    return withSuspense(<PayrollPage />);
};

export const LazyInsuranceDashboardPage: React.FC = () => {
    return withSuspense(<InsuranceDashboard />);
};

export const LazyOnboardingPage: React.FC = () => {
    return withSuspense(<OnboardingPage />);
};

export const LazyPerformancePage: React.FC = () => {
    return withSuspense(<PerformancePage />);
};

export const LazySelfServicePortal: React.FC = () => {
    return withSuspense(<SelfServicePortal />);
};

export const LazyHRAnalyticsDashboard: React.FC = () => {
    return withSuspense(<HRAnalyticsDashboard />);
};

export const LazyPublicApplicationForm: React.FC = () => withSuspense(<PublicApplicationForm />, <FormPageSkeleton />);

// CMS / News
export const LazyNewsPage: React.FC = () => withSuspense(<NewsList />);

// Settings / System
export const LazyAIObservabilityDashboardPage: React.FC = () => withSuspense(<AIObservabilityDashboard />);
