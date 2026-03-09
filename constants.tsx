import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Settings,
  BrainCircuit,
  PieChart,
  Users,
  Building2,
  Package,
  HelpCircle,
  FolderOpen,
  Wrench,
  MessageCircle,
  CheckSquare,
  ListTodo
} from 'lucide-react';
import { UserRole, PlanStatus } from './types';

export const ROLE_LABELS: Record<UserRole, string> = {
  'NVKD': 'Nhân viên Kinh doanh',
  'NVKT': 'Nhân viên Kỹ thuật',
  'UnitLeader': 'Lãnh đạo Đơn vị',
  'AdminUnit': 'Quản trị Đơn vị',
  'Accountant': 'Kế toán Viễn thông',
  'ChiefAccountant': 'Kế toán trưởng',
  'Legal': 'Ban Pháp chế',
  'Leadership': 'Ban Lãnh đạo',
  'Admin': 'Quản trị viên'
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  'Draft': 'Nháp (Soạn thảo)',
  'Pending_Unit': 'Chờ Đơn vị duyệt',
  'Pending_Finance': 'Chờ Kế toán duyệt',
  'Pending_Board': 'Chờ Lãnh đạo duyệt',
  'Approved': 'Đã phê duyệt',
  'Rejected': 'Từ chối'
};

export const NON_BUSINESS_UNIT_CODES = ['HCNS'];

export const INDUSTRIES = [
  'Xây dựng', 'Bất động sản', 'Năng lượng', 'Công nghệ', 'Sản xuất',
  'Thương mại', 'Dịch vụ', 'Giáo dục', 'Y tế', 'Khác'
] as const;

export const PRODUCT_CATEGORIES = [
  'Phần mềm', 'Tư vấn', 'Thiết kế', 'Thi công', 'Bảo trì', 'Đào tạo'
] as const;

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  'Processing': 'Đang thực hiện',
  'Suspended': 'Tạm dừng/Huỷ',
  'Overdue_Advance': 'QH tạm ứng',
  'Handover': 'Bàn giao',
  'Acceptance': 'Nghiệm thu/TL',
  'Overdue_Payment': 'QH thanh toán',
  'Completed': 'Hoàn thành',
  'Liquidated': 'Nghiệm thu/TL',
  // Legacy statuses (for backward compatibility with old data)
  'Active': 'Đang thực hiện',
  'Pending': 'Đang thực hiện',
  'Reviewing': 'Đang thực hiện',
  'Expired': 'Hoàn thành',
  'Draft': 'Đang thực hiện',
  'Terminated': 'Hoàn thành',
  'Cancelled': 'Hoàn thành',
};

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard size={20} /> },
  { id: 'contracts', label: 'Hợp đồng', icon: <FileText size={20} /> },
  { id: 'payments', label: 'Tài chính', icon: <Package size={20} /> },
  { id: 'analytics', label: 'Thống kê', icon: <PieChart size={20} /> },
  { id: 'ai-assistant', label: 'AI Phân tích', icon: <BrainCircuit size={20} /> },
  { id: 'tools', label: 'Công cụ', icon: <Wrench size={20} /> },
  { id: 'chat', label: 'Chat', icon: <MessageCircle size={20} /> },
  { id: 'tasks', label: 'Công việc', icon: <CheckSquare size={20} /> },
  { id: 'my-tasks', label: 'Việc của tôi', icon: <ListTodo size={20} /> },
  { id: 'documents', label: 'Tài liệu', icon: <FolderOpen size={20} /> },

  // Danh mục
  { id: 'units', label: 'Đơn vị', icon: <Building2 size={20} /> },
  { id: 'personnel', label: 'Nhân sự', icon: <Users size={20} /> },
  { id: 'products', label: 'Sản phẩm/DV', icon: <Package size={20} /> },
  { id: 'customers', label: 'Khách hàng', icon: <Building2 size={20} /> },
  { id: 'user-guide', label: 'Hướng dẫn', icon: <HelpCircle size={20} /> },

  { id: 'settings', label: 'Cài đặt', icon: <Settings size={20} /> },
];

export const TASK_STATUS_LABELS: Record<string, { label: string; color: string; group: string }> = {
  status_pending: { label: 'Chờ xử lý', color: '#808080', group: 'not_started' },
  status_approval: { label: 'Đang chờ duyệt', color: '#F59E0B', group: 'not_started' },
  status_in_progress: { label: 'Đang làm', color: '#2196F3', group: 'in_progress' },
  status_review: { label: 'Đang xem xét', color: '#9C27B0', group: 'in_progress' },
  status_revision: { label: 'Cần chỉnh sửa', color: '#F97316', group: 'in_progress' },
  status_paused: { label: 'Tạm dừng', color: '#94A3B8', group: 'in_progress' },
  status_done: { label: 'Hoàn thành', color: '#4CAF50', group: 'completed' },
  status_cancelled: { label: 'Hủy bỏ', color: '#F44336', group: 'completed' },
};

export const TASK_PRIORITY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  urgent: { label: 'Khẩn cấp', color: '#EF4444', icon: '🔴' },
  high: { label: 'Cao', color: '#F97316', icon: '🟠' },
  medium: { label: 'Trung bình', color: '#EAB308', icon: '🟡' },
  low: { label: 'Thấp', color: '#3B82F6', icon: '🔵' },
  none: { label: 'Không', color: '#94A3B8', icon: '⚪' },
};
