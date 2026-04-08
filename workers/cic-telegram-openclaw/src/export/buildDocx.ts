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

export interface LeaveRequestOptions {
  fullName: string;
  department?: string;
  fromDate?: string;
  toDate?: string;
  days?: string;
  reason?: string;
}

/** Đơn xin nghỉ phép dạng văn bản (không phải báo cáo hợp đồng) */
export async function leaveRequestToDocxBuffer(opts: LeaveRequestOptions): Promise<Buffer> {
  const today = new Date().toLocaleDateString('vi-VN');
  const from = opts.fromDate?.trim() || '…..';
  const to = opts.toDate?.trim() || '…..';
  const days = opts.days?.trim() || '…..';
  const reason = opts.reason?.trim() || '…..';
  const dept = opts.department?.trim();

  const blocks: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', size: 22 })],
      alignment: 'center',
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Độc lập – Tự do – Hạnh phúc', size: 22 })],
      alignment: 'center',
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [new TextRun({ text: 'ĐƠN XIN NGHỈ PHÉP', bold: true, size: 28 })],
      alignment: 'center',
    }),
    new Paragraph({ text: '' }),
    pText('Kính gửi: Ban Giám đốc / Trưởng bộ phận'),
    new Paragraph({ text: '' }),
    pText(`Tôi tên là: ${opts.fullName}`),
    ...(dept ? [pText(`Đơn vị công tác: ${dept}`)] : []),
    new Paragraph({ text: '' }),
    pText(
      `Đề nghị được nghỉ phép từ ngày ${from} đến hết ngày ${to} (${days} ngày làm việc).`
    ),
    new Paragraph({ text: '' }),
    pText(`Lý do: ${reason}`),
    new Paragraph({ text: '' }),
    pText(
      'Trong thời gian vắng mặt, tôi sẽ bàn giao công việc theo quy định của công ty.'
    ),
    new Paragraph({ text: '' }),
    pText(`….., ngày ${today}`),
    new Paragraph({ text: '' }),
    pText('Người làm đơn'),
    pText('(Ký và ghi rõ họ tên)'),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [new TextRun({ text: opts.fullName, italics: true })],
    }),
  ];

  const doc = new Document({
    sections: [{ children: blocks }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
