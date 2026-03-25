export interface HtmlReport {
  id: string;
  stt: number;
  title: string;
  description: string;
  author: string;
  date: string;
  fileUrl: string;
}

export const REPORTS_DATA: HtmlReport[] = [
  {
    id: 'cic-bao-gia',
    stt: 1,
    title: 'Báo giá phần mềm QLDA',
    description: 'Báo giá chi tiết tính năng và phí triển khai phần mềm quản lý dự án (bản phát triển riêng)',
    author: 'Hệ thống AI',
    date: '2026-03-24',
    fileUrl: '/reports/cic-bao-gia-phat-trien-rieng.html'
  }
];
