import * as XLSX from 'xlsx';
import type { Task } from '../types/taskTypes';
import { formatDate, formatDateTime } from '../utils/formatters';

const PRIORITY_MAP: Record<string, string> = {
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  none: 'Không',
};

const APPROVAL_MAP: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

/**
 * Export danh sách công việc ra file Excel (.xlsx)
 */
export function exportTasksToExcel(
  tasks: Task[],
  employees: Record<string, { name: string; avatar?: string }> = {},
  fileName?: string
): void {
  const rows = tasks.map((t) => {
    const assigneeNames = (t.assignees || [])
      .map((id) => employees[id]?.name || id.substring(0, 8))
      .join(', ');
    const watcherNames = (t.watchers || [])
      .map((id) => employees[id]?.name || id.substring(0, 8))
      .join(', ');

    return {
      'Tiêu đề': t.title,
      'Trạng thái': t.status?.name || '',
      'Độ ưu tiên': PRIORITY_MAP[t.priority] || t.priority,
      'Người thực hiện': assigneeNames,
      'Người theo dõi': watcherNames,
      'Ngày bắt đầu': t.start_date ? formatDate(t.start_date) : '',
      'Hạn hoàn thành': t.due_date ? formatDate(t.due_date) : '',
      'Thời gian ước tính (phút)': t.time_estimate || '',
      'Thời gian đã dùng (phút)': t.time_spent || 0,
      'Phê duyệt': t.approval_status ? APPROVAL_MAP[t.approval_status] || t.approval_status : '',
      'Tags': (t.tags || []).join(', '),
      'Hoàn thành lúc': t.completed_at ? formatDateTime(t.completed_at) : '',
      'Tạo lúc': formatDateTime(t.created_at),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto column widths
  const maxWidths: Record<number, number> = {};
  rows.forEach((row) => {
    Object.values(row).forEach((val, i) => {
      const len = String(val).length;
      if (!maxWidths[i] || len > maxWidths[i]) maxWidths[i] = len;
    });
  });
  ws['!cols'] = Object.keys(maxWidths).map((i) => ({
    wch: Math.min(maxWidths[Number(i)] + 4, 50),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách công việc');

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, fileName || `cong-viec-${stamp}.xlsx`);
}
