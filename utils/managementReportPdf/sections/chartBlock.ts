/**
 * Nhúng ảnh chart (đã chụp từ ReportPrintLayout) vào PDF.
 * Ảnh chụp đã bao gồm khung card + tiêu đề + subtitle nên không vẽ lại heading.
 */
import { PAGE, CONTENT_W } from '../theme';
import { ReportCtx, ensureSpace, newPage } from '../layout';
import type { ChartImage } from '../types';

const MAX_BLOCK_H = 150; // mm — trần chiều cao 1 khối chart

export function drawChartBlock(ctx: ReportCtx, img: ChartImage): void {
    let w = CONTENT_W;
    let h = (img.height / img.width) * w;
    if (h > MAX_BLOCK_H) {
        h = MAX_BLOCK_H;
        w = (img.width / img.height) * h;
    }

    // Không cắt đôi chart: thiếu chỗ → sang trang
    if (ctx.y + h > PAGE.h - PAGE.marginB) newPage(ctx);

    const x = PAGE.marginL + (CONTENT_W - w) / 2;
    ctx.doc.addImage(img.dataUrl, 'PNG', x, ctx.y, w, h, undefined, 'FAST');
    ctx.y += h + 6;
}
