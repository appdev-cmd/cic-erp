import * as XLSX from 'xlsx';
import type { ContractReportRow } from '../supabaseClient.js';

export function contractsToXlsxBuffer(rows: ContractReportRow[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      Ma: r.contract_code,
      Tieu_de: r.title,
      Don_vi: r.unit_id,
      Trang_thai: r.status,
      Ngay_ky: r.signed_date ?? '',
      Gia_tri: r.value_numeric ?? '',
      Khach: r.customer_id ?? '',
      Id: r.contract_id,
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Hop_dong');
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return out;
}
