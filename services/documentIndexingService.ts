/**
 * Document Indexing Service — CIC ERP
 * 
 * Pipeline: File → Text Extraction → Chunking → Embedding → document_chunks
 * 
 * Hỗ trợ:
 * - PDF (via pdfjs-dist)
 * - DOCX (via mammoth)
 * - XLSX/CSV (via xlsx)
 * - Plain text
 */

import { dataClient as supabase } from '../lib/dataClient';
import { DocumentRegistryService, type DocumentRegistryItem } from './documentRegistryService';
import { generateEmbedding } from './ragService';
import { extractTextFromImageAsOCR, suggestTagsForContent } from './aiProcessingService';

// ============================================
// Types
// ============================================

export type IndexingStatus = 'idle' | 'extracting' | 'chunking' | 'embedding' | 'saving' | 'done' | 'error';

export interface IndexingProgress {
  status: IndexingStatus;
  documentId: string;
  progress: number; // 0-100
  message: string;
  error?: string;
  totalChunks?: number;
  processedChunks?: number;
}

type ProgressCallback = (progress: IndexingProgress) => void;

// ============================================
// Text Extraction
// ============================================

/**
 * Trích xuất text từ PDF bằng pdfjs-dist
 */
async function extractTextFromPDF(fileOrUrl: File | string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configure worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  let pdf;
  if (typeof fileOrUrl === 'string') {
    // URL or path
    pdf = await pdfjsLib.getDocument(fileOrUrl).promise;
  } else {
    // File object
    const buffer = await fileOrUrl.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  }

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

/**
 * Trích xuất text từ DOCX bằng mammoth
 */
async function extractTextFromDOCX(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

/**
 * Trích xuất text từ XLSX/CSV bằng xlsx
 */
async function extractTextFromXLSX(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  const sheets: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
  }

  return sheets.join('\n\n');
}

/**
 * Trích xuất text từ file dựa trên mime type
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  // PDF
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return extractTextFromPDF(file);
  }

  // DOCX
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
    return extractTextFromDOCX(file);
  }

  // DOC (old format) — mammoth hỗ trợ hạn chế
  if (mime === 'application/msword' || name.endsWith('.doc')) {
    try {
      return await extractTextFromDOCX(file);
    } catch {
      throw new Error('Định dạng .doc cũ không được hỗ trợ. Vui lòng chuyển sang .docx');
    }
  }

  // XLSX
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      mime === 'application/vnd.ms-excel' ||
      name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return extractTextFromXLSX(file);
  }

  // Plain text / Markdown
  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json')) {
    return await file.text();
  }

  // Image (OCR via Gemini Vision)
  if (mime.startsWith('image/')) {
    try {
      return await extractTextFromImageAsOCR(file);
    } catch (e: any) {
      throw new Error(`Lỗi OCR ảnh: ${e.message}`);
    }
  }

  throw new Error(`Không hỗ trợ trích xuất text từ loại file: ${mime || name}`);
}

/**
 * Trích xuất text từ URL (Google Drive hoặc web) qua fetch
 */
export async function extractTextFromUrl(url: string): Promise<string> {
  // Nếu là Google Drive file, cần xử lý đặc biệt
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    // Thử export dạng text qua Google Drive export
    const fileId = driveMatch[1];
    const exportUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    try {
      const res = await fetch(exportUrl);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text') || contentType.includes('json')) {
          return await res.text();
        }
        // Nếu là file binary (PDF etc.), cần download và parse
        const blob = await res.blob();
        const file = new File([blob], 'download', { type: contentType });
        return extractTextFromFile(file);
      }
    } catch {
      // Fall through
    }
  }

  // Thử fetch trực tiếp
  try {
    const res = await fetch(url);
    if (res.ok) {
      return await res.text();
    }
  } catch {
    // Ignore
  }

  throw new Error('Không thể trích xuất nội dung từ URL này.');
}

// ============================================
// Text Chunking
// ============================================

interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

/**
 * Chia text thành các chunk ~500 tokens (ước lượng ~4 chars/token)
 * Overlap 100 tokens để giữ ngữ cảnh
 */
export function chunkText(text: string, maxTokens = 500, overlapTokens = 100): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const charsPerToken = 4;
  const maxChars = maxTokens * charsPerToken;
  const overlapChars = overlapTokens * charsPerToken;

  // Clean text
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleanText.length <= maxChars) {
    return [{
      index: 0,
      content: cleanText,
      tokenCount: Math.ceil(cleanText.length / charsPerToken),
    }];
  }

  const chunks: TextChunk[] = [];
  let startPos = 0;
  let index = 0;

  while (startPos < cleanText.length) {
    let endPos = Math.min(startPos + maxChars, cleanText.length);

    // Cố gắng cắt tại boundary tự nhiên (paragraph hoặc câu)
    if (endPos < cleanText.length) {
      // Tìm paragraph break gần nhất
      const paragraphBreak = cleanText.lastIndexOf('\n\n', endPos);
      if (paragraphBreak > startPos + maxChars * 0.5) {
        endPos = paragraphBreak;
      } else {
        // Tìm sentence break
        const sentenceBreak = cleanText.lastIndexOf('. ', endPos);
        if (sentenceBreak > startPos + maxChars * 0.3) {
          endPos = sentenceBreak + 1;
        }
      }
    }

    const chunkContent = cleanText.slice(startPos, endPos).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        index,
        content: chunkContent,
        tokenCount: Math.ceil(chunkContent.length / charsPerToken),
      });
      index++;
    }

    // Move start with overlap
    startPos = endPos - overlapChars;
    if (startPos >= cleanText.length) break;
    // Tránh loop vô hạn
    if (startPos <= (chunks.length > 0 ? endPos - maxChars : 0)) {
      startPos = endPos;
    }
  }

  return chunks;
}

// ============================================
// Indexing Pipeline
// ============================================

/**
 * Index 1 tài liệu: Extract → Chunk → Embed → Save
 */
export async function indexDocument(
  document: DocumentRegistryItem,
  file?: File,
  onProgress?: ProgressCallback,
): Promise<{ success: boolean; chunks: number; error?: string }> {
  const docId = document.id;
  const progress = (status: IndexingStatus, pct: number, msg: string) => {
    onProgress?.({ status, documentId: docId, progress: pct, message: msg });
  };

  try {
    // Step 1: Extract text
    progress('extracting', 10, 'Đang trích xuất nội dung...');
    let fullText = '';

    if (document.fullTextContent) {
      // Đã có text sẵn (pasted_text)
      fullText = document.fullTextContent;
    } else if (file) {
      fullText = await extractTextFromFile(file);
    } else if (document.sourceUrl) {
      try {
        fullText = await extractTextFromUrl(document.sourceUrl);
      } catch {
        return { success: false, chunks: 0, error: 'Không thể tải file từ URL để trích xuất' };
      }
    } else {
      return { success: false, chunks: 0, error: 'Không có nguồn dữ liệu để trích xuất' };
    }

    if (!fullText || fullText.trim().length < 10) {
      return { success: false, chunks: 0, error: 'Nội dung file quá ngắn hoặc rỗng' };
    }

    // Auto-Tagging: Sinh mảng thẻ nếu tài liệu chưa có tags
    let newTags = document.tags || [];
    if (!newTags || newTags.length === 0) {
      progress('extracting', 20, 'Đang phân tích thông minh...');
      const generatedTags = await suggestTagsForContent(fullText);
      if (generatedTags.length > 0) {
        newTags = generatedTags;
      }
    }

    // Update content_preview + full_text_content + tags in registry
    const preview = fullText.slice(0, 500);
    await DocumentRegistryService.update(docId, {
      contentPreview: preview,
      fullTextContent: fullText,
      tags: newTags,
    });

    // Step 2: Chunk text
    progress('chunking', 25, 'Đang chia nhỏ văn bản...');
    const chunks = chunkText(fullText, 500, 100);

    if (chunks.length === 0) {
      return { success: false, chunks: 0, error: 'Không tạo được chunk từ nội dung' };
    }

    progress('chunking', 30, `Đã chia thành ${chunks.length} đoạn`);

    // Step 3: Delete old chunks (if re-indexing)
    await supabase.from('document_chunks').delete().eq('document_id', docId);

    // Step 4: Generate embeddings + save chunks
    progress('embedding', 35, 'Đang tạo vector embedding...');

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const pct = 35 + Math.round((i / chunks.length) * 55); // 35% -> 90%
      
      progress('embedding', pct, `Embedding ${i + 1}/${chunks.length}...`);

      try {
        const embedding = await generateEmbedding(chunk.content);

        await supabase.from('document_chunks').insert({
          document_id: docId,
          chunk_index: chunk.index,
          content: chunk.content,
          token_count: chunk.tokenCount,
          embedding,
          metadata: {
            doc_title: document.title,
            doc_category: document.docCategory,
          },
        });
      } catch (embErr) {
        console.warn(`[Indexing] Chunk ${i} embedding failed:`, embErr);
        // Lưu chunk không có embedding (vẫn searchable bằng text)
        await supabase.from('document_chunks').insert({
          document_id: docId,
          chunk_index: chunk.index,
          content: chunk.content,
          token_count: chunk.tokenCount,
          metadata: {
            doc_title: document.title,
            doc_category: document.docCategory,
            embedding_error: String(embErr),
          },
        });
      }
    }

    // Step 5: Mark as indexed
    progress('saving', 95, 'Đang hoàn tất...');
    await DocumentRegistryService.markAsIndexed(docId);

    progress('done', 100, `Hoàn tất! ${chunks.length} đoạn đã được AI đọc`);
    return { success: true, chunks: chunks.length };

  } catch (err: any) {
    const errorMsg = err.message || 'Lỗi không xác định';
    progress('error', 0, errorMsg);
    return { success: false, chunks: 0, error: errorMsg };
  }
}

/**
 * Batch index nhiều tài liệu
 */
export async function indexDocuments(
  documents: DocumentRegistryItem[],
  onProgress?: (docIndex: number, total: number, docProgress: IndexingProgress) => void,
): Promise<{ total: number; success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const result = await indexDocument(doc, undefined, (p) => {
      onProgress?.(i, documents.length, p);
    });

    if (result.success) success++;
    else failed++;
  }

  return { total: documents.length, success, failed };
}

/**
 * Kiểm tra xem provider embedding có sẵn sàng không
 */
export async function testEmbeddingProvider(): Promise<{ ok: boolean; provider: string; error?: string }> {
  const provider = typeof window !== 'undefined'
    ? localStorage.getItem('cic-embedding-provider') || 'local'
    : 'local';

  try {
    const embedding = await generateEmbedding('test connection');
    if (embedding && embedding.length === 768) {
      return { ok: true, provider };
    }
    return { ok: false, provider, error: 'Vector size không phải 768 dimensions' };
  } catch (err: any) {
    return { ok: false, provider, error: err.message };
  }
}
