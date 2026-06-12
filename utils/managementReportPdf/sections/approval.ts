/**
 * Trang phê duyệt: ô ký Người lập báo cáo / Lãnh đạo phê duyệt.
 */
import { C, PAGE, CONTENT_W } from '../theme';
import { ReportCtx, ensureSpace } from '../layout';

export function drawApproval(ctx: ReportCtx, exportedBy: string): void {
    const { doc } = ctx;
    // Khối ký cần ~70mm liền mạch
    ensureSpace(ctx, 75);
    ctx.y += 10;

    const leftX = PAGE.marginL + CONTENT_W * 0.25;
    const rightX = PAGE.marginL + CONTENT_W * 0.75;
    const y = ctx.y;

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.text);
    doc.text('NGƯỜI LẬP BÁO CÁO', leftX, y, { align: 'center' });
    doc.text('LÃNH ĐẠO PHÊ DUYỆT', rightX, y, { align: 'center' });

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('(Ký, ghi rõ họ tên)', leftX, y + 5, { align: 'center' });
    doc.text('(Ký, ghi rõ họ tên)', rightX, y + 5, { align: 'center' });

    // Chừa 35mm cho chữ ký tay
    doc.setFontSize(9.5);
    doc.setTextColor(...C.text);
    doc.text(exportedBy, leftX, y + 40, { align: 'center' });

    ctx.y = y + 48;
}
