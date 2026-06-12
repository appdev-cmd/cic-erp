/**
 * Bộ sinh PDF "Báo cáo Quản trị Kinh doanh" — A4 dọc, chuẩn báo cáo doanh nghiệp.
 *
 * Cấu trúc: Trang bìa → Phần I Tóm tắt điều hành (KPI) → các phần II–V theo
 * tab BI (chart chụp từ ReportPrintLayout + bảng số liệu) → Trang phê duyệt.
 * Header/footer + số trang được vẽ sau cùng khi đã biết tổng số trang.
 *
 * Phân quyền: chỉ render card trong opts.visibleCardIds (role ∩ cá nhân hoá),
 * KPI lợi nhuận đã được gating từ phía gọi (Analytics.tsx).
 */
import jsPDF from 'jspdf';
import { CARD_BY_ID, TAB_LABELS, TAB_ORDER } from '../../components/analytics/cardRegistry';
import { savePdf } from '../savePdf';
import { setupReportFonts } from './fonts';
import { loadImageAsset, ImageAsset } from './assets';
import { PAGE } from './theme';
import {
    ReportCtx, newPage, sectionHeading, cardHeading, mutedNote, finalizeDecorations,
} from './layout';
import { drawCover } from './sections/cover';
import { drawExecutiveSummary } from './sections/executiveSummary';
import { drawChartBlock } from './sections/chartBlock';
import { buildCardTable, drawTable, PRIORITY_TABLE_CARDS } from './sections/tables';
import { drawApproval } from './sections/approval';
import type { ManagementReportOptions } from './types';

export type { ManagementReportOptions, ReportKpiRow, ChartImage, ReportDatasets } from './types';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export async function generateManagementReport(
    opts: ManagementReportOptions,
    onProgress?: (message: string) => void,
): Promise<void> {
    onProgress?.('Đang chuẩn bị phông chữ & tài nguyên…');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await setupReportFonts(doc);

    const safeLoad = (url: string): Promise<ImageAsset | null> =>
        loadImageAsset(url).catch(() => null);
    const [logoFull, logoSmall] = await Promise.all([
        safeLoad('/cic-logo-full.png'),
        safeLoad('/cic-logo.png'),
    ]);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const exportedAt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const ctx: ReportCtx = {
        doc,
        y: PAGE.marginT,
        headerTitle: `Báo cáo Quản trị Kinh doanh — ${opts.periodLabel}`,
        exportedAt,
        logoSmall,
    };

    // ═══ Trang bìa ═══
    onProgress?.('Đang dựng trang bìa…');
    drawCover(ctx, opts, logoFull);

    let sectionNo = 0;

    // ═══ Phần I — Tóm tắt điều hành ═══
    if (opts.kpis.length > 0) {
        newPage(ctx);
        sectionHeading(ctx, `PHẦN ${ROMAN[sectionNo++]}. TÓM TẮT ĐIỀU HÀNH`);
        drawExecutiveSummary(ctx, opts.kpis);
    }

    // ═══ Các phần nội dung theo tab ═══
    for (const tab of TAB_ORDER) {
        if (!opts.sections.includes(tab)) continue;

        // kpi-summary đã thể hiện ở Phần I — không lặp lại trong phần Tổng quan
        const cardIds = opts.visibleCardIds.filter(
            id => CARD_BY_ID[id]?.tab === tab && id !== 'kpi-summary',
        );
        if (cardIds.length === 0) continue;

        onProgress?.(`Đang dựng phần ${TAB_LABELS[tab]}…`);
        newPage(ctx);
        sectionHeading(ctx, `PHẦN ${ROMAN[sectionNo++]}. ${TAB_LABELS[tab].toUpperCase()}`);

        for (const id of cardIds) {
            const meta = CARD_BY_ID[id];
            const chart = opts.includeCharts ? opts.charts.get(id) : undefined;
            const rows = opts.datasets[id];
            // Bản Đầy đủ: bảng chỉ in kèm cho card ưu tiên hoặc khi thiếu ảnh chart
            const wantTable = !opts.includeCharts || PRIORITY_TABLE_CARDS.has(id) || !chart;
            const table = wantTable ? buildCardTable(id, rows) : null;

            if (chart) {
                // Ảnh chụp đã gồm khung card + tiêu đề
                drawChartBlock(ctx, chart);
                if (table) drawTable(ctx, table);
            } else if (table) {
                cardHeading(ctx, meta.title, meta.subtitle);
                drawTable(ctx, table);
            } else {
                cardHeading(ctx, meta.title, meta.subtitle);
                mutedNote(ctx, 'Không có dữ liệu trong kỳ báo cáo.');
            }
        }
    }

    // ═══ Trang phê duyệt ═══
    drawApproval(ctx, opts.exportedBy);

    // ═══ Header/footer + số trang ═══
    onProgress?.('Đang hoàn thiện trang & số trang…');
    finalizeDecorations(ctx);

    onProgress?.('Đang lưu file PDF…');
    await savePdf(doc, opts.fileName);
}
