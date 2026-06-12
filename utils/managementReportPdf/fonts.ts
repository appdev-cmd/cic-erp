/**
 * Nạp font Roboto (Regular + Bold) cho jsPDF — bắt buộc để render tiếng Việt có dấu.
 * Font TTF tĩnh đặt tại public/fonts/, được Vite serve ở /fonts/...
 */
import type jsPDF from 'jspdf';

const FONT_FILES = [
    { vfsName: 'Roboto-Regular.ttf', url: '/fonts/Roboto-Regular.ttf', style: 'normal' as const },
    { vfsName: 'Roboto-Bold.ttf', url: '/fonts/Roboto-Bold.ttf', style: 'bold' as const },
];

const _cache = new Map<string, string>();

async function fetchFontBase64(url: string): Promise<string> {
    const cached = _cache.get(url);
    if (cached) return cached;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Không tải được font ${url}: ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());

    // Chuyển base64 theo chunk để tránh tràn call stack với file lớn
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const b64 = btoa(binary);
    _cache.set(url, b64);
    return b64;
}

/**
 * Đăng ký Roboto normal + bold vào doc. Nếu Bold tải lỗi thì dùng Regular
 * thay thế (báo cáo vẫn xuất được, tiêu đề không đậm).
 */
export async function setupReportFonts(doc: jsPDF): Promise<void> {
    const regular = await fetchFontBase64(FONT_FILES[0].url);
    doc.addFileToVFS(FONT_FILES[0].vfsName, regular);
    doc.addFont(FONT_FILES[0].vfsName, 'Roboto', 'normal');

    try {
        const bold = await fetchFontBase64(FONT_FILES[1].url);
        doc.addFileToVFS(FONT_FILES[1].vfsName, bold);
        doc.addFont(FONT_FILES[1].vfsName, 'Roboto', 'bold');
    } catch {
        doc.addFont(FONT_FILES[0].vfsName, 'Roboto', 'bold');
    }

    doc.setFont('Roboto', 'normal');
}
