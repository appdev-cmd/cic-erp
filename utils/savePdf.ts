/**
 * Lưu file PDF từ jsPDF — đảm bảo đúng tên file .pdf trên mọi trình duyệt.
 * Ưu tiên File System Access API (hộp thoại lưu gốc), fallback về thẻ <a> + data URI.
 */
import type jsPDF from 'jspdf';

export async function savePdf(doc: jsPDF, filename: string): Promise<void> {
  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

  // Ưu tiên File System Access API (hiện hộp thoại lưu với đúng tên file)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'PDF Document',
          accept: { 'application/pdf': ['.pdf'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      return;
    } catch (err: any) {
      // User bấm huỷ hộp thoại → dừng, không fallback
      if (err?.name === 'AbortError') return;
      // API lỗi → rơi xuống fallback
    }
  }

  // Fallback: thẻ <a> với data URI (tránh lỗi tên file UUID của blob URL)
  await new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const link = document.createElement('a');
      link.href = reader.result as string;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); resolve(); }, 100);
    };
    reader.readAsDataURL(pdfBlob);
  });
}
