import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, ImageRun } from 'docx';
import { marked } from 'marked';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';

/**
 * Sinh tên file nhanh dựa trên ngữ cảnh (không dùng AI để tránh độ trễ)
 */
export async function generateSmartFileName(question: string, answer: string, currentModel: string = 'qwen2.5-7b'): Promise<string> {
  // Trích xuất 6 từ đầu tiên của câu hỏi làm tên file
  const words = question.trim().split(/\s+/).slice(0, 6).join('-');
  
  // Loại bỏ các ký tự đặc biệt, dấu tiếng Việt (nếu cần), chỉ giữ lại alphanumeric và dấu gạch ngang
  let safeName = words
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Xóa dấu tiếng Việt
    .replace(/[^a-zA-Z0-9-]/g, '-')                   // Thay ký tự đặc biệt bằng gạch ngang
    .replace(/-+/g, '-')                              // Xóa gạch ngang liên tiếp
    .toLowerCase();

  // Xóa gạch ngang ở đầu/cuối nếu có
  if (safeName.startsWith('-')) safeName = safeName.substring(1);
  if (safeName.endsWith('-')) safeName = safeName.substring(0, safeName.length - 1);

  // Fallback nếu không có câu hỏi hợp lệ
  if (!safeName) {
    safeName = `ai-report`;
  }

  // Thêm ngày tháng ngắn gọn để không trùng lặp
  const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '');
  
  return `${safeName}-${dateStr}`;
}

/**
 * XUẤT HTML (Trực tiếp từ DOM để giữ biểu đồ Recharts)
 */
export function exportToHTML(targetElementId: string, fileName: string) {
  const container = document.getElementById(targetElementId);
  if (!container) return;

  // Tạo một bản sao để xóa các nút ẩn (Copy, Download...)
  const clone = container.cloneNode(true) as HTMLElement;
  const ignoreElements = clone.querySelectorAll('[data-html2canvas-ignore="true"]');
  ignoreElements.forEach(el => el.remove());

  const htmlContent = clone.innerHTML;

  const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
    }
  </script>
  <style>
    body { font-family: 'Inter', 'Roboto', sans-serif; background-color: #f8fafc; color: #1e293b; padding: 2rem; }
    .chat-container { max-width: 1000px; margin: 0 auto; background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    /* Fix for Recharts SVG which might rely on container size */
    .recharts-wrapper { max-width: 100%; }
    .recharts-surface { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="chat-container">
    <div style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0;">
      <h2 style="font-size: 1.5rem; font-weight: bold; color: #4f46e5; margin: 0;">${fileName}</h2>
      <p style="font-size: 0.875rem; color: #64748b; margin-top: 0.25rem;">Báo cáo xuất bởi CIC ERP AI Agent</p>
    </div>
    
    <!-- Rendered Content (Preserving Tailwind Classes & SVGs) -->
    <div class="prose prose-sm max-w-none">
      ${htmlContent}
    </div>
    
    <div style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; text-align: center;">
      © 2026 CIC ERP System
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  saveAs(blob, `${fileName}.html`);
}

/**
 * XUẤT DOCX
 */
export async function exportToDOCX(markdownContent: string, fileName: string, targetElementId?: string) {
  const chartImageBlobs: Uint8Array[] = [];
  
  // Chụp ảnh các biểu đồ trước
  if (targetElementId) {
    const container = document.getElementById(targetElementId);
    if (container) {
      const charts = container.querySelectorAll('.recharts-wrapper');
      for (let i = 0; i < charts.length; i++) {
        try {
          const canvas = await html2canvas(charts[i] as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
          const base64 = canvas.toDataURL('image/png');
          const binaryString = atob(base64.split(',')[1]);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          chartImageBlobs.push(bytes);
        } catch (e) {
          console.error("Lỗi chụp biểu đồ cho Word:", e);
        }
      }
    }
  }

  // Simple heuristic parser
  const lines = markdownContent.split('\n');
  const docChildren: any[] = [];
  
  let inTable = false;
  let tableRows: any[] = [];
  let inJsonBlock = false;
  let chartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bỏ qua block JSON và chèn ảnh biểu đồ thay thế
    if (line.trim().startsWith('\`\`\`json')) {
      inJsonBlock = true;
      continue;
    }
    if (inJsonBlock && line.trim() === '\`\`\`') {
      inJsonBlock = false;
      if (chartImageBlobs[chartIndex]) {
        docChildren.push(new Paragraph({
          children: [
            new ImageRun({
              data: chartImageBlobs[chartIndex],
              transformation: { width: 500, height: 300 }
            })
          ]
        }));
        chartIndex++;
      }
      continue;
    }
    if (inJsonBlock) continue;

    // Bỏ qua block code thông thường khác
    if (line.trim().startsWith('\`\`\`')) {
      continue;
    }

    // Bảng
    if (line.trim().startsWith('|')) {
      inTable = true;
      if (line.includes('---')) continue; // Bỏ qua dòng separator
      
      const cells = line.split('|').filter((c, idx, arr) => !(idx === 0 && c.trim() === '') && !(idx === arr.length - 1 && c.trim() === '')).map(c => c.trim());
      
      tableRows.push(
        new TableRow({
          children: cells.map(text => 
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text })] })],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
              }
            })
          )
        })
      );
      continue;
    } else if (inTable) {
      // Kết thúc bảng
      inTable = false;
      if (tableRows.length > 0) {
        docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
        tableRows = [];
      }
    }

    // Heading
    if (line.startsWith('# ')) {
      docChildren.push(new Paragraph({ text: line.substring(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('## ')) {
      docChildren.push(new Paragraph({ text: line.substring(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('### ')) {
      docChildren.push(new Paragraph({ text: line.substring(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Bullet list
      docChildren.push(new Paragraph({ text: line.substring(2), bullet: { level: 0 } }));
    } else if (line.match(/^[0-9]+\. /)) {
      // Numbered list
      const content = line.replace(/^[0-9]+\. /, '');
      docChildren.push(new Paragraph({ text: content, numbering: { reference: "my-numbering", level: 0 } }));
    } else if (line.trim() === '') {
      // Dòng trống
      docChildren.push(new Paragraph({ text: '' }));
    } else {
      // Plain text (có thể chứa bold/italic, tạm thời coi như text thường)
      docChildren.push(new Paragraph({ text: line }));
    }
  }

  if (tableRows.length > 0) {
    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
  }

  const doc = new Document({
    sections: [{ children: docChildren }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName}.docx`);
}

/**
 * HELPERS: Render nội dung HTML để chụp ảnh
 */
function createOffscreenContainer(markdownContent: string, fileName: string): HTMLElement {
  const container = document.createElement('div');
  container.style.padding = '30px';
  container.style.width = '800px';
  container.style.fontFamily = 'Inter, Roboto, sans-serif';
  container.style.backgroundColor = '#ffffff'; // Quan trọng để nền không bị trong suốt
  container.style.color = '#1e293b';
  container.style.lineHeight = '1.6';
  
  const htmlContent = marked.parse(markdownContent) as string;
  container.innerHTML = `
    <div style="margin-bottom: 20px; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
      <h2 style="color: #4f46e5; margin: 0;">${fileName}</h2>
      <p style="font-size: 12px; color: #64748b; margin: 5px 0 0 0;">Báo cáo xuất bởi CIC ERP AI Agent</p>
    </div>
    <div style="font-size: 14px;">
      ${htmlContent}
    </div>
  `;

  const styles = document.createElement('style');
  styles.innerHTML = `
    table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background-color: #f8fafc; }
    code { background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; color: #e11d48; }
    pre { background-color: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; }
  `;
  container.appendChild(styles);
  
  // Phải gắn vào body mới chụp được, nhưng đưa ra ngoài viewport
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  document.body.appendChild(container);
  
  return container;
}

/**
 * XUẤT ẢNH (PNG)
 */
export async function exportToImage(targetElementId: string, fileName: string) {
  const container = document.getElementById(targetElementId);
  if (!container) return;

  try {
    // Ẩn các nút thao tác trước khi chụp
    const ignoreElements = container.querySelectorAll('[data-html2canvas-ignore="true"]');
    ignoreElements.forEach(el => (el as HTMLElement).style.display = 'none');

    await new Promise(resolve => setTimeout(resolve, 200));
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: null, // Giữ màu nền thực tế của phần tử (Dark/Light mode)
      logging: false
    });
    
    // Hiện lại các nút
    ignoreElements.forEach(el => (el as HTMLElement).style.display = '');

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      saveAs(blob, `${fileName}.png`);
    }
  } catch (error) {
    console.error('Lỗi khi xuất ảnh:', error);
  }
}

/**
 * COPY ẢNH VÀO CLIPBOARD (Để dán Zalo, Telegram)
 */
export async function copyImageToClipboard(targetElementId: string, fileName: string) {
  const container = document.getElementById(targetElementId);
  if (!container) return;

  try {
    const ignoreElements = container.querySelectorAll('[data-html2canvas-ignore="true"]');
    ignoreElements.forEach(el => (el as HTMLElement).style.display = 'none');

    await new Promise(resolve => setTimeout(resolve, 200));
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });
    
    ignoreElements.forEach(el => (el as HTMLElement).style.display = '');

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
    }
  } catch (error) {
    console.error('Lỗi khi copy ảnh:', error);
  }
}

/**
 * XUẤT PDF
 */
export async function exportToPDF(targetElementId: string, fileName: string) {
  const container = document.getElementById(targetElementId);
  if (!container) return;

  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `${fileName}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: null },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    const ignoreElements = container.querySelectorAll('[data-html2canvas-ignore="true"]');
    ignoreElements.forEach(el => (el as HTMLElement).style.display = 'none');

    await html2pdf().set(opt).from(container).save();

    ignoreElements.forEach(el => (el as HTMLElement).style.display = '');
  } catch (error) {
    console.error('Lỗi khi xuất PDF:', error);
  }
}
