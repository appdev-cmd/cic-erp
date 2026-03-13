import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { formatVND, getStatusColor, getWarningBadges } from '../utils/contractHelpers';
import { formatDate } from '../utils/formatters';
import { useSlidePanel } from '../contexts/SlidePanelContext';
import CustomerDetail from './CustomerDetail';
import AcceptanceDialog from './ui/AcceptanceDialog';

interface ContractDetailProps {
  contract?: Contract;
  initialContract?: any;
  contractId?: string;
  onBack: () => void;
  onEdit: (contract: Contract) => void;
  onDelete: () => Promise<void>;
}

const ContractDetail: React.FC<ContractDetailProps> = ({ contract: initialContract, contractId, onBack, onEdit, onDelete }) => {
  const [contract, setContract] = useState<Contract | null>(initialContract || null);
  const [loading, setLoading] = useState(!initialContract);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'pakd'>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAcceptanceDialog, setShowAcceptanceDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const { can, canOnContract } = usePermissionCheck();
  const navigate = useNavigate();

  // Slide panel for nested navigation (always available within MainLayout)
  const { openPanel: openPanelFn, closePanel: closePanelFn } = useSlidePanel();
  const slidePanelAvailable = true;

  // Effective role (impersonation-aware) — for backward compat
  const effectiveRole = isImpersonating && impersonatedUser ? impersonatedUser.role : profile?.role;
  const effectiveUnitId = isImpersonating && impersonatedUser ? impersonatedUser.unitId : profile?.unitId;
  const effectiveEmployeeId = isImpersonating && impersonatedUser ? impersonatedUser.employeeId : profile?.employeeId;


  // Reference Names State
  const [unitName, setUnitName] = useState('...');
  const [salesName, setSalesName] = useState('...');
  const [customerName, setCustomerName] = useState('...');
  const [customerShortName, setCustomerShortName] = useState('');
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

  // ── Auto-update via custom event (fired by ContractFormInPanel after save) ──
  useEffect(() => {
    const handleContractUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (contractId && (!detail?.contractId || detail.contractId === contractId)) {
        console.log('[ContractDetail] contract-updated event received!', detail);
        // Use saved contract data directly (no network refetch needed)
        if (detail?.contract) {
          setContract(detail.contract);
        } else if (contractId) {
          // Fallback: refetch from DB
          ContractService.getById(contractId)
            .then(data => { if (data) setContract(data); })
            .catch(err => console.error('Refetch error:', err));
        }
      }
    };
    window.addEventListener('contract-updated', handleContractUpdated);
    return () => window.removeEventListener('contract-updated', handleContractUpdated);
  }, [contractId]);

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

        // Employee/Salesperson — prioritize lead from employee_allocations
        const leadAlloc = contract.employeeAllocations?.find((a: any) => a.role === 'lead') || contract.employeeAllocations?.[0];
        const picId = leadAlloc?.employeeId || contract.salespersonId;
        if (picId) {
          console.log('[DEBUG ContractDetail] PIC id:', picId, '(from', leadAlloc ? 'allocations' : 'salespersonId', ')');
          const emp = await EmployeeService.getById(picId);
          setSalesName(emp?.name || 'Unknown');
        }

        // Customer
        if (contract.customerId) {
          const c = await CustomerService.getById(contract.customerId);
          setCustomerName(c?.name || 'Unknown');
          setCustomerShortName(c?.shortName || '');
        } else if (contract.partyA) {
          setCustomerName(contract.partyA);
          setCustomerShortName('');
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
      case 'Advance': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">TẠM ỨNG</span>;
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
        MÃ: ${contract.contractCode}
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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pr-10 md:pr-12">
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
                    navigator.clipboard.writeText(contract?.contractCode || '');
                    toast.success('Đã copy mã hợp đồng!');
                  }}
                  title="Click để copy mã hợp đồng"
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded uppercase tracking-wider hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
                >
                  {contract?.contractCode}
                </button>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(contract?.status || '')} uppercase`}>
                  {CONTRACT_STATUS_LABELS[contract?.status || ''] || contract?.status}
                </span>
                {contract?.classification && contract.classification !== 'Thông thường' && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    contract.classification === 'Bán qua đại lý' ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800'
                    : contract.classification === 'Khách bị LC' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                    : contract.classification === 'Hỗ trợ đối tác' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}>
                    {contract.classification}
                  </span>
                )}
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
                  <span>Khách hàng: {contract.customerId ? (
                    <button
                      onClick={() => {
                        if (slidePanelAvailable && openPanelFn && closePanelFn) {
                          const closeP = closePanelFn;
                          const openP = openPanelFn;
                          openP({
                            title: `Khách hàng: ${customerName}`,
                            url: `/customers/${contract.customerId}`,
                            component: (
                              <div className="p-4 md:p-6 lg:p-8">
                                <CustomerDetail
                                  customerId={contract.customerId!}
                                  onBack={() => closeP()}
                                  onViewContract={(contractId) => {
                                    openP({
                                      title: `Hợp đồng ${contractId}`,
                                      url: `/contracts/${contractId}`,
                                      component: (
                                        <div className="p-4 md:p-6 lg:p-8">
                                          <ContractDetail
                                            contractId={contractId}
                                            onBack={() => closeP()}
                                            onEdit={() => { }}
                                            onDelete={async () => { closeP(); }}
                                          />
                                        </div>
                                      ),
                                    });
                                  }}
                                />
                              </div>
                            ),
                          });
                        } else {
                          navigate(`/customers/${contract.customerId}`);
                        }
                      }}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                      title="Click để xem chi tiết khách hàng"
                    >
                      {customerName}{customerShortName && !customerName.includes(customerShortName) ? ` (${customerShortName})` : ''}
                    </button>
                  ) : (
                    <b className="text-slate-700 dark:text-slate-200">{customerName}</b>
                  )}</span>
                </div>
                {contract.customerContractNumber && (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <FileText size={14} className="text-amber-500" />
                    <span className="text-slate-500 dark:text-slate-400">Số HĐ KH: <b className="text-amber-600 dark:text-amber-400">{contract.customerContractNumber}</b></span>
                  </div>
                )}
                {contract.endUserName && (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <User size={14} className="text-teal-500" />
                    <span className="text-slate-500 dark:text-slate-400">End User: <b className="text-teal-600 dark:text-teal-400">{contract.endUserName}</b></span>
                  </div>
                )}
              </div>
              {/* Contract dates row */}
              <div className="flex flex-wrap gap-4 mt-2">
                {contract.signedDate && (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Calendar size={14} className="text-emerald-500" />
                    <span className="text-slate-500 dark:text-slate-400">Ngày ký: <b className="text-emerald-600 dark:text-emerald-400">{formatDate(contract.signedDate)}</b></span>
                  </div>
                )}
                {/* Status transition dates */}
                {contract.handoverDate && (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <PackageCheck size={14} className="text-cyan-500" />
                    <span className="text-slate-500 dark:text-slate-400">Bàn giao: <b className="text-cyan-600 dark:text-cyan-400">{formatDate(contract.handoverDate)}</b></span>
                  </div>
                )}
                {contract.acceptanceDate && (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <CheckCircle2 size={14} className="text-blue-500" />
                    <span className="text-slate-500 dark:text-slate-400">Nghiệm thu: <b className="text-blue-600 dark:text-blue-400">{formatDate(contract.acceptanceDate)}</b></span>
                    {contract.acceptanceValue != null && (
                      <span className="text-slate-500 dark:text-slate-400">— GT: <b className="text-blue-600 dark:text-blue-400">{formatVND(contract.acceptanceValue)}</b></span>
                    )}
                  </div>
                )}
                {contract.completedDate && (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-slate-500 dark:text-slate-400">Hoàn thành: <b className="text-emerald-600 dark:text-emerald-400">{formatDate(contract.completedDate)}</b></span>
                  </div>
                )}
                {contract.suspendedDate && (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <AlertCircle size={14} className="text-rose-500" />
                    <span className="text-slate-500 dark:text-slate-400">Tạm dừng: <b className="text-rose-600 dark:text-rose-400">{formatDate(contract.suspendedDate)}</b></span>
                  </div>
                )}
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
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            {can('contracts', 'delete') && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
              >
                <Trash2 size={16} />
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

        {/* WARNING BANNERS */}
        {contract.warnings && (contract.warnings.isOverdueAdvance || contract.warnings.isOverduePayment || contract.warnings.isAcceptedNoInvoice) && (
          <div className="flex flex-col gap-2">
            {contract.warnings.isOverdueAdvance && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">⚠️ Quá hạn tạm ứng — Kế hoạch tạm ứng đã quá hạn và chưa nhận được tiền</span>
              </div>
            )}
            {contract.warnings.isOverduePayment && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-sm font-bold text-red-700 dark:text-red-400">🔴 Quá hạn thanh toán — Đã xuất HĐ VAT nhưng tiền chưa về đủ và đã quá hạn due_date</span>
              </div>
            )}
            {contract.warnings.isAcceptedNoInvoice && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <AlertCircle size={18} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="text-sm font-bold text-purple-700 dark:text-purple-400">📋 Đã nghiệm thu nhưng chưa xuất hóa đơn VAT — Cần xuất HĐ doanh thu theo ngày nghiệm thu</span>
              </div>
            )}
          </div>
        )}

        {/* STATUS CHANGE SECTION */}
        {canOnContract('update', { unitId: contract?.unitId, salespersonId: contract?.salespersonId }) && contract.status !== 'Completed' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Chuyển trạng thái:</span>
            <div className="flex gap-2 flex-wrap">
              {(['Processing', 'Suspended', 'Handover', 'Acceptance'] as const)
                .filter(s => s !== contract.status)
                .map(targetStatus => {
                  const labels: Record<string, string> = { Processing: 'Đang thực hiện', Suspended: 'Tạm dừng', Handover: 'Bàn giao', Acceptance: 'Nghiệm thu/TL' };
                  const colors: Record<string, string> = {
                    Processing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 border-orange-200 dark:border-orange-800',
                    Suspended: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 border-rose-200 dark:border-rose-800',
                    Handover: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-900/50 border-cyan-200 dark:border-cyan-800',
                    Acceptance: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800',
                  };
                  const datePromptMap: Record<string, string> = { Handover: 'Nhập ngày bàn giao (dd/mm/yyyy):', Suspended: 'Nhập ngày tạm dừng (dd/mm/yyyy):' };
                  const dateFieldMap: Record<string, string> = { Handover: 'handoverDate', Suspended: 'suspendedDate' };
                  return (
                    <button
                      key={targetStatus}
                      onClick={async () => {
                        // Acceptance: mở dialog thay vì prompt
                        if (targetStatus === 'Acceptance') {
                          setShowAcceptanceDialog(true);
                          return;
                        }
                        let updateData: Record<string, any> = { status: targetStatus };
                        if (datePromptMap[targetStatus]) {
                          const today = new Date();
                          const defaultDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                          const inputDate = prompt(datePromptMap[targetStatus], defaultDate);
                          if (!inputDate) return;
                          const parts = inputDate.split('/');
                          if (parts.length === 3) {
                            const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            updateData[dateFieldMap[targetStatus]] = isoDate;
                          }
                        }
                        try {
                          await ContractService.update(contract.id, updateData as any);
                          setContract(prev => prev ? { ...prev, ...updateData } as any : prev);
                          toast.success(`Đã chuyển trạng thái → ${labels[targetStatus]}`);
                        } catch (err: any) {
                          toast.error('Lỗi: ' + (err.message || err));
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${colors[targetStatus]}`}
                    >
                      {labels[targetStatus]}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

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
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <Trash2 size={24} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Xóa hợp đồng</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Bạn có chắc chắn muốn xóa hợp đồng <strong className="text-slate-900 dark:text-slate-100">{contract?.contractCode}</strong> không? Tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDelete();
                  } catch {
                    setIsDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <><Loader2 size={16} className="animate-spin" /> Đang xóa...</>
                ) : (
                  <><Trash2 size={16} /> Xác nhận xóa</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Acceptance Dialog */}
      {contract && (
        <AcceptanceDialog
          isOpen={showAcceptanceDialog}
          onClose={() => setShowAcceptanceDialog(false)}
          defaultValue={contract.value || 0}
          onConfirm={async ({ date, value }) => {
            setShowAcceptanceDialog(false);
            const updateData: Record<string, any> = {
              status: 'Acceptance',
              acceptanceDate: date,
              acceptanceValue: value,
            };
            try {
              await ContractService.update(contract.id, updateData as any);
              setContract(prev => prev ? { ...prev, ...updateData } as any : prev);
              toast.success('Đã chuyển trạng thái → Nghiệm thu/TL');
            } catch (err: any) {
              toast.error('Lỗi: ' + (err.message || err));
            }
          }}
        />
      )}
    </ErrorBoundary>
  );
};

export default ContractDetail;
