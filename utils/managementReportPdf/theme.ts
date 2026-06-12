/**
 * Token màu sắc / khổ giấy cho PDF Báo cáo Quản trị (A4 dọc).
 */
export type Rgb = [number, number, number];

export const C = {
    navy: [30, 58, 138] as Rgb,        // tiêu đề, thanh section
    navySoft: [224, 231, 255] as Rgb,  // nền nhấn nhẹ
    text: [30, 41, 59] as Rgb,         // chữ chính (slate-800)
    muted: [100, 116, 139] as Rgb,     // chữ phụ (slate-500)
    line: [203, 213, 225] as Rgb,      // kẻ bảng (slate-300)
    stripe: [248, 250, 252] as Rgb,    // hàng chẵn (slate-50)
    white: [255, 255, 255] as Rgb,
    green: [5, 150, 105] as Rgb,       // đạt ≥100%
    amber: [217, 119, 6] as Rgb,       // 70–99%
    red: [220, 38, 38] as Rgb,         // <70% / cảnh báo
    orange: [234, 88, 12] as Rgb,      // accent thương hiệu
};

/** Khổ A4 dọc (mm). marginT chừa chỗ header trang nội dung. */
export const PAGE = {
    w: 210,
    h: 297,
    marginL: 15,
    marginR: 15,
    marginT: 26,
    marginB: 18,
};

export const CONTENT_W = PAGE.w - PAGE.marginL - PAGE.marginR;

/** Ngưỡng tô màu % hoàn thành kế hoạch. */
export function completionColor(pct: number): Rgb {
    if (pct >= 100) return C.green;
    if (pct >= 70) return C.amber;
    return C.red;
}
