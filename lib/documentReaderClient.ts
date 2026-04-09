import * as mammoth from 'mammoth';

export async function parseDocumentClientSide(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value || '';
    } else if (['txt', 'csv', 'md', 'json'].includes(ext || '')) {
      return new TextDecoder('utf-8').decode(arrayBuffer);
    } else if (ext === 'pdf') {
      // Vì pdfjs-dist khá nặng và khó config trong Vite không có Web Worker
      // Phiên bản hiện tại sẽ cảnh báo user. (Về sau có thể dựng API riêng hoặc dùng pdfjs local)
      throw new Error('Tính năng đọc trực tiếp PDF trên trình duyệt đang phát triển. Tạm thời vui lòng dùng DOCX/TXT/CSV.');
    } else {
      throw new Error("Định dạng ." + ext + " chưa được hỗ trợ (chỉ hỗ trợ docx, txt, csv, md)");
    }
  } catch (err: unknown) {
    throw new Error("Lỗi giải mã file: " + (err instanceof Error ? err.message : String(err)));
  }
}
