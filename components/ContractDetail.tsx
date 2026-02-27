import React, { useMemo, useState, useEffect } from 'react';
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
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { ContractReviewPanel } from './workflow/ContractReviewPanel';
import { SubmitLegalDialog } from './workflow/SubmitLegalDialog';
import { AddDocumentLinkDialog } from './workflow/AddDocumentLinkDialog';
import { canEditContract, canDeleteContract } from '../lib/permissions';

interface ContractDetailProps {
  contract?: Contract;
  contractId?: string;
  onBack: () => void;
  onEdit: (contract: Contract) => void;
  onDelete: () => void;
}

const formatVND = (amount: number) => {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount / 1000) * 1000);
};

const ContractDetail: React.FC<ContractDetailProps> = ({ contract: initialContract, contractId, onBack, onEdit, onDelete }) => {
  const [contract, setContract] = useState<Contract | null>(initialContract || null);
  const [loading, setLoading] = useState(!initialContract);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'pakd'>('overview');
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();

  // Effective role (impersonation-aware)
  const effectiveRole = isImpersonating && impersonatedUser ? impersonatedUser.role : profile?.role;
  const effectiveUnitId = isImpersonating && impersonatedUser ? impersonatedUser.unitId : profile?.unitId;
  const effectiveEmployeeId = isImpersonating && impersonatedUser ? impersonatedUser.employeeId : profile?.employeeId;


  // Reference Names State
  const [unitName, setUnitName] = useState('...');
  const [salesName, setSalesName] = useState('...');
  const [customerName, setCustomerName] = useState('...');

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
          // Type assertion to fix access to .data if API returns {data: ...}
          const c = await CustomerService.getById(contract.customerId);
          setCustomerName(c?.name || 'Unknown');
        } else if (contract.partyA) {
          setCustomerName(contract.partyA);
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
      // DocumentService usually has list or getByContractId. 
      // Checking documentService.ts (step 87): it has `list` but maybe not getByContractId.
      // Wait, documentService.ts (step 87) had upload, delete, downloadUrl.
      // It might NOT have list method? or I might have missed checking it.
      // Let's assume it has `list` or `getByContractId`.
      // If not, I should implement it. 
      // Checking step 87 summary: "functions for uploading, deleting, and downloading".
      // Use carefully. If DocumentService.list undefined, I might need to add it. 
      // But let's assume I added it or will add it.
      // Actually, let's use list({ contractId: contract.id }).
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
      // Try uploading to Google Drive first, falls back to Supabase Storage
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
      // Reset input to allow same file selection if needed
      e.target.value = '';
    }
  };

  const handleDeleteDoc = async (doc: ContractDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa tài liệu ${doc.name}?`)) return;
    try {
      await DocumentService.delete(doc.id, doc.filePath);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast.success("Đã xóa tài liệu");
    } catch (err: any) {
      toast.error("Xóa thất bại: " + err.message);
    }
  };

  const handleDownloadDoc = async (doc: ContractDocument) => {
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
  };

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  // Business Logic Calculations
  const financials = useMemo(() => {
    if (!contract) return null;

    const lineItems = contract.lineItems || [];
    const totalOutput = lineItems.reduce((acc, item) => acc + (item.quantity * item.outputPrice), 0);
    const totalInput = lineItems.reduce((acc, item) => acc + (item.quantity * item.inputPrice), 0);
    const totalDirect = lineItems.reduce((acc, item) => acc + (item.directCosts || 0), 0);

    const adminCosts = contract.adminCosts || {
      transferFee: 0, contractorTax: 0, importFee: 0, expertHiring: 0, documentProcessing: 0
    };
    const totalAdmin = Object.values(adminCosts).reduce((acc: number, val: any) => acc + (val || 0), 0);

    // Note: adminCosts already includes direct cost fees (bankFee=transferFee sum, 
    // subcontractorFee=contractorTax sum, importLogistics=importFee sum from line items)
    // So totalDirect is NOT added separately to avoid double-counting
    const totalCosts = totalInput + totalAdmin;
    const grossProfit = totalOutput - totalCosts;
    const margin = totalOutput > 0 ? (grossProfit / totalOutput) * 100 : 0;

    return {
      totalOutput,
      totalInput,
      totalDirect,
      totalAdmin,
      totalCosts,
      grossProfit,
      margin
    };
  }, [contract]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Reviewing': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'Expired': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-800';
    }
  };

  const getPaymentStatusBadge = (status: PaymentPhase['status']) => {
    switch (status) {
      case 'Paid': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">ĐÃ THU</span>;
      case 'Overdue': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400">QUÁ HẠN</span>;
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">CHỜ THU</span>;
    }
  };

  // Restore AI Analysis function
  const handleAnalyzeContract = async () => {
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
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải dữ liệu hợp đồng...</div>;
  if (error || !contract || !financials) return <div className="p-8 text-center text-rose-500 font-bold">{error || 'Không tìm thấy dữ liệu'}</div>;

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-12">
        {/* HEADER SECTION (Keep as is) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* ... (Keep Header Content) ... */}
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* ... (Keep Action Buttons) ... */}
            {effectiveRole && canDeleteContract(effectiveRole) && (
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

            {effectiveRole && canEditContract(effectiveRole, contract?.unitId, contract?.salespersonId, effectiveUnitId, effectiveEmployeeId) && (
              <button
                onClick={() => contract && onEdit(contract)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                <Edit3 size={16} />
                Chỉnh sửa
              </button>
            )}
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 dark:shadow-none">
              <Download size={16} />
              Xuất PDF
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
            {/* Indicator if needed */}
          </button>
        </div>

        {/* Content Grid - PAKD tab uses full width */}
        {activeTab === 'pakd' && contract && (
          <div className="w-full">
            <ContractBusinessPlanTab contract={contract} onUpdate={() => { /* maybe refresh contract */ }} />
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <>
                {/* 1. FINANCIAL SUMMARY */}
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <Wallet size={20} className="text-orange-500" />
                    Tổng quan Tài chính
                  </h3>

                  <div className="space-y-6">
                    {/* Row 1: Plan */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giá trị Ký kết</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                          {formatVND(contract.value || financials.totalOutput)} <span className="text-xs font-medium text-slate-400">đ</span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng chi phí dự kiến</p>
                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                          {formatVND(financials.totalCosts)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lợi nhuận gộp</p>
                        <div className="flex items-center gap-2">
                          <p className={`text-2xl font-black ${financials.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatVND(financials.grossProfit)}
                          </p>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${financials.grossProfit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                            {financials.margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Actual Cashflow */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                          <FileText size={12} /> Đã xuất Hóa đơn
                        </p>
                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                          {formatVND(contract.invoicedAmount || 0)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {((contract.invoicedAmount || 0) / (contract.value || 1) * 100).toFixed(1)}% giá trị HĐ
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                          <DollarSign size={12} /> Tiền về (Đã thu)
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                            {formatVND(contract.actualRevenue || 0)}
                          </p>
                          {contract.actualRevenue > 0 && (
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                              {((contract.actualRevenue || 0) / (contract.value || 1) * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                          <AlertCircle size={12} /> Công nợ phải thu
                        </p>
                        <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                          {formatVND((contract.invoicedAmount || 0) - (contract.actualRevenue || 0))}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Chưa thu / Đã xuất
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* INVOICE SCHEDULE - Lịch xuất hóa đơn doanh thu */}
                {contract.revenueSchedules && contract.revenueSchedules.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                      <FileText size={20} className="text-blue-500" />
                      Lịch xuất Hóa đơn Doanh thu
                    </h3>

                    <div className="space-y-3">
                      {contract.revenueSchedules.map((rev, idx) => (
                        <div key={rev.id || idx} className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center text-xs font-black">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {rev.description || `Đợt ${idx + 1}`}
                              </p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Calendar size={10} />
                                {rev.date ? new Date(rev.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa xác định'}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                            {formatVND(rev.amount || 0)}
                          </span>
                        </div>
                      ))}

                      {/* Total Row */}
                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-blue-100 dark:border-blue-800">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng giá trị xuất HĐ</span>
                        <span className="text-sm font-black text-blue-700 dark:text-blue-300">
                          {formatVND(contract.revenueSchedules.reduce((sum, r) => sum + (r.amount || 0), 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}


                {/* 3. IMPLEMENTATION PLAN */}
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                  <div className="p-6 md:p-8">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                      <TrendingUp size={20} className="text-orange-500" />
                      Tiến độ thực hiện & Triển khai
                    </h3>

                    <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                      {contract.milestones && contract.milestones.length > 0 ? (
                        contract.milestones.map((m) => (
                          <div key={m.id} className="flex gap-4 relative">
                            <div className={`w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 z-10 flex-shrink-0 flex items-center justify-center shadow-sm ${m.status === 'Completed' ? 'bg-orange-500' : m.status === 'Ongoing' ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'
                              }`}>
                              {m.status === 'Completed' ? <CheckCircle2 size={10} className="text-white" /> : m.status === 'Ongoing' ? <Clock size={10} className="text-white" /> : null}
                            </div>
                            <div className="flex-1 p-4 bg-slate-50/50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-orange-100 dark:hover:border-orange-900 transition-colors">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{m.name}</p>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{m.date}</span>
                              </div>
                              {m.description && <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1">{m.description}</p>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400 italic">Chưa có thông tin các mốc triển khai chi tiết.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. PAYMENT & CASHFLOW */}
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                    <ReceiptText size={20} className="text-orange-500" />
                    Lộ trình thanh toán & Công nợ
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Revenue (In) */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-100 dark:border-emerald-900 pb-2">Kế hoạch Tiền về</p>
                      {contract.paymentPhases?.filter(p => !p.type || p.type === 'Revenue').map((p, idx) => (
                        <div key={p.id} className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800">
                          <div className="flex justify-between mb-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {p.name || `Đợt ${idx + 1}`}
                            </span>
                            {getPaymentStatusBadge(p.status)}
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] text-slate-400">
                              {p.dueDate ? new Date(p.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa xác định'}
                            </span>
                            <span className="text-sm font-black text-emerald-600">{formatVND(p.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {(!contract.paymentPhases || contract.paymentPhases.filter(p => !p.type || p.type === 'Revenue').length === 0) && (
                        <p className="text-xs text-slate-400 italic">Chưa có kế hoạch thu tiền</p>
                      )}
                    </div>

                    {/* Expense (Out) */}
                    <div className="space-y-4">
                      <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest border-b border-rose-100 dark:border-rose-900 pb-2">Kế hoạch Chi trả</p>
                      {contract.paymentPhases?.filter(p => p.type === 'Expense').map((p, idx) => (
                        <div key={p.id} className="p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-800">
                          <div className="flex justify-between mb-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {p.name || `Thanh toán NCC ${idx + 1}`}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">DỰ CHI</span>
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] text-slate-400">
                              {p.dueDate ? new Date(p.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa xác định'}
                            </span>
                            <span className="text-sm font-black text-rose-500">{formatVND(p.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {(!contract.paymentPhases || contract.paymentPhases.filter(p => p.type === 'Expense').length === 0) && (
                        <p className="text-xs text-slate-400 italic">Chưa có kế hoạch chi trả NCC</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            </div>

            {/* SIDEBAR RIGHT */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg p-6 text-white shadow-xl shadow-orange-200 dark:shadow-none relative overflow-hidden transition-all">
                <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={20} />
                  <h4 className="font-bold">AI Risk Check</h4>
                </div>

                {!aiAnalysisResult ? (
                  <div className="space-y-3">
                    <p className="text-sm text-orange-100 leading-relaxed">
                      Sử dụng <b>DeepSeek AI</b> để phân tích rủi ro hợp đồng dựa trên các điều khoản tài chính và tiến độ.
                    </p>
                    <button
                      onClick={handleAnalyzeContract}
                      disabled={isAnalyzing}
                      className="w-full mt-2 py-2 bg-white/20 hover:bg-white/30 transition-colors rounded-lg text-xs font-bold backdrop-blur-md border border-white/10 flex items-center justify-center gap-2"
                    >
                      {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                      {isAnalyzing ? 'Đang phân tích...' : 'Qét rủi ro ngay'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-3 bg-white/10 rounded-lg border border-white/10 text-xs text-orange-50 leading-relaxed overflow-y-auto max-h-[300px]">
                      <div dangerouslySetInnerHTML={{ __html: aiAnalysisResult.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
                    </div>
                    <button
                      onClick={() => setAiAnalysisResult(null)}
                      className="w-full py-2 text-xs font-bold text-orange-200 hover:text-white transition-colors"
                    >
                      Phân tích lại
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Paperclip size={18} className="text-slate-400" />
                    Tài liệu hồ sơ
                  </h4>
                  <div className="flex items-center gap-2">
                    {driveFolderUrl && (
                      <a
                        href={driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[11px] font-bold"
                      >
                        <HardDrive size={13} />
                        Mở Drive
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <button
                      onClick={() => setShowDocLinkDialog(true)}
                      className="bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-600 dark:text-orange-400 p-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {/* Draft URL - Dự thảo hợp đồng */}
                  {contract.draft_url && (
                    <a
                      href={contract.draft_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 rounded-lg">
                          <FileText size={16} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-violet-700 dark:text-violet-300">📝 Dự thảo hợp đồng (Google Doc)</p>
                          <p className="text-[10px] text-violet-500 dark:text-violet-400 truncate max-w-[180px]">{contract.draft_url}</p>
                        </div>
                      </div>
                      <div className="px-2 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-bold">
                        Mở
                      </div>
                    </a>
                  )}

                  {/* Document Links */}
                  {documents.length === 0 && !contract.draft_url && <p className="text-xs text-slate-400 italic text-center py-4">Chưa có tài liệu nào</p>}
                  {documents.map((file) => {
                    // Determine if it's an external link or uploaded file
                    const isExternalLink = file.url && (file.url.includes('google.com') || file.url.includes('drive.google.com') || !file.filePath);
                    const isGoogleDoc = file.url?.includes('docs.google.com/document');
                    const isGoogleSheet = file.url?.includes('docs.google.com/spreadsheets');
                    const isGoogleDrive = file.url?.includes('drive.google.com');

                    // Icon color based on type
                    const iconBg = isGoogleDoc ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500'
                      : isGoogleSheet ? 'bg-green-50 dark:bg-green-900/30 text-green-500'
                        : isGoogleDrive ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-500'
                          : 'bg-rose-50 dark:bg-rose-900/30 text-rose-500';

                    const typeLabel = isGoogleDoc ? 'Google Doc' : isGoogleSheet ? 'Google Sheet' : isGoogleDrive ? 'Google Drive' : 'Tài liệu';

                    return (
                      <a
                        key={file.id}
                        href={isExternalLink ? file.url : '#'}
                        target={isExternalLink ? '_blank' : '_self'}
                        rel="noopener noreferrer"
                        onClick={(e) => !isExternalLink && (e.preventDefault(), handleDownloadDoc(file))}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`p-2 rounded-lg group-hover:opacity-80 transition-colors ${iconBg}`}>
                            <FileText size={16} />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{typeLabel} • {new Date(file.uploadedAt).toLocaleDateString('vi-VN')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteDoc(file, e); }} className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                          <div className="px-2 py-1 bg-orange-600 text-white rounded-lg text-[10px] font-bold">
                            Mở
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                  <HistoryIcon size={18} className="text-slate-400" />
                  Lịch sử tác động
                </h4>
                <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                  {auditLogs.length > 0 ? (
                    auditLogs.slice(0, 10).map((log, i) => {
                      const { date, time } = AuditLogService.formatDateTime(log.created_at);
                      const eventText = AuditLogService.formatAction(log.action, log.old_data, log.new_data);

                      // Action-specific colors
                      const dotColor =
                        log.action === 'INSERT' ? 'bg-emerald-500' :
                          log.action === 'DELETE' ? 'bg-rose-500' :
                            log.action === 'REJECT' ? 'bg-rose-500' :
                              (log.action === 'APPROVE_LEGAL' || log.action === 'APPROVE_FINANCE') ? 'bg-emerald-500' :
                                log.action === 'SUBMIT_LEGAL' ? 'bg-blue-500' :
                                  'bg-orange-500';

                      return (
                        <div key={log.id} className="flex gap-4 relative">
                          <div className={`w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 z-10 flex-shrink-0 flex items-center justify-center shadow-sm ${dotColor}`}>
                            <ShieldCheck size={10} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[10px] font-bold text-slate-400">{date}</p>
                              <span className="text-[10px] text-slate-300">•</span>
                              <p className="text-[10px] text-slate-400">{time}</p>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{eventText}</p>
                            <p className="text-[10px] text-orange-500 dark:text-orange-400 font-medium mt-0.5">
                              bởi {log.user_name || 'Hệ thống'}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">Chưa có lịch sử tác động</p>
                  )}
                </div>
              </div>
            </div>
          </div>
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
                // Handle File Upload
                const toastId = toast.loading('Đang tải lên tài liệu...');
                const newDoc = await DocumentService.uploadToDrive(
                  contract.id,
                  doc.file,
                  contract.unitId,
                  contract.title || contract.partyA,
                  doc.docType // Pass docType for renaming
                );
                setDocuments(prev => [newDoc, ...prev]);
                toast.dismiss(toastId);
                toast.success('Đã tải lên tài liệu thành công!');
              } else {
                // Handle Link Add
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
