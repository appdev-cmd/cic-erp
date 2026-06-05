/**
 * Region Detection — Phát hiện vùng miền từ text
 * Dùng để auto-detect region khi tạo/cập nhật lead
 */

import type { RegionType } from '../../types/crm';

// ── Keywords theo vùng miền ─────────────────────

const NORTH_KEYWORDS = [
  'hà nội', 'ha noi', 'hn', 'hải phòng', 'hai phong',
  'bắc ninh', 'bac ninh', 'quảng ninh', 'quang ninh',
  'hải dương', 'hai duong', 'hưng yên', 'hung yen',
  'vĩnh phúc', 'vinh phuc', 'thái nguyên', 'thai nguyen',
  'phú thọ', 'phu tho', 'bắc giang', 'bac giang',
  'nam định', 'nam dinh', 'ninh bình', 'ninh binh',
  'thái bình', 'thai binh', 'hà nam', 'ha nam',
  'lạng sơn', 'lang son', 'thanh hóa', 'thanh hoa',
  'nghệ an', 'nghe an', 'hà tĩnh', 'ha tinh',
  'lào cai', 'lao cai', 'yên bái', 'yen bai',
  'điện biên', 'dien bien', 'sơn la', 'son la',
  'hòa bình', 'hoa binh', 'tuyên quang', 'tuyen quang',
  'cao bằng', 'cao bang', 'bắc kạn', 'bac kan',
  'miền bắc', 'mien bac',
];

const CENTRAL_KEYWORDS = [
  'đà nẵng', 'da nang', 'dn',
  'huế', 'hue', 'thừa thiên', 'thua thien',
  'quảng nam', 'quang nam', 'quảng ngãi', 'quang ngai',
  'bình định', 'binh dinh', 'phú yên', 'phu yen',
  'khánh hòa', 'khanh hoa', 'nha trang',
  'ninh thuận', 'ninh thuan', 'bình thuận', 'binh thuan',
  'quảng bình', 'quang binh', 'quảng trị', 'quang tri',
  'kon tum', 'gia lai', 'đắk lắk', 'dak lak',
  'đắk nông', 'dak nong', 'lâm đồng', 'lam dong',
  'đà lạt', 'da lat',
  'miền trung', 'mien trung',
];

const SOUTH_KEYWORDS = [
  'hồ chí minh', 'ho chi minh', 'tp.hcm', 'tphcm', 'hcm', 'sài gòn', 'sai gon', 'sgn',
  'bình dương', 'binh duong', 'đồng nai', 'dong nai',
  'long an', 'bà rịa', 'ba ria', 'vũng tàu', 'vung tau',
  'tây ninh', 'tay ninh', 'bình phước', 'binh phuoc',
  'cần thơ', 'can tho', 'an giang', 'kiên giang', 'kien giang',
  'hậu giang', 'hau giang', 'cà mau', 'ca mau',
  'bạc liêu', 'bac lieu', 'sóc trăng', 'soc trang',
  'trà vinh', 'tra vinh', 'vĩnh long', 'vinh long',
  'đồng tháp', 'dong thap', 'bến tre', 'ben tre',
  'tiền giang', 'tien giang',
  'miền nam', 'mien nam',
];

/**
 * Normalize text: lowercase, bỏ dấu (optional), trim
 */
function normalize(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Detect vùng miền từ một chuỗi text
 */
export function detectRegion(text: string): RegionType {
  if (!text) return 'unknown';
  const normalized = normalize(text);

  // Check từng vùng — ưu tiên match dài hơn trước
  for (const keyword of SOUTH_KEYWORDS) {
    if (normalized.includes(keyword)) return 'south';
  }
  for (const keyword of NORTH_KEYWORDS) {
    if (normalized.includes(keyword)) return 'north';
  }
  for (const keyword of CENTRAL_KEYWORDS) {
    if (normalized.includes(keyword)) return 'central';
  }

  return 'unknown';
}

/**
 * Detect vùng miền từ lead data
 * Ưu tiên: source_detail > company_name
 */
export function detectLeadRegion(lead: {
  company_name?: string;
  source_detail?: string;
}): RegionType {
  // Try source_detail first (thường chứa địa chỉ chi tiết hơn)
  if (lead.source_detail) {
    const region = detectRegion(lead.source_detail);
    if (region !== 'unknown') return region;
  }

  // Then try company_name
  if (lead.company_name) {
    const region = detectRegion(lead.company_name);
    if (region !== 'unknown') return region;
  }

  return 'unknown';
}
