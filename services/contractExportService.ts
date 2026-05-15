import * as XLSX from 'xlsx';
import type { Contract } from '../types';
import { CONTRACT_STATUS_LABELS } from '../constants';
import { formatDate } from '../utils/formatters';

interface ExportOptions {
  customersMap?: Map<string, { name: string; shortName: string }>;
  employeesMap?: Map<string, string>;
  fileName?: string;
}

export function exportContractsToExcel(contracts: Contract[], options: ExportOptions = {}): void {
  const { customersMap, employeesMap, fileName } = options;

  const rows = contracts.map((c, idx) => {
    const customerName = (customersMap?.get(c.customerId)?.name) || c.partyA || '';
    const salesperson = (c.salespersonId && employeesMap?.get(c.salespersonId)) || c.salespersonId || '';
    const margin = (c.adminProfit != null && c.value)
      ? parseFloat(((c.adminProfit / c.value) * 100).toFixed(1))
      : '';

    return {
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
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
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

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách HĐ');

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, fileName || `hop-dong-${stamp}.xlsx`);
}
