import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { CONTRACT_STATUS_LABELS } from '../constants';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  User,
  FileText,
  Download,
  Edit3,
  History as HistoryIcon,
  Paperclip,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  ChevronRight,
  TrendingUp,
  ReceiptText,
  ShieldAlert,
  PackageCheck,
  GanttChart,
  Package,
  Briefcase,
  Percent,
  Wallet,
  Building2,
  Users,
  Trash2,
  Plus,
  Loader2,
  ExternalLink,
  HardDrive
} from 'lucide-react';
import { Contract, Unit, Milestone, PaymentPhase, AdministrativeCosts, ContractDocument } from '../types';
import { ContractService, UnitService, EmployeeService, CustomerService, DocumentService, WorkflowService, AuditLogService, AuditLog } from '../services';
import { analyzeContractWithDeepSeek } from '../services/openaiService';
import Tooltip from './ui/Tooltip';
import ContractBusinessPlanTab from './ContractBusinessPlanTab';
import ContractOverviewTab from './contract-detail/ContractOverviewTab';
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { ContractReviewPanel } from './workflow/ContractReviewPanel';
import { SubmitLegalDialog } from './workflow/SubmitLegalDialog';
import { AddDocumentLinkDialog } from './workflow/AddDocumentLinkDialog';
import { usePermissionCheck } from '../hooks/usePermissions';
import { useFinancialCalculations } from '../hooks/useFinancialCalculations';
import { formatVND, getStatusColor } from '../utils/contractHelpers';

interface ContractDetailProps {
  contract?: Contract;
  contractId?: string;
  onBack: () => void;
  onEdit: (contract: Contract) => void;
  onDelete: () => void;
}

const ContractDetail: React.FC<ContractDetailProps> = ({ contract: initialContract, contractId, onBack, onEdit, onDelete }) => {
  const [contract, setContract] = useState<Contract | null>(initialContract || null);
  const [loading, setLoading] = useState(!initialContract);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'pakd'>('overview');
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const { can, canOnContract } = usePermissionCheck();

  // Effective role (impersonation-aware) — for backward compat
  const effectiveRole = isImpersonating && impersonatedUser ? impersonatedUser.role : profile?.role;
  const effectiveUnitId = isImpersonating && impersonatedUser ? impersonatedUser.unitId : profile?.unitId;
  const effectiveEmployeeId = isImpersonating && impersonatedUser ? impersonatedUser.employeeId : profile?.employeeId;


  // Reference Names State
  const [unitName, setUnitName] = useState('...');
  const [salesName, setSalesName] = useState('...');
  const [customerName, setCustomerName] = useState('...');
  // Allocation display names
  const [allocationNames, setAllocationNames] = useState<{ unitName: string; employeeName: string; percent: number; role: string }[]>([]);

  // Documents State
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showLegalDialog, setShowLegalDialog] = useState(false);
  const [showDocLinkDialog, setShowDocLinkDialog] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Drive folder state
  const [driveFolderUrl, setDriveFolderUrl] = useState<string | null>(null);

  useEffect(() => {
    if (initialContract) {
      setContract(initialContract);
      setLoading(false);
      return;
    }

    if (contractId) {
      setLoading(true);
      ContractService.getById(contractId)
        .then(data => {
          if (data) setContract(data);
          else setError('Không tìm thấy hợp đồng');
        })
        .catch(err => setError('Lỗi tải hợp đồng: ' + err))
        .finally(() => setLoading(false));
    }
  }, [contractId, initialContract]);

  // Fetch References
  useEffect(() => {
    const fetchRefs = async () => {
      if (!contract) return;

      try {
        // Unit
        if (contract.unitId) {
          if (contract.unitId === 'all') setUnitName('Tất cả');
          else {
            const u = await UnitService.getById(contract.unitId);
            setUnitName(u?.name || 'Unknown');
          }
        }

        // Employee/Salesperson
        if (contract.salespersonId) {
          const emp = await EmployeeService.getById(contract.salespersonId);
          setSalesName(emp?.name || 'Unknown');
        }

        // Customer
        if (contract.customerId) {
          const c = await CustomerService.getById(contract.customerId);
          setCustomerName(c?.name || 'Unknown');
        } else if (contract.partyA) {
          setCustomerName(contract.partyA);
        }

        // Unit Allocations — resolve names for display
        if (contract.unitAllocations && contract.unitAllocations.length > 0) {
          const allocResults = await Promise.all(
            contract.unitAllocations.map(async (alloc) => {
              let uName = alloc.unitId;
              let eName = alloc.employeeId || '';
              try {
                const unit = await UnitService.getById(alloc.unitId);
                if (unit) uName = unit.name;
              } catch { /* fallback to ID */ }
              if (alloc.employeeId) {
                try {
                  const emp = await EmployeeService.getById(alloc.employeeId);
                  if (emp) eName = emp.name;
                } catch { /* fallback to ID */ }
              }
              return { unitName: uName, employeeName: eName, percent: alloc.percent, role: alloc.role };
            })
          );
          setAllocationNames(allocResults);
        } else {
          setAllocationNames([]);
        }

      } catch (e) {
        console.error("Error fetching refs", e);
      }
    };
    fetchRefs();
  }, [contract]);

  // Fetch Documents
  useEffect(() => {
    if (contract?.id) {
      DocumentService.getByContractId(contract.id)
        .then(setDocuments)
        .catch(e => console.error("Load docs error", e));
    }
  }, [contract?.id]);

  // Fetch Audit Logs
  useEffect(() => {
    if (contract?.id) {
      console.log('[ContractDetail] Fetching audit logs for contract:', contract.id);
      AuditLogService.getByRecordId('contracts', contract.id)
        .then(logs => {
          console.log('[ContractDetail] Audit logs received:', logs);
          setAuditLogs(logs);
        })
        .catch(e => console.error("Load audit logs error", e));
    }
  }, [contract?.id]);

  // Check if contract has a Drive folder
  useEffect(() => {
    if (contract?.id) {
      import('../services/driveInitService').then(({ DriveInitService }) => {
        DriveInitService.getContractFolderId(contract.id)
          .then(folderId => {
            if (folderId) {
              import('../services/googleDriveService').then(({ GoogleDriveService }) => {
                setDriveFolderUrl(GoogleDriveService.getFolderUrl(folderId));
              });
            }
          })
          .catch(() => { }); // Silently fail
      });
    }
  }, [contract?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !contract) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const newDoc = await DocumentService.uploadToDrive(
        contract.id,
        file,
        contract.unitId,
        contract.title || contract.partyA
      );
      setDocuments(prev => [newDoc, ...prev]);
      const isDrive = newDoc.type?.startsWith('drive:');
      toast.success(isDrive ? "Đã upload lên Google Drive!" : "Upload tài liệu thành công!");
    } catch (err: any) {
      toast.error("Upload thất bại: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDoc = useCallback(async (doc: ContractDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa tài liệu ${doc.name}?`)) return;
    try {
      await DocumentService.delete(doc.id, doc.filePath);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success("Đã xóa tài liệu");
    } catch (err: any) {
      toast.error("Xóa thất bại: " + err.message);
    }
  }, []);

  const handleDownloadDoc = useCallback(async (doc: ContractDocument) => {
    try {
      const blob = await DocumentService.download(doc.filePath);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error("Download error: " + e.message);
    }
  }, []);

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  // Business Logic Calculations via Hook
  const financialsData = useFinancialCalculations(
    contract?.lineItems || [],
    contract?.executionCosts || []
  );

  const financials = useMemo(() => {
    if (!contract) return null;
    return {
      totalOutput: financialsData.signingValue,
      totalRevenue: financialsData.estimatedRevenue,
      totalInput: financialsData.totalInput,
      totalDirect: financialsData.totalDirectCosts,
      totalExecution: financialsData.executionCostsSum,
      totalCosts: financialsData.totalCosts,
      grossProfit: financialsData.grossProfit,
      margin: financialsData.profitMargin
    };
  }, [contract, financialsData]);

  const getPaymentStatusBadge = useCallback((status: PaymentPhase['status']) => {
    switch (status) {
      case 'Paid': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">TIỀN VỀ</span>;
      case 'Overdue': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400">QUÁ HẠN</span>;
      case 'Pending': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">CHỜ THU</span>;
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">ĐÃ XUẤT HĐ</span>;
    }
  }, []);

  // Restore AI Analysis function
  const handleAnalyzeContract = useCallback(async () => {
    if (!contract || !financials) return;
    setIsAnalyzing(true);
    try {
      const contractText = `
        LOẠI HỢP ĐỒNG: ${contract.contractType}
        TIÊU ĐỀ: ${contract.title}
        MÃ: ${contract.id}
        KHÁCH HÀNG: ${customerName} (ID: ${contract.customerId})
        GIÁ TRỊ: ${formatVND(financials.totalOutput)}
        LỢI NHUẬN GỘP: ${formatVND(financials.grossProfit)} (${financials.margin.toFixed(1)}%)
        NGÀY KÝ: ${contract.signedDate}
        TRẠNG THÁI: ${contract.status}
        
        CÁC HẠNG MỤC (${contract.lineItems?.length || 0}):
        ${contract.lineItems?.map(i => `- ${i.name}: SL ${i.quantity}, Đơn giá ${formatVND(i.outputPrice)}`).join('\n')}

        TIẾN ĐỘ THANH TOÁN:
        ${contract.paymentPhases?.map(p => `- ${p.name}: ${formatVND(p.amount)} (${p.status}) - Hạn: ${p.dueDate}`).join('\n')}
        `;

      const result = await analyzeContractWithDeepSeek(contractText);
      setAiAnalysisResult(result);
      toast.success("Phân tích AI hoàn tất!");
    } catch (error) {
      console.error(error);
      toast.error("Không thể phân tích rủi ro lúc này.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [contract, financials, customerName]);

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu hợp đồng...</div>;
  if (error || !contract || !financials) return <div className="p-8 text-center text-rose-500 font-bold">{error || 'Không tìm thấy dữ liệu'}</div>;

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-12">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-slate-500"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(contract?.id || '');
                    toast.success('Đã copy mã hợp đồng!');
                  }}
                  title="Click để copy mã hợp đồng"
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded uppercase tracking-wider hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
                >
                  {contract?.id}
                </button>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(contract?.status || '')} uppercase`}>
                  {CONTRACT_STATUS_LABELS[contract?.status || ''] || contract?.status}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{contract?.title}</h1>

              <div className="flex flex-wrap gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <Building2 size={14} />
                  <span>Đơn vị: <b className="text-slate-700 dark:text-slate-200">{unitName}</b></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <User size={14} />
                  <span>PIC: <b className="text-slate-700 dark:text-slate-200">{salesName}</b></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <Users size={14} />
                  <span>Khách hàng: <b className="text-slate-700 dark:text-slate-200">{customerName}</b></span>
                </div>
              </div>
              {/* Unit Allocations Display */}
              {allocationNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {allocationNames.map((alloc, i) => (
                    <div
                      key={i}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${alloc.role === 'lead'
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                        }`}
                    >
                      <Building2 size={12} />
                      <span className="font-bold">{alloc.role === 'lead' ? 'Chủ trì' : 'Phối hợp'}:</span>
                      <span>{alloc.unitName}</span>
                      {alloc.employeeName && (
                        <><span className="text-slate-400 dark:text-slate-500">•</span><User size={11} /><span>{alloc.employeeName}</span></>
                      )}
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-800/60 text-[10px] font-black">{alloc.percent}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {can('contracts', 'delete') && (
              <button
                onClick={() => {
                  if (window.confirm("Bạn có chắc chắn muốn xóa hợp đồng này không? hành động này không thể hoàn tác.")) {
                    onDelete();
                  }
                }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
              >
                <div className="w-4 h-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg></div>
                Xóa
              </button>
            )}

            {canOnContract('update', { unitId: contract?.unitId, salespersonId: contract?.salespersonId }) && (
              <button
                onClick={() => contract && onEdit(contract)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                <Edit3 size={16} />
                Chỉnh sửa
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 dark:shadow-none"
            >
              <Download size={16} />
              In PDF
            </button>
          </div>
        </div>

        {/* CRM: Contract approval panel hidden — will be re-enabled in CRM module */}

        {/* TABS */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Tổng quan
          </button>
          <button
            onClick={() => setActiveTab('pakd')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'pakd' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            PAKD & Dòng tiền
          </button>
        </div>

        {/* Content - PAKD tab */}
        {activeTab === 'pakd' && contract && (
          <div className="w-full">
            <ContractBusinessPlanTab contract={contract} onUpdate={() => { /* maybe refresh contract */ }} />
          </div>
        )}

        {/* Content - Overview tab (extracted to sub-component) */}
        {activeTab === 'overview' && contract && (
          <ContractOverviewTab
            contract={contract}
            financials={financials}
            documents={documents}
            auditLogs={auditLogs}
            driveFolderUrl={driveFolderUrl}
            aiAnalysisResult={aiAnalysisResult}
            isAnalyzing={isAnalyzing}
            handleAnalyzeContract={handleAnalyzeContract}
            setAiAnalysisResult={setAiAnalysisResult}
            handleDownloadDoc={handleDownloadDoc}
            handleDeleteDoc={handleDeleteDoc}
            setShowDocLinkDialog={setShowDocLinkDialog}
            getPaymentStatusBadge={getPaymentStatusBadge}
          />
        )}
      </div>

      {/* CRM: Submit Legal Dialog hidden — will be re-enabled in CRM module */}

      {/* Add Document Link Dialog */}
      {contract && (
        <AddDocumentLinkDialog
          isOpen={showDocLinkDialog}
          onClose={() => setShowDocLinkDialog(false)}
          onSubmit={async (doc) => {
            try {
              if (doc.file) {
                const toastId = toast.loading('Đang tải lên tài liệu...');
                const newDoc = await DocumentService.uploadToDrive(
                  contract.id,
                  doc.file,
                  contract.unitId,
                  contract.title || contract.partyA,
                  doc.docType
                );
                setDocuments(prev => [newDoc, ...prev]);
                toast.dismiss(toastId);
                toast.success('Đã tải lên tài liệu thành công!');
              } else {
                const newDoc = await DocumentService.addLink(contract.id, doc);
                setDocuments(prev => [newDoc, ...prev]);
                toast.success('Đã thêm tài liệu thành công!');
              }
              setShowDocLinkDialog(false);
            } catch (err: any) {
              toast.dismiss();
              toast.error('Thêm tài liệu thất bại: ' + err.message);
            }
          }}
        />
      )}
    </ErrorBoundary>
  );
};

export default ContractDetail;
