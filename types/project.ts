// ============================================
// DỰ ÁN TƯ VẤN BIM (BIM Consulting Projects)
// ============================================

export type BIMProjectStatus = '10_XUCTIEN' | '20_BAOGIA' | '30_CHUANBI' | '40_TRINHTHAMDINH' | '50_HOTROQLDA' | '60_THANHQUYETTOAN' | '70_LUUTRU';

export const BIM_PROJECT_STATUS_LABELS: Record<BIMProjectStatus, string> = {
  '10_XUCTIEN': 'Xúc tiến dự án',
  '20_BAOGIA': 'Báo giá',
  '30_CHUANBI': 'Chuẩn bị',
  '40_TRINHTHAMDINH': 'Trình thẩm định',
  '50_HOTROQLDA': 'Hỗ trợ QLDA',
  '60_THANHQUYETTOAN': 'Thanh quyết toán',
  '70_LUUTRU': 'Lưu trữ',
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
  area?: number;               // Diện tích (m²)
  projectPhase?: string;       // Giai đoạn dự án
  contractId?: string;         // ID hợp đồng gắn với dự án
  createdAt?: string;
  updatedAt?: string;
}
