/**
 * Lead Scoring — Tính điểm lead 0-100 theo runtime
 * Dùng trong hiển thị UI, KHÔNG lưu vào DB (tính on-the-fly)
 */

import type { CrmLead } from '../../types/crm';

// ── Score bands ─────────────────────────────────

export interface ScoreBand {
  label: string;
  color: string;        // Tailwind text color
  bgColor: string;      // Tailwind bg color  
  darkColor: string;    // Dark mode text
  darkBgColor: string;  // Dark mode bg
}

const BANDS: { min: number; band: ScoreBand }[] = [
  {
    min: 61,
    band: {
      label: 'Hot',
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-100',
      darkColor: 'dark:text-emerald-400',
      darkBgColor: 'dark:bg-emerald-900/30'
    }
  },
  {
    min: 31,
    band: {
      label: 'Warm',
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
      darkColor: 'dark:text-amber-400',
      darkBgColor: 'dark:bg-amber-900/30'
    }
  },
  { 
    min: 0, 
    band: { 
      label: 'Cold', 
      color: 'text-slate-600', 
      bgColor: 'bg-slate-100', 
      darkColor: 'dark:text-slate-400', 
      darkBgColor: 'dark:bg-slate-800' 
    } 
  },
];

export function getScoreBand(score: number): ScoreBand {
  for (const { min, band } of BANDS) {
    if (score >= min) return band;
  }
  return BANDS[BANDS.length - 1].band;
}

// ── Score breakdown ─────────────────────────────

export interface ScoreCategory {
  category: string;
  score: number;
  max: number;
  details: string[];
}

/**
 * Tính điểm lead 0-100 = điểm thủ công (max 70) + AI Intelligence (max 30).
 * Tổng được cap ở 100.
 */
export function calcLeadScore(lead: CrmLead): number {
  const breakdown = getScoreBreakdown(lead);
  const total = breakdown.reduce((sum, cat) => sum + cat.score, 0);
  return Math.min(total, 100);
}

/**
 * Chi tiết breakdown scoring cho tooltip.
 * Tổng max = 70 (thủ công) + 30 (AI) = 100.
 */
export function getScoreBreakdown(lead: CrmLead): ScoreCategory[] {
  const categories: ScoreCategory[] = [];

  // ── 1. Profile Completeness (max 20) ──
  let profileScore = 0;
  const profileDetails: string[] = [];

  if (lead.title) { profileScore += 4; profileDetails.push('Có tiêu đề (+4)'); }
  if (lead.company_name) { profileScore += 8; profileDetails.push('Có tên công ty (+8)'); }
  if (lead.phone) { profileScore += 4; profileDetails.push('Có SĐT (+4)'); }
  if (lead.email) { profileScore += 4; profileDetails.push('Có email (+4)'); }

  categories.push({ category: 'Thông tin', score: Math.min(profileScore, 20), max: 20, details: profileDetails });

  // ── 2. Products Interest (max 15) ──
  let productScore = 0;
  const productDetails: string[] = [];
  const products = lead.products;

  if (Array.isArray(products) && products.length > 0) {
    productScore += 5;
    productDetails.push(`Có ${products.length} sản phẩm (+5)`);
    if (products.length >= 2) {
      productScore += 3;
      productDetails.push('Quan tâm 2+ SP (+3)');
    }
  }
  if (lead.expected_value && lead.expected_value > 0) {
    productScore += 7;
    productDetails.push('Có giá trị ước tính (+7)');
  }

  categories.push({ category: 'Sản phẩm', score: Math.min(productScore, 15), max: 15, details: productDetails });

  // ── 3. Source Quality (max 15) ──
  let sourceScore = 0;
  const sourceDetails: string[] = [];

  const sourceScores: Record<string, number> = {
    referral: 10,
    event: 10,
    website: 8,
    phone: 7,
    social: 6,
    api: 6,
    email: 5,
    other: 3,
    import: 3,
  };

  if (lead.source && sourceScores[lead.source]) {
    sourceScore += sourceScores[lead.source];
    sourceDetails.push(`Nguồn ${lead.source} (+${sourceScores[lead.source]})`);
  }
  if (lead.source_detail) {
    sourceScore += 5;
    sourceDetails.push('Có chi tiết nguồn (+5)');
  }

  categories.push({ category: 'Nguồn', score: Math.min(sourceScore, 15), max: 15, details: sourceDetails });

  // ── 4. Activity Engagement (max 20) ──
  let activityScore = 0;
  const activityDetails: string[] = [];
  const activities = lead.activities;

  if (Array.isArray(activities) && activities.length > 0) {
    activityScore += 8;
    activityDetails.push(`Có ${activities.length} hoạt động (+8)`);
    if (activities.length >= 3) {
      activityScore += 6;
      activityDetails.push('≥3 hoạt động (+6)');
    }
    if (activities.length >= 5) {
      activityScore += 6;
      activityDetails.push('≥5 hoạt động (+6)');
    }
  }

  categories.push({ category: 'Hoạt động', score: Math.min(activityScore, 20), max: 20, details: activityDetails });

  // ── 5. AI Intelligence (max 30) ──
  const aiContribution = Math.min(Math.max(lead.ai_score_contribution || 0, 0), 30);
  const aiDetails: string[] = [];
  if (aiContribution > 0) {
    aiDetails.push(`AI phân tích (+${aiContribution})`);
  } else if (lead.intelligence_status === 'completed') {
    aiDetails.push('AI đã phân tích (+0)');
  } else {
    aiDetails.push('Chưa phân tích AI');
  }

  categories.push({ category: 'AI Intelligence', score: aiContribution, max: 30, details: aiDetails });

  return categories;
}
