import type { UserContext } from '../types';
import { GLOBAL_VIEW_ROLES } from '../../../../lib/permissions';

// ═══════════════════════════════════════════════
// Format & Calculation Helpers
// ═══════════════════════════════════════════════

/** Format số thành chuỗi tiền tệ dễ đọc */
export const fmtMoney = (v: number): string => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} tỷ VND`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} triệu VND`;
  return `${v.toLocaleString('vi-VN')} VND`;
};

/** Format tiền + kèm raw để LLM đối chiếu */
export const fmtMoneyWithRaw = (v: number): string => {
  return `${fmtMoney(v)} (raw: ${v})`;
};

/** Tính % tăng giảm giữa 2 số */
export const calcChange = (cur: number, prev: number): string => {
  if (prev === 0) return cur > 0 ? '+∞' : '0%';
  const change = ((cur - prev) / prev * 100).toFixed(1);
  return Number(change) >= 0 ? `+${change}%` : `${change}%`;
};

// ═══════════════════════════════════════════════
// Permission & Filter Helpers
// ═══════════════════════════════════════════════

/** Kiểm tra user có quyền xem toàn công ty */
export const canViewAll = (ctx: UserContext): boolean => {
  return GLOBAL_VIEW_ROLES.includes(ctx.role as any);
};

/** Danh sách phòng ban hành chính/quản lý — loại khỏi báo cáo kinh doanh */
const EXCLUDED_ADMIN_UNITS = [
  'hội đồng quản trị',
  'ban giám đốc',
  'phòng tckt',
  'phòng tổng hợp',
];

/** Kiểm tra có phải đơn vị kinh doanh (loại bỏ back-office) */
export const isBusinessUnit = (u: any): boolean => {
  if (u.id === 'all') return false;
  const name = (u.name || '').toLowerCase();
  return !EXCLUDED_ADMIN_UNITS.some(ex => name.includes(ex));
};

/** Lấy đơn vị filter dựa theo phân quyền user */
export const getUnitFilter = (args: any, context: UserContext): string | undefined => {
  let unitFilter = args.unitId || undefined;
  if (!canViewAll(context) && context.unitId) {
    unitFilter = context.unitId;
  }
  return unitFilter;
};

/** Ép buộc unit filter, quăng lỗi nếu user không có quyền xem toàn công ty mà lại thiếu unitId */
export const enforceUnitScope = (context: UserContext): string | undefined => {
  if (canViewAll(context)) {
    return undefined; // Không giới hạn
  }
  if (!context.unitId) {
    throw new Error('Bạn không có quyền truy cập dữ liệu do không thuộc đơn vị nào.');
  }
  return context.unitId;
};
