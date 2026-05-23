import React from 'react';
import { Copy, Hash, ChevronDown, Check, Loader2 } from 'lucide-react';
import { formatVND as formatCurrency } from '../utils/contractHelpers';
import { formatDate } from '../utils/formatters';
import { CONTRACT_STATUS_LABELS } from '../constants';
import { ACTIVE_STATUSES } from './ContractListSubComponents';
import { toast } from 'sonner';

export interface ContractListTableRowProps {
  contract: any;
  index: number;
  onSelectContract: (id: string) => void;
  units: any[];
  salespeople: any[];
  customersData: Map<string, any>;
  contractTagsMap: Map<string, string[]>;
  invoiceMap: Map<string, string[]>;
  statusDropdownId: string | null;
  setStatusDropdownId: (id: string | null) => void;
  statusDropdownRef: React.RefObject<HTMLDivElement | null>;
  changingStatusId: string | null;
  handleQuickStatusChange: (id: string, newStatus: string, oldStatus: string) => void;
  onClone?: (c: any) => void;
  isGlobalScope: boolean;
  profile?: any;
}

type WarningBadge = { icon: string; label: string; color: string };
const getWarningBadges = (w?: any): WarningBadge[] => {
  if (!w) return [];
  const badges: WarningBadge[] = [];
  if (w.isOverdueAdvance) badges.push({ icon: '⚠️', label: 'Quá hạn tạm ứng', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' });
  if (w.isOverduePayment) badges.push({ icon: '🔴', label: 'Quá hạn thanh toán', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' });
  if (w.isAcceptedNoInvoice) badges.push({ icon: '📄', label: 'Nghiệm thu chưa xuất HĐ', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800' });
  return badges;
};

export const ContractListTableRow: React.FC<ContractListTableRowProps> = ({
  contract,
  index,
  onSelectContract,
  units,
  salespeople,
  customersData,
  contractTagsMap,
  invoiceMap,
  statusDropdownId,
  setStatusDropdownId,
  statusDropdownRef,
  changingStatusId,
  handleQuickStatusChange,
  onClone,
  isGlobalScope,
  profile
}) => {
  // Allocation info (tagged by ContractService.list for collaborative contracts)
  const allocationRole = (contract as any)._allocationRole as 'lead' | 'support' | undefined;
  const allocationPct = (contract as any)._allocationPct as number | undefined;
  const employeePct = (contract as any)._employeePct as number | undefined;
  const isCollaborative = allocationRole === 'support';
  const hasAllocation = allocationPct !== undefined && allocationPct < 100;
  const hasEmployeeAllocation = employeePct !== undefined && employeePct < 100;
  
  // Combined fraction: unitPct x employeePct (when both present)
  let allocFraction = 1;
  if (hasAllocation && hasEmployeeAllocation) {
    allocFraction = (allocationPct / 100) * (employeePct / 100);
  } else if (hasAllocation) {
    allocFraction = allocationPct / 100;
  } else if (hasEmployeeAllocation) {
    allocFraction = employeePct / 100;
  }
  
  // Show tooltip whenever contract has multi-unit or multi-employee allocations
  const unitAllocs: any[] = contract.unitAllocations || [];
  const empAllocs: any[] = contract.employeeAllocations || [];
  const showAllocTooltip = unitAllocs.length > 1 || empAllocs.length > 1 || (unitAllocs.length === 1 && empAllocs.length > 0);
  
  // Hierarchical tooltip: unit -> employees nested under each unit
  const buildAllocTooltip = (label: string, fullValue: number): string => {
    if (!showAllocTooltip) return `${label}: ${formatCurrency(fullValue)}`;
    const lines: string[] = [`${label} gốc: ${formatCurrency(fullValue)}`];
    if (unitAllocs.length > 0) {
      unitAllocs.forEach((a: any) => {
        const unitName = units.find(u => u.id === a.unitId)?.name || a.unitId;
        const unitPct = a.percent || 0;
        const unitValue = Math.round(fullValue * unitPct / 100);
        lines.push(`${a.role === 'lead' ? '▸ Chủ trì' : '▹ Phối hợp'} ${unitName} ${unitPct}% = ${formatCurrency(unitValue)}`);
        if (a.role === 'lead' && empAllocs.length > 0) {
          // Lead unit: show all employees from employeeAllocations
          empAllocs.forEach((emp: any) => {
            const empName = salespeople.find(s => s.id === emp.employeeId)?.name || '?';
            const empPctVal = emp.percent || 100;
            const empValue = Math.round(fullValue * unitPct / 100 * empPctVal / 100);
            lines.push(`  - ${empName} ${empPctVal}% × ${unitPct}% = ${formatCurrency(empValue)}`);
          });
        } else if (a.role === 'support' && a.employeeId) {
          // Support unit: show single PIC
          const empName = salespeople.find(s => s.id === a.employeeId)?.name || '?';
          lines.push(`  - ${empName} 100% × ${unitPct}% = ${formatCurrency(unitValue)}`);
        }
      });
    } else if (empAllocs.length > 0) {
      // No unit allocation data, only employee allocations
      empAllocs.forEach((emp: any) => {
        const empName = salespeople.find(s => s.id === emp.employeeId)?.name || '?';
        const empPctVal = emp.percent || 100;
        const empValue = Math.round(fullValue * empPctVal / 100);
        lines.push(`  - ${empName} ${empPctVal}% = ${formatCurrency(empValue)}`);
      });
    }
    return lines.join('\n');
  };

  // Apply allocation fraction to ALL financial metrics when viewing by unit
  const adminProfit = Math.round((contract.adminProfit || 0) * allocFraction);
  // Doanh thu thực tế: chỉ hiển thị actual_revenue (ghi nhận sau xuất hóa đơn), không fallback
  const revenue = Math.round((contract.actualRevenue || 0) * allocFraction);
  const cashReceived = Math.round((contract.cashReceived || 0) * allocFraction);
  const advanceAmount = Math.round((contract.advanceAmount || 0) * allocFraction);
  const revProfit = Math.round((contract.revProfit || 0) * allocFraction);
  // ★ FIX Bug #5: margin được tính sẵn trong mapContract → đọc trực tiếp,
  // không cần tính lại (allocFraction tự triệt tiêu trong phép chia)
  const margin = contract.margin || 0;
  
  const leadAllocEmp = contract.employeeAllocations?.find((a: any) => a.role === 'lead') || contract.employeeAllocations?.[0];
  const picEmployeeId = leadAllocEmp?.employeeId || contract.salespersonId;
  const salesperson = salespeople.find(s => s.id === picEmployeeId);

  // STT - sequential across infinite scroll
  const stt = index + 1;

  return (
    <tr
      key={contract.id}
      onClick={() => onSelectContract(contract.id)}
      className={`group transition-all cursor-pointer hover:bg-orange-50/30 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${isCollaborative ? 'bg-blue-50 dark:bg-blue-900/20' : index % 2 !== 0 ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900'}`}
      title={isCollaborative ? `HĐ phối hợp — Phân bổ ${allocationPct}% — Giá trị: ${formatCurrency(Math.round((contract.value || 0) * (allocationPct || 100) / 100))}` : allocationRole === 'lead' && allocationPct !== undefined && allocationPct < 100 ? `HĐ chủ trì — Phân bổ ${allocationPct}% — Giá trị: ${formatCurrency(Math.round((contract.value || 0) * allocationPct / 100))}` : undefined}
    >
      <td className="px-1.5 py-2 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
        {stt.toString().padStart(2, '0')}
      </td>
      {/* Số HĐ + Phụ trách KD */}
      <td className="px-2 py-2 overflow-hidden" title={`${contract.id}\n${contract.signedDate ? formatDate(contract.signedDate) : 'Chưa ký'}\n${salesperson?.name || 'Chưa gán'}${contract.customerContractNumber ? '\nSố HĐ KH: ' + contract.customerContractNumber : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0 ${contract.contractType === 'HĐ' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}`}>
            {contract.contractType}
          </div>
          <div>
            <p
              className="text-xs font-black text-slate-900 dark:text-slate-100 leading-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <span className="truncate">{contract.contractCode}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(contract.contractCode || contract.id);
                  toast.success(`Đã copy: ${contract.contractCode}`);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer flex-shrink-0"
                title="Copy số HĐ"
              >
                <Copy size={11} />
              </button>
            </p>
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-tighter">
              {contract.signedDate ? formatDate(contract.signedDate) : 'Chưa ký'}
            </p>
            {contract.customerContractNumber && (
              <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                📋 {contract.customerContractNumber}
              </p>
            )}
            <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 mt-0.5 truncate">
              {salesperson?.name || 'Chưa gán'}
            </p>
          </div>
        </div>
      </td>
      {/* Nội dung HĐ + Khách hàng */}
      <td className="px-3 py-2 text-[11px] font-bold text-slate-800 dark:text-slate-200" title={`${contract.title}\n${contract.partyA}${contract.endUserName ? '\nEnd User: ' + contract.endUserName : ''}`}>
        <div className="flex items-center gap-2">
          <p className="line-clamp-2">{contract.title}</p>
          {isCollaborative && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 whitespace-nowrap flex-shrink-0" title={`Đơn vị phối hợp — Phân bổ ${allocationPct}%`}>
              Phối hợp {allocationPct}%
            </span>
          )}
          {!isCollaborative && allocationRole === 'lead' && allocationPct !== undefined && allocationPct < 100 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap flex-shrink-0" title={`Đơn vị chủ trì — Phân bổ ${allocationPct}%`}>
              Chủ trì {allocationPct}%
            </span>
          )}
        </div>
        <div>
          {(() => {
            const customerInfo = contract.customerId ? customersData.get(contract.customerId) : null;
            const displayCustomerName = customerInfo ? customerInfo.name : contract.partyA;
            const displayShortName = customerInfo?.shortName;
            const shouldShowShortName = displayShortName && displayShortName !== displayCustomerName && displayCustomerName !== `${displayShortName} (${displayShortName})`;

            return (
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1" title={contract.endUserName ? `End User: ${contract.endUserName}` : undefined}>
                {displayCustomerName}
                {shouldShowShortName && (
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold"> ({displayShortName})</span>
                )}
              </p>
            );
          })()}
          {contract.endUserName && (
            <p className="text-[9px] font-bold text-teal-600 dark:text-teal-400 mt-0.5 truncate max-w-[220px]" title={`End User: ${contract.endUserName}`}>
              👤 {contract.endUserName}
            </p>
          )}
        </div>
        {/* Personal tags inline */}
        {contractTagsMap.get(contract.id)?.length ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {contractTagsMap.get(contract.id)!.slice(0, 3).map(tag => (
              <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[8px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <Hash size={7} className="opacity-60" />{tag}
              </span>
            ))}
            {(contractTagsMap.get(contract.id)?.length || 0) > 3 && (
              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500">+{(contractTagsMap.get(contract.id)?.length || 0) - 3}</span>
            )}
          </div>
        ) : null}
      </td>
      {/* Ký kết — hiển thị giá trị phân bổ (ĐV% × NV%), hover xem chi tiết */}
      <td className="px-1.5 py-2 text-right overflow-hidden">
        <span
          className={`text-[11px] font-bold ${showAllocTooltip ? 'text-indigo-700 dark:text-indigo-400 cursor-help' : 'text-slate-900 dark:text-slate-100'}`}
          title={buildAllocTooltip('Ký kết', contract.value || 0)}
        >
          {formatCurrency(Math.round((contract.value || 0) * allocFraction))}
        </span>
      </td>
      {/* Doanh thu */}
      <td className="px-1.5 py-2 text-right overflow-hidden">
        <span
          className={`text-[11px] font-bold ${showAllocTooltip ? 'text-emerald-700 dark:text-emerald-400 cursor-help' : 'text-slate-900 dark:text-slate-100'}`}
          title={buildAllocTooltip('Doanh thu', contract.actualRevenue || 0)}
        >
          {formatCurrency(revenue)}
        </span>
        {invoiceMap.get(contract.id) && invoiceMap.get(contract.id)!.length > 0 && (
          <p className="text-[8px] font-bold text-blue-500 dark:text-blue-400 mt-0.5 truncate max-w-[120px]" title={`Số HĐ: ${invoiceMap.get(contract.id)!.join(', ')}`}>
            HĐ: {invoiceMap.get(contract.id)!.join(', ')}
          </p>
        )}
      </td>
      {/* Tiền về */}
      <td className="px-1.5 py-2 text-right overflow-hidden">
        {cashReceived > 0 ? (
          advanceAmount > 0 && advanceAmount >= cashReceived ? (
            // All cash is from advance payments
            <span
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 cursor-help"
              title={showAllocTooltip
                ? `${buildAllocTooltip('Tiền về', contract.cashReceived || 0)}\n💰 Tạm ứng: ${formatCurrency(advanceAmount)} (chưa xuất HĐ)`
                : `💰 Tạm ứng: ${formatCurrency(advanceAmount)} (chưa xuất HĐ)`}
            >
              {formatCurrency(cashReceived)}
              <span className="block text-[8px] font-bold text-amber-500/70 dark:text-amber-500/60 uppercase tracking-wider mt-0.5">Tạm ứng</span>
            </span>
          ) : advanceAmount > 0 ? (
            // Mixed: some advance + some regular
            <span
              className="cursor-help"
              title={showAllocTooltip
                ? `${buildAllocTooltip('Tiền về', contract.cashReceived || 0)}\nTiền về: ${formatCurrency(cashReceived - advanceAmount)} + Tạm ứng: ${formatCurrency(advanceAmount)}`
                : `Tiền về: ${formatCurrency(cashReceived - advanceAmount)} + Tạm ứng: ${formatCurrency(advanceAmount)}`}
            >
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{formatCurrency(cashReceived - advanceAmount)}</span>
              <span className="block text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">+ TU: {formatCurrency(advanceAmount)}</span>
            </span>
          ) : (
            // Normal cash received
            <span
              className={`text-[11px] font-bold text-blue-700 dark:text-blue-400 ${showAllocTooltip ? 'cursor-help' : ''}`}
              title={buildAllocTooltip('Tiền về', contract.cashReceived || 0)}
            >
              {formatCurrency(cashReceived)}
            </span>
          )
        ) : (
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-600">
            {formatCurrency(0)}
          </span>
        )}
        {/* Còn thiếu = Tổng giá trị xuất HĐ sau VAT - Tổng tiền về */}
        {(() => {
          const invoiced = Math.round((contract.invoicedAmount || 0) * allocFraction);
          const outstanding = invoiced - cashReceived;
          if (invoiced > 0 && outstanding > 0) {
            return (
              <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 mt-0.5" title={`Còn thiếu: ${formatCurrency(outstanding)} = Đã xuất HĐ ${formatCurrency(invoiced)} − Tiền về ${formatCurrency(cashReceived)}`}>
                −{formatCurrency(outstanding)}
              </p>
            );
          }
          return null;
        })()}
      </td>
      {/* LNG Quản trị */}
      <td className="px-1.5 py-2 text-right overflow-hidden">
        <span
          className={`text-[11px] font-bold text-amber-700 dark:text-amber-400 ${showAllocTooltip ? 'cursor-help' : ''}`}
          title={buildAllocTooltip('LNG Quản trị', contract.adminProfit || 0)}
        >
          {formatCurrency(adminProfit)}
        </span>
      </td>
      {/* LNG theo DT */}
      <td className="px-1.5 py-2 text-right overflow-hidden">
        <span
          className={`text-[11px] font-bold text-purple-700 dark:text-purple-400 ${showAllocTooltip ? 'cursor-help' : ''}`}
          title={buildAllocTooltip('LNG theo DT', contract.revProfit || 0)}
        >
          {formatCurrency(revProfit)}
        </span>
      </td>
      {/* Tỷ suất LN/DT */}
      <td className="px-1.5 py-2 text-right">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${margin > 50 ? 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          {margin.toFixed(0)}%
        </span>
      </td>
      <td className="px-1.5 py-2 text-left">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <div className="relative inline-block" ref={statusDropdownId === contract.id ? statusDropdownRef : undefined}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setStatusDropdownId(statusDropdownId === contract.id ? null : contract.id);
                }}
                disabled={changingStatusId === contract.id}
                className={`group/status flex items-center justify-start gap-1 px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold shadow-sm transition-all focus:ring-2 focus:ring-orange-500 cursor-pointer whitespace-nowrap ${contract.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20' :
                  contract.status === 'Processing' ? 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-500/20' :
                    contract.status === 'Suspended' ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-500/20' :
                      contract.status === 'Handover' ? 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 hover:bg-cyan-500/20' :
                        contract.status === 'Acceptance' ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/20' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                title="Click để đổi trạng thái"
              >
                {changingStatusId === contract.id ? (
                  <Loader2 size={12} className="animate-spin shrink-0" />
                ) : (
                  <>
                    <span className="truncate">{CONTRACT_STATUS_LABELS[contract.status as keyof typeof CONTRACT_STATUS_LABELS] || contract.status}</span>
                    <ChevronDown size={12} className="opacity-0 group-hover/status:opacity-50 transition-opacity shrink-0" />
                  </>
                )}
              </button>
              {statusDropdownId === contract.id && (
                <div className="absolute z-50 top-full mt-1 right-0 w-44 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 animate-in fade-in slide-in-from-top-1 duration-150" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chuyển trạng thái</div>
                  {ACTIVE_STATUSES.map(s => (
                    <button
                      key={s.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Type assertion to bypass strict string union matching if handled inside handleQuickStatusChange
                        handleQuickStatusChange(contract.id, s.value, contract.status);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 transition-colors ${contract.status === s.value
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.value === 'Processing' ? 'bg-orange-500' :
                        s.value === 'Suspended' ? 'bg-rose-500' :
                          s.value === 'Handover' ? 'bg-cyan-500' :
                            s.value === 'Acceptance' ? 'bg-blue-500' : 'bg-emerald-500'
                        }`} />
                      {s.label}
                      {contract.status === s.value && <Check size={14} className="ml-auto text-indigo-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Warning badges — shown below status for visibility */}
          {getWarningBadges(contract.warnings).length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {getWarningBadges(contract.warnings).map((badge, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap ${badge.color}`}
                  title={badge.label}
                >
                  {badge.icon} {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-1 py-2 text-center">
        {(onClone && (isGlobalScope || contract.unitId === profile?.unitId)) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClone(contract);
            }}
            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            title="Nhân bản hợp đồng"
          >
            <Copy size={15} />
          </button>
        )}
      </td>
    </tr>
  );
};

export const ContractListMobileCard: React.FC<ContractListTableRowProps> = ({
  contract, index, onSelectContract, units, salespeople, customersData, contractTagsMap, invoiceMap,
  statusDropdownId, setStatusDropdownId, statusDropdownRef, changingStatusId, handleQuickStatusChange, onClone, isGlobalScope, profile
}) => {
  const allocationRole = (contract as any)._allocationRole as 'lead' | 'support' | undefined;
  const allocationPct = (contract as any)._allocationPct as number | undefined;
  const employeePct = (contract as any)._employeePct as number | undefined;
  const isCollaborative = allocationRole === 'support';
  const hasAllocation = allocationPct !== undefined && allocationPct < 100;
  const hasEmployeeAllocation = employeePct !== undefined && employeePct < 100;
  
  let allocFraction = 1;
  if (hasAllocation && hasEmployeeAllocation) {
    allocFraction = (allocationPct / 100) * (employeePct / 100);
  } else if (hasAllocation) {
    allocFraction = allocationPct / 100;
  } else if (hasEmployeeAllocation) {
    allocFraction = employeePct / 100;
  }
  
  const adminProfit = Math.round((contract.adminProfit || 0) * allocFraction);
  const revenue = Math.round((contract.actualRevenue || 0) * allocFraction);
  const cashReceived = Math.round((contract.cashReceived || 0) * allocFraction);
  const advanceAmount = Math.round((contract.advanceAmount || 0) * allocFraction);
  const revProfit = Math.round((contract.revProfit || 0) * allocFraction);
  // ★ FIX Bug #5: margin được tính sẵn trong mapContract → đọc trực tiếp
  const margin = contract.margin || 0;
  
  const leadAllocEmp = contract.employeeAllocations?.find((a: any) => a.role === 'lead') || contract.employeeAllocations?.[0];
  const picEmployeeId = leadAllocEmp?.employeeId || contract.salespersonId;
  const salesperson = salespeople.find(s => s.id === picEmployeeId);
  
  const customerInfo = contract.customerId ? customersData.get(contract.customerId) : null;
  const displayCustomerName = customerInfo ? customerInfo.name : contract.partyA;
  const displayShortName = customerInfo?.shortName;
  const stt = index + 1;

  return (
    <div 
      onClick={() => onSelectContract(contract.id)}
      className={`rounded-lg p-3 shadow-sm border relative cursor-pointer hover:shadow-md transition-shadow ${isCollaborative ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${contract.contractType === 'HĐ' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'}`}>
            {contract.contractType}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
              {contract.contractCode}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(contract.contractCode || contract.id);
                  toast.success(`Đã copy: ${contract.contractCode}`);
                }}
                className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <Copy size={12} />
              </button>
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {contract.signedDate ? formatDate(contract.signedDate) : 'Chưa ký'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-400">#{stt}</span>
      </div>
      
      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2 line-clamp-2">{contract.title}</p>
      
      <div className="flex justify-between text-[11px] mb-3">
        <div className="text-slate-600 dark:text-slate-400 font-medium truncate pr-2 max-w-[65%]">
          🏢 {displayCustomerName} {displayShortName ? `(${displayShortName})` : ''}
        </div>
        <div className="text-indigo-600 dark:text-indigo-400 font-bold truncate max-w-[35%]">
          👤 {salesperson?.name || 'Chưa gán'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
        <div>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Ký kết</p>
          <p className="text-xs font-black text-slate-900 dark:text-slate-100">{formatCurrency(Math.round((contract.value || 0) * allocFraction))}</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Doanh thu</p>
          <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(revenue)}</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Tiền về</p>
          <p className="text-xs font-black text-blue-600 dark:text-blue-400">{formatCurrency(cashReceived)}</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">LNG / Tỷ suất</p>
          <p className="text-xs font-black text-amber-600 dark:text-amber-400">{formatCurrency(adminProfit)} <span className="text-[9px] opacity-70">({margin.toFixed(0)}%)</span></p>
        </div>
      </div>

      <div className="flex justify-between items-center mt-2">
        <div className="relative inline-block" ref={statusDropdownId === contract.id ? statusDropdownRef : undefined}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStatusDropdownId(statusDropdownId === contract.id ? null : contract.id);
            }}
            disabled={changingStatusId === contract.id}
            className={`group/status flex items-center justify-start gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all focus:ring-2 focus:ring-orange-500 cursor-pointer whitespace-nowrap ${contract.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' :
              contract.status === 'Processing' ? 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' :
                contract.status === 'Suspended' ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' :
                  contract.status === 'Handover' ? 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400' :
                    contract.status === 'Acceptance' ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
          >
            {changingStatusId === contract.id ? (
              <Loader2 size={12} className="animate-spin shrink-0" />
            ) : (
              <>
                <span className="truncate">{CONTRACT_STATUS_LABELS[contract.status as keyof typeof CONTRACT_STATUS_LABELS] || contract.status}</span>
                <ChevronDown size={12} className="opacity-50 shrink-0" />
              </>
            )}
          </button>
          {statusDropdownId === contract.id && (
            <div className="absolute z-50 bottom-full mb-1 left-0 w-44 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 animate-in fade-in" onMouseDown={(e) => e.stopPropagation()}>
              <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chuyển trạng thái</div>
              {ACTIVE_STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickStatusChange(contract.id, s.value, contract.status);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 transition-colors ${contract.status === s.value
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.value === 'Processing' ? 'bg-orange-500' :
                    s.value === 'Suspended' ? 'bg-rose-500' :
                      s.value === 'Handover' ? 'bg-cyan-500' :
                        s.value === 'Acceptance' ? 'bg-blue-500' : 'bg-emerald-500'
                    }`} />
                  {s.label}
                  {contract.status === s.value && <Check size={14} className="ml-auto text-indigo-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {getWarningBadges(contract.warnings).length > 0 && (
          <div className="flex gap-1">
            {getWarningBadges(contract.warnings).map((badge, i) => (
              <span key={i} className={`flex items-center justify-center w-6 h-6 rounded-full ${badge.color}`} title={badge.label}>
                {badge.icon}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
