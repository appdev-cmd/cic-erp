import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ChevronDown, Building2, User, Briefcase, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Sparkles, Link2, Package,
  Search, ExternalLink, ShieldAlert, ShieldCheck, Info
} from 'lucide-react';
import { CrmLead, CrmStageTemplate } from '../../../types';
import { CrmCompletionService, CompletionResultType } from '../../../services/crmService';
import { checkDuplicateWithAI, AIDuplicationResult, DuplicateCandidateResult } from '../../../services/ai/aiDuplicationService';
import { formatCurrency } from '../../../utils/formatters';
import { dataClient as supabase } from '../../../lib/dataClient';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface CompleteLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lead: CrmLead;
  stages: CrmStageTemplate[];
}

/** 7 opportunity combinations (mapped to CompletionResultType) */
type OpportunityCombination = Exclude<CompletionResultType, 'not_opportunity'>;

interface CombinationOption {
  value: OpportunityCombination;
  label: string;
  icons: Array<'deal' | 'contact' | 'company'>;
}

const COMBINATION_OPTIONS: CombinationOption[] = [
  { value: 'deal+contact+company', label: 'Deal + Liên hệ + Công ty', icons: ['deal', 'contact', 'company'] },
  { value: 'deal+contact',         label: 'Deal + Liên hệ',           icons: ['deal', 'contact'] },
  { value: 'deal+company',         label: 'Deal + Công ty',           icons: ['deal', 'company'] },
  { value: 'deal',                 label: 'Deal',                     icons: ['deal'] },
  { value: 'contact+company',      label: 'Liên hệ + Công ty',       icons: ['contact', 'company'] },
  { value: 'contact',              label: 'Liên hệ',                 icons: ['contact'] },
  { value: 'company',              label: 'Công ty',                  icons: ['company'] },
];

const ENTITY_ICON_MAP = {
  deal: Briefcase,
  contact: User,
  company: Building2,
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

const CompleteLeadModal: React.FC<CompleteLeadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lead,
  stages,
}) => {
  // ── Mode: 'opportunity' or 'not_opportunity' ──
  const [mode, setMode] = useState<'opportunity' | 'not_opportunity'>('opportunity');

  // ── Combination dropdown ──
  const [selectedCombination, setSelectedCombination] = useState<OpportunityCombination>('deal+contact+company');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Company fields ──
  const [companyName, setCompanyName] = useState('');
  const [companyTaxCode, setCompanyTaxCode] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [linkedCompanyName, setLinkedCompanyName] = useState<string | undefined>(undefined);

  // ── AI Duplicate check ──
  const [dupResult, setDupResult] = useState<AIDuplicationResult | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);

  // ── Contact fields ──
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPosition, setContactPosition] = useState('');

  // ── Deal fields ──
  const [dealTitle, setDealTitle] = useState('');
  const [dealAmount, setDealAmount] = useState<number>(0);

  // ── Note & rejection ──
  const [note, setNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // ── Submitting ──
  const [submitting, setSubmitting] = useState(false);

  // ── Animation ──
  const [visible, setVisible] = useState(false);

  // ── Derived flags ──
  const includesCompany = mode === 'opportunity' && selectedCombination.includes('company');
  const includesContact = mode === 'opportunity' && selectedCombination.includes('contact');
  const includesDeal    = mode === 'opportunity' && selectedCombination.includes('deal');

  // ── Init form from lead data ──
  useEffect(() => {
    if (isOpen && lead) {
      setCompanyName(lead.company_name || '');
      setCompanyTaxCode('');
      setCustomerId(lead.customer_id || undefined);
      setLinkedCompanyName(lead.customer_id ? lead.company_name || '' : undefined);
      setContactName(lead.name || '');
      setContactPhone(lead.phone || '');
      setContactEmail(lead.email || '');
      setContactPosition('');
      setDealTitle(lead.title || '');
      setDealAmount(Number(lead.expected_value) || 0);
      setNote('');
      setRejectionReason('');
      setDupResult(null);
      setMode('opportunity');
      setSelectedCombination('deal+contact+company');
      setShowDropdown(false);

      // Trigger enter animation
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen, lead]);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Close with animation ──
  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // ── ESC to close ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // ═══════════════════════════════════════════════════════════════
  // AI Duplicate Check
  // ═══════════════════════════════════════════════════════════════

  const handleCheckDuplicate = async () => {
    if (!companyName.trim() || companyName.trim().length < 2) {
      toast.warning('Vui lòng nhập tên công ty (tối thiểu 2 ký tự)');
      return;
    }
    try {
      setCheckingDup(true);
      setDupResult(null);
      const result = await checkDuplicateWithAI(companyName.trim());
      setDupResult(result);

      if (result.isHighRisk) {
        toast.warning(`Rủi ro trùng cao (${result.score}%) — Vui lòng kiểm tra`, { duration: 5000 });
      } else if (result.score > 0) {
        toast.info(`Tìm thấy ${result.candidates.length} ứng viên, rủi ro thấp (${result.score}%)`);
      } else {
        toast.success('Không tìm thấy trùng lặp — An toàn để tạo mới');
      }
    } catch (err: any) {
      toast.error('Lỗi kiểm tra trùng: ' + err.message);
    } finally {
      setCheckingDup(false);
    }
  };

  const handleLinkExisting = (candidate: DuplicateCandidateResult) => {
    setCustomerId(candidate.id);
    setLinkedCompanyName(candidate.name);
    setCompanyName(candidate.name);
    toast.success(`Đã liên kết với: ${candidate.name}`);
  };

  const handleUnlink = () => {
    setCustomerId(undefined);
    setLinkedCompanyName(undefined);
  };

  // ═══════════════════════════════════════════════════════════════
  // SUBMIT
  // ═══════════════════════════════════════════════════════════════

  const handleSubmit = async () => {
    // Validation
    if (mode === 'not_opportunity') {
      if (!rejectionReason.trim()) {
        toast.error('Vui lòng nhập lý do không phải cơ hội');
        return;
      }
    } else {
      if (includesCompany && !companyName.trim() && !customerId) {
        toast.error('Vui lòng nhập tên công ty hoặc liên kết công ty đã có');
        return;
      }
      if (includesContact && !contactName.trim()) {
        toast.error('Vui lòng nhập họ tên liên hệ');
        return;
      }
      if (includesDeal && !dealTitle.trim()) {
        toast.error('Vui lòng nhập tiêu đề Deal');
        return;
      }
      // Warn if high-risk company dup not resolved
      if (includesCompany && dupResult?.isHighRisk && !customerId) {
        const proceed = window.confirm(
          `Cảnh báo: Rủi ro trùng lặp công ty cao (${dupResult.score}%).\n` +
          `Bạn có muốn tiếp tục tạo mới không?`
        );
        if (!proceed) return;
      }
    }

    try {
      setSubmitting(true);
      const resultType: CompletionResultType = mode === 'not_opportunity' ? 'not_opportunity' : selectedCombination;

      await CrmCompletionService.completeLead(lead.id, {
        resultType,
        note: mode === 'not_opportunity' ? rejectionReason : note,
        companyName: includesCompany ? companyName : undefined,
        companyTaxCode: includesCompany ? companyTaxCode : undefined,
        customerId: includesCompany ? customerId : undefined,
        contactName: includesContact ? contactName : undefined,
        contactPhone: includesContact ? contactPhone : undefined,
        contactEmail: includesContact ? contactEmail : undefined,
        contactPosition: includesContact ? contactPosition : undefined,
        dealTitle: includesDeal ? dealTitle : undefined,
        dealAmount: includesDeal ? dealAmount : undefined,
        products: lead.products,
        unitId: lead.unit_id,
        assignedTo: lead.assigned_to,
      });

      const successMsg = mode === 'not_opportunity'
        ? 'Đã đóng Lead — Không phải cơ hội'
        : `Hoàn thành Lead → ${selectedCombination.replace(/\+/g, ' + ').toUpperCase()}`;

      toast.success(successMsg);
      handleClose();
      onSuccess();
    } catch (err: any) {
      toast.error('Lỗi hoàn thành Lead: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (!isOpen) return null;

  const selectedOption = COMBINATION_OPTIONS.find(o => o.value === selectedCombination)!;

  // Compute products total
  const productsTotal = (lead.products || []).reduce(
    (sum: number, p: any) => sum + ((p.quantity || 1) * (p.price || p.unit_price || 0)),
    0
  );

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-colors';
  const labelCls = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5';
  const sectionTitleCls = 'flex items-center gap-2 text-sm font-bold mb-4';

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none`}
      >
        <div
          className={`pointer-events-auto w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col transform transition-all duration-200 ${
            visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── HEADER ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Hoàn thành Lead
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lead.title} — Chọn hành động kết thúc
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── TOP ACTION BUTTONS ── */}
          <div className="flex items-stretch gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shrink-0">
            {/* Green: Create combination dropdown */}
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                onClick={() => {
                  setMode('opportunity');
                  setShowDropdown(!showDropdown);
                }}
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  mode === 'opportunity'
                    ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  <span>TẠO: {selectedOption.label.toUpperCase()}</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown menu */}
              {showDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  {COMBINATION_OPTIONS.map((opt) => {
                    const isSelected = opt.value === selectedCombination;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSelectedCombination(opt.value);
                          setMode('opportunity');
                          setShowDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.icons.map((icon) => {
                            const IconComp = ENTITY_ICON_MAP[icon];
                            return (
                              <IconComp
                                key={icon}
                                size={14}
                                className={
                                  isSelected
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }
                              />
                            );
                          })}
                        </div>
                        <span className="flex-1">{opt.label}</span>
                        {isSelected && (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Red: Not an opportunity */}
            <button
              onClick={() => {
                setMode('not_opportunity');
                setShowDropdown(false);
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer shrink-0 ${
                mode === 'not_opportunity'
                  ? 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white shadow-lg shadow-red-500/25'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800'
              }`}
            >
              <XCircle size={18} />
              <span className="hidden sm:inline">KHÔNG PHẢI CƠ HỘI</span>
              <span className="sm:hidden">TỪ CHỐI</span>
            </button>
          </div>

          {/* ── SCROLLABLE FORM BODY ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {mode === 'opportunity' ? (
              <>
                {/* ═══ COMPANY SECTION ═══ */}
                {includesCompany && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                    <div className={sectionTitleCls}>
                      <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-slate-900 dark:text-slate-100">Công ty</span>
                    </div>

                    {/* Linked company banner */}
                    {customerId && linkedCompanyName && (
                      <div className="flex items-center justify-between mb-4 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Link2 size={14} className="text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Đã liên kết: {linkedCompanyName}
                          </span>
                        </div>
                        <button
                          onClick={handleUnlink}
                          className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium cursor-pointer transition-colors"
                        >
                          Hủy liên kết
                        </button>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>
                          Tên công ty <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => {
                              setCompanyName(e.target.value);
                              // Clear dup result if name changed
                              if (dupResult) setDupResult(null);
                            }}
                            placeholder="Nhập tên công ty..."
                            className={`${inputCls} flex-1`}
                            disabled={!!customerId}
                          />
                          <button
                            onClick={handleCheckDuplicate}
                            disabled={checkingDup || !!customerId}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                          >
                            {checkingDup ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            AI Check
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={labelCls}>Mã số thuế (MST)</label>
                        <input
                          type="text"
                          value={companyTaxCode}
                          onChange={(e) => setCompanyTaxCode(e.target.value)}
                          placeholder="Nhập MST nếu có..."
                          className={inputCls}
                          disabled={!!customerId}
                        />
                      </div>
                    </div>

                    {/* ── AI Duplicate Result ── */}
                    {dupResult && (
                      <div className="mt-4">
                        {dupResult.isHighRisk ? (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <ShieldAlert size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-bold text-red-700 dark:text-red-400">
                                  Rủi ro trùng cao: {dupResult.score}%
                                </p>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                  {dupResult.reasoning}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-red-500 dark:text-red-400 mb-2 font-medium">
                              Vui lòng liên kết với công ty đã có hoặc xác nhận tạo mới:
                            </p>
                            {renderCandidateList(dupResult.candidates)}
                          </div>
                        ) : dupResult.score > 0 ? (
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-2">
                              <Info size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                  Tìm thấy {dupResult.candidates.length} ứng viên (rủi ro: {dupResult.score}%)
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                  {dupResult.reasoning}
                                </p>
                              </div>
                            </div>
                            {renderCandidateList(dupResult.candidates)}
                          </div>
                        ) : (
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                              Không tìm thấy trùng lặp — An toàn để tạo mới
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ CONTACT SECTION ═══ */}
                {includesContact && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                    <div className={sectionTitleCls}>
                      <User size={18} className="text-violet-600 dark:text-violet-400" />
                      <span className="text-slate-900 dark:text-slate-100">Liên hệ</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className={labelCls}>
                          Họ tên <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Họ và tên..."
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Điện thoại</label>
                        <input
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="0xxx xxx xxx"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="email@company.com"
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Chức vụ</label>
                        <input
                          type="text"
                          value={contactPosition}
                          onChange={(e) => setContactPosition(e.target.value)}
                          placeholder="VD: Giám đốc, Trưởng phòng..."
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ DEAL SECTION ═══ */}
                {includesDeal && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                    <div className={sectionTitleCls}>
                      <Briefcase size={18} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="text-slate-900 dark:text-slate-100">Deal</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>
                          Tiêu đề Deal <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={dealTitle}
                          onChange={(e) => setDealTitle(e.target.value)}
                          placeholder="Tiêu đề cho Deal mới..."
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Giá trị (VND)</label>
                        <input
                          type="text"
                          value={dealAmount ? new Intl.NumberFormat('vi-VN').format(dealAmount) : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setDealAmount(Number(raw) || 0);
                          }}
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>

                      {/* Products list (read-only) */}
                      {lead.products && lead.products.length > 0 && (
                        <div>
                          <label className={labelCls}>
                            <span className="flex items-center gap-1">
                              <Package size={12} />
                              Sản phẩm từ Lead
                            </span>
                          </label>
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                            {lead.products.map((p: any, idx: number) => (
                              <div
                                key={p.id || idx}
                                className="flex items-center justify-between px-3 py-2.5 text-sm"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="text-slate-900 dark:text-slate-100 font-medium truncate block">
                                    {p.productName || p.product_name || `SP #${idx + 1}`}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    SL: {p.quantity || 1} × {formatCurrency(p.price || p.unit_price || 0)}
                                  </span>
                                </div>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 shrink-0 ml-3">
                                  {formatCurrency(
                                    (p.quantity || 1) * (p.price || p.unit_price || 0)
                                  )}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-b-lg">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Tổng</span>
                              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                {formatCurrency(productsTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ═══ NOTE SECTION (Opportunity) ═══ */}
                <div>
                  <label className={labelCls}>Ghi chú (tùy chọn)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Ghi chú thêm về Lead này..."
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </>
            ) : (
              /* ═══ NOT OPPORTUNITY MODE ═══ */
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
                <div className={sectionTitleCls}>
                  <XCircle size={18} className="text-red-600 dark:text-red-400" />
                  <span className="text-red-700 dark:text-red-400">Không phải cơ hội</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                  Lead sẽ được đóng lại. Không có Deal, Liên hệ hay Công ty nào được tạo.
                </p>
                <div>
                  <label className={`${labelCls} text-red-700 dark:text-red-400`}>
                    Lý do <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    placeholder="Nhập lý do không phải cơ hội... (bắt buộc)"
                    className={`${inputCls} border-red-200 dark:border-red-800 focus:ring-red-500 dark:focus:ring-red-400 resize-none`}
                    autoFocus
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── FOOTER ACTIONS ── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 shrink-0">
            {/* Summary badge */}
            <div className="flex items-center gap-2">
              {mode === 'opportunity' ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {selectedOption.icons.map((icon) => {
                    const IconComp = ENTITY_ICON_MAP[icon];
                    return (
                      <span
                        key={icon}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                      >
                        <IconComp size={12} />
                        <span className="capitalize font-medium">{icon}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold">
                  <XCircle size={12} />
                  Đóng Lead
                </span>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                HỦY
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  mode === 'opportunity'
                    ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 shadow-lg shadow-emerald-500/25'
                    : 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 shadow-lg shadow-red-500/25'
                }`}
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : mode === 'opportunity' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <XCircle size={16} />
                )}
                {submitting
                  ? 'Đang xử lý...'
                  : mode === 'opportunity'
                    ? 'TẠO'
                    : 'ĐÓNG LEAD'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // ── Render candidate list for AI dup check ──
  function renderCandidateList(candidates: DuplicateCandidateResult[]) {
    if (!candidates || candidates.length === 0) return null;

    return (
      <div className="space-y-2 mt-2">
        {candidates.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors group"
          >
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {c.name}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    c.similarity > 70
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : c.similarity > 40
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {c.similarity}%
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {c.reason}
              </p>
            </div>
            <button
              onClick={() => handleLinkExisting(c)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer opacity-80 group-hover:opacity-100"
            >
              <Link2 size={12} />
              Liên kết
            </button>
          </div>
        ))}
      </div>
    );
  }
};

export default CompleteLeadModal;
