// Page wrapper components that bridge react-router-dom to existing components
// These wrappers get context from MainLayout and pass as props to existing components

import React, { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLayoutContext } from './layout/MainLayout';
import { ROUTES } from '../routes/routes';
import { useSlidePanel } from '../contexts/SlidePanelContext';

// Dashboard
import DashboardComponent from './Dashboard';
export const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedUnit, setSelectedUnit } = useLayoutContext();
    return (
        <DashboardComponent
            selectedUnit={selectedUnit}
            onSelectUnit={setSelectedUnit}
            onSelectContract={(id) => navigate(ROUTES.CONTRACT_DETAIL(id))}
        />
    );
};

// Contract List
import ContractListComponent from './ContractList';
export const ContractListPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedUnit } = useLayoutContext();
    const { openPanel, closePanel } = useSlidePanel();

    // Open contract detail in a slide panel
    const handleSelectContract = useCallback((id: string) => {
        const encodedId = encodeURIComponent(id);
        openPanel({
            title: `Hợp đồng ${id}`,
            component: (
                <ContractDetailInPanel
                    contractId={id}
                />
            ),
        });
    }, [openPanel]);

    // Open contract form in a slide panel
    const handleAddContract = useCallback(() => {
        openPanel({
            title: 'Tạo hợp đồng mới',
            component: (
                <ContractFormInPanel />
            ),
        });
    }, [openPanel]);

    // Clone contract in a slide panel
    const handleCloneContract = useCallback((contract: any) => {
        openPanel({
            title: 'Nhân bản hợp đồng',
            component: (
                <ContractFormInPanel cloneFrom={contract} />
            ),
        });
    }, [openPanel]);

    return (
        <ContractListComponent
            selectedUnit={selectedUnit}
            onSelectContract={handleSelectContract}
            onAdd={handleAddContract}
            onClone={handleCloneContract}
        />
    );
};

// ── ContractDetail rendered inside a slide panel ─────────────────────────────
import ContractDetailComponent from './ContractDetail';
const ContractDetailInPanel: React.FC<{ contractId: string }> = ({ contractId }) => {
    const navigate = useNavigate();
    const { openPanel, closePanel } = useSlidePanel();
    const [refreshKey, setRefreshKey] = React.useState(0);

    const handleEdit = useCallback((contract: any) => {
        openPanel({
            title: `Chỉnh sửa ${contract.contractCode}`,
            component: (
                <ContractFormInPanel
                    contractId={contract.id}
                    onSuccess={() => setTimeout(() => setRefreshKey(prev => prev + 1), 0)}
                />
            ),
        });
    }, [openPanel]);

    return (
        <div className="p-4 md:p-6 lg:p-8" key={refreshKey}>
            <ContractDetailComponent
                contractId={contractId}
                onBack={() => closePanel()}
                onEdit={handleEdit}
                onDelete={async () => {
                    const { ContractService } = await import('../services');
                    await ContractService.delete(contractId);
                    closePanel();
                    toast.success('Đã xóa hợp đồng');
                }}
            />
        </div>
    );
};

// ── ContractForm rendered inside a slide panel ───────────────────────────────
import ContractFormComponent from './ContractForm';
import { useLocation } from 'react-router-dom';
import { ContractService } from '../services';
import { toast } from 'sonner';

const ContractFormInPanel: React.FC<{ contractId?: string; cloneFrom?: any; onSuccess?: (contract: any) => void }> = ({ contractId, cloneFrom, onSuccess }) => {
    const { closePanel } = useSlidePanel();
    const [contract, setContract] = React.useState<any>(cloneFrom || null);
    const [loading, setLoading] = React.useState(!!contractId && !cloneFrom);

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
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Đang tải...</div>;
    }

    return (
        <ContractFormComponent
            contract={contract}
            isCloning={!!cloneFrom}
            isInsidePanel={true}
            onSave={async (data) => {
                try {
                    let savedContract;
                    if (contractId && !cloneFrom) {
                        savedContract = await ContractService.update(contractId, data);
                        toast.success('Cập nhật hợp đồng thành công!');
                    } else {
                        savedContract = await ContractService.create(data);
                        toast.success(cloneFrom ? 'Nhân bản hợp đồng thành công!' : 'Tạo hợp đồng thành công!');
                    }
                    if (onSuccess && savedContract) {
                        onSuccess(savedContract);
                    }
                    // Event dispatch now handled inside ContractService.update
                    closePanel();
                } catch (e: any) {
                    toast.error('Lỗi: ' + (e.message || e));
                }
            }}
            onCancel={() => closePanel()}
        />
    );
};

// ── ContractDetailPage — for direct URL access (/contracts/:id or /contracts/:id/:subId) ──
export const ContractDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id: rawId, subId } = useParams<{ id: string; subId: string }>();
    // Handle contract IDs containing slashes (e.g., VV_038/DCS_2026)
    const rawFullId = rawId && subId ? `${rawId}/${subId}` : rawId;
    const id = rawFullId ? decodeURIComponent(rawFullId) : undefined;
    const { openPanel, closePanel } = useSlidePanel();
    
    if (!id) return <div>Contract not found</div>;
    return (
        <ContractDetailComponent
            contractId={id}
            onBack={() => navigate(ROUTES.CONTRACTS)}
            onEdit={(contract) => {
                openPanel({
                    title: `Chỉnh sửa ${contract.contractCode}`,
                    component: (
                        <ContractFormInPanel
                            contractId={contract.id}
                            onSuccess={() => {
                                // Event dispatch is handled inside ContractService.update.
                                // The ContractDetail component listens to 'contract-updated' 
                                // and will fetch the newest complete data dynamically.
                            }}
                        />
                    ),
                });
            }}
            onDelete={async () => {
                navigate(ROUTES.CONTRACTS);
            }}
        />
    );
};


// Contract Form Page — for direct URL access (/contracts/new, /contracts/:id/edit)
export const ContractFormPage: React.FC = () => {
    const navigate = useNavigate();
    const { id: rawId } = useParams<{ id: string }>();
    const id = rawId ? decodeURIComponent(rawId) : undefined;
    const location = useLocation();
    const cloneFrom = location.state?.cloneFrom;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
            <ContractFormComponent
                contract={cloneFrom}
                isCloning={!!cloneFrom}
                onSave={async (data) => {
                    try {
                        if (id) {
                            await ContractService.update(id, data);
                            toast.success("Cập nhật hợp đồng thành công!");
                        } else {
                            await ContractService.create(data);
                            toast.success(cloneFrom ? "Nhân bản hợp đồng thành công!" : "Tạo hợp đồng thành công!");
                        }
                        navigate(ROUTES.CONTRACTS);
                    } catch (e: any) {
                        toast.error("Lỗi: " + (e.message || e));
                    }
                }}
                onCancel={() => navigate(-1)}
            />
        </div>
    );
};

// Payment List
import PaymentListComponent from './PaymentList';
export const PaymentListPage: React.FC = () => {
    const navigate = useNavigate();
    return (
        <PaymentListComponent
            onSelectContract={(id) => navigate(ROUTES.CONTRACT_DETAIL(id))}
        />
    );
};

// Analytics
import AnalyticsComponent from './Analytics';
export const AnalyticsPage: React.FC = () => {
    const { selectedUnit, setSelectedUnit } = useLayoutContext();
    return (
        <AnalyticsComponent
            selectedUnit={selectedUnit}
            onSelectUnit={setSelectedUnit}
        />
    );
};

// AI Assistant
import AIAssistantComponent from './AIAssistant';
export const AIAssistantPage: React.FC = () => {
    return <AIAssistantComponent />;
};

// Personnel List
import PersonnelListComponent from './PersonnelList';
export const PersonnelListPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedUnit } = useLayoutContext();
    return (
        <PersonnelListComponent
            selectedUnit={selectedUnit}
            onSelectPersonnel={(id) => navigate(ROUTES.PERSONNEL_DETAIL(id))}
        />
    );
};

// Personnel Detail
import PersonnelDetailComponent from './PersonnelDetail';
export const PersonnelDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    if (!id) return <div>Personnel not found</div>;
    return (
        <PersonnelDetailComponent
            personnelId={id}
            onBack={() => navigate(ROUTES.PERSONNEL)}
            onViewContract={(contractId) => navigate(ROUTES.CONTRACT_DETAIL(contractId))}
        />
    );
};

// Customer List
import CustomerListComponent from './CustomerList';
export const CustomerListPage: React.FC = () => {
    const navigate = useNavigate();
    return (
        <CustomerListComponent
            onSelectCustomer={(id) => navigate(ROUTES.CUSTOMER_DETAIL(id))}
        />
    );
};

// Customer Detail
import CustomerDetailComponent from './CustomerDetail';
export const CustomerDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    if (!id) return <div>Customer not found</div>;
    return (
        <CustomerDetailComponent
            customerId={id}
            onBack={() => navigate(ROUTES.CUSTOMERS)}
            onViewContract={(contractId) => navigate(ROUTES.CONTRACT_DETAIL(contractId))}
        />
    );
};

// Product List
import ProductListComponent from './ProductList';
export const ProductListPage: React.FC = () => {
    const navigate = useNavigate();
    return (
        <ProductListComponent
            onSelectProduct={(id) => navigate(ROUTES.PRODUCT_DETAIL(id))}
        />
    );
};

// Product Detail
import ProductDetailComponent from './ProductDetail';
export const ProductDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    if (!id) return <div>Product not found</div>;
    return (
        <ProductDetailComponent
            productId={id}
            onBack={() => navigate(ROUTES.PRODUCTS)}
            onEdit={() => {/* TODO: implement edit modal */ }}
            onViewContract={(contractId) => navigate(ROUTES.CONTRACT_DETAIL(contractId))}
        />
    );
};

// Unit List
import UnitListComponent from './UnitList';
export const UnitListPage: React.FC = () => {
    const navigate = useNavigate();
    return (
        <UnitListComponent
            onSelectUnit={(id) => navigate(ROUTES.UNIT_DETAIL(id))}
        />
    );
};

// Unit Detail
import UnitDetailComponent from './UnitDetail';
export const UnitDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    if (!id) return <div>Unit not found</div>;
    return (
        <UnitDetailComponent
            unitId={id}
            onBack={() => navigate(ROUTES.UNITS)}
            onViewContract={(contractId) => navigate(ROUTES.CONTRACT_DETAIL(contractId))}
            onViewPersonnel={(personnelId) => navigate(ROUTES.PERSONNEL_DETAIL(personnelId))}
        />
    );
};

// Settings - uses context directly
import SettingsComponent from './Settings';
export const SettingsPage: React.FC = () => {
    return <SettingsComponent />;
};
