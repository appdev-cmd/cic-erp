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
  Handshake,
  CheckSquare,
  Landmark,
  ClipboardList,
  Briefcase,
  Bot,
  Newspaper,
  Globe
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

export const PRODUCT_CATEGORY_MAP: { label: string; code: string }[] = [
  { label: 'Phần mềm', code: 'PM' },
  { label: 'Thiết bị', code: 'TB' },
  { label: 'Tư vấn', code: 'TV' },
  { label: 'Dịch vụ', code: 'DV' },
  { label: 'Bảo trì', code: 'BT' },
  { label: 'Đào tạo', code: 'ĐT' },
  { label: 'Khác', code: 'K' },
];

export const PRODUCT_CATEGORIES = PRODUCT_CATEGORY_MAP.map(c => c.label) as readonly string[];

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  'Processing': 'Đang thực hiện',
  'Suspended': 'Tạm dừng/Huỷ',
  'Handover': 'Bàn giao',
  'Acceptance': 'Nghiệm thu/TL',
  'Completed': 'Hoàn thành',
  // Legacy statuses (for backward compatibility with old data)
  'Active': 'Đang thực hiện',
  'Pending': 'Đang thực hiện',
  'Reviewing': 'Đang thực hiện',
  'Expired': 'Hoàn thành',
  'Draft': 'Đang thực hiện',
  'Terminated': 'Hoàn thành',
  'Cancelled': 'Hoàn thành',
  'Liquidated': 'Nghiệm thu/TL',
  'Overdue_Advance': 'Đang thực hiện',
  'Overdue_Payment': 'Đang thực hiện',
};

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard size={20} /> },
  { id: 'tasks', label: 'Công việc', icon: <CheckSquare size={20} /> },
  { id: 'contracts', label: 'Hợp đồng', icon: <FileText size={20} /> },
  { id: 'payments', label: 'Tài chính', icon: <Package size={20} /> },
  { id: 'projects', label: 'Dự án', icon: <Landmark size={20} /> },
  { id: 'analytics', label: 'Thống kê', icon: <PieChart size={20} />, devOnly: true },
  { id: 'hrm', label: 'Nhân sự HR', icon: <Briefcase size={20} /> },
  { id: 'ai-assistant', label: 'AI Agent', icon: <BrainCircuit size={20} /> },
  // { id: 'tools', label: 'Công cụ', icon: <Wrench size={20} /> },
  { id: 'chat', label: 'Chat', icon: <MessageCircle size={20} /> },

  { id: 'documents', label: 'Tài liệu', icon: <FolderOpen size={20} />, devOnly: true },

  // Danh mục
  { id: 'units', label: 'Đơn vị', icon: <Building2 size={20} /> },
  { id: 'personnel', label: 'Nhân viên', icon: <Users size={20} /> },
  { id: 'products', label: 'Sản phẩm/DV', icon: <Package size={20} /> },
  { id: 'customers', label: 'Đối tác', icon: <Handshake size={20} /> },
  { id: 'agent-manager', label: 'Agent', icon: <Bot size={20} /> },
  { id: 'user-guide', label: 'Hướng dẫn', icon: <HelpCircle size={20} /> },

  // Quản trị Website và Hệ thống
  { id: 'website', label: 'Website', icon: <Globe size={20} /> },
  { id: 'settings', label: 'Cài đặt', icon: <Settings size={20} /> },
];

