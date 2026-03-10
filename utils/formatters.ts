export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// ============================================================
// 📅 Date Formatting Utilities — Chuẩn dd/mm/yyyy
// ============================================================
// BẮT BUỘC: Mọi hiển thị ngày tháng phải dùng các hàm dưới đây.
// KHÔNG BAO GIỜ dùng toLocaleDateString() trực tiếp trong component.
// ============================================================

/**
 * Format ngày tháng dạng dd/mm/yyyy (ví dụ: 01/03/2026)
 * @param dateStr - ISO date string hoặc YYYY-MM-DD
 * @param fallback - Giá trị trả về khi dateStr rỗng (mặc định: '—')
 */
export function formatDate(dateStr?: string | null, fallback: string = '—'): string {
    if (!dateStr) return fallback;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return fallback;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return fallback;
    }
}

/**
 * Format ngày tháng dạng ngắn dd/mm (ví dụ: 01/03)
 * @param dateStr - ISO date string hoặc YYYY-MM-DD
 * @param fallback - Giá trị trả về khi dateStr rỗng
 */
export function formatDateShort(dateStr?: string | null, fallback: string = '—'): string {
    if (!dateStr) return fallback;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return fallback;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    } catch {
        return fallback;
    }
}

/**
 * Format ngày + giờ dạng dd/mm/yyyy HH:mm (ví dụ: 01/03/2026 14:30)
 * @param dateStr - ISO date string
 * @param fallback - Giá trị trả về khi dateStr rỗng
 */
export function formatDateTime(dateStr?: string | null, fallback: string = '—'): string {
    if (!dateStr) return fallback;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return fallback;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
        return fallback;
    }
}

/**
 * Format ngày tháng đầy đủ với thứ (ví dụ: Thứ hai, 01/03/2026)
 * Dùng cho date dividers, headers
 */
export function formatDateFull(dateStr?: string | null, fallback: string = '—'): string {
    if (!dateStr) return fallback;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return fallback;
        const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' });
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        // Capitalize first letter
        const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        return `${capitalizedWeekday}, ${day}/${month}/${year}`;
    } catch {
        return fallback;
    }
}

/**
 * Format ngày với year 2 chữ số: dd/mm/yy (ví dụ: 01/03/26)
 */
export function formatDateCompact(dateStr?: string | null, fallback: string = '—'): string {
    if (!dateStr) return fallback;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return fallback;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    } catch {
        return fallback;
    }
}
