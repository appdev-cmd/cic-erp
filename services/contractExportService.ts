import * as XLSX from 'xlsx';
import type { Contract, UnitAllocation } from '../types';
import { CONTRACT_STATUS_LABELS } from '../constants';
import { formatDate } from '../utils/formatters';

interface ExportOptions {
  customersMap?: Map<string, { name: string; shortName: string }>;
  employeesMap?: Map<string, string>;
  fileName?: string;
  unitId?: string;
}

function getContractFraction(contract: Contract, unitId: string | undefined): number {
  if (!unitId || unitId.toLowerCase() === 'all') return 1;
  const allocations: UnitAllocation[] = contract.unitAllocations || [];
  const isLead = contract.unitId === unitId;
  if (isLead && allocations.length > 0) {
    const leadAlloc = allocations.find(a => a.unitId === unitId && a.role === 'lead');
    return (leadAlloc ? (leadAlloc.percent ?? 100) : 100) / 100;
  }
  if (isLead) return 1;
  const supportAlloc = allocations.find(a => a.unitId === unitId && a.role === 'support');
  if (supportAlloc) return (supportAlloc.percent ?? 0) / 100;
  return 1;
}

export function exportContractsToExcel(contracts: Contract[], options: ExportOptions = {}): void {
  const { customersMap, employeesMap, fileName, unitId } = options;
  const showAllocated = !!unitId && unitId.toLowerCase() !== 'all';

  const rows = contracts.map((c, idx) => {
    const customerName = (customersMap?.get(c.customerId)?.name) || c.partyA || '';
    const salesperson = (c.salespersonId && employeesMap?.get(c.salespersonId)) || c.salespersonId || '';
    const margin = (c.adminProfit != null && c.value)
      ? parseFloat(((c.adminProfit / c.value) * 100).toFixed(1))
      : '';

    const row: Record<string, any> = {
      'STT': idx + 1,
      'Mã HĐ': c.contractCode || '',
      'Loại': c.contractType || '',
      'Nội dung HĐ': c.title || '',
      'Khách hàng': customerName,
      'Số HĐ KH': c.customerContractNumber || '',
      'Ngày ký': c.signedDate ? formatDate(c.signedDate) : '',
      'Giá trị HĐ': c.value ?? '',
      'Doanh thu': c.actualRevenue ?? '',
      'Tiền về': c.cashReceived ?? '',
      'LNG Quản trị': c.adminProfit ?? '',
      'LNG Doanh thu': c.revProfit ?? '',
      'Tỷ suất (%)': margin,
      'Trạng thái': CONTRACT_STATUS_LABELS[c.status] || c.status || '',
      'Cán bộ phụ trách': salesperson,
    };

    if (showAllocated) {
      const f = getContractFraction(c, unitId);
      const allocVal = c.value != null ? Math.round(c.value * f) : '';
      const allocRev = c.actualRevenue != null ? Math.round(c.actualRevenue * f) : '';
      const allocCash = c.cashReceived != null ? Math.round(c.cashReceived * f) : '';
      const allocAdmin = c.adminProfit != null ? Math.round(c.adminProfit * f) : '';
      const allocRevProfit = c.revProfit != null ? Math.round(c.revProfit * f) : '';
      const allocMargin = (typeof allocAdmin === 'number' && allocVal)
        ? parseFloat(((allocAdmin / allocVal) * 100).toFixed(1))
        : '';
      row['Giá trị (phân chia)'] = allocVal;
      row['Doanh thu (phân chia)'] = allocRev;
      row['Tiền về (phân chia)'] = allocCash;
      row['LNG QT (phân chia)'] = allocAdmin;
      row['LNG DT (phân chia)'] = allocRevProfit;
      row['Tỷ suất phân chia (%)'] = allocMargin;
    }

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  const baseCols = [
    { wch: 6 },  // STT
    { wch: 16 }, // Mã HĐ
    { wch: 8 },  // Loại
    { wch: 40 }, // Nội dung HĐ
    { wch: 30 }, // Khách hàng
    { wch: 18 }, // Số HĐ KH
    { wch: 12 }, // Ngày ký
    { wch: 16 }, // Giá trị HĐ
    { wch: 16 }, // Doanh thu
    { wch: 16 }, // Tiền về
    { wch: 16 }, // LNG Quản trị
    { wch: 16 }, // LNG Doanh thu
    { wch: 13 }, // Tỷ suất (%)
    { wch: 16 }, // Trạng thái
    { wch: 25 }, // Cán bộ phụ trách
  ];
  const allocCols = showAllocated ? [
    { wch: 18 }, // Giá trị (phân chia)
    { wch: 18 }, // Doanh thu (phân chia)
    { wch: 18 }, // Tiền về (phân chia)
    { wch: 16 }, // LNG QT (phân chia)
    { wch: 16 }, // LNG DT (phân chia)
    { wch: 20 }, // Tỷ suất phân chia (%)
  ] : [];
  ws['!cols'] = [...baseCols, ...allocCols];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách HĐ');

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, fileName || `hop-dong-${stamp}.xlsx`);
}
