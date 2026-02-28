/**
 * PAKD Excel Parser Service
 * Parse and generate Excel files for PAKD (Phương án Kinh doanh)
 * 
 * Supports 2 template formats:
 * - Format 1 (HD123): STT, Tên SP, SL, Nhập từ, Giá vào, TT vào, Giá ra, TT ra, Chênh lệch, %LN
 * - Format 2 (185/PPXD): STT, Tên SP, NCC, SL, DVT, Giá vào, TT vào, Giá ra, TT ra, Nhập, Thuế, Chuyển, CL
 * - Unified Format: 14 columns combining both
 */
import * as XLSX from 'xlsx';

export interface PAKDForeignCurrency {
    amount: number;   // Đơn giá ngoại tệ (VD: 3136.5)
    rate: number;     // Tỷ giá (VD: 26500)
    currency: string; // "USD" | "EUR"
}

export interface PAKDLineItem {
    id: string;
    stt: number;
    name: string;
    supplier: string;
    quantity: number;
    unit: string;
    unitCost: number;      // Đơn giá đầu vào
    totalCost: number;     // Thành tiền đầu vào
    unitPrice: number;     // Đơn giá đầu ra
    totalPrice: number;    // Thành tiền đầu ra
    importFee: number;     // Chi phí nhập khẩu
    contractorTax: number; // Thuế nhà thầu
    transferFee: number;   // Phí chuyển tiền
    margin: number;        // Chênh lệch
    marginPercent?: number; // % Lợi nhuận
    vatRate?: number;      // Thuế VAT áp dụng cho sản phẩm này
    foreignCurrency?: PAKDForeignCurrency; // Thông tin ngoại tệ (nếu có)
}

export interface PAKDAdminCosts {
    bankFee: number;       // Phí chuyển tiền/ngân hàng
    subcontractorFee: number; // Thuê nhà thầu
    importLogistics: number;  // Phí nhập khẩu/logistics
    expertFee: number;     // Phí thuê chuyên gia
    documentFee: number;   // Phí xử lý chứng từ
    supplierDiscount: number; // Chiết khấu thêm từ NCC (Bentley, etc)
}

// Dynamic execution cost item parsed from summary section
export interface PAKDExecutionCost {
    id: string;
    name: string;
    amount: number;
}

export interface PAKDFinancials {
    revenue: number;       // Doanh thu (sản lượng)
    costs: number;         // Tổng chi phí
    profit: number;        // Lợi nhuận
    margin: number;        // Hệ số LN/SL (%)
    vatRate?: number;      // Thuế VAT (8 | 10) - auto-detected from Sản lượng / Doanh thu
    signingValue?: number; // Sản lượng (Giá trị ký kết = Đầu ra + VAT)
}

export interface PAKDHeader {
    contractNumber?: string;  // Số hợp đồng
    customerName?: string;    // Tên khách hàng
    salesPerson?: string;     // Nhân viên kinh doanh
    usdRate?: number;         // Tỷ giá USD
    eurRate?: number;         // Tỷ giá EUR
}

export interface ParsedPAKD {
    header: PAKDHeader;
    lineItems: PAKDLineItem[];
    adminCosts: PAKDAdminCosts;
    executionCosts: PAKDExecutionCost[];  // Dynamic execution costs (Chi phí khác, Phí chuyên gia, etc.)
    financials: PAKDFinancials;
}

// Template format detection
type TemplateFormat = 'FORMAT_1' | 'FORMAT_2' | 'UNIFIED';

/**
 * Detect template format based on header row structure
 */
function detectTemplateFormat(headerRow: any[]): TemplateFormat {
    if (!headerRow || headerRow.length < 5) return 'UNIFIED';

    const headerStr = headerRow.map(h => String(h || '').toLowerCase()).join('|');

    // Format 1: Has "Nhập từ" column and no separate "Nhà cung cấp"
    if (headerStr.includes('nhập từ') || headerStr.includes('nhap tu')) {
        return 'FORMAT_1';
    }

    // Format 2: Has "Nhà cung cấp" and "DVT" columns  
    if ((headerStr.includes('nhà cung cấp') || headerStr.includes('nha cung cap'))
        && (headerStr.includes('dvt') || headerStr.includes('đvt'))) {
        return 'FORMAT_2';
    }

    return 'UNIFIED';
}

/**
 * Get column mapping based on template format
 */
function getColumnMapping(format: TemplateFormat): Record<string, number> {
    switch (format) {
        case 'FORMAT_1':
            // Mẫu 1: HD123 - STT, Tên SP, SL, Nhập từ, Giá vào, TT vào, Giá ra, TT ra, CL, %LN
            return {
                STT: 0,           // A
                NAME: 1,          // B
                QUANTITY: 2,      // C
                SUPPLIER: 3,      // D (Nhập từ)
                UNIT_COST: 4,     // E (Giá nhập)
                TOTAL_COST: 5,    // F (Thành tiền đầu vào)
                UNIT_PRICE: 6,    // G (Đơn giá đầu ra)
                TOTAL_PRICE: 7,   // H (Thành tiền đầu ra)
                MARGIN: 8,        // I (Chênh lệch)
                MARGIN_PCT: 9,    // J (% LN)
                // No separate fee columns in Format 1
                IMPORT_FEE: -1,
                CONTRACTOR_TAX: -1,
                TRANSFER_FEE: -1,
                UNIT: -1,
            };
        case 'FORMAT_2':
            // Mẫu 2: 185/PPXD - STT, Tên, NCC, SL, DVT, Giá vào, TT vào, Giá ra, TT ra, Nhập, Thuế, Chuyển, CL
            return {
                STT: 0,           // A
                NAME: 1,          // B
                SUPPLIER: 2,      // C
                QUANTITY: 3,      // D
                UNIT: 4,          // E (DVT)
                UNIT_COST: 5,     // F
                TOTAL_COST: 6,    // G
                UNIT_PRICE: 7,    // H
                TOTAL_PRICE: 8,   // I
                IMPORT_FEE: 9,    // J
                CONTRACTOR_TAX: 10, // K
                TRANSFER_FEE: 11,   // L
                MARGIN: 12,       // M
                MARGIN_PCT: -1,   // Not in Format 2
            };
        case 'UNIFIED':
        default:
            // Unified format: 14 columns
            return {
                STT: 0,           // A
                NAME: 1,          // B
                SUPPLIER: 2,      // C
                QUANTITY: 3,      // D
                UNIT: 4,          // E
                UNIT_COST: 5,     // F
                TOTAL_COST: 6,    // G
                UNIT_PRICE: 7,    // H
                TOTAL_PRICE: 8,   // I
                IMPORT_FEE: 9,    // J
                CONTRACTOR_TAX: 10, // K
                TRANSFER_FEE: 11,   // L
                MARGIN: 12,       // M
                MARGIN_PCT: 13,   // N
            };
    }
}

/**
 * Find header row in the sheet
 */
function findHeaderRow(jsonData: any[][]): number {
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row) continue;

        const rowStr = row.map(c => String(c || '').toLowerCase()).join('|');

        // Look for common header keywords
        if (rowStr.includes('stt') &&
            (rowStr.includes('tên') || rowStr.includes('ten') ||
                rowStr.includes('sản phẩm') || rowStr.includes('phần mềm'))) {
            return i;
        }
    }
    return 3; // Default to row 4 (0-indexed = 3)
}

/**
 * Parse header information from sheet
 */
function parseHeader(jsonData: any[][]): PAKDHeader {
    const header: PAKDHeader = {};

    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row) continue;

        const rowText = row.map(c => String(c || '')).join(' ').toLowerCase();

        // Contract number
        if (rowText.includes('hợp đồng') || rowText.includes('po/hđ')) {
            const match = row.join(' ').match(/(?:HD|HĐ|PO|PPXD)\d+[A-Za-z]*/i);
            if (match) header.contractNumber = match[0];
        }

        // Customer name (often after "với" or "khách hàng")
        if (rowText.includes('với') || rowText.includes('khách hàng')) {
            for (const cell of row) {
                const cellStr = String(cell || '');
                if (cellStr.includes('CÔNG TY') || cellStr.includes('TỔNG CÔNG TY')) {
                    header.customerName = cellStr.trim();
                    break;
                }
            }
        }

        // Sales person
        if (rowText.includes('sales') || rowText.includes('phụ trách')) {
            const nextCell = row.find((c, idx) => idx > 0 && c && !String(c).toLowerCase().includes('sales'));
            if (nextCell) header.salesPerson = String(nextCell).replace(/^[^:]+:\s*/, '').trim();
        }

        // Exchange rates
        if (rowText.includes('usd')) {
            const match = row.join(' ').match(/usd[:\s]*([0-9.,]+)/i);
            if (match) header.usdRate = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
        }
        if (rowText.includes('eur')) {
            const match = row.join(' ').match(/eur[:\s]*([0-9.,]+)/i);
            if (match) header.eurRate = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
        }
    }

    return header;
}

/**
 * Parse Excel file to PAKD data
 * Supports merged cells for shared costs (e.g., transfer fee shared across multiple products)
 * Auto-detects template format (Format 1, Format 2, or Unified)
 */
export function parsePAKDExcel(file: File): Promise<ParsedPAKD> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellFormula: true });
                resolve(parsePAKDWorkbook(workbook));
            } catch (error) {
                console.error('[PAKD Parser] Error parsing Excel:', error);
                reject(new Error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Lỗi đọc file'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * Generate PAKD Excel template with unified format
 */
export function generatePAKDTemplate(): void {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Template data with unified format (14 columns)
    const templateData = [
        // Row 1: Title
        ['', 'BẢNG PHƯƠNG ÁN KINH DOANH (PAKD)'],
        // Row 2: Contract info
        ['', 'Hợp đồng số: [SỐ HỢP ĐỒNG] với [TÊN KHÁCH HÀNG]'],
        // Row 3: Sales + Exchange rates
        ['Sales Phụ trách:', '[TÊN NVKD]', '', '', '', 'Tỷ giá USD:', '', 'Tỷ giá EUR:', ''],
        // Row 4: Header (14 columns)
        [
            'STT',
            'Tên sản phẩm/Dịch vụ',
            'Nhà cung cấp',
            'Số lượng',
            'ĐVT',
            'Đơn giá (Đầu vào)',
            'Thành tiền (Đầu vào)',
            'Đơn giá (Đầu ra)',
            'Thành tiền (Đầu ra)',
            'Nhập khẩu',
            'Thuế nhà thầu',
            'Chuyển tiền',
            'Chênh lệch',
            '% LN'
        ],
        // Row 5: Sample data 1
        [1, 'Phần mềm Cubicost TAS Pro - 1 year', 'Glodon', 2, 'VNĐ', 34508390, 69016780, 37584000, 75168000, 0, 0, 0, 6151219, '8.19%'],
        // Row 6: Sample data 2
        [2, 'Phần mềm Microstation', 'Bentley', 6, 'VNĐ', 32176565, 193059390, 69415000, 416490000, 0, 1230297, 0, 222200313, '53.36%'],
        // Row 7: Sample data 3
        [3, 'Phần mềm SketchUp Pro', 'Trimble', 1, 'VNĐ', 9900000, 9900000, 11386000, 11386000, 0, 0, 0, 1486000, '13.05%'],
        // Row 8: Empty for more items
        [],
        // Row 9: Total row
        ['', 'TỔNG CỘNG', '', '', '', '', 271976170, '', 503044000, 0, 1230297, 0, 229837532, '45.69%'],
        // Row 10: Empty
        [],
        // Row 11: Summary section header
        ['', 'TỔNG HỢP TÀI CHÍNH:'],
        // Row 12-19: Summary items
        ['', 'Đầu vào', 271976170],
        ['', 'Sản lượng (Đầu ra)', 503044000],
        ['', 'Chi phí khác (thuê nhà thầu, logistics...)', 1230297],
        ['', 'Phí thuê chuyên gia (net)', 0],
        ['', 'Phí thanh toán chứng từ', 0],
        ['', 'Chiết khấu thêm NCC', 0],
        ['', 'Tổng chi phí', 273206467],
        ['', 'Lợi nhuận', 229837532],
        ['', 'Hệ số LN/ SL', '45.69%'],
        // Row 21: Empty
        [],
        // Row 22: Payment schedule header
        ['', 'THANH TOÁN HỢP ĐỒNG:'],
        ['', 'Tạm ứng:'],
        ['', '  - Tạm ứng của khách hàng', 0],
        ['', '  - Tạm ứng cho nhà cung cấp', 0],
        ['', 'Thanh toán:'],
        ['', '  - Thanh toán của khách hàng', 503044000, '', 'Dự kiến:', '15 ngày sau khi nhận hàng'],
        ['', '  - Thanh toán cho nhà cung cấp', 271976170, '', 'Dự kiến:', 'Khi có thanh toán của KH'],
    ];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths for 14 columns
    ws['!cols'] = [
        { wch: 5 },   // A: STT
        { wch: 40 },  // B: Tên sản phẩm
        { wch: 15 },  // C: NCC
        { wch: 8 },   // D: SL
        { wch: 8 },   // E: ĐVT
        { wch: 18 },  // F: Đơn giá vào
        { wch: 18 },  // G: Thành tiền vào
        { wch: 18 },  // H: Đơn giá ra
        { wch: 18 },  // I: Thành tiền ra
        { wch: 12 },  // J: Nhập khẩu
        { wch: 14 },  // K: Thuế nhà thầu
        { wch: 12 },  // L: Chuyển tiền
        { wch: 16 },  // M: Chênh lệch
        { wch: 10 },  // N: % LN
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'PAKD');

    // Generate and download file
    XLSX.writeFile(wb, 'PAKD_Template_Unified.xlsx');
}

/**
 * Fetch and parse PAKD from Google Sheets URL
 * Supports converting standard Google Sheets 'edit' URLs to export URLs
 */
export async function fetchPAKDFromGoogleSheets(url: string, accessToken?: string): Promise<ParsedPAKD> {
    try {
        // Extract sheet ID from URL
        const sheetIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!sheetIdMatch) {
            throw new Error('Định dạng link Google Sheets không đúng. Vui lòng kiểm tra lại.');
        }

        let buffer: ArrayBuffer;

        if (accessToken) {
            // Use Supabase Edge Function proxy (server-side fetch, no CORS issues)
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const proxyUrl = `${supabaseUrl}/functions/v1/google-sheets-proxy`;

            console.log(`[PAKD Parser] Fetching via Edge Function proxy (authenticated)`);

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({ url, accessToken }),
            });

            if (!response.ok) {
                let errorInfo = '';
                try {
                    const errorJson = await response.json();
                    errorInfo = errorJson.error || errorJson.details || '';
                    console.error(`[PAKD Parser] Proxy Error ${response.status}:`, errorJson);
                } catch (_) {
                    errorInfo = await response.text();
                    console.error(`[PAKD Parser] Proxy Error ${response.status}:`, errorInfo);
                }

                if (response.status === 403 || response.status === 401) {
                    throw new Error('Không có quyền truy cập file. Vui lòng đảm bảo tài khoản Google của bạn có quyền xem file này, hoặc thử đăng xuất rồi đăng nhập lại.');
                }
                if (response.status === 404) {
                    throw new Error('Không tìm thấy file. Vui lòng kiểm tra link Google Sheets.');
                }
                throw new Error(`Lỗi tải dữ liệu (${response.status}). ${errorInfo}`);
            }

            buffer = await response.arrayBuffer();
        } else {
            // Fallback: direct fetch for public sheets (no auth)
            const sheetId = sheetIdMatch[1];
            const gidMatch = url.match(/gid=(-?[0-9]+)/);
            const gid = gidMatch ? gidMatch[1] : '0';
            const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`;

            console.log(`[PAKD Parser] Fetching public (no token): ${exportUrl}`);

            const response = await fetch(exportUrl);
            if (!response.ok) {
                throw new Error(`Lỗi tải dữ liệu (${response.status}). Google Sheet cần được chia sẻ public hoặc bạn cần đăng nhập bằng Google.`);
            }
            buffer = await response.arrayBuffer();
        }

        console.log(`[PAKD Parser] Received ${buffer.byteLength} bytes, parsing...`);

        // Parse ArrayBuffer
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellFormula: true });
        return parsePAKDWorkbook(workbook);
    } catch (error: any) {
        console.error('[PAKD Parser] Google Sheets error:', error);
        throw error;
    }
}

/**
 * Shared logic to parse a workbook (from file or buffer)
 */
/**
 * Extract foreign currency info from a cell formula.
 * Formulas like: =-3136.5*26500, =3136.5*26500, -3136.5*26500
 * Returns { amount, rate } where rate is the larger number (tỷ giá VND)
 */
function extractForeignCurrencyFromFormula(
    worksheet: XLSX.WorkSheet,
    rowIndex: number,
    colIndex: number,
    header: PAKDHeader
): PAKDForeignCurrency | undefined {
    if (colIndex < 0) return undefined;

    const cellAddr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    const cell = worksheet[cellAddr];
    if (!cell || !cell.f) return undefined; // No formula

    const formula = cell.f;
    console.log(`[PAKD Parser] Cell ${cellAddr} formula: ${formula}`);

    // Match patterns: =-A*B, =A*B, -A*B (with optional negative signs)
    const match = formula.match(/=?\s*-?\s*([\d.,]+)\s*\*\s*-?\s*([\d.,]+)/);
    if (!match) return undefined;

    const num1 = parseFloat(match[1].replace(/,/g, '.'));
    const num2 = parseFloat(match[2].replace(/,/g, '.'));
    if (isNaN(num1) || isNaN(num2) || num1 === 0 || num2 === 0) return undefined;

    // Tỷ giá VND thường lớn hơn nhiều so với đơn giá ngoại tệ
    // VD: 3136.5 * 26500 → amount=3136.5, rate=26500
    let amount: number, rate: number;
    if (num2 > num1) {
        amount = num1;
        rate = num2;
    } else {
        amount = num2;
        rate = num1;
    }

    // Nhận dạng loại tiền dựa vào tỷ giá trong header
    let currency = 'USD'; // Mặc định
    if (header.usdRate && Math.abs(rate - header.usdRate) < 1000) {
        currency = 'USD';
    } else if (header.eurRate && Math.abs(rate - header.eurRate) < 1000) {
        currency = 'EUR';
    } else if (rate > 20000 && rate < 30000) {
        currency = 'USD';
    } else if (rate > 25000 && rate < 35000) {
        currency = 'EUR';
    }

    return { amount, rate, currency };
}

export function parsePAKDWorkbook(workbook: XLSX.WorkBook): ParsedPAKD {
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get merged cells info
    const merges = worksheet['!merges'] || [];

    // Convert to JSON array
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    // Parse header info
    const header = parseHeader(jsonData);

    // Find header row and detect format
    const headerRowIdx = findHeaderRow(jsonData);
    const headerRow = jsonData[headerRowIdx] || [];
    const format = detectTemplateFormat(headerRow);
    const COL = getColumnMapping(format);

    const DATA_START_ROW = headerRowIdx + 1;

    // Build a map of merged cell ranges for fee columns
    const mergedFees: Map<string, { startRow: number; endRow: number; col: number; value: number }> = new Map();

    for (const merge of merges) {
        const col = merge.s.c;
        if ((col === COL.IMPORT_FEE || col === COL.CONTRACTOR_TAX || col === COL.TRANSFER_FEE)
            && col >= 0 && merge.s.r !== merge.e.r) {
            const cellAddr = XLSX.utils.encode_cell({ r: merge.s.r, c: col });
            const cell = worksheet[cellAddr];
            const value = cell ? Number(cell.v) || 0 : 0;

            if (value > 0) {
                const key = `${merge.s.r}-${merge.e.r}-${col}`;
                mergedFees.set(key, {
                    startRow: merge.s.r,
                    endRow: merge.e.r,
                    col,
                    value
                });
            }
        }
    }

    // Parse line items
    const lineItems: PAKDLineItem[] = [];
    let totalCostSum = 0;
    let totalPriceSum = 0;

    const lineItemRows: { rowIndex: number; row: any[] }[] = [];
    for (let i = DATA_START_ROW; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[COL.STT] || typeof row[COL.STT] !== 'number') {
            const cellText = String(row?.[COL.NAME] || row?.[0] || '').toLowerCase();
            if (cellText.includes('tổng') || cellText.includes('tong')) break;
            continue;
        }
        lineItemRows.push({ rowIndex: i, row });
    }

    const getFeeValue = (rowIndex: number, col: number, defaultValue: number): { value: number; isShared: boolean; sharedCount: number } => {
        if (col < 0) return { value: 0, isShared: false, sharedCount: 1 };

        let result = { value: defaultValue, isShared: false, sharedCount: 1 };
        mergedFees.forEach((mergeInfo) => {
            if (mergeInfo.col === col && rowIndex >= mergeInfo.startRow && rowIndex <= mergeInfo.endRow) {
                const rowsInMerge = mergeInfo.endRow - mergeInfo.startRow + 1;
                result = {
                    value: Math.round(mergeInfo.value / rowsInMerge),
                    isShared: true,
                    sharedCount: rowsInMerge
                };
            }
        });
        return result;
    };

    const getCellValue = (row: any[], colIdx: number, defaultValue: any = ''): any => {
        if (colIdx < 0 || colIdx >= row.length) return defaultValue;
        return row[colIdx] ?? defaultValue;
    };

    for (const { rowIndex, row } of lineItemRows) {
        const importFeeInfo = getFeeValue(rowIndex, COL.IMPORT_FEE, Number(getCellValue(row, COL.IMPORT_FEE, 0)) || 0);
        const contractorTaxInfo = getFeeValue(rowIndex, COL.CONTRACTOR_TAX, Number(getCellValue(row, COL.CONTRACTOR_TAX, 0)) || 0);
        const transferFeeInfo = getFeeValue(rowIndex, COL.TRANSFER_FEE, Number(getCellValue(row, COL.TRANSFER_FEE, 0)) || 0);

        const totalCost = Number(getCellValue(row, COL.TOTAL_COST, 0)) || 0;
        const totalPrice = Number(getCellValue(row, COL.TOTAL_PRICE, 0)) || 0;
        const margin = Number(getCellValue(row, COL.MARGIN, 0)) || (totalPrice - totalCost);

        let marginPercent = 0;
        if (COL.MARGIN_PCT >= 0) {
            const pctValue = getCellValue(row, COL.MARGIN_PCT, 0);
            marginPercent = typeof pctValue === 'string'
                ? parseFloat(pctValue.replace('%', '').replace(',', '.'))
                : Number(pctValue) || 0;
        } else if (totalPrice > 0) {
            marginPercent = Math.round((margin / totalPrice) * 100 * 100) / 100;
        }

        // Trích xuất thông tin ngoại tệ từ công thức đơn giá
        const foreignCurrency = extractForeignCurrencyFromFormula(worksheet, rowIndex, COL.UNIT_COST, header);

        const item: PAKDLineItem = {
            id: `item-${Date.now()}-${rowIndex}`,
            stt: Number(getCellValue(row, COL.STT, lineItems.length + 1)) || lineItems.length + 1,
            name: String(getCellValue(row, COL.NAME, '')),
            supplier: String(getCellValue(row, COL.SUPPLIER, '')),
            quantity: Number(getCellValue(row, COL.QUANTITY, 0)) || 0,
            unit: String(getCellValue(row, COL.UNIT, 'VNĐ')),
            unitCost: Number(getCellValue(row, COL.UNIT_COST, 0)) || 0,
            totalCost,
            unitPrice: Number(getCellValue(row, COL.UNIT_PRICE, 0)) || 0,
            totalPrice,
            importFee: importFeeInfo.value,
            contractorTax: contractorTaxInfo.value,
            transferFee: transferFeeInfo.value,
            margin,
            marginPercent,
            vatRate: 10, // Default VAT rate for line item
            foreignCurrency,
        };

        lineItems.push(item);
        totalCostSum += item.totalCost;
        totalPriceSum += item.totalPrice;
    }

    const adminCosts: PAKDAdminCosts = {
        bankFee: lineItems.reduce((sum, item) => sum + item.transferFee, 0),
        subcontractorFee: lineItems.reduce((sum, item) => sum + item.contractorTax, 0),
        importLogistics: lineItems.reduce((sum, item) => sum + item.importFee, 0),
        expertFee: 0,
        documentFee: 0,
        supplierDiscount: 0,
    };

    const executionCosts: PAKDExecutionCost[] = [];
    const extractNum = (cell: any): number => {
        if (cell === null || cell === undefined) return 0;
        if (typeof cell === 'number') return cell;
        const str = String(cell).replace(/\./g, '').replace(',', '.');
        return Number(str) || 0;
    };

    const findNumericInRow = (row: any[]): number => {
        // Scan from left to right, skip the first few columns if they are likely labels
        for (let i = 1; i < row.length; i++) {
            const val = extractNum(row[i]);
            if (val > 0) return val;
        }
        return 0;
    };

    // --- Known summary row labels to SKIP (not execution costs) ---
    const SKIP_LABELS = [
        'đầu vào', 'dau vao',
        'tổng chi phí', 'tong chi phi',
        'lợi nhuận', 'loi nhuan',
        'hệ số', 'he so',
        'tổng hợp', 'tong hop',
        'tổng cộng', 'tong cong',
        'chi phí khác', 'chi phi khac',
        'thanh toán hợp đồng', 'thanh toan hop dong',
        'tạm ứng', 'tam ung',
        'thanh toán của', 'thanh toan cua',
        'thanh toán cho', 'thanh toan cho',
        'dự kiến', 'du kien',
    ];

    let inSummarySection = false;
    let parsedSanLuong = 0;  // Sản lượng (= Đầu ra + VAT = Giá trị ký kết)
    let parsedDoanhThu = 0;  // Doanh thu (= Đầu ra trước VAT)

    for (let i = DATA_START_ROW; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        // Collect text from the first few columns to identify the row label
        const labelText = row.slice(0, 5).map(c => String(c || '').trim()).join(' ').toLowerCase();
        if (!labelText) continue;

        // Detect when we enter summary section (after "Tổng hợp tài chính" or "Tổng cộng")
        if (labelText.includes('tổng hợp') || labelText.includes('tổng cộng') || labelText.includes('tong hop') || labelText.includes('tong cong')) {
            inSummarySection = true;
            continue;
        }

        // Stop if we hit payment schedule section
        if (labelText.includes('thanh toán hợp đồng') || labelText.includes('thanh toan hop dong')) {
            break;
        }

        // Only parse execution costs from summary section
        if (!inSummarySection) continue;

        const value = findNumericInRow(row);

        // Capture Sản lượng and Doanh thu for VAT detection (even if value is 0 or skipped)
        if (labelText.includes('sản lượng') || labelText.includes('san luong')) {
            parsedSanLuong = value;
            continue;
        }
        if (labelText.includes('doanh thu')) {
            parsedDoanhThu = value;
            continue;
        }

        if (value <= 0) continue;

        // Skip known summary rows (total costs, profit, margin ratios)
        const isSkipRow = SKIP_LABELS.some(skip => labelText.includes(skip));
        if (isSkipRow) continue;

        // --- Categorize the cost ---
        // 1. Expert Fees (including support/hỗ trợ)
        if (labelText.includes('chuyên gia')) {
            const name = labelText.includes('hỗ trợ') ? 'Phí hỗ trợ chuyên gia' : 'Phí thuê chuyên gia (net)';
            executionCosts.push({
                id: `pakd-expert-${Date.now()}-${i}`,
                name,
                amount: value
            });
            adminCosts.expertFee += value;
        }
        // 2. Document Fees
        else if (labelText.includes('phí thanh toán') || labelText.includes('chứng từ') || labelText.includes('biên bản')) {
            executionCosts.push({
                id: `pakd-document-${Date.now()}-${i}`,
                name: 'Phí thanh toán chứng từ',
                amount: value
            });
            adminCosts.documentFee += value;
        }
        // 3. Supplier Discount
        else if (labelText.includes('chiết khấu') || labelText.includes('chiet khau')) {
            adminCosts.supplierDiscount = value;
        }
        // 4. Generic execution cost — capture ALL other cost items dynamically
        //    (e.g., Thưởng hoàn thành dự án, Xúc tiến hợp đồng, Ban lãnh đạo hỗ trợ, logistics, etc.)
        else {
            // Find the best label from the row cells
            const costName = String(row[1] || row[0] || 'Chi phí thực hiện').trim();
            executionCosts.push({
                id: `pakd-exec-${Date.now()}-${i}`,
                name: costName,
                amount: value
            });
        }
    }

    const totalAdminCosts = adminCosts.bankFee + adminCosts.subcontractorFee + adminCosts.importLogistics + adminCosts.expertFee + adminCosts.documentFee;
    const otherExecutionCosts = executionCosts.filter(c => !c.name.includes('chuyên gia') && !c.name.includes('chứng từ')).reduce((sum, c) => sum + c.amount, 0);

    const computedCosts = totalCostSum + totalAdminCosts + otherExecutionCosts - adminCosts.supplierDiscount;
    const computedProfit = totalPriceSum - computedCosts;
    const computedMargin = totalPriceSum > 0 ? Math.round((computedProfit / totalPriceSum) * 100 * 100) / 100 : 0;

    // Detect VAT rate from Sản lượng / Doanh thu ratio
    // Sản lượng = Doanh thu × (1 + VAT) → VAT = (Sản lượng / Doanh thu) - 1
    let detectedVatRate: number | undefined;
    const signingValue = parsedSanLuong || totalPriceSum;
    if (parsedSanLuong > 0 && parsedDoanhThu > 0) {
        const ratio = parsedSanLuong / parsedDoanhThu;
        // ratio ≈ 1.08 → 8%, ratio ≈ 1.10 → 10%, ratio ≈ 1.0 → 0%
        if (Math.abs(ratio - 1.08) < 0.005) detectedVatRate = 8;
        else if (Math.abs(ratio - 1.10) < 0.005) detectedVatRate = 10;
        else if (Math.abs(ratio - 1.0) < 0.005) detectedVatRate = 0;
        else detectedVatRate = Math.round((ratio - 1) * 100); // fallback
        console.log(`[PAKD Parser] VAT detected: ${detectedVatRate}% (SL=${parsedSanLuong}, DT=${parsedDoanhThu}, ratio=${ratio.toFixed(4)})`);
    }

    const financials: PAKDFinancials = {
        revenue: totalPriceSum,
        costs: totalCostSum + totalAdminCosts + otherExecutionCosts,
        profit: totalPriceSum - totalCostSum - totalAdminCosts - otherExecutionCosts,
        margin: totalPriceSum > 0 ? Math.round(((totalPriceSum - totalCostSum - totalAdminCosts - otherExecutionCosts) / totalPriceSum) * 100 * 100) / 100 : 0,
        vatRate: detectedVatRate,
        signingValue,
    };

    return { header, lineItems, adminCosts, executionCosts, financials };
}

/**
 * Convert parsed PAKD to form-compatible format
 */
export function convertToFormData(parsed: ParsedPAKD) {
    return {
        header: parsed.header,
        lineItems: parsed.lineItems.map(item => ({
            id: item.id,
            name: item.name,
            supplierId: '', // Will need to match with existing suppliers
            supplierName: item.supplier,
            quantity: item.quantity,
            unit: item.unit,
            inputPrice: item.unitCost,
            outputPrice: item.unitPrice,
            directCosts: {
                importFee: item.importFee,
                contractorTax: item.contractorTax,
                transferFee: item.transferFee,
            },
            marginPercent: item.marginPercent,
            vatRate: item.vatRate,
            foreignCurrency: item.foreignCurrency ? {
                amount: item.foreignCurrency.amount,
                rate: item.foreignCurrency.rate,
                currency: item.foreignCurrency.currency,
            } : undefined,
        })),
        adminCosts: {
            bankFee: parsed.adminCosts.bankFee,
            bankFeePercent: 0,
            subcontractorFee: parsed.adminCosts.subcontractorFee,
            subcontractorPercent: 0,
            importLogistics: parsed.adminCosts.importLogistics,
            importLogisticsPercent: 0,
            expertFee: parsed.adminCosts.expertFee,
            expertFeePercent: 0,
            documentFee: parsed.adminCosts.documentFee,
            documentFeePercent: 0,
            supplierDiscount: parsed.adminCosts.supplierDiscount,
        },
        executionCosts: parsed.executionCosts,
        financials: parsed.financials,
    };
}

/**
 * Parse PAKD data from clipboard text (tab-separated, copied from Excel)
 *
 * Converts the pasted text into an in-memory XLSX workbook and then
 * delegates to parsePAKDWorkbook() — reusing ALL existing logic for
 * header detection, template format detection, column mapping, summary
 * section parsing, etc.
 *
 * Users can paste the ENTIRE sheet (including title, header, data, totals,
 * summary) — the parser handles it automatically.
 */
export function parsePAKDFromClipboard(text: string): ParsedPAKD {
    if (!text || !text.trim()) {
        throw new Error('Không có dữ liệu. Vui lòng copy từ Excel rồi paste vào đây.');
    }

    // Normalize line endings
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    if (lines.length === 0) {
        throw new Error('Không có dữ liệu hợp lệ.');
    }

    // Convert tab-separated text → 2D array
    const aoa: any[][] = lines.map(line => {
        return line.split('\t').map(cell => {
            const trimmed = cell.trim();
            if (trimmed === '') return '';

            // Remove surrounding quotes from Excel
            const unquoted = trimmed.replace(/^"(.*)"$/, '$1');

            // Try to parse as number (Vietnamese formatting: dots as thousands)
            // Only parse as number if it looks like a pure numeric value
            const cleanNum = unquoted
                .replace(/\s/g, '')
                .replace(/₫|đ/gi, '')
                .replace(/%$/, '');

            // Check if it's a formatted Vietnamese number like "6.068.500" or "130.680.000"
            if (/^-?\d{1,3}(\.\d{3})+$/.test(cleanNum)) {
                return Number(cleanNum.replace(/\./g, ''));
            }
            // Check if it's a number with comma decimal: "37,60%"
            if (/^-?\d+,\d+%?$/.test(cleanNum)) {
                return parseFloat(cleanNum.replace(',', '.'));
            }
            // Plain integer or float
            if (/^-?\d+(\.\d+)?$/.test(cleanNum)) {
                return Number(cleanNum);
            }

            return unquoted;
        });
    });

    // Build an XLSX workbook from the 2D array
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clipboard');

    // Delegate to the existing workbook parser
    return parsePAKDWorkbook(wb);
}

