/**
 * AI Duplication Service — Kiểm tra trùng lặp tên công ty bằng AI
 * =================================================================
 *
 * Sử dụng Local AI (Qwen 3.5 35B) qua AI Gateway để phân tích
 * mức độ tương đồng giữa tên công ty mới và các bản ghi đã có.
 *
 * Flow:
 * 1. CustomerService.checkDuplicate() → tìm ứng viên từ DB
 * 2. Gửi danh sách ứng viên cho AI để phân tích sâu
 * 3. Trả về kết quả có cấu trúc (score, reasoning, isHighRisk)
 */

import { chat } from './gateway';
import { CustomerService, DuplicateMatch } from '../customerService';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface DuplicateCandidate {
  id: string;
  name: string;
  short_name?: string;
  tax_code?: string;
  type?: string;
  match_reason?: string;
}

export interface DuplicateCandidateResult {
  id: string;
  name: string;
  similarity: number;
  reason: string;
}

export interface AIDuplicationResult {
  score: number;            // 0-100: Overall duplication risk score
  reasoning: string;        // AI explanation in Vietnamese
  isHighRisk: boolean;      // true if score > 70
  candidates: DuplicateCandidateResult[];
}

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════

const AI_MODEL = 'qwen3.5-35b';
const HIGH_RISK_THRESHOLD = 70;

const SYSTEM_PROMPT = `Bạn là hệ thống kiểm tra trùng lặp tên công ty/đối tác trong ERP.

NHIỆM VỤ:
Phân tích tên công ty mục tiêu và so sánh với danh sách ứng viên trùng lặp đã tìm được từ cơ sở dữ liệu.

QUY TẮC PHÂN TÍCH:
- So sánh tên đầy đủ, tên viết tắt, mã số thuế
- Xem xét: viết tắt (TNHH, CP, JSC...), dấu tiếng Việt, khoảng trắng, ký tự đặc biệt
- Các công ty cùng tên nhưng khác loại hình (TNHH vs CP) vẫn CÓ THỂ là trùng
- Mã số thuế trùng → rủi ro rất cao (90-100)
- Tên giống >= 80% → rủi ro cao (70-90)
- Tên tương tự nhưng khác ngành/loại hình → rủi ro trung bình (40-70)

ĐỊNH DẠNG TRẢ LỜI — BẮT BUỘC theo JSON:
\`\`\`json
{
  "score": <number 0-100>,
  "reasoning": "<giải thích ngắn gọn bằng tiếng Việt>",
  "candidates": [
    {
      "id": "<id ứng viên>",
      "name": "<tên ứng viên>",
      "similarity": <number 0-100>,
      "reason": "<lý do tương đồng>"
    }
  ]
}
\`\`\`

CHỈ TRẢ VỀ JSON, KHÔNG thêm text ngoài.`;

// ═══════════════════════════════════════
// CORE: AI ANALYSIS
// ═══════════════════════════════════════

/**
 * Analyze company name duplication using AI.
 * Takes a target name and candidate matches from DB.
 */
export async function analyzeDuplicationWithAI(
  targetName: string,
  candidates: DuplicateCandidate[]
): Promise<AIDuplicationResult> {
  if (!candidates || candidates.length === 0) {
    return {
      score: 0,
      reasoning: 'Không tìm thấy ứng viên trùng lặp trong cơ sở dữ liệu.',
      isHighRisk: false,
      candidates: [],
    };
  }

  // Build the user prompt with target and candidates
  const candidateList = candidates.map((c, i) =>
    `${i + 1}. ID: ${c.id} | Tên: "${c.name}" | Tên ngắn: "${c.short_name || 'N/A'}" | MST: "${c.tax_code || 'N/A'}" | Loại: ${c.type || 'N/A'} | Lý do match: ${c.match_reason || 'name'}`
  ).join('\n');

  const userPrompt = `TÊN CÔNG TY MỚI CẦN KIỂM TRA: "${targetName}"

DANH SÁCH ỨNG VIÊN TRÙNG LẶP TỪ DATABASE:
${candidateList}

Hãy phân tích mức độ trùng lặp và trả về JSON theo định dạng đã chỉ định.`;

  try {
    const response = await chat({
      messages: [{ role: 'user', content: userPrompt }],
      model: AI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.1,
      maxTokens: 1500,
      meta: { source: 'api' },
    });

    return parseAIResponse(response, candidates);
  } catch (error) {
    console.error('[AI Duplication] AI call failed, falling back to heuristic:', error);
    return buildHeuristicResult(targetName, candidates);
  }
}

// ═══════════════════════════════════════
// HELPER: Parse AI Response
// ═══════════════════════════════════════

function parseAIResponse(
  rawResponse: string,
  originalCandidates: DuplicateCandidate[]
): AIDuplicationResult {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      rawResponse.match(/(\{[\s\S]*\})/);

    if (!jsonMatch?.[1]) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[1].trim());

    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const reasoning = String(parsed.reasoning || 'Không có giải thích từ AI.');
    const candidateResults: DuplicateCandidateResult[] = (parsed.candidates || []).map((c: any) => ({
      id: String(c.id || ''),
      name: String(c.name || ''),
      similarity: Math.max(0, Math.min(100, Number(c.similarity) || 0)),
      reason: String(c.reason || ''),
    }));

    return {
      score,
      reasoning,
      isHighRisk: score > HIGH_RISK_THRESHOLD,
      candidates: candidateResults,
    };
  } catch (parseError) {
    console.warn('[AI Duplication] Failed to parse AI response, using heuristic:', parseError);
    return buildHeuristicResult('', originalCandidates);
  }
}

// ═══════════════════════════════════════
// FALLBACK: Heuristic scoring (when AI is unavailable)
// ═══════════════════════════════════════

function buildHeuristicResult(
  targetName: string,
  candidates: DuplicateCandidate[]
): AIDuplicationResult {
  const candidateResults: DuplicateCandidateResult[] = candidates.map(c => {
    let similarity = 0;
    let reason = '';

    if (c.match_reason === 'tax_code') {
      similarity = 95;
      reason = 'Mã số thuế trùng khớp';
    } else if (c.match_reason === 'name') {
      similarity = 75;
      reason = 'Tên công ty tương tự';
    } else if (c.match_reason === 'short_name') {
      similarity = 60;
      reason = 'Tên viết tắt tương tự';
    } else {
      similarity = 50;
      reason = 'Có yếu tố trùng lặp';
    }

    return {
      id: c.id,
      name: c.name,
      similarity,
      reason,
    };
  });

  const maxScore = candidateResults.reduce((max, c) => Math.max(max, c.similarity), 0);

  return {
    score: maxScore,
    reasoning: `Tìm thấy ${candidates.length} đối tác có dấu hiệu trùng lặp (phân tích heuristic do AI không khả dụng).`,
    isHighRisk: maxScore > HIGH_RISK_THRESHOLD,
    candidates: candidateResults,
  };
}

// ═══════════════════════════════════════
// PUBLIC API: Full duplication check (DB + AI)
// ═══════════════════════════════════════

/**
 * Full duplication check: query DB for matches, then analyze with AI.
 * This is the main entry point for components.
 */
export async function checkDuplicateWithAI(
  companyName: string
): Promise<AIDuplicationResult> {
  if (!companyName || companyName.trim().length < 2) {
    return {
      score: 0,
      reasoning: 'Tên công ty quá ngắn để kiểm tra.',
      isHighRisk: false,
      candidates: [],
    };
  }

  // Step 1: Query DB for potential matches
  const dbMatches: DuplicateMatch[] = await CustomerService.checkDuplicate({
    name: companyName.trim(),
  });

  // Step 2: No DB matches → definitely no duplicates
  if (!dbMatches || dbMatches.length === 0) {
    return {
      score: 0,
      reasoning: 'Không tìm thấy trùng lặp trong cơ sở dữ liệu.',
      isHighRisk: false,
      candidates: [],
    };
  }

  // Step 3: Convert DB matches to AI candidate format
  const aiCandidates: DuplicateCandidate[] = dbMatches.map(m => ({
    id: m.id,
    name: m.name,
    short_name: m.shortName,
    tax_code: m.taxCode,
    type: m.type,
    match_reason: m.matchReason,
  }));

  // Step 4: Analyze with AI
  return analyzeDuplicationWithAI(companyName.trim(), aiCandidates);
}
