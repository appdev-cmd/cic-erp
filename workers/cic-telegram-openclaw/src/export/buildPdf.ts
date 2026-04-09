import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontPath = path.resolve(__dirname, '../../fonts/Roboto-Regular.ttf');

export async function contractsToPdfBuffer(rows: any[], title: string = 'BÁO CÁO HỢP ĐỒNG'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      doc.font(fontPath);

      // Header
      doc.fontSize(18).text(title, { align: 'center' });
      doc.moveDown(1.5);

      // Body
      rows.forEach((row, index) => {
        const text = `${index + 1}. [${row.contract_code}] ${row.title || 'Không có tiêu đề'}\n`
                   + `   Khách hàng: ${row.customer_name || 'N/A'}\n`
                   + `   Giá trị: ${Number(row.value_numeric || row.value || 0).toLocaleString('vi-VN')} VNĐ\n`
                   + `   Trạng thái: ${row.status || 'N/A'}\n`
                   + `   Ký ngày: ${row.signed_date || 'N/A'}`;
        doc.fontSize(12).text(text);
        doc.moveDown(0.5);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
