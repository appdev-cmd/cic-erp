/**
 * Khung trang chung cho PDF Báo cáo Quản trị:
 * con trỏ y, sang trang, tiêu đề section, header/footer mọi trang nội dung.
 */
import type jsPDF from 'jspdf';
import { C, PAGE, CONTENT_W } from './theme';
import type { ImageAsset } from './assets';

export interface ReportCtx {
    doc: jsPDF;
    /** Con trỏ dọc hiện tại (mm). */
    y: number;
    /** Dòng tiêu đề ở header trang nội dung. */
    headerTitle: string;
    /** "dd/MM/yyyy HH:mm" — in ở footer. */
    exportedAt: string;
    logoSmall: ImageAsset | null;
}

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** 1.234.567 — số tiền đầy đủ cho bảng chi tiết. */
export function fmtVnd(v: number): string {
    return nf.format(Math.round(v || 0));
}

/** Viết gọn: 12,34 tỷ / 56 triệu — cho bảng KPI tổng hợp. */
export function fmtShort(v: number): string {
    const abs = Math.abs(v || 0);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2).replace('.', ',')} tỷ`;
    if (abs >= 1e6) return `${sign}${Math.round(abs / 1e6)} triệu`;
    return fmtVnd(v);
}

export function fmtPct(v: number, digits = 1): string {
    return `${v.toFixed(digits).replace('.', ',')}%`;
}

export function newPage(ctx: ReportCtx): void {
    ctx.doc.addPage();
    ctx.y = PAGE.marginT;
}

/** Nếu không đủ `needed` mm trên trang hiện tại → sang trang mới. */
export function ensureSpace(ctx: ReportCtx, needed: number): void {
    if (ctx.y + needed > PAGE.h - PAGE.marginB) newPage(ctx);
}

/** Thanh tiêu đề phần: nền navy, chữ trắng đậm. */
export function sectionHeading(ctx: ReportCtx, title: string): void {
    ensureSpace(ctx, 18);
    const { doc } = ctx;
    doc.setFillColor(...C.navy);
    doc.rect(PAGE.marginL, ctx.y, CONTENT_W, 9, 'F');
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...C.white);
    doc.text(title, PAGE.marginL + 3.5, ctx.y + 6.2);
    ctx.y += 14;
}

/** Tiêu đề card (dùng cho khối bảng — khối chart đã chứa sẵn tiêu đề trong ảnh). */
export function cardHeading(ctx: ReportCtx, title: string, subtitle?: string): void {
    ensureSpace(ctx, subtitle ? 14 : 10);
    const { doc } = ctx;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...C.text);
    doc.text(title, PAGE.marginL, ctx.y + 4);
    // gạch nhấn ngắn màu cam dưới tiêu đề
    doc.setDrawColor(...C.orange);
    doc.setLineWidth(0.8);
    doc.line(PAGE.marginL, ctx.y + 6, PAGE.marginL + 10, ctx.y + 6);
    ctx.y += 8.5;
    if (subtitle) {
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...C.muted);
        doc.text(subtitle, PAGE.marginL, ctx.y + 1.5);
        ctx.y += 5;
    }
}

/** Ghi chú nghiêng nhỏ (vd "Không có dữ liệu trong kỳ"). */
export function mutedNote(ctx: ReportCtx, text: string): void {
    ensureSpace(ctx, 8);
    const { doc } = ctx;
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.muted);
    doc.text(text, PAGE.marginL, ctx.y + 3);
    ctx.y += 8;
}

/**
 * Vẽ header + footer cho mọi trang nội dung (từ trang 2) sau khi đã dựng
 * xong toàn bộ nội dung — để có tổng số trang chính xác.
 */
export function finalizeDecorations(ctx: ReportCtx): void {
    const { doc } = ctx;
    const total = doc.getNumberOfPages();

    for (let p = 2; p <= total; p++) {
        doc.setPage(p);

        // ── Header ──
        let textX = PAGE.marginL;
        if (ctx.logoSmall) {
            const h = 8;
            const w = (ctx.logoSmall.width / ctx.logoSmall.height) * h;
            doc.addImage(ctx.logoSmall.dataUrl, 'PNG', PAGE.marginL, 8, w, h);
            textX += w + 3;
        }
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...C.muted);
        doc.text(ctx.headerTitle, PAGE.w - PAGE.marginR, 13, { align: 'right' });
        doc.setDrawColor(...C.navy);
        doc.setLineWidth(0.4);
        doc.line(PAGE.marginL, 18.5, PAGE.w - PAGE.marginR, 18.5);

        // ── Footer ──
        const fy = PAGE.h - 10;
        doc.setDrawColor(...C.line);
        doc.setLineWidth(0.2);
        doc.line(PAGE.marginL, fy - 4, PAGE.w - PAGE.marginR, fy - 4);
        doc.setFontSize(7.5);
        doc.setTextColor(...C.muted);
        doc.text('CIC ERP · Tài liệu lưu hành nội bộ', PAGE.marginL, fy);
        doc.text(`Xuất ngày ${ctx.exportedAt}`, PAGE.w / 2, fy, { align: 'center' });
        doc.text(`Trang ${p}/${total}`, PAGE.w - PAGE.marginR, fy, { align: 'right' });
    }

    doc.setPage(total);
}
