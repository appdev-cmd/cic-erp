import React, { useState, useCallback } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CustomerService } from '../services';
import { INDUSTRIES } from '../constants';
import { toast } from 'sonner';

interface ImportCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ImportRow {
    name: string;
    shortName: string;
    taxCode?: string;
    industry: string;
    type: 'Customer' | 'Supplier';
    address?: string;
    phone?: string;
    email?: string;
    contactPerson?: string;
}

interface ParsedRow extends ImportRow {
    rowIndex: number;
    errors: string[];
    isValid: boolean;
}

const VALID_INDUSTRIES = [...INDUSTRIES];
const VALID_TYPES = ['Customer', 'Supplier'];

const ImportCustomerModal: React.FC<ImportCustomerModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const resetModal = () => {
        setParsedData([]);
        setIsUploading(false);
        setIsImporting(false);
    };

    const handleClose = () => {
        resetModal();
        onClose();
    };

    const parseType = (value: string): 'Customer' | 'Supplier' => {
        if (!value) return 'Customer';
        const lower = value.toLowerCase();
        if (lower.includes('ncc') || lower.includes('supplier') || lower.includes('cung cấp')) return 'Supplier';
        return 'Customer';
    };

    const validateRow = (row: ImportRow, rowIndex: number, existingNames: Set<string>): ParsedRow => {
        const errors: string[] = [];

        // Required fields
        if (!row.name || row.name.trim() === '') {
            errors.push('Tên đối tác không được để trống');
        } else if (existingNames.has(row.name.trim().toLowerCase())) {
            errors.push('Tên đối tác đã tồn tại trong file');
        }

        if (!row.shortName || row.shortName.trim() === '') {
            errors.push('Tên viết tắt không được để trống');
        }

        // Industry validation
        if (row.industry && !(VALID_INDUSTRIES as readonly string[]).includes(row.industry)) {
            errors.push(`Ngành nghề không hợp lệ. Chọn: ${VALID_INDUSTRIES.join(', ')}`);
        }

        return {
            ...row,
            rowIndex,
            errors,
            isValid: errors.length === 0
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

                // Skip header row
                const rows = jsonData.slice(1) as any[][];
                const existingNames = new Set<string>();
                const parsed: ParsedRow[] = [];

                rows.forEach((row, idx) => {
                    if (!row || row.length === 0 || !row[0]) return; // Skip empty rows

                    const importRow: ImportRow = {
                        name: String(row[0] || '').trim(),
                        shortName: String(row[1] || '').trim(),
                        taxCode: String(row[2] || '').trim() || undefined,
                        industry: String(row[3] || 'Khác').trim(),
                        type: parseType(String(row[4] || '')),
                        address: String(row[5] || '').trim() || undefined,
                        phone: String(row[6] || '').trim() || undefined,
                        email: String(row[7] || '').trim() || undefined,
                        contactPerson: String(row[8] || '').trim() || undefined
                    };

                    const validated = validateRow(importRow, idx + 2, existingNames);
                    if (validated.name) {
                        existingNames.add(validated.name.toLowerCase());
                    }
                    parsed.push(validated);
                });

                setParsedData(parsed);
                toast.success(`Đã đọc ${parsed.length} dòng dữ liệu`);
            } catch (error) {
                console.error('Parse error:', error);
                toast.error('Lỗi đọc file Excel');
            } finally {
                setIsUploading(false);
            }
        };

        reader.readAsArrayBuffer(file);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileRead(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            handleFileRead(file);
        } else {
            toast.error('Vui lòng chọn file Excel (.xlsx, .xls)');
        }
    };

    const handleImport = async () => {
        const validRows = parsedData.filter(r => r.isValid);
        if (validRows.length === 0) {
            toast.error('Không có dữ liệu hợp lệ để import');
            return;
        }

        setIsImporting(true);
        let successCount = 0;
        const errors: string[] = [];

        for (const row of validRows) {
            try {
                await CustomerService.create({
                    name: row.name,
                    shortName: row.shortName,
                    taxCode: row.taxCode,
                    industry: [(VALID_INDUSTRIES as readonly string[]).includes(row.industry) ? row.industry : 'Khác'],
                    type: row.type,
                    address: row.address || '',
                    phone: row.phone || '',
                    email: row.email || '',
                    contactPerson: row.contactPerson || ''
                });
                successCount++;
            } catch (error: any) {
                errors.push(`Dòng ${row.rowIndex}: ${error.message || 'Lỗi không xác định'}`);
            }
        }

        setIsImporting(false);

        if (successCount > 0) {
            toast.success(`Đã import thành công ${successCount}/${validRows.length} khách hàng`);
            onSuccess();
            handleClose();
        }

        if (errors.length > 0) {
            toast.error(`Có ${errors.length} lỗi khi import`);
            console.error('Import errors:', errors);
        }
    };

    const downloadTemplate = () => {
        const template = [
            ['Tên đối tác', 'Tên viết tắt', 'Mã số thuế', 'Ngành nghề', 'Loại (KH/NCC)', 'Địa chỉ', 'Điện thoại', 'Email', 'Người liên hệ'],
            ['Công ty ABC', 'ABC', '0123456789', 'Xây dựng', 'KH', 'Hà Nội', '0987654321', 'abc@company.vn', 'Nguyễn Văn A'],
            ['Nhà cung cấp XYZ', 'XYZ', '9876543210', 'Sản xuất', 'NCC', 'TP HCM', '0912345678', 'xyz@supplier.vn', 'Trần Văn B'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        XLSX.writeFile(wb, 'template_import_customers.xlsx');
        toast.success('Đã tải template');
    };

    const validCount = parsedData.filter(r => r.isValid).length;
    const invalidCount = parsedData.filter(r => !r.isValid).length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <FileSpreadsheet className="text-emerald-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Import Khách hàng</h2>
                            <p className="text-sm text-slate-500">Nhập danh sách khách hàng/NCC từ file Excel</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {parsedData.length === 0 ? (
                        <>
                            {/* Download Template */}
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            >
                                <Download size={18} />
                                Tải template Excel mẫu
                            </button>

                            {/* Drop Zone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={handleDrop}
                                className={`border border-dashed rounded-lg p-12 text-center transition-colors ${dragActive
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-slate-300 dark:border-slate-800 hover:border-emerald-400'
                                    }`}
                            >
                                {isUploading ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={40} className="animate-spin text-emerald-500" />
                                        <p className="text-slate-600 dark:text-slate-400">Đang đọc file...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={48} className="mx-auto mb-4 text-slate-400" />
                                        <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            Kéo thả file Excel vào đây
                                        </p>
                                        <p className="text-sm text-slate-500 mb-4">hoặc</p>
                                        <label className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold cursor-pointer hover:bg-emerald-700 transition-colors">
                                            <Upload size={18} />
                                            Chọn file
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                        </label>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Preview Stats */}
                            <div className="flex gap-4 mb-6">
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Tổng:</span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100">{parsedData.length}</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <CheckCircle size={16} className="text-emerald-600" />
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{validCount} hợp lệ</span>
                                </div>
                                {invalidCount > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                        <AlertCircle size={16} className="text-rose-600" />
                                        <span className="font-bold text-rose-700 dark:text-rose-400">{invalidCount} lỗi</span>
                                    </div>
                                )}
                            </div>

                            {/* Preview Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px]">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Dòng</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Tên</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Viết tắt</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Ngành</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Loại</th>
                                                <th className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-400">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {parsedData.map((row, idx) => (
                                                <tr key={idx} className={row.isValid ? '' : 'bg-rose-50 dark:bg-rose-900/10'}>
                                                    <td className="px-4 py-3 text-slate-500">{row.rowIndex}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{row.name}</td>
                                                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{row.shortName}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.industry}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${row.type === 'Customer' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {row.type === 'Customer' ? 'KH' : 'NCC'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {row.isValid ? (
                                                            <CheckCircle size={18} className="inline text-emerald-500" />
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <AlertCircle size={18} className="text-rose-500" />
                                                                <span className="text-xs text-rose-600 max-w-[200px] truncate" title={row.errors.join(', ')}>
                                                                    {row.errors[0]}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                    <button
                        onClick={parsedData.length > 0 ? resetModal : handleClose}
                        className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        {parsedData.length > 0 ? 'Chọn file khác' : 'Hủy bỏ'}
                    </button>

                    {parsedData.length > 0 && (
                        <button
                            onClick={handleImport}
                            disabled={validCount === 0 || isImporting}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Đang import...
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    Import {validCount} khách hàng
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportCustomerModal;
