/**
 * Phần I — Tóm tắt điều hành: bảng KPI 5 chỉ tiêu + nhận xét tự động (rule-based).
 */
import autoTable from 'jspdf-autotable';
import { C, PAGE, completionColor } from '../theme';
import { ReportCtx, ensureSpace, fmtShort, fmtPct } from '../layout';
import type { ReportKpiRow } from '../types';

export function drawExecutiveSummary(ctx: ReportCtx, kpis: ReportKpiRow[]): void {
    const { doc } = ctx;
    const hasCompanyTarget = kpis.some(k => k.companyTarget > 0);

    const head = [[
        'Chỉ tiêu', 'Thực hiện', 'KH nội bộ', '% HT',
        ...(hasCompanyTarget ? ['KH ĐHCĐ', '% HT ĐHCĐ'] : []),
        'So cùng kỳ',
    ]];

    const body = kpis.map(k => {
        const pct = k.target > 0 ? (k.actual / k.target) * 100 : null;
        const pctDhcd = k.companyTarget > 0 ? (k.actual / k.companyTarget) * 100 : null;
        return [
            k.label,
            fmtShort(k.actual),
            k.target > 0 ? fmtShort(k.target) : '—',
            pct != null ? fmtPct(pct) : '—',
            ...(hasCompanyTarget ? [
                k.companyTarget > 0 ? fmtShort(k.companyTarget) : '—',
                pctDhcd != null ? fmtPct(pctDhcd) : '—',
            ] : []),
            k.yoyPct != null ? `${k.yoyUp ? '▲' : '▼'} ${fmtPct(Math.abs(k.yoyPct))}` : '—',
        ];
    });

    const pctCols = hasCompanyTarget ? [3, 5] : [3];
    const yoyCol = hasCompanyTarget ? 6 : 4;

    autoTable(doc, {
        startY: ctx.y,
        head, body,
        theme: 'grid',
        styles: {
            font: 'Roboto', fontSize: 9, cellPadding: 2.5,
            lineColor: C.line, lineWidth: 0.15, textColor: C.text,
        },
        headStyles: {
            font: 'Roboto', fontStyle: 'bold', fillColor: C.navy,
            textColor: C.white, fontSize: 8.5, halign: 'center',
        },
        alternateRowStyles: { fillColor: C.stripe },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 38 },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            ...(hasCompanyTarget ? { 4: { halign: 'right' }, 5: { halign: 'right' } } : {}),
            [yoyCol]: { halign: 'center' },
        },
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            const kpi = kpis[data.row.index];
            // Tô màu trạng thái cho cột % hoàn thành
            if (pctCols.includes(data.column.index)) {
                const base = data.column.index === 3 ? kpi.target : kpi.companyTarget;
                if (base > 0) {
                    data.cell.styles.textColor = completionColor((kpi.actual / base) * 100);
                    data.cell.styles.fontStyle = 'bold';
                }
            }
            // Màu xanh/đỏ cho cột so cùng kỳ
            if (data.column.index === yoyCol && kpi.yoyPct != null) {
                data.cell.styles.textColor = kpi.yoyUp ? C.green : C.red;
                data.cell.styles.fontStyle = 'bold';
            }
        },
        margin: { left: PAGE.marginL, right: PAGE.marginR, top: PAGE.marginT, bottom: PAGE.marginB },
    });
    ctx.y = (doc as any).lastAutoTable.finalY + 7;

    // ── Nhận xét tự động ──
    const comments = buildComments(kpis);
    if (comments.length === 0) return;

    ensureSpace(ctx, 10 + comments.length * 5.5);
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.text);
    doc.text('Nhận xét nhanh', PAGE.marginL, ctx.y + 3);
    ctx.y += 7.5;

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8.8);
    comments.forEach(line => {
        const wrapped = doc.splitTextToSize(line, PAGE.w - PAGE.marginL - PAGE.marginR - 5);
        ensureSpace(ctx, wrapped.length * 4.5 + 1.5);
        doc.setTextColor(...C.orange);
        doc.text('•', PAGE.marginL + 1, ctx.y + 3);
        doc.setTextColor(...C.text);
        doc.text(wrapped, PAGE.marginL + 5, ctx.y + 3);
        ctx.y += wrapped.length * 4.5 + 1.5;
    });
    ctx.y += 3;
}

/** Sinh nhận xét rule-based từ số liệu KPI — không phụ thuộc AI. */
function buildComments(kpis: ReportKpiRow[]): string[] {
    const out: string[] = [];
    const fmtP = (v: number) => fmtPct(Math.abs(v));

    kpis.forEach(k => {
        if (k.target > 0) {
            const pct = (k.actual / k.target) * 100;
            if (pct >= 100) out.push(`${k.label} đã vượt kế hoạch nội bộ (đạt ${fmtPct(pct)}).`);
            else if (pct < 70) out.push(`${k.label} mới đạt ${fmtPct(pct)} kế hoạch nội bộ — cần lưu ý tiến độ.`);
        }
    });

    const withYoy = kpis.filter(k => k.yoyPct != null && k.yoyPct !== 0);
    const up = withYoy.filter(k => k.yoyUp);
    const down = withYoy.filter(k => !k.yoyUp);
    if (up.length > 0) {
        out.push(`Tăng trưởng so cùng kỳ: ${up.map(k => `${k.label} +${fmtP(k.yoyPct!)}`).join(', ')}.`);
    }
    if (down.length > 0) {
        out.push(`Suy giảm so cùng kỳ: ${down.map(k => `${k.label} -${fmtP(k.yoyPct!)}`).join(', ')}.`);
    }
    return out.slice(0, 5);
}
