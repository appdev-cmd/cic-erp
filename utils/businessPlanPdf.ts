/**
 * Business Plan PDF Generator — "Bảng phương án kinh doanh"
 * 
 * Generates a landscape A4 PDF matching the PAKD layout with:
 * - Header: contract code + customer name
 * - Product table with input/output pricing
 * - Financial summary & payment schedules
 * - Signature section
 *
 * Uses jspdf + jspdf-autotable with Vietnamese font support.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Contract, LineItem, ExecutionCostItem, PaymentPhase } from '../types';
import { savePdf } from './savePdf';

// ── Vietnamese font (Roboto TTF) ───────────────────────────
// jsPDF requires a classic (non-variable) TTF for proper Unicode support.
// Font file: public/fonts/Roboto-Regular.ttf (served by Vite at /fonts/...)
let _fontCache: string | null = null;

async function loadVietnameseFont(): Promise<string> {
  if (_fontCache) return _fontCache;

  // Load from local public folder (fast, no CDN dependency)
  const url = '/fonts/Roboto-Regular.ttf';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font download failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  // Convert ArrayBuffer to base64 string
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  _fontCache = btoa(binary);
  return _fontCache;
}

function setupFont(doc: jsPDF, fontBase64: string) {
  doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');
}

// ── Number formatting ──────────────────────────────────────
function fmtNum(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function fmtPercent(value: number): string {
  return value.toFixed(2) + '%';
}

// ── Financial calculations (same as useFinancialCalculations) ──
function computeFinancials(lineItems: LineItem[], executionCosts: ExecutionCostItem[]) {
  let signingValue = 0;
  let totalInput = 0;
  let totalDirectCosts = 0;
  let estimatedRevenue = 0;

  lineItems.forEach(item => {
    const outputTotal = item.quantity * item.outputPrice;
    const inputTotal = item.quantity * item.inputPrice;
    const vatRate = item.vatRate ?? 0;
    signingValue += outputTotal * (1 + vatRate / 100);
    totalInput += inputTotal;
    totalDirectCosts += item.directCosts || 0;
    estimatedRevenue += outputTotal;
  });

  const executionCostsSum = executionCosts.reduce((acc, c) => acc + (c.amount || 0), 0);
  const totalCosts = totalInput + totalDirectCosts + executionCostsSum;
  const grossProfit = estimatedRevenue - totalCosts;
  const profitMargin = estimatedRevenue > 0 ? (grossProfit / estimatedRevenue) * 100 : 0;

  return {
    signingValue, estimatedRevenue, totalCosts, grossProfit, profitMargin,
    totalInput, totalDirectCosts, executionCostsSum,
  };
}

// ── Main export function ───────────────────────────────────
export async function generateBusinessPlanPdf(
  contract: Contract,
  customerName: string,
  salesName: string,
  _unitName: string, // reserved for future use
) {
  const lineItems = contract.lineItems || [];
  const executionCosts = contract.executionCosts || [];
  const paymentPhases = contract.paymentPhases || [];
  const revenuePhases = paymentPhases.filter(p => !p.type || p.type === 'Revenue');
  const expensePhases = paymentPhases.filter(p => p.type === 'Expense');

  const fin = computeFinancials(lineItems, executionCosts);

  // Load font
  const fontBase64 = await loadVietnameseFont();

  // Create landscape A4 PDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  setupFont(doc, fontBase64);

  const pageW = doc.internal.pageSize.getWidth(); // ~297mm
  const pageH = doc.internal.pageSize.getHeight(); // ~210mm
  const marginL = 10;
  const marginR = 10;
  const contentW = pageW - marginL - marginR;

  let y = 12;

  // ═══════════════════════════════════════════════════════════
  // 1. HEADER
  // ═══════════════════════════════════════════════════════════
  doc.setFontSize(13);
  doc.setFont('Roboto', 'normal');
  const title1 = `Bảng phương án kinh doanh cho hợp đồng ${contract.contractCode} với`;
  doc.text(title1, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(12);
  const title2 = customerName.toUpperCase();
  doc.text(title2, pageW / 2, y, { align: 'center' });
  y += 8;

  // Sales info
  doc.setFontSize(9);
  doc.text(`Sales phụ trách: ${salesName}`, marginL, y);
  y += 6;

  // ═══════════════════════════════════════════════════════════
  // 2. MAIN PRODUCT TABLE
  // ═══════════════════════════════════════════════════════════
  const directCostBreakdown = (item: LineItem) => {
    const details = item.directCostDetails || [];
    // Group costs into: Nhập khẩu, Thuê nhà thầu, Chuyển tiền, Other
    let importFee = 0, contractorFee = 0, transferFee = 0;
    details.forEach(d => {
      const name = d.name.toLowerCase();
      if (name.includes('nhập khẩu') || name.includes('import')) importFee += d.amount;
      else if (name.includes('thuê') || name.includes('nhà thầu') || name.includes('contractor')) contractorFee += d.amount;
      else if (name.includes('chuyển') || name.includes('transfer')) transferFee += d.amount;
      else {
        // Distribute to whatever fits or add to contractor
        contractorFee += d.amount;
      }
    });
    // If no detail breakdown, put total into contractorFee
    if (details.length === 0 && (item.directCosts || 0) > 0) {
      contractorFee = item.directCosts || 0;
    }
    return { importFee, contractorFee, transferFee };
  };

  // Table columns matching the reference image
  // STT | Tên phần mềm | NCC | SL | ĐVT | ĐG Vào | TT Vào | ĐG Ra | TT Ra | NK | Thuê NT | Chuyển tiền | Chênh lệch
  const tableHead = [
    [
      { content: 'STT', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Tên phần mềm', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Nhà cung cấp', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Số lượng', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'ĐVT', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Đầu vào', colSpan: 2, styles: { halign: 'center' as const } },
      { content: 'Đầu ra', colSpan: 2, styles: { halign: 'center' as const } },
      { content: 'Chi phí khác', colSpan: 3, styles: { halign: 'center' as const } },
      { content: 'Chênh lệch', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
    ],
    [
      { content: 'Đơn giá', styles: { halign: 'center' as const } },
      { content: 'Thành tiền', styles: { halign: 'center' as const } },
      { content: 'Đơn giá', styles: { halign: 'center' as const } },
      { content: 'Thành tiền', styles: { halign: 'center' as const } },
      { content: 'Nhập khẩu', styles: { halign: 'center' as const } },
      { content: 'Thuê nhà thầu', styles: { halign: 'center' as const } },
      { content: 'Chuyển tiền', styles: { halign: 'center' as const } },
    ],
  ];

  const tableBody = lineItems.map((item, idx) => {
    const inputTotal = item.quantity * item.inputPrice;
    const outputTotal = item.quantity * item.outputPrice;
    const costs = directCostBreakdown(item);
    const margin = outputTotal - inputTotal - (item.directCosts || 0);
    return [
      (idx + 1).toString(),
      item.name,
      item.supplier || '',
      item.quantity.toString(),
      'VNĐ',
      fmtNum(item.inputPrice),
      fmtNum(inputTotal),
      fmtNum(item.outputPrice),
      fmtNum(outputTotal),
      costs.importFee ? fmtNum(costs.importFee) : '',
      costs.contractorFee ? fmtNum(costs.contractorFee) : '',
      costs.transferFee ? fmtNum(costs.transferFee) : '',
      fmtNum(margin),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'Roboto',
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'normal',
      fontSize: 7.5,
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },    // STT
      1: { cellWidth: 55 },                       // Tên SP
      2: { cellWidth: 22 },                       // NCC
      3: { cellWidth: 12, halign: 'center' },     // SL
      4: { cellWidth: 12, halign: 'center' },     // ĐVT
      5: { cellWidth: 22, halign: 'right' },      // ĐG Vào
      6: { cellWidth: 25, halign: 'right' },      // TT Vào
      7: { cellWidth: 22, halign: 'right' },      // ĐG Ra
      8: { cellWidth: 25, halign: 'right' },      // TT Ra
      9: { cellWidth: 18, halign: 'right' },      // Nhập khẩu
      10: { cellWidth: 20, halign: 'right' },     // Thuê NT
      11: { cellWidth: 18, halign: 'right' },     // Chuyển tiền
      12: { cellWidth: 22, halign: 'right' },     // Chênh lệch
    },
    margin: { left: marginL, right: marginR },
  });

  // Get Y after table
  y = (doc as any).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════════════
  // 3. FINANCIAL SUMMARY + PAYMENT INFO (side by side)
  // ═══════════════════════════════════════════════════════════
  const leftX = marginL;
  const midX = marginL + contentW * 0.33;
  const rightX = marginL + contentW * 0.65;

  // Check if we need a new page
  if (y + 60 > pageH - 20) {
    doc.addPage();
    y = 15;
  }

  doc.setFontSize(8.5);
  const lineH = 5;

  // ── LEFT: Tổng hợp tài chính ──
  const drawLabelValue = (label: string, value: string, x: number, yPos: number, bold = false) => {
    doc.setFont('Roboto', 'normal');
    doc.text(label, x, yPos);
    doc.text(value, x + 55, yPos, { align: 'right' });
    return yPos + lineH;
  };

  let yLeft = y;
  doc.setFontSize(9);
  doc.text('Tổng hợp tài chính:', leftX, yLeft);
  yLeft += lineH + 1;
  doc.setFontSize(8);

  yLeft = drawLabelValue('Đầu vào', fmtNum(fin.totalInput), leftX + 2, yLeft);
  yLeft = drawLabelValue('Sản lượng', fmtNum(fin.estimatedRevenue), leftX + 2, yLeft);
  yLeft = drawLabelValue('Chi phí khác', fmtNum(fin.totalDirectCosts), leftX + 2, yLeft);

  // Breakdown execution costs
  executionCosts.forEach(cost => {
    yLeft = drawLabelValue(cost.name, fmtNum(cost.amount || 0), leftX + 2, yLeft);
  });

  yLeft = drawLabelValue('Tổng chi phí', fmtNum(fin.totalCosts), leftX + 2, yLeft);
  yLeft = drawLabelValue('Lợi nhuận', fmtNum(fin.grossProfit), leftX + 2, yLeft);
  yLeft = drawLabelValue('Hệ số LN/ SL', fmtPercent(fin.profitMargin), leftX + 2, yLeft);

  // ── MIDDLE: Thanh toán hợp đồng & Tạm ứng ──
  let yMid = y;
  doc.setFontSize(9);
  doc.text('Thanh toán hợp đồng:', midX, yMid);
  yMid += lineH + 1;
  doc.setFontSize(8);

  // Tạm ứng section
  doc.text('Tạm ứng:', midX + 2, yMid);
  yMid += lineH;

  const advancePhases = revenuePhases.filter(p => p.status === 'Advance');
  if (advancePhases.length > 0) {
    advancePhases.forEach(p => {
      yMid = drawLabelValue(`- ${p.name}`, fmtNum(p.amount), midX + 4, yMid);
    });
  } else {
    yMid = drawLabelValue('- Tạm ứng của khách hàng', '0', midX + 4, yMid);
    yMid = drawLabelValue('- Tạm ứng cho nhà cung cấp', '0', midX + 4, yMid);
  }

  // Supplier payments
  if (expensePhases.length > 0) {
    expensePhases.forEach(p => {
      yMid = drawLabelValue(`→ ${p.name}`, fmtNum(p.amount), midX + 6, yMid);
    });
  }

  yMid += 2;
  doc.text('Thanh toán:', midX + 2, yMid);
  yMid += lineH;

  const totalRevenuePayments = revenuePhases.reduce((s, p) => s + p.amount, 0);
  yMid = drawLabelValue('- Thanh toán của khách hàng', fmtNum(totalRevenuePayments), midX + 4, yMid);

  const totalExpensePayments = expensePhases.reduce((s, p) => s + p.amount, 0);
  if (totalExpensePayments > 0) {
    yMid = drawLabelValue('- Thanh toán cho nhà cung cấp', fmtNum(totalExpensePayments), midX + 4, yMid);
    expensePhases.forEach(p => {
      yMid = drawLabelValue(`→ ${p.name}`, fmtNum(p.amount), midX + 6, yMid);
    });
  }

  // ── RIGHT: Dự kiến tiến độ thanh toán ──
  let yRight = y;
  doc.setFontSize(8);

  if (revenuePhases.length > 0) {
    // Payment schedule table
    const scheduleHead = [['', 'Giá trị', 'Dự kiến tiến độ thanh toán']];
    const scheduleBody = revenuePhases.map(p => [
      p.name,
      fmtNum(p.amount),
      p.dueDate ? formatDateForPdf(p.dueDate) : '',
    ]);

    autoTable(doc, {
      startY: yRight,
      head: scheduleHead,
      body: scheduleBody,
      theme: 'grid',
      styles: {
        font: 'Roboto',
        fontSize: 7.5,
        cellPadding: 1.2,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'normal',
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 35, halign: 'center' },
      },
      margin: { left: rightX },
      tableWidth: 90,
    });

    yRight = (doc as any).lastAutoTable.finalY;
  }

  // ═══════════════════════════════════════════════════════════
  // 4. SIGNATURE SECTION
  // ═══════════════════════════════════════════════════════════
  const maxY = Math.max(yLeft, yMid, yRight) + 15;
  const sigY = maxY > pageH - 30 ? (doc.addPage(), 30) : maxY;

  doc.setFontSize(9);

  // Left: Tổng giám đốc
  const sigLeftX = marginL + contentW * 0.22;
  doc.text('Tổng giám đốc', sigLeftX, sigY, { align: 'center' });
  // Placeholder for signature
  doc.setFontSize(8);
  doc.text('Nguyễn Hoàng Hà', sigLeftX, sigY + 25, { align: 'center' });

  // Right: Phụ trách trung tâm
  const sigRightX = marginL + contentW * 0.72;
  doc.setFontSize(9);
  doc.text('Phụ trách trung tâm', sigRightX, sigY, { align: 'center' });

  // ═══════════════════════════════════════════════════════════
  // 5. DOWNLOAD — dùng helper chung, đảm bảo đúng tên file .pdf
  // ═══════════════════════════════════════════════════════════
  const filename = `PAKD_${contract.contractCode.replace(/\//g, '_')}.pdf`;
  await savePdf(doc, filename);
}

// Helper: format date for PDF display (dd/mm/yyyy)
function formatDateForPdf(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}
