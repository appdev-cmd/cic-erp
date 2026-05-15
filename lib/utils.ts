import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format số với dấu chấm phân tách hàng nghìn (chuẩn Việt Nam)
 * @param value - Số cần format
 * @returns Chuỗi đã format (vd: 1.000.000)
 */
export function formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '0';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0';
    return Math.round(numValue).toLocaleString('vi-VN');
}

/**
 * Format tiền VND với dấu chấm phân tách
 * @param value - Số tiền
 * @param showCurrency - Có hiển thị đơn vị tiền tệ không
 * @returns Chuỗi đã format (vd: 1.000.000 hoặc 1.000.000 đ)
 */
export function formatVND(value: number | string | null | undefined, showCurrency: boolean = false): string {
    const formatted = formatNumber(value);
    return showCurrency ? `${formatted} đ` : formatted;
}

/**
 * Parse chuỗi số có dấu chấm phân tách về number
 * @param value - Chuỗi số đã format (vd: "1.000.000")
 * @returns Số (vd: 1000000)
 */
export function parseFormattedNumber(value: string): number {
    if (!value) return 0;
    // Loại bỏ tất cả dấu chấm và khoảng trắng
    const cleaned = value.replace(/\./g, '').replace(/\s/g, '').replace(/[^\d-]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
}
