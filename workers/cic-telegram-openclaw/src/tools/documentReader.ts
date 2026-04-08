import { tgGetFileUrl } from '../telegramApi.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Tùy chọn load dynamic imports cho pdf-parse & mammoth
// để không crash webworker/edge nếu thư viện chưa sẵn sàng
let pdfParse: any = null;
let mammoth: any = null;

async function loadDependencies() {
  if (!pdfParse) {
    try {
      pdfParse = (await import('pdf-parse')).default;
    } catch {
      // fallback if pdf-parse is not installed
    }
  }
  if (!mammoth) {
    try {
      mammoth = await import('mammoth');
    } catch {
      // fallback
    }
  }
}

export async function parseDocumentFromTelegram(fileId: string, fileName: string): Promise<string> {
  await loadDependencies();
  const fileUrl = await tgGetFileUrl(fileId);
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Tải file thất bại: HTTP ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  try {
    if (ext === 'pdf') {
      if (!pdfParse) throw new Error('Thư viện pdf-parse chưa được cài đặt. Chạy: npm i pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    } else if (ext === 'docx') {
      if (!mammoth) throw new Error('Thư viện mammoth chưa được cài đặt. Chạy: npm i mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (ext === 'txt' || ext === 'csv' || ext === 'md' || ext === 'json') {
      return buffer.toString('utf-8');
    } else {
      throw new Error(`Định dạng .${ext} chưa được hỗ trợ trích xuất text (chỉ hỗ trợ pdf, docx, txt)`);
    }
  } catch (err: unknown) {
    throw new Error(`Lỗi giải mã nội dung: ${err instanceof Error ? err.message : String(err)}`);
  }
}
