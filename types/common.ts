// --- Report Module Types ---
export type ReportType = 'html_file' | 'external_link';

export interface Report {
  id: string;
  title: string;
  description?: string;
  author: string;
  date: string;
  type: ReportType;
  fileUrl: string;
  filePath?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KPIPlan {
  signing: number;
  revenue: number;
  adminProfit: number; // LNG Quản trị (Dựa trên giá trị ký)
  revProfit: number;   // LNG theo DT (Dựa trên doanh thu thực tế)
  cash: number;        // Tiền về thực tế
}

export interface HistoricalProduction {
  id?: string;
  unitId: string;
  year: number;
  month?: number | null; // null = yearly aggregate, 1-12 = monthly
  signing: number;     // Ký kết (triệu đồng)
  revenue: number;     // Doanh thu thực hiện (triệu đồng)
  adminProfit: number; // LNG Quản trị (triệu đồng)
  revProfit: number;   // LNG theo Doanh thu (triệu đồng)
  notes?: string;
  updatedBy?: string;
}
