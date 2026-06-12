/**
 * Trang bìa báo cáo: logo, tiêu đề, kỳ báo cáo, phạm vi dữ liệu, người xuất.
 */
import { C, PAGE, CONTENT_W } from '../theme';
import type { ReportCtx } from '../layout';
import type { ImageAsset } from '../assets';
import type { ManagementReportOptions } from '../types';

export function drawCover(ctx: ReportCtx, opts: ManagementReportOptions, logoFull: ImageAsset | null): void {
    const { doc } = ctx;

    // Dải màu nhấn trên cùng
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PAGE.w, 6, 'F');
    doc.setFillColor(...C.orange);
    doc.rect(0, 6, PAGE.w, 1.5, 'F');

    // Logo căn giữa
    let y = 50;
    if (logoFull) {
        const w = 58;
        const h = (logoFull.height / logoFull.width) * w;
        doc.addImage(logoFull.dataUrl, 'PNG', (PAGE.w - w) / 2, y, w, h);
        y += h + 22;
    } else {
        y += 30;
    }

    // Tiêu đề
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(23);
    doc.setTextColor(...C.navy);
    doc.text('BÁO CÁO QUẢN TRỊ', PAGE.w / 2, y, { align: 'center' });
    y += 11;
    doc.text('KINH DOANH', PAGE.w / 2, y, { align: 'center' });
    y += 12;

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(...C.text);
    doc.text(opts.periodLabel, PAGE.w / 2, y, { align: 'center' });
    y += 6;

    // Kẻ phân cách
    doc.setDrawColor(...C.orange);
    doc.setLineWidth(0.8);
    doc.line(PAGE.w / 2 - 22, y + 3, PAGE.w / 2 + 22, y + 3);
    y += 22;

    // Khối thông tin phạm vi
    const rows: [string, string][] = [
        ['Đơn vị', opts.unitName],
        ...opts.filterSummary.map(f => [f.label, f.value] as [string, string]),
        ['Người xuất', opts.exportedBy],
        ['Thời điểm xuất', ctx.exportedAt],
    ];

    const boxPadding = 8;
    const lineH = 8;
    const boxH = rows.length * lineH + boxPadding * 2 - 3;
    const boxW = 130;
    const boxX = (PAGE.w - boxW) / 2;

    doc.setFillColor(...C.stripe);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'FD');

    let ry = y + boxPadding + 2;
    rows.forEach(([label, value]) => {
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...C.muted);
        doc.text(label, boxX + boxPadding, ry);
        doc.setFont('Roboto', 'normal');
        doc.setTextColor(...C.text);
        // Giá trị dài (danh sách hãng/KH lọc) → xuống dòng trong phạm vi hộp
        const wrapped = doc.splitTextToSize(value, boxW - boxPadding * 2 - 38);
        doc.text(wrapped[0] + (wrapped.length > 1 ? '…' : ''), boxX + boxPadding + 38, ry);
        ry += lineH;
    });

    // Chân trang bìa
    const fy = PAGE.h - 28;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.red);
    doc.text('TÀI LIỆU LƯU HÀNH NỘI BỘ', PAGE.w / 2, fy, { align: 'center' });
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(
        'Báo cáo chứa thông tin tài chính nhạy cảm — không sao chép, chuyển tiếp ra ngoài tổ chức.',
        PAGE.w / 2, fy + 5.5, { align: 'center' },
    );
    doc.setFillColor(...C.navy);
    doc.rect(0, PAGE.h - 8, PAGE.w, 8, 'F');
}
