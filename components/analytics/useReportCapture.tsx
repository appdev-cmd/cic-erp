import React, { useCallback, useRef, useState } from 'react';
import { toSvg } from 'html-to-image';
import { Global as RechartsGlobal } from 'recharts';
import ReportPrintLayout from './ReportPrintLayout';
import type { ChartImage } from '../../utils/managementReportPdf/types';

/** Đợi ms mili-giây. */
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Chụp 1 node DOM thành PNG dataURL @2x.
 *
 * Dùng toSvg + tự rasterize qua canvas thay vì toPng của html-to-image:
 * toPng chờ img.decode() + requestAnimationFrame — rAF bị tạm dừng khi tab
 * chạy nền nên export sẽ treo vô hạn nếu user chuyển tab. drawImage sau
 * onload không phụ thuộc rAF, hoạt động ổn cả khi tab ẩn.
 */
async function rasterizeNode(node: HTMLElement, pixelRatio = 2): Promise<string> {
    const svgUrl = await toSvg(node, {
        // Bỏ bước nhúng webfont: stylesheet cross-origin (Google Fonts)
        // gây SecurityError + rất chậm; chart fallback sans-serif hệ thống.
        skipFonts: true,
        backgroundColor: '#ffffff',
    });

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Không nạp được ảnh SVG của card'));
        img.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = node.offsetWidth * pixelRatio;
    canvas.height = node.offsetHeight * pixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không tạo được canvas 2D');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
}

/**
 * Hook chụp các card chart thành ảnh PNG @2x phục vụ xuất PDF.
 *
 * Cách hoạt động:
 *  1. Tạm gỡ class `dark` trên <html> (ép light mode — PDF luôn nền trắng,
 *     và các helper getChartColors/getGridStroke đọc class này lúc render).
 *  2. Mount ReportPrintLayout ẩn chứa các card cần chụp (794px, nền trắng).
 *  3. Đợi Recharts dựng SVG + animation (framer-motion & recharts) ổn định.
 *  4. Chụp tuần tự từng card bằng html-to-image, pixelRatio 2.
 *  5. Unmount layout, trả lại dark mode như cũ.
 */
export function useReportCapture(cardElements: Record<string, React.ReactNode>) {
    const [mountedIds, setMountedIds] = useState<string[] | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const captureCharts = useCallback(async (
        ids: string[],
        onProgress?: (message: string) => void,
    ): Promise<Map<string, ChartImage>> => {
        const result = new Map<string, ChartImage>();
        if (ids.length === 0) return result;

        const root = document.documentElement;
        const hadDark = root.classList.contains('dark');
        if (hadDark) root.classList.remove('dark');

        // Tắt animation recharts cho các chart sắp mount trong print layout:
        // animation chạy bằng requestAnimationFrame — bị tạm dừng khi tab chạy
        // nền → bar/area kẹt ở trạng thái đầu (rỗng) và ảnh chụp sẽ trắng.
        // isSsr=true khiến chart render ngay ở trạng thái cuối. Chart trên trang
        // chính đã mount từ trước nên không bị ảnh hưởng.
        const prevIsSsr = RechartsGlobal.isSsr;
        (RechartsGlobal as any).isSsr = true;
        setMountedIds(ids);

        try {
            onProgress?.('Đang dựng biểu đồ…');

            // Đợi layout mount + Recharts vẽ SVG đầu tiên (ResponsiveContainer đo qua ResizeObserver)
            const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
                await sleep(150);
                const el = containerRef.current;
                if (el && el.querySelectorAll('svg').length > 0) break;
            }
            // Animation đã tắt (isSsr) — chỉ chờ thêm 1 nhịp để layout/legend ổn định.
            await sleep(800);

            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                const node = containerRef.current?.querySelector<HTMLElement>(
                    `[data-report-card="${CSS.escape(id)}"]`,
                );
                if (!node) continue;
                onProgress?.(`Đang chụp biểu đồ ${i + 1}/${ids.length}…`);
                try {
                    const dataUrl = await rasterizeNode(node);
                    result.set(id, { dataUrl, width: node.offsetWidth, height: node.offsetHeight });
                } catch {
                    // Card lỗi chụp → PDF sẽ thay bằng bảng số liệu / ghi chú
                }
            }
            return result;
        } finally {
            setMountedIds(null);
            (RechartsGlobal as any).isSsr = prevIsSsr;
            if (hadDark) root.classList.add('dark');
        }
    }, []);

    const printLayout = mountedIds ? (
        <ReportPrintLayout ref={containerRef} cardIds={mountedIds} cardElements={cardElements} />
    ) : null;

    return { captureCharts, printLayout };
}
