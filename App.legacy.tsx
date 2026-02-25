import React, { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster, toast } from 'sonner';
import { RoleSwitcher } from './components/RoleSwitcher';
import DataSeeder from './components/admin/DataSeeder';
import PilotRunner from './components/admin/PilotRunner';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ContractList from './components/ContractList';
import AIAssistant from './components/AIAssistant';
import ContractDetail from './components/ContractDetail';
import DocumentManager from './components/DocumentManager';
import ContractForm from './components/ContractForm';
import Analytics from './components/Analytics';
import PersonnelList from './components/PersonnelList';
import PersonnelDetail from './components/PersonnelDetail';
import UnitList from './components/UnitList';
import UnitDetail from './components/UnitDetail';
import CustomerList from './components/CustomerList';
import CustomerDetail from './components/CustomerDetail';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail';
import PaymentList from './components/PaymentList';
import UserGuide from './components/UserGuide';
import { MOCK_CONTRACTS } from './constants';
import { Unit, Contract, Product } from './types';
import { ContractService } from './services';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import { useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import DebugPanel from './components/DebugPanel';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Default "All Units" selection
  const ALL_UNIT: Unit = {
    id: 'all',
    name: 'Toàn công ty',
    code: 'ALL',
    type: 'Company',
    target: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
    lastYearActual: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
  };
  const [selectedUnit, setSelectedUnit] = useState<Unit>(ALL_UNIT);
  const [viewingContractId, setViewingContractId] = useState<string | null>(null);
  const [viewingPersonnelId, setViewingPersonnelId] = useState<string | null>(null);
  const [viewingUnitId, setViewingUnitId] = useState<string | null>(null);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);
  const [viewingProductId, setViewingProductId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [cloningContract, setCloningContract] = useState<Contract | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Auth Context
  const { session, isLoading: isLoadingSession, user, profile } = useAuth();

  // Theme management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('contract-pro-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    if (theme === 'dark') root.classList.add('dark');
    // Also apply accent from saved preference
    root.classList.remove('accent-blue');
    const savedAccent = localStorage.getItem('contract-pro-accent');
    if (savedAccent === 'blue') root.classList.add('accent-blue');
    localStorage.setItem('contract-pro-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleViewContract = (id: string) => {
    setViewingContractId(id);
    setActiveTab('contract-detail');
  };

  const handleBackToList = () => {
    setViewingContractId(null);
    setActiveTab('contracts');
  };

  const handleViewPersonnel = (id: string) => {
    setViewingPersonnelId(id);
    setActiveTab('personnel-detail');
  };

  const handleBackToPersonnelList = () => {
    setViewingPersonnelId(null);
    setActiveTab('personnel');
  };

  const handleViewCustomer = (id: string) => {
    setViewingCustomerId(id);
    setActiveTab('customer-detail');
  };

  const handleBackToCustomerList = () => {
    setViewingCustomerId(null);
    setActiveTab('customers');
  };

  const handleViewProduct = (id: string) => {
    setViewingProductId(id);
    setActiveTab('product-detail');
  };

  const handleBackToProductList = () => {
    setViewingProductId(null);
    setActiveTab('products');
  };

  const handleViewUnit = (id: string) => {
    setViewingUnitId(id);
    setActiveTab('unit-detail');
  };

  const handleBackToUnitList = () => {
    setViewingUnitId(null);
    setActiveTab('units');
  };

  const handleCloneContract = async (contract: Contract) => {
    try {
      // Fetch full details if needed (though list usually has most info, but detailed items might be missing if pagination optimization was aggressive)
      // For now trust the contract object passed, or fetch specifically 
      // Safe bet: fetch by ID to ensure we have lineItems and phases if lazy loaded
      const fullContract = await ContractService.getById(contract.id);
      if (fullContract) {
        setCloningContract(fullContract);
      } else {
        setCloningContract(contract); // Fallback
      }
    } catch (e) {
      console.error("Clone error", e);
      setCloningContract(contract);
    }
  };

  const renderContent = () => {
    // Create new contract
    if (isCreating) {
      return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <ContractForm
            onSave={async (data) => {
              try {
                await ContractService.create(data);
                setIsCreating(false);
                toast.success("Tạo hợp đồng thành công!");
                // Refresh is handled by component mount or we can force it if needed
              } catch (e: any) {
                console.error(e);
                toast.error("Có lỗi khi tạo hợp đồng: " + (e.message || JSON.stringify(e)));
              }
            }}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      );
    }

    // Edit existing contract
    if (editingContract) {
      return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <ContractForm
            contract={editingContract}
            onSave={async (data) => {
              try {
                await ContractService.update(editingContract.id, data);
                setEditingContract(null);
                toast.success("Cập nhật hợp đồng thành công!");
              } catch (e: any) {
                toast.error("Lỗi cập nhật: " + (e.message || e));
              }
            }}
            onCancel={() => setEditingContract(null)}
          />
        </div>
      );
    }

    // Clone existing contract
    if (cloningContract) {
      return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <ContractForm
            contract={cloningContract}
            isCloning={true}
            onSave={async (data) => {
              try {
                // Ensure ID is new (handled by form but double check here if needed)
                await ContractService.create(data);
                setCloningContract(null);
                toast.success("Nhân bản hợp đồng thành công!");
              } catch (e: any) {
                toast.error("Lỗi nhân bản: " + (e.message || e));
              }
            }}
            onCancel={() => setCloningContract(null)}
          />
        </div>
      );
    }

    if (activeTab === 'contract-detail' && viewingContractId) {
      return (
        <ContractDetail
          contractId={viewingContractId}
          onBack={handleBackToList}
          onEdit={(contract) => setEditingContract(contract)}
          onDelete={async () => {
            try {
              await ContractService.delete(viewingContractId);
              setViewingContractId(null);
              // Force refresh list logic? 
              // ContractList re-fetches on mount. When we back to list (setViewing(null)), activeTab actually needs to change?
              // Ah, App's logic is: if viewingContractId exists, we show Detail. If not, we show List (if activeTab is contracts).
              // So setting viewingContractId(null) will show ContractList.
              // ContractList has useEffect [] to fetch.
              toast.success("Đã xóa hợp đồng thành công!");
            } catch (e: any) {
              toast.error("Lỗi xóa hợp đồng: " + e.message);
            }
          }}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} onSelectContract={handleViewContract} />;
      case 'contracts':
        return <ContractList selectedUnit={selectedUnit} onSelectContract={handleViewContract} onAdd={() => setIsCreating(true)} onClone={handleCloneContract} />;
      case 'documents':
        return <DocumentManager />;
      case 'ai-assistant':
        return <AIAssistant />;
      case 'personnel':
        return <PersonnelList selectedUnit={selectedUnit} onSelectPersonnel={handleViewPersonnel} />;
      case 'personnel-detail':
        if (viewingPersonnelId) {
          return <PersonnelDetail personnelId={viewingPersonnelId} onBack={handleBackToPersonnelList} onViewContract={handleViewContract} />;
        }
        return <PersonnelList selectedUnit={selectedUnit} onSelectPersonnel={handleViewPersonnel} />;
      case 'customers':
        return <CustomerList onSelectCustomer={handleViewCustomer} />;
      case 'customer-detail':
        if (viewingCustomerId) {
          return <CustomerDetail customerId={viewingCustomerId} onBack={handleBackToCustomerList} onViewContract={handleViewContract} />;
        }
        return <CustomerList onSelectCustomer={handleViewCustomer} />;
      case 'products':
        return <ProductList onSelectProduct={handleViewProduct} />;
      case 'product-detail':
        if (viewingProductId) {
          return <ProductDetail productId={viewingProductId} onBack={handleBackToProductList} onEdit={() => setEditingProductId(viewingProductId)} onViewContract={handleViewContract} />;
        }
        return <ProductList onSelectProduct={handleViewProduct} />;
      case 'payments':
        return <PaymentList onSelectContract={handleViewContract} />;
      case 'analytics':
        return <Analytics selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} />;
      case 'settings':
        return (
          <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cài đặt hệ thống</h2>
              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">v2.4.0</span>
            </div>
            <div className="space-y-6">
              <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-4">Giao diện hệ thống</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setTheme('light')} className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all ${theme === 'light' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-500'}`}><Sun size={20} /><span className="font-bold text-sm">Sáng</span></button>
                  <button onClick={() => setTheme('dark')} className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all ${theme === 'dark' ? 'bg-indigo-900/40 border-indigo-500 text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-500'}`}><Moon size={20} /><span className="font-bold text-sm">Tối</span></button>
                </div>
              </div>

              <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-4">Dữ liệu & Hệ thống</p>
                <DataSeeder />
              </div>

              <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-4">Kiểm thử Hệ thống (Testing)</p>
                <PilotRunner />
              </div>
            </div>
          </div>
        );
      case 'units':
        return <UnitList onSelectUnit={handleViewUnit} />;
      case 'unit-detail':
        if (viewingUnitId) {
          return <UnitDetail
            unitId={viewingUnitId}
            onBack={handleBackToUnitList}
            onViewContract={handleViewContract}
            onViewPersonnel={handleViewPersonnel}
          />;
        }
        return <UnitList onSelectUnit={handleViewUnit} />;
      case 'user-guide':
        return <UserGuide />;
      default:
        return <Dashboard selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} onSelectContract={handleViewContract} />;
    }
  };

  const mainMarginClass = isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64';
  const contentMaxWidthClass = isSidebarCollapsed ? 'max-w-[1920px]' : 'max-w-[1600px]';

  if (isLoadingSession) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>;
  }

  if (!session) {
    return (
      <>
        <Auth />
        <Toaster richColors position="top-center" />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col transition-colors duration-300">
        <Sidebar
          activeTab={activeTab === 'contract-detail' ? 'contracts' : activeTab}
          setActiveTab={setActiveTab}
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onClose={() => setIsSidebarOpen(false)}
        />
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          user={session?.user}
        />

        {/* 
          QUAN TRỌNG: Loại bỏ padding khỏi main để con có thể bám sticky sát Header.
          Padding sẽ được áp dụng cho div bên trong.
      */}
        <main className={`flex-1 ${mainMarginClass} overflow-auto transition-all duration-300 ease-in-out`}>
          <div className={`mx-auto ${contentMaxWidthClass} p-4 md:p-8 transition-all duration-500 ease-in-out`}>
            {renderContent()}
          </div>
        </main>

        <button
          onClick={() => setIsCreating(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-40 md:hidden"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        </button>
        {import.meta.env.DEV && <DebugPanel />}
        <Toaster richColors position="top-center" />
        <RoleSwitcher />
      </div>
    </QueryClientProvider>
  );
};

export default App;
