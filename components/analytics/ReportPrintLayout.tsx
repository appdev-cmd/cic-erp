import React from 'react';

/**
 * Layout ẩn ngoài màn hình để chụp chart cho PDF Báo cáo Quản trị.
 *
 * - Chiều rộng cố định 794px (~A4 dọc @96dpi) → chart không phụ thuộc
 *   kích thước màn hình người dùng.
 * - Nền trắng cố định; việc ép light mode (gỡ class `dark` trên <html>)
 *   do useReportCapture đảm nhiệm trước khi mount layout này.
 * - Mỗi card bọc trong [data-report-card=<id>] để html-to-image chụp từng khối.
 */
interface ReportPrintLayoutProps {
    cardIds: string[];
    cardElements: Record<string, React.ReactNode>;
}

const ReportPrintLayout = React.forwardRef<HTMLDivElement, ReportPrintLayoutProps>(
    ({ cardIds, cardElements }, ref) => (
        <div
            ref={ref}
            aria-hidden="true"
            style={{
                position: 'fixed',
                top: 0,
                left: '-2400px',
                width: '794px',
                zIndex: -1,
                pointerEvents: 'none',
                background: '#ffffff',
            }}
        >
            {/* Vô hiệu trạng thái khởi đầu của framer-motion (opacity 0, translateY):
                animation chạy bằng rAF — bị tạm dừng khi tab chạy nền nên card sẽ
                kẹt ở trạng thái trong suốt và ảnh chụp ra trắng. Chỉ áp cho thẻ div
                (HTML) — không đụng transform attribute của SVG recharts. */}
            <style>{`
                [data-report-card] div { opacity: 1 !important; transform: none !important; }
                /* Ep padding card nhat quan: ChartCard dung padding responsive theo
                   media-query viewport, nen PDF xuat tu dien thoai (375px) se khac
                   desktop. Ep cung 2rem tren goc card de PDF giong het nhau moi thiet bi. */
                [data-report-card] > div { padding: 2rem !important; }
            `}</style>
            {cardIds.map(id => (
                <div
                    key={id}
                    data-report-card={id}
                    style={{ width: '794px', padding: '8px', background: '#ffffff' }}
                >
                    {cardElements[id]}
                </div>
            ))}
        </div>
    ),
);

ReportPrintLayout.displayName = 'ReportPrintLayout';

export default ReportPrintLayout;
