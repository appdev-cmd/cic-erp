/**
 * Bảng số liệu cho từng card BI — key khớp cardId trong cardRegistry.
 * Bản "Rút gọn" dùng bảng cho mọi card; bản "Đầy đủ" chỉ thêm bảng
 * cho các card trong PRIORITY_TABLE_CARDS (dữ liệu dạng hành động).
 */
import autoTable from 'jspdf-autotable';
import { C, PAGE } from '../theme';
import { ReportCtx, fmtVnd, fmtPct } from '../layout';

/** Card mà bảng số liệu có giá trị tra cứu cao → in kèm cả ở bản Đầy đủ. */
export const PRIORITY_TABLE_CARDS = new Set([
    'monthly-trend',
    'historical-yoy',
    'unit-performance',
    'ar-aging',
    'top-receivables',
    'top-customers',
    'top-employees',
    'employee-target-completion',
]);

interface TableSpec {
    head: string[];
    body: (string | number)[][];
    /** Cột căn phải (số liệu). */
    rightCols?: number[];
    note?: string;
}

const pctOf = (v: number, total: number) => (total > 0 ? fmtPct((v / total) * 100) : '—');

/** Dataset → spec bảng. Trả null nếu card không có dạng bảng phù hợp. */
export function buildCardTable(cardId: string, rows: any[]): TableSpec | null {
    if (!rows || rows.length === 0) return null;
    const total = rows.reduce((s: number, r: any) => s + (typeof r.value === 'number' ? r.value : 0), 0);

    switch (cardId) {
        case 'revenue-structure':
            return {
                head: ['#', 'Đơn vị / Nhân sự', 'Doanh thu (VNĐ)', 'Tỷ trọng'],
                body: rows.map((r, i) => [i + 1, r.name, fmtVnd(r.value), pctOf(r.value, total)]),
                rightCols: [2, 3],
            };
        case 'plan-vs-actual':
            return {
                head: ['Đơn vị', 'Kế hoạch (VNĐ)', 'Thực tế (VNĐ)', '% HT'],
                body: rows.map(r => [
                    r.name, fmtVnd(r.Target), fmtVnd(r.Actual),
                    r.Target > 0 ? fmtPct((r.Actual / r.Target) * 100) : '—',
                ]),
                rightCols: [1, 2, 3],
            };
        case 'unit-performance':
            return {
                head: ['Đơn vị', 'Chỉ tiêu (VNĐ)', 'Thực tế (VNĐ)', '% hoàn thành'],
                body: rows.map(r => [
                    r.name, fmtVnd(r.Target), fmtVnd(r.Actual),
                    r.Target > 0 ? fmtPct(r.completion) : '—',
                ]),
                rightCols: [1, 2, 3],
            };
        case 'contract-status-funnel':
            return {
                head: ['Giai đoạn', 'Số HĐ', 'Giá trị (VNĐ)'],
                body: rows.map(r => [r.name, r.count, fmtVnd(r.value)]),
                rightCols: [1, 2],
            };
        case 'contract-classification':
            return {
                head: ['Phân loại', 'Doanh thu (VNĐ)', 'Tỷ trọng'],
                body: rows.map(r => [r.name, fmtVnd(r.value), pctOf(r.value, total)]),
                rightCols: [1, 2],
            };
        case 'monthly-trend':
            return {
                head: ['Tháng', 'Doanh thu (VNĐ)', 'Lợi nhuận (VNĐ)'],
                body: rows.map(r => [r.name, fmtVnd(r.DoanhThu), fmtVnd(r.LoiNhuan)]),
                rightCols: [1, 2],
            };
        case 'cumulative-vs-target':
            return {
                head: ['Tháng', 'DT lũy kế (VNĐ)', 'Mục tiêu lũy kế (VNĐ)'],
                body: rows.map(r => [r.name, fmtVnd(r['Lũy kế']), fmtVnd(r['Mục tiêu'])]),
                rightCols: [1, 2],
            };
        case 'historical-yoy':
            return {
                head: ['Năm', 'Ký kết (VNĐ)', 'Doanh thu (VNĐ)', 'LNG QT (VNĐ)', 'LNG DT (VNĐ)'],
                body: rows.map(r => [
                    r.name, fmtVnd(r['Ký kết']), fmtVnd(r['Doanh thu']),
                    fmtVnd(r['LNG QT']), fmtVnd(r['LNG DT']),
                ]),
                rightCols: [1, 2, 3, 4],
            };
        case 'cashflow':
            return {
                head: ['Tháng', 'Thu (VNĐ)', 'Chi (VNĐ)', 'Ròng (VNĐ)'],
                body: rows.map(r => [r.name, fmtVnd(r.Thu), fmtVnd(r.Chi), fmtVnd(r.Rong)]),
                rightCols: [1, 2, 3],
            };
        case 'cumulative-cashflow':
            return {
                head: ['Tháng', 'Số dư lũy kế (VNĐ)'],
                body: rows.map(r => [r.name, fmtVnd(r['Số dư'])]),
                rightCols: [1],
            };
        case 'payment-status':
            return {
                head: ['Trạng thái', 'Giá trị (VNĐ)', 'Tỷ trọng'],
                body: rows.map(r => [r.name, fmtVnd(r.value), pctOf(r.value, total)]),
                rightCols: [1, 2],
            };
        case 'ar-aging':
            return {
                head: ['Nhóm tuổi nợ', 'Giá trị chưa thu (VNĐ)', 'Tỷ trọng'],
                body: rows.map(r => [r.name, fmtVnd(r.value), pctOf(r.value, total)]),
                rightCols: [1, 2],
            };
        case 'top-receivables':
            return {
                head: ['#', 'Mã HĐ', 'Tên hợp đồng', 'Còn phải thu (VNĐ)'],
                body: rows.map((r, i) => [i + 1, r.code, r.title || '', fmtVnd(r.value)]),
                rightCols: [3],
            };
        case 'collection-rate-trend':
            return {
                head: ['Tháng', 'Tiền về (VNĐ)', 'Doanh thu (VNĐ)', 'Tỷ lệ thu hồi'],
                body: rows.map(r => [
                    r.name, fmtVnd(r['Tiền về']), fmtVnd(r['Doanh thu']), fmtPct(r['Tỷ lệ']),
                ]),
                rightCols: [1, 2, 3],
            };
        case 'top-brands':
            return {
                head: ['#', 'Hãng / Đối tác', 'Doanh thu (VNĐ)', 'Tỷ trọng nhóm'],
                body: rows.map((r, i) => [i + 1, r.name, fmtVnd(r.value), pctOf(r.value, total)]),
                rightCols: [2, 3],
                note: 'Tỷ trọng tính trong phạm vi các hãng thuộc bảng.',
            };
        case 'product-category':
            return {
                head: ['Nhóm sản phẩm', 'Doanh thu (VNĐ)', 'Tỷ trọng'],
                body: rows.map(r => [r.name, fmtVnd(r.value), pctOf(r.value, total)]),
                rightCols: [1, 2],
            };
        case 'brand-margin':
            return {
                head: ['#', 'Hãng (phân khúc)', 'Doanh thu (VNĐ)', 'Biên LN'],
                body: rows.map((r, i) => [i + 1, r.name || r.brandName, fmtVnd(r.revenue), fmtPct(r.value)]),
                rightCols: [2, 3],
            };
        case 'product-qty':
            return {
                head: ['#', 'Họ sản phẩm', 'Số lượng đã bán'],
                body: rows.map((r, i) => [i + 1, r.name, fmtVnd(r.value)]),
                rightCols: [2],
            };
        case 'brand-qty':
            return {
                head: ['#', 'Hãng', 'Số lượng đã bán'],
                body: rows.map((r, i) => [i + 1, r.name, fmtVnd(r.value)]),
                rightCols: [2],
            };
        case 'brand-profit-structure':
            return {
                head: ['#', 'Hãng (phân khúc)', 'LNG (VNĐ)', 'Tỷ trọng'],
                body: rows.map((r, i) => [i + 1, r.name || r.brandName, fmtVnd(r.value), pctOf(r.value, total)]),
                rightCols: [2, 3],
            };
        case 'brand-bcg':
            return {
                head: ['#', 'Hãng (phân khúc)', 'Doanh thu (VNĐ)', 'Biên LN', 'SL bán'],
                body: rows.map((r: any, i: number) => [
                    i + 1, r.name || r.brandName, fmtVnd(r.x), fmtPct(r.y), fmtVnd(r.z),
                ]),
                rightCols: [2, 3, 4],
            };
        case 'revenue-pareto':
            return {
                head: ['#', 'Hãng', 'Doanh thu (VNĐ)', 'Lũy kế'],
                body: rows.map((r: any, i: number) => [i + 1, r.name, fmtVnd(r.value), fmtPct(r.cum)]),
                rightCols: [2, 3],
            };
        case 'top-customers':
            return {
                head: ['#', 'Khách hàng', 'Doanh thu (VNĐ)'],
                body: rows.map((r, i) => [i + 1, r.name, fmtVnd(r.value)]),
                rightCols: [2],
            };
        case 'top-employees':
            return {
                head: ['#', 'Nhân sự', 'Doanh thu (VNĐ)'],
                body: rows.map((r, i) => [i + 1, r.name, fmtVnd(r.value)]),
                rightCols: [2],
            };
        case 'employee-target-completion':
            return {
                head: ['#', 'Nhân sự', 'Chỉ tiêu (VNĐ)', 'Thực tế (VNĐ)', '% HT'],
                body: rows.map((r, i) => [
                    i + 1, r.name, fmtVnd(r.target), fmtVnd(r.actual),
                    r.target > 0 ? fmtPct(r.pct) : '—',
                ]),
                rightCols: [2, 3, 4],
            };
        case 'new-vs-returning-customers':
            return {
                head: ['Tháng', 'KH mới', 'KH quay lại'],
                body: rows.map(r => [r.name, r['Mới'], r['Quay lại']]),
                rightCols: [1, 2],
            };
        case 'deal-size-distribution':
            return {
                head: ['Khoảng giá trị HĐ', 'Số lượng HĐ'],
                body: rows.map(r => [r.name, r.count]),
                rightCols: [1],
            };
        case 'cycle-time':
            return {
                head: ['Giai đoạn', 'Số ngày trung bình'],
                body: rows.map(r => [r.name, r.value]),
                rightCols: [1],
            };
        default:
            return null;
    }
}

/** Vẽ bảng theo style thống nhất của báo cáo (header navy, striped). */
export function drawTable(ctx: ReportCtx, spec: TableSpec): void {
    const columnStyles: Record<number, any> = {};
    (spec.rightCols || []).forEach(c => { columnStyles[c] = { halign: 'right' }; });

    autoTable(ctx.doc, {
        startY: ctx.y,
        head: [spec.head],
        body: spec.body,
        theme: 'grid',
        styles: {
            font: 'Roboto', fontSize: 8, cellPadding: 1.8,
            lineColor: C.line, lineWidth: 0.15, textColor: C.text,
        },
        headStyles: {
            font: 'Roboto', fontStyle: 'bold', fillColor: C.navy,
            textColor: C.white, fontSize: 8, halign: 'center',
        },
        alternateRowStyles: { fillColor: C.stripe },
        columnStyles,
        margin: { left: PAGE.marginL, right: PAGE.marginR, top: PAGE.marginT, bottom: PAGE.marginB },
    });
    ctx.y = (ctx.doc as any).lastAutoTable.finalY + 4;

    if (spec.note) {
        ctx.doc.setFont('Roboto', 'normal');
        ctx.doc.setFontSize(7);
        ctx.doc.setTextColor(...C.muted);
        ctx.doc.text(spec.note, PAGE.marginL, ctx.y);
        ctx.y += 4;
    }
    ctx.y += 2;
}
