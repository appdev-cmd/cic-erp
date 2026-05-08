import * as XLSX from 'xlsx';
import type { BIMProject } from '../types/project';
import { BIM_PROJECT_STATUS_LABELS } from '../types/project';
import { formatDate } from '../utils/formatters';

function formatCurrency(value?: number): string {
  if (!value && value !== 0) return '';
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function exportProjectsToExcel(projects: BIMProject[], fileName?: string): void {
  const rows = projects.map((p) => ({
    'Mã dự án': p.code || '',
    'Tên dự án': p.name || '',
    'Trạng thái': BIM_PROJECT_STATUS_LABELS[p.status] || p.status || '',
    'Địa điểm': p.location || '',
    'Chủ đầu tư': p.clientName || '',
    'Khách hàng (CĐT thực)': p.endUserName || '',
    'Loại dịch vụ': p.serviceType || '',
    'Nhóm dự án': p.projectGroup || '',
    'Loại công trình': p.constructionType || '',
    'Cấp công trình': p.constructionGrade || '',
    'Giai đoạn': p.projectPhase || '',
    'Giá trị HĐ (VNĐ)': p.contractValue || 0,
    'Tiến độ (%)': p.progress ?? 0,
    'Ngày bắt đầu': p.startDate ? formatDate(p.startDate) : '',
    'Ngày kết thúc': p.endDate ? formatDate(p.endDate) : '',
    'Diện tích sàn (m²)': p.area ?? '',
    'Diện tích XD (m²)': p.buildingArea ?? '',
    'Đầu mối liên hệ': p.contactName || '',
    'Chức danh ĐM': p.contactTitle || '',
    'Điện thoại ĐM': p.contactPhone || '',
    'Email ĐM': p.contactEmail || '',
    'Ghi chú': p.notes || '',
    'Ngày tạo': p.createdAt ? formatDate(p.createdAt) : '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 16 }, { wch: 40 }, { wch: 18 }, { wch: 25 }, { wch: 30 },
    { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 16 },
    { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 18 }, { wch: 18 },
    { wch: 25 }, { wch: 30 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách dự án');

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, fileName || `du-an-${stamp}.xlsx`);
}

export function exportProjectTemplate(): void {
  const headers = [
    'Mã dự án', 'Tên dự án (*)', 'Trạng thái', 'Địa điểm',
    'Chủ đầu tư', 'Loại dịch vụ', 'Loại công trình',
    'Giá trị HĐ (VNĐ)', 'Tiến độ (%)', 'Ngày bắt đầu', 'Ngày kết thúc',
    'Đầu mối liên hệ', 'Điện thoại ĐM',
  ];
  const hints = [
    '(Tự sinh nếu bỏ trống)', '(Bắt buộc)', '(new/active/paused/done/cancelled)',
    '(Tỉnh/thành phố)', '(Tên chủ đầu tư)', '(BIM/Thiết kế/...)',
    '(Nhà ở/Văn phòng/...)', '(Số, VNĐ)', '(0-100)', '(dd/mm/yyyy)',
    '(dd/mm/yyyy)', '(Tên người liên hệ)', '(Số điện thoại)',
  ];
  const example = [
    'DA-2026-001', 'Dự án tư vấn BIM tòa nhà ABC', 'active',
    'Hà Nội', 'Tập đoàn ABC', 'BIM Consulting', 'Văn phòng',
    1500000000, 30, '01/01/2026', '31/12/2026', 'Nguyễn Văn A', '0912345678',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, hints, example]);
  ws['!cols'] = [
    { wch: 16 }, { wch: 38 }, { wch: 20 }, { wch: 20 },
    { wch: 30 }, { wch: 20 }, { wch: 22 },
    { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 25 }, { wch: 16 },
  ];

  // Status reference sheet
  const statusRef = [
    ['== TRẠNG THÁI DỰ ÁN =='],
    ['Giá trị', 'Hiển thị'],
    ['new', 'Mới'],
    ['active', 'Đang triển khai'],
    ['paused', 'Tạm dừng'],
    ['done', 'Hoàn thành'],
    ['cancelled', 'Hủy'],
  ];
  const wsRef = XLSX.utils.aoa_to_sheet(statusRef);
  wsRef['!cols'] = [{ wch: 16 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nhập dự án');
  XLSX.utils.book_append_sheet(wb, wsRef, 'Tra cứu');

  XLSX.writeFile(wb, 'template_import_du_an.xlsx');
}
