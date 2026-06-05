/**
 * Stage Workflow — Logic chuyển trạng thái Lead (Bitrix24-style, 4 stage)
 *
 * Pipeline: Mới → Đang xử lý → Tiềm năng cao
 *           (nhánh đóng: Không tiềm năng)
 *
 * Luồng nghiệp vụ:
 * - "Đang xử lý": sale phân loại theo Mức tiềm năng (potential_level). Mỗi lần nâng mức
 *   bắt buộc Ghi chú. Chọn mức "Tiềm năng cao"/"Không tiềm năng" sẽ chuyển stage.
 * - "Tiềm năng cao": bắt buộc đủ thông tin (công ty, địa chỉ, liên hệ + chức danh/SĐT/email,
 *   sản phẩm quan tâm). Việc chuyển đổi (tạo deal+company+contact) là một NÚT RIÊNG, không
 *   gắn vào việc chuyển stage.
 * - "Không tiềm năng": bắt buộc lý do; lead vào ao chung toàn công ty.
 *
 * Dùng chung cho LeadsKanbanView (drag-drop) và LeadDetailsPanel (click stage / chọn mức).
 */

import type { CrmLead, CrmStageTemplate, LeadSource, PotentialLevel } from '../../types/crm';
import { LEAD_SOURCE_LABELS, POTENTIAL_LEVEL_RANK } from '../../types/crm';

// ── Tên stage chuẩn (khớp migration 20260605010000) ─────────────
export const LEAD_STAGE = {
  NEW: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  HIGH_POTENTIAL: 'Tiềm năng cao',
  NO_POTENTIAL: 'Không tiềm năng',
} as const;

// ── Nhận diện loại stage (tolerant với tên cũ) ──────────────────
export function isNewStage(name: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('mới') || n.includes('khởi tạo');
}

export function isInProgressStage(name: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('đang xử lý') || n.includes('đã liên hệ') ||
         n.includes('đủ điều kiện') || n.includes('tiềm năng thấp');
}

export function isHighPotentialStage(name: string): boolean {
  const n = (name || '').toLowerCase();
  // 'tiềm năng cao' = stage mới; 'chuyển đổi'/'hoàn thành' = tên cũ
  return n.includes('tiềm năng cao') || n.includes('chuyển đổi') || n.includes('hoàn thành');
}

export function isLoseStage(name: string): boolean {
  const n = (name || '').toLowerCase();
  // 'không tiềm năng' = stage lose mới; 'không đủ'/'mất'/'thất bại' = tên cũ
  return n.includes('không tiềm năng') || n.includes('không đủ') || n.includes('mất') || n.includes('thất bại');
}

/** Bắt buộc Ghi chú khi chuyển tới stage (mọi forward + lose; trừ lùi về "Mới"). */
export function requiresNote(stageName: string): boolean {
  return isInProgressStage(stageName) || isHighPotentialStage(stageName) || isLoseStage(stageName);
}

/** "Tiềm năng cao" bắt buộc có ít nhất 1 sản phẩm/dịch vụ quan tâm. */
export function requiresProducts(stageName: string): boolean {
  return isHighPotentialStage(stageName);
}

// ── Cấu hình field gating ───────────────────────────────────────
export interface StageFieldConfig {
  key: keyof CrmLead;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'number';
  options?: { value: string; label: string }[];
  placeholder: string;
}

const SOURCE_FIELD: StageFieldConfig = {
  key: 'source',
  label: 'Nguồn đầu mối',
  type: 'select',
  options: (Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => ({
    value: s,
    label: LEAD_SOURCE_LABELS[s],
  })),
  placeholder: 'Chọn nguồn đầu mối',
};

const COMPANY_FIELD: StageFieldConfig = {
  key: 'company_name',
  label: 'Tên công ty',
  type: 'text',
  placeholder: 'Nhập tên công ty',
};

const ADDRESS_FIELD: StageFieldConfig = {
  key: 'address',
  label: 'Địa chỉ công ty',
  type: 'text',
  placeholder: 'Nhập địa chỉ công ty',
};

const NAME_FIELD: StageFieldConfig = {
  key: 'name',
  label: 'Người liên hệ chính',
  type: 'text',
  placeholder: 'Nhập tên người liên hệ',
};

const CONTACT_POSITION_FIELD: StageFieldConfig = {
  key: 'contact_position',
  label: 'Chức danh liên hệ',
  type: 'text',
  placeholder: 'VD: Trưởng phòng Kỹ thuật, Giám đốc...',
};

const PHONE_FIELD: StageFieldConfig = {
  key: 'phone',
  label: 'Điện thoại',
  type: 'tel',
  placeholder: 'Nhập số điện thoại',
};

const EMAIL_FIELD: StageFieldConfig = {
  key: 'email',
  label: 'Email',
  type: 'email',
  placeholder: 'Nhập email liên hệ',
};

/**
 * Trả về danh sách field cấu trúc bắt buộc khi chuyển TỚI một stage.
 * - Tiềm năng cao: công ty + địa chỉ + liên hệ + chức danh + điện thoại + email
 *   (kèm yêu cầu sản phẩm — xem requiresProducts; và Ghi chú — xem requiresNote).
 * - Các stage khác: không có field cấu trúc bắt buộc (chỉ Ghi chú nếu requiresNote).
 */
export function getRequiredFieldsForStage(stageName: string): StageFieldConfig[] {
  if (isHighPotentialStage(stageName)) {
    return [COMPANY_FIELD, ADDRESS_FIELD, NAME_FIELD, CONTACT_POSITION_FIELD, PHONE_FIELD, EMAIL_FIELD];
  }
  return [];
}

// Field nguồn — export để form khác tái dùng nếu cần.
export { SOURCE_FIELD };

// ── Kiểm tra một field của lead đã có giá trị chưa ──────────────
function isFieldFilled(lead: CrmLead, key: keyof CrmLead): boolean {
  const v = lead[key];
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return v > 0;
  return true;
}

export function hasProducts(lead: CrmLead): boolean {
  return Array.isArray(lead.products) && lead.products.length > 0;
}

export type StageAction = 'direct' | 'transition';

/**
 * Quyết định hành động khi kéo/chuyển lead sang stage đích:
 * - 'transition' → mở StageTransitionModal (điền field còn thiếu / ghi chú / lý do đóng)
 * - 'direct'     → cập nhật stage trực tiếp (vd: lùi về "Mới")
 *
 * Việc CHUYỂN ĐỔI (tạo deal+company+contact) KHÔNG đi qua đây — nó là một nút riêng
 * chỉ hiện khi lead ở stage "Tiềm năng cao".
 */
export function resolveStageAction(lead: CrmLead, targetStage: CrmStageTemplate): StageAction {
  if (isNewStage(targetStage.name)) return 'direct';
  if (requiresNote(targetStage.name)) return 'transition';

  const required = getRequiredFieldsForStage(targetStage.name);
  const hasMissing = required.some((f) => !isFieldFilled(lead, f.key));
  return hasMissing ? 'transition' : 'direct';
}

/**
 * Ánh xạ Mức tiềm năng (chọn trong "Đang xử lý") → stage đích.
 * - 'high' → "Tiềm năng cao"; 'none' → "Không tiềm năng"; còn lại → "Đang xử lý".
 */
export function mapPotentialLevelToStage(
  level: PotentialLevel,
  stages: CrmStageTemplate[]
): CrmStageTemplate | undefined {
  if (level === 'high') return stages.find((s) => isHighPotentialStage(s.name));
  if (level === 'none') return stages.find((s) => isLoseStage(s.name));
  return stages.find((s) => isInProgressStage(s.name));
}

/** Có phải là "nâng mức" tiềm năng không (để bắt buộc ghi chú). */
export function isLevelUp(prev: PotentialLevel | undefined, next: PotentialLevel): boolean {
  const prevRank = prev ? POTENTIAL_LEVEL_RANK[prev] : 0;
  return POTENTIAL_LEVEL_RANK[next] > prevRank;
}
