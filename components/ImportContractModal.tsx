import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ContractService, UnitService, CustomerService, EmployeeService } from '../services';
import { toast } from 'sonner';
import { Unit, Customer, Employee } from '../types';

interface ImportContractModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ImportRow {
    contractNumber?: string;
    title: string;
    customerName: string;
    unitCode: string;
    salespersonName?: string;
    value: number;
    vatRate: number;
    estimatedCost: number;
    signedDate: string;
    startDate?: string;
    endDate?: string;
    status: string;
}

interface ParsedRow extends ImportRow {
    rowIndex: number;
    errors: string[];
    isValid: boolean;
    customerId?: string;
    unitId?: string;
    salespersonId?: string;
}

const VALID_STATUSES = ['Processing', 'Suspended', 'Acceptance', 'Liquidated', 'Completed'];

const ImportContractModal: React.FC<ImportContractModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Lookup data
    const [units, setUnits] = useState<Unit[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchLookups();
        }
    }, [isOpen]);

    const fetchLookups = async () => {
        try {
            const [unitsData, customersData, employeesData] = await Promise.all([
                UnitService.getAll(),
                CustomerService.getAll({ pageSize: 1000 }), // Load ALL customers for template & validation
                EmployeeService.getAll()
            ]);
            setUnits(unitsData);
            setCustomers(customersData.data || customersData as any);
            setEmployees(employeesData);
        } catch (err) {
            console.error('Failed to fetch lookups:', err);
        }
    };

    const resetModal = () => {
        setParsedData([]);
        setIsUploading(false);
        setIsImporting(false);
    };

    const handleClose = () => {
        resetModal();
        onClose();
    };

    const parseStatus = (value: string): string => {
        if (!value) return 'Processing';
        const lower = value.toLowerCase();
        if (lower.includes('thực hiện') || lower.includes('processing') || lower.includes('active') || lower.includes('pending')) return 'Processing';
        if (lower.includes('tạm dừng') || lower.includes('suspended')) return 'Suspended';
        if (lower.includes('nghiệm thu') || lower.includes('acceptance')) return 'Acceptance';
        if (lower.includes('thanh lý') || lower.includes('liquidat')) return 'Liquidated';
        if (lower.includes('hoàn thành') || lower.includes('complete')) return 'Completed';
        return 'Processing';
    };

    const parseDate = (value: any): string => {
        if (!value) return '';
        if (typeof value === 'number') {
            // Excel serial date number
            const date = XLSX.SSF.parse_date_code(value);
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
        if (typeof value === 'string') {
            // Try common formats
            const dateMatch = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
            if (dateMatch) {
                const [_, d, m, y] = dateMatch;
                const year = y.length === 2 ? '20' + y : y;
                return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }
        return String(value);
    };

    const findUnit = (code: string): Unit | undefined => {
        if (!code) return undefined;
        const normalized = code.trim().toUpperCase();
        return units.find(u =>
            u.code?.toUpperCase() === normalized ||
            u.name?.toUpperCase().includes(normalized)
        );
    };

    const findCustomer = (name: string): Customer | undefined => {
        if (!name) return undefined;
        const normalized = name.trim().toLowerCase();
        return customers.find(c =>
            c.name?.toLowerCase().includes(normalized) ||
            c.shortName?.toLowerCase() === normalized
        );
    };

    const findEmployee = (name: string): Employee | undefined => {
        if (!name) return undefined;
        const normalized = name.trim().toLowerCase();
        return employees.find(e =>
            e.name?.toLowerCase().includes(normalized)
        );
    };

    const validateRow = (row: ImportRow, rowIndex: number, existingTitles: Set<string>): ParsedRow => {
        const errors: string[] = [];

        // Required fields
        if (!row.title || row.title.trim() === '') {
            errors.push('Tên hợp đồng không được để trống');
        } else if (existingTitles.has(row.title.trim().toLowerCase())) {
            errors.push('Tên hợp đồng đã tồn tại trong file');
        }

        // Unit lookup
        const unit = findUnit(row.unitCode);
        if (!row.unitCode || !unit) {
            errors.push(`Đơn vị "${row.unitCode}" không tồn tại`);
        }

        // Customer lookup - allow new customers (will be auto-created)
        const customer = findCustomer(row.customerName);
        if (!row.customerName) {
            errors.push('Tên khách hàng không được để trống');
        }
        // Note: if customer not found, it will be auto-created during import

        // Employee lookup (optional)
        const employee = row.salespersonName ? findEmployee(row.salespersonName) : undefined;
        if (row.salespersonName && !employee) {
            errors.push(`Nhân viên KD "${row.salespersonName}" không tồn tại`);
        }

        // Value validation
        if (isNaN(row.value) || row.value < 0) {
            errors.push('Giá trị hợp đồng không hợp lệ');
        }

        return {
            ...row,
            rowIndex,
            errors,
            isValid: errors.length === 0,
            customerId: customer?.id,
            unitId: unit?.id,
            salespersonId: employee?.id
        };
    };

    const handleFileRead = useCallback((file: File) => {
        setIsUploading(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const rows = jsonData.slice(2) as any[][]; // Skip header + hint rows
                const existingTitles = new Set<string>();
                const parsed: ParsedRow[] = [];

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;
                    // Skip empty rows - check title column (B) since contract number (A) can be empty
                    if (!row[1] && !row[0]) continue;

                    const importRow: ImportRow = {
                        contractNumber: row[0] ? String(row[0]).trim() : undefined,
                        title: String(row[1] || '').trim(),
                        customerName: String(row[2] || '').trim(),
                        unitCode: String(row[3] || '').trim(),
                        salespersonName: row[4] ? String(row[4]).trim() : undefined,
                        value: parseFloat(row[5]) || 0,
                        vatRate: [0, 8, 10].includes(Number(row[6])) ? Number(row[6]) : 10,
                        estimatedCost: parseFloat(row[7]) || 0,
                        signedDate: parseDate(row[8]),
                        startDate: parseDate(row[9]),
                        endDate: parseDate(row[10]),
                        status: parseStatus(String(row[11] || ''))
                    };

                    const parsedRow = validateRow(importRow, i + 2, existingTitles);
                    if (importRow.title) {
                        existingTitles.add(importRow.title.toLowerCase());
                    }
                    parsed.push(parsedRow);
                }

                setParsedData(parsed);
                toast.success(`Đã đọc ${parsed.length} dòng dữ liệu`);
            } catch (err) {
                console.error('Parse error:', err);
                toast.error('Lỗi đọc file Excel');
            } finally {
                setIsUploading(false);
            }
        };

        reader.onerror = () => {
            toast.error('Lỗi đọc file');
            setIsUploading(false);
        };

        reader.readAsArrayBuffer(file);
    }, [units, customers, employees]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileRead(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileRead(e.target.files[0]);
        }
    };

    const downloadTemplate = () => {
        // === SHEET 1: Main data entry ===
        const templateData = [
            ['Số HĐ', 'Tên hợp đồng (*)', 'Khách hàng (*)', 'Mã đơn vị (*)', 'NVKD', 'Giá trị ký (*)', 'Thuế suất (%)', 'Chi phí dự kiến', 'Ngày ký', 'Ngày BĐ', 'Ngày KT', 'Trạng thái'],
            ['(Tự sinh nếu bỏ trống)', '(Bắt buộc)', '(Tên KH/Tên mới)', '(Xem sheet Tra cứu)', '(Tên nhân viên)', '(Số, VNĐ, sau thuế)', '(0, 8 hoặc 10)', '(Số, VNĐ)', '(dd/mm/yyyy)', '(dd/mm/yyyy)', '(dd/mm/yyyy)', '(Processing/...)'],
            ['01/CIC-HĐ/2026', 'HĐ Tư vấn dự án ABC', 'Công ty ABC', 'BIM', 'Nguyễn Văn A', 500000000, 10, 350000000, '15/01/2026', '20/01/2026', '30/06/2026', 'Processing'],
            ['', 'HĐ Thiết kế XYZ', 'Tập đoàn XYZ', 'CSS', '', 800000000, 8, 600000000, '01/02/2026', '', '', 'Processing']
        ];

        const ws = XLSX.utils.aoa_to_sheet(templateData);
        ws['!cols'] = [
            { wch: 22 }, { wch: 35 }, { wch: 30 }, { wch: 12 },
            { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
            { wch: 14 }, { wch: 14 }, { wch: 14 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Nhập HĐ');

        // === SHEET 2: Reference lookups ===
        const refHeader = [['== DANH SÁCH ĐƠN VỊ ==', '', '', '== DANH SÁCH KHÁCH HÀNG ==', '', '', '== DANH SÁCH NHÂN VIÊN ==']];
        const refSubHeader = [['Mã đơn vị', 'Tên đơn vị', '', 'Tên khách hàng', 'Tên viết tắt', '', 'Tên nhân viên']];

        // Build unit rows
        const unitRows = units.filter(u => u.id !== 'all').map(u => [u.code || u.id, u.name]);
        // Build customer rows
        const customerRows = customers.map(c => [c.name, c.shortName || '']);
        // Build employee rows
        const employeeRows = employees.map(e => [e.name]);

        const maxLen = Math.max(unitRows.length, customerRows.length, employeeRows.length);
        const refRows: any[][] = [];
        for (let i = 0; i < maxLen; i++) {
            refRows.push([
                unitRows[i]?.[0] || '', unitRows[i]?.[1] || '', '',
                customerRows[i]?.[0] || '', customerRows[i]?.[1] || '', '',
                employeeRows[i]?.[0] || ''
            ]);
        }

        const refData = [...refHeader, ...refSubHeader, ...refRows];
        const wsRef = XLSX.utils.aoa_to_sheet(refData);
        wsRef['!cols'] = [
            { wch: 12 }, { wch: 25 }, { wch: 3 },
            { wch: 40 }, { wch: 15 }, { wch: 3 },
            { wch: 25 }
        ];
        XLSX.utils.book_append_sheet(wb, wsRef, 'Tra cứu');

        // === SHEET 3: Instructions ===
        const instructionData = [
            ['HƯỚNG DẪN IMPORT HỢP ĐỒNG'],
            [''],
            ['1. Điền dữ liệu vào sheet "Nhập HĐ"'],
            ['2. Các cột có dấu (*) là bắt buộc'],
            ['3. Tên khách hàng & Mã đơn vị phải khớp với dữ liệu trong sheet "Tra cứu"'],
            ['4. Xóa dòng hướng dẫn (dòng 2) trước khi import'],
            ['5. Xóa 2 dòng mẫu trước khi nhập dữ liệu thật'],
            [''],
            ['CÁC GIÁ TRỊ HỢP LỆ:'],
            ['Thuế suất (%):', '0, 8, 10 (mặc định 10%)'],
            ['Trạng thái:', 'Processing, Suspended, Acceptance, Liquidated, Completed'],
            ['Ngày:', 'dd/mm/yyyy hoặc yyyy-mm-dd'],
            [''],
            ['LƯU Ý:'],
            ['- Giá trị ký = Giá trị SAU THUẾ (đã bao gồm VAT)'],
            ['- Nếu KH chưa có trong hệ thống, sẽ được tự động tạo mới'],
        ];

        const wsInst = XLSX.utils.aoa_to_sheet(instructionData);
        wsInst['!cols'] = [{ wch: 50 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, wsInst, 'Hướng dẫn');

        // Use blob download for reliable filename (XLSX.writeFile can produce UUID names in some browsers)
        const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'template_import_hop_dong.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Đã tải template (3 sheet: Nhập HĐ, Tra cứu, Hướng dẫn)');
    };

    const handleImport = async () => {
        const validRows = parsedData.filter(r => r.isValid);
        if (validRows.length === 0) {
            toast.error('Không có dữ liệu hợp lệ để import');
            return;
        }

        setIsImporting(true);
        let successCount = 0;
        let newCustomerCount = 0;
        const errors: string[] = [];

        // Cache for newly created customers (avoid duplicate creation)
        const createdCustomers: Record<string, string> = {};

        for (const row of validRows) {
            try {
                // Resolve customer ID — auto-create if not found
                let customerId = row.customerId || '';
                if (!customerId && row.customerName) {
                    const cacheKey = row.customerName.trim().toLowerCase();
                    if (createdCustomers[cacheKey]) {
                        customerId = createdCustomers[cacheKey];
                    } else {
                        try {
                            const newCustomer = await CustomerService.create({
                                name: row.customerName.trim(),
                                shortName: '',
                                industry: [],
                                type: 'Customer',
                                contactPerson: '',
                                phone: '',
                                email: '',
                                address: ''
                            });
                            customerId = newCustomer.id;
                            createdCustomers[cacheKey] = customerId;
                            newCustomerCount++;
                        } catch (custErr: any) {
                            console.warn(`Auto-create customer "${row.customerName}" failed:`, custErr);
                            // Continue without customer if creation fails
                        }
                    }
                }

                // Use user-provided contract number or auto-generate
                let contractId = row.contractNumber || '';
                if (!contractId) {
                    const year = new Date(row.signedDate || Date.now()).getFullYear();
                    const contractNumber = await ContractService.getNextContractNumber(row.unitId!, year);
                    const unit = units.find(u => u.id === row.unitId);
                    contractId = `HD_${String(contractNumber).padStart(3, '0')}/${unit?.code || 'CIC'}`;
                }

                await ContractService.create({
                    id: contractId,
                    title: row.title,
                    contractType: 'HĐ',
                    customerId,
                    partyA: row.customerName || '',
                    unitId: row.unitId || '',
                    salespersonId: row.salespersonId || '',
                    value: row.value,
                    vatRate: row.vatRate,
                    hasVat: row.vatRate > 0,
                    estimatedCost: row.estimatedCost,
                    actualRevenue: 0,
                    actualCost: 0,
                    signedDate: row.signedDate,
                    startDate: row.startDate || row.signedDate,
                    endDate: row.endDate || '',
                    status: row.status as any,
                    stage: 'Signed',
                    category: 'Mới',
                    partyB: '',
                    clientInitials: '',
                    content: '',
                    contacts: []
                });
                successCount++;
            } catch (error: any) {
                errors.push(`Dòng ${row.rowIndex}: ${error.message || 'Lỗi không xác định'}`);
            }
        }

        setIsImporting(false);

        if (successCount > 0) {
            const msg = newCustomerCount > 0
                ? `Đã import ${successCount} hợp đồng (tạo mới ${newCustomerCount} khách hàng)`
                : `Đã import thành công ${successCount} hợp đồng`;
            toast.success(msg);
        }
        if (errors.length > 0) {
            toast.error(`Có ${errors.length} lỗi khi import`);
            console.error('Import errors:', errors);
        }
        if (successCount > 0) {
            onSuccess();
            handleClose();
        }
    };

    const validCount = parsedData.filter(r => r.isValid).length;
    const invalidCount = parsedData.filter(r => !r.isValid).length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <FileSpreadsheet className="text-blue-600" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Import Hợp đồng</h2>
                            <p className="text-sm text-slate-500">Nhập danh sách hợp đồng từ file Excel</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {parsedData.length === 0 ? (
                        <div className="space-y-4">
                            {/* Template Download */}
                            <button
                                onClick={downloadTemplate}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors font-medium"
                            >
                                <Download size={18} />
                                Tải file Template mẫu
                            </button>

                            {/* Drop Zone */}
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={`border border-dashed rounded-lg p-10 text-center transition-colors ${dragActive
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-300 dark:border-slate-800 hover:border-blue-400'
                                    }`}
                            >
                                {isUploading ? (
                                    <Loader2 className="animate-spin mx-auto text-blue-500" size={40} />
                                ) : (
                                    <>
                                        <Upload className="mx-auto text-slate-400 mb-3" size={40} />
                                        <p className="text-slate-600 dark:text-slate-400 mb-2">
                                            Kéo thả file Excel vào đây hoặc
                                        </p>
                                        <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                                            Chọn file
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls"
                                                onChange={handleFileInput}
                                                className="hidden"
                                            />
                                        </label>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Stats */}
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                    <CheckCircle size={18} className="text-green-600" />
                                    <span className="font-medium text-green-700 dark:text-green-400">{validCount} hợp lệ</span>
                                </div>
                                {invalidCount > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                        <AlertCircle size={18} className="text-red-600" />
                                        <span className="font-medium text-red-700 dark:text-red-400">{invalidCount} lỗi</span>
                                    </div>
                                )}
                            </div>

                            {/* Preview Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-80">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-slate-600">Dòng</th>
                                                <th className="px-3 py-2 text-left font-medium text-slate-600">Tên HĐ</th>
                                                <th className="px-3 py-2 text-left font-medium text-slate-600">Khách hàng</th>
                                                <th className="px-3 py-2 text-left font-medium text-slate-600">Đơn vị</th>
                                                <th className="px-3 py-2 text-right font-medium text-slate-600">Giá trị</th>
                                                <th className="px-3 py-2 text-center font-medium text-slate-600">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {parsedData.map((row, idx) => (
                                                <tr
                                                    key={idx}
                                                    className={row.isValid ? '' : 'bg-red-50 dark:bg-red-900/10'}
                                                >
                                                    <td className="px-3 py-2 text-slate-500">{row.rowIndex}</td>
                                                    <td className="px-3 py-2 font-medium max-w-[200px] truncate">{row.title}</td>
                                                    <td className="px-3 py-2">{row.customerName}</td>
                                                    <td className="px-3 py-2">{row.unitCode}</td>
                                                    <td className="px-3 py-2 text-right">{(row.value / 1000000).toFixed(1)}M</td>
                                                    <td className="px-3 py-2 text-center">
                                                        {row.isValid ? (
                                                            <CheckCircle size={16} className="text-green-500 mx-auto" />
                                                        ) : (
                                                            <div className="group relative">
                                                                <AlertCircle size={16} className="text-red-500 mx-auto cursor-help" />
                                                                <div className="hidden group-hover:block absolute right-0 top-5 z-10 w-64 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs rounded-lg shadow-lg">
                                                                    {row.errors.join(', ')}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-5 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setParsedData([])}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        disabled={parsedData.length === 0}
                    >
                        Chọn lại file
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={validCount === 0 || isImporting}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isImporting && <Loader2 className="animate-spin" size={16} />}
                            Import {validCount} hợp đồng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportContractModal;
