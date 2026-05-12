import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { UnitService, ContractService } from '../services';
import { KPIPlan } from '../types';

export const exportDashboardReport = async (
  activeMetric: keyof KPIPlan,
  yearFilter: string
) => {
  try {
    // 1. Lấy dữ liệu các Trung tâm, Chi nhánh
    const allUnits = await UnitService.getActive();
    const businessUnits = allUnits.filter(u => u.type === 'Center' || u.type === 'Branch');

    let metricLabel = 'SẢN LƯỢNG KÝ KẾT';
    if (activeMetric === 'revenue') metricLabel = 'DOANH THU';
    else if (activeMetric === 'adminProfit') metricLabel = 'LỢI NHUẬN QUẢN TRỊ';
    else if (activeMetric === 'revProfit') metricLabel = 'LỢI NHUẬN THEO DOANH THU';
    else if (activeMetric === 'cash') metricLabel = 'DÒNG TIỀN (TIỀN VỀ)';

    const safeYear = yearFilter === 'All' ? new Date().getFullYear().toString() : yearFilter;
    const reportTitle = `BẢNG TỔNG HỢP ${metricLabel} NĂM ${safeYear}`;

    // 2. Khởi tạo Workbook bằng ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo');

    // -- ROW 1, 2: TITLE --
    worksheet.mergeCells('A1:Q1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = reportTitle;
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // -- ROW 3: HEADERS --
    const headers = [
      'STT',
      'Nội dung',
      'Tháng 1',
      'Tháng 2',
      'Tháng 3',
      'Tháng 4',
      'Tháng 5',
      'Tháng 6',
      'Tháng 7',
      'Tháng 8',
      'Tháng 9',
      'Tháng 10',
      'Tháng 11',
      'Tháng 12',
      'Tổng tháng',
      'Kế hoạch năm',
      'Tỷ lệ % hoàn thành KH'
    ];
    const headerRow = worksheet.getRow(3);
    headerRow.values = headers;
    headerRow.height = 25;
    
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, name: 'Arial', size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    // Cấu hình kích thước cột
    worksheet.getColumn(1).width = 5;  // STT
    worksheet.getColumn(2).width = 30; // Nội dung
    for (let i = 3; i <= 14; i++) {
      worksheet.getColumn(i).width = 15; // Tháng 1-12
    }
    worksheet.getColumn(15).width = 18; // Tổng
    worksheet.getColumn(16).width = 18; // Kế hoạch
    worksheet.getColumn(17).width = 12; // % Hoàn thành

    let stt = 1;
    let currentRow = 4;

    // 3. Fetch monthly data for each unit
    for (const unit of businessUnits) {
      const yearParam = yearFilter === 'All' ? new Date().getFullYear().toString() : yearFilter;
      const chartData = await ContractService.getChartDataRPC(unit.id, yearParam);

      const monthlyValues = Array(12).fill(0);
      chartData.forEach((monthData: any) => {
        if (monthData.month >= 1 && monthData.month <= 12) {
          let val = 0;
          if (activeMetric === 'signing') val = monthData.signing || 0;
          else if (activeMetric === 'revenue') val = monthData.revenue || 0;
          else if (activeMetric === 'revProfit') val = monthData.revProfit || 0;
          else if (activeMetric === 'adminProfit') val = monthData.profit || monthData.adminProfit || 0;
          else if (activeMetric === 'cash') val = monthData.cash || 0;
          
          monthlyValues[monthData.month - 1] = val;
        }
      });

      let target = 0;
      if (unit.target) {
        if (activeMetric === 'signing') target = unit.target.signing || 0;
        else if (activeMetric === 'revenue') target = unit.target.revenue || 0;
        else if (activeMetric === 'adminProfit') target = unit.target.adminProfit || 0;
        else if (activeMetric === 'revProfit') target = unit.target.revProfit || unit.target.adminProfit || 0;
        else if (activeMetric === 'cash') target = unit.target.cash || 0;
      }

      const row = worksheet.getRow(currentRow);
      row.values = [
        stt++,
        unit.name,
        ...monthlyValues,
        0, // Placeholder cho Tổng tháng (sẽ điền công thức Excel)
        target,
        0  // Placeholder cho % KH (sẽ điền công thức Excel)
      ];

      // Gắn công thức
      row.getCell(15).value = { formula: `SUM(C${currentRow}:N${currentRow})` };
      // Nếu kế hoạch = 0 thì không thể chia, dùng hàm IFERROR
      row.getCell(17).value = { formula: `IFERROR(O${currentRow}/P${currentRow}, 0)` };

      // Định dạng borders và alignment
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.font = { name: 'Arial', size: 11 };
        
        if (colNumber === 1 || colNumber === 17) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber >= 3 && colNumber <= 16) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          // Định dạng số (Hàng triệu, nghìn...)
          cell.numFmt = '#,##0.00';
        }
      });
      // Cột phần trăm
      row.getCell(17).numFmt = '0.00%';

      currentRow++;
    }

    // 4. Add Summary Row (Tổng cộng)
    const summaryRow = worksheet.getRow(currentRow);
    // Điền STT trống, nội dung là "TỔNG CỘNG"
    summaryRow.getCell(2).value = 'TỔNG CỘNG';
    
    // Gắn công thức SUM cho các cột từ Tháng 1 tới Kế hoạch
    for (let c = 3; c <= 16; c++) {
      const colLetter = String.fromCharCode(64 + c); // 3=C, 4=D...
      summaryRow.getCell(c).value = { formula: `SUM(${colLetter}4:${colLetter}${currentRow - 1})` };
    }
    // Gắn công thức tính tỷ lệ cho hàng tổng (Tổng O / Tổng P)
    summaryRow.getCell(17).value = { formula: `IFERROR(O${currentRow}/P${currentRow}, 0)` };

    summaryRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 11, bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF2CC' } // Màu vàng nhạt cho hàng tổng
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      if (colNumber === 17) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '0.00%';
      } else if (colNumber >= 3 && colNumber <= 16) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      }
    });

    // 5. Download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Bao_cao_${activeMetric}_${safeYear}.xlsx`;
    saveAs(blob, fileName);

    return true;
  } catch (error) {
    console.error('Export Excel Error:', error);
    throw error;
  }
};
