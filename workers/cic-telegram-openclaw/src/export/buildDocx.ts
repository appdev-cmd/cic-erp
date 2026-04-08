import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ContractReportRow } from '../supabaseClient.js';

function pText(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text })] });
}

export async function contractsToDocxBuffer(
  rows: ContractReportRow[],
  title: string
): Promise<Buffer> {
  const header = new TableRow({
    children: ['Mã HĐ', 'Tiêu đề', 'Đơn vị', 'Trạng thái', 'Ngày ký', 'Giá trị'].map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        })
    ),
  });

  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({ children: [pText(r.contract_code)] }),
          new TableCell({ children: [pText((r.title ?? '').slice(0, 200))] }),
          new TableCell({ children: [pText(r.unit_id)] }),
          new TableCell({ children: [pText(r.status)] }),
          new TableCell({ children: [pText(r.signed_date ?? '')] }),
          new TableCell({
            children: [pText(r.value_numeric != null ? String(r.value_numeric) : '')],
          }),
        ],
      })
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...dataRows],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 28 })],
          }),
          pText(`Số bản ghi: ${rows.length}`),
          new Paragraph({ text: '' }),
          table,
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
