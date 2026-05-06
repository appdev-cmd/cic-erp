// ============================================
// DỰ ÁN TƯ VẤN BIM (BIM Consulting Projects)
// ============================================

export type BIMProjectStatus = 'new' | 'active' | 'paused' | 'done' | 'cancelled';

export const BIM_PROJECT_STATUS_LABELS: Record<BIMProjectStatus, string> = {
  'new':       'Mới',
  'active':    'Đang triển khai',
  'paused':    'Tạm dừng',
  'done':      'Hoàn thành',
  'cancelled': 'Hủy',
};

export interface BIMProject {
  id: string;
  code: string;
  name: string;
  thumbnailUrl?: string;
  status: BIMProjectStatus;
  location?: string;
  progress: number;            // 0-100
  clientName?: string;
  customerId?: string;
  endUserId?: string; // Khách hàng
  endUserName?: string;
  unitId?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  contractValue: number;       // VNĐ
  notes?: string;
  folderPotentialUrl?: string; // Link lưu trữ hồ sơ tiền dự án (potential)
  folderOngoingUrl?: string;   // Link lưu trữ hồ sơ triển khai (ongoing)
  serviceType?: string;        // Loại dịch vụ
  projectGroup?: string;       // Nhóm dự án (A, B)
  constructionType?: string;   // Loại công trình
  constructionGrade?: string;  // Cấp công trình (I, II)
  area?: number;               // Diện tích sàn (m²)
  buildingArea?: number;       // Diện tích xây dựng (m²)
  projectPhase?: string;       // Giai đoạn dự án
  contractId?: string;         // ID hợp đồng gắn với dự án

  // Web Integration fields
  isPublishedWeb?: boolean;
  isFeaturedWeb?: boolean;
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
  webCategory?: string;
  webClientName?: string;
  webStats?: string;
  summary?: string;            // Tóm tắt ngắn (Web)
  viewCount?: number;

  createdAt?: string;
  updatedAt?: string;
}

export type ProjectMemberRole = 'Manager' | 'Member' | 'Viewer';

export interface ProjectMember {
  id: string;
  projectId: string;
  employeeId: string;
  role: ProjectMemberRole;
  createdAt: string;
}
