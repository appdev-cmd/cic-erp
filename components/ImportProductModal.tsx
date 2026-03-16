import React, { useState, useCallback } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product, ProductCategory, Unit } from '../types';
import { ProductService } from '../services';
import { toast } from 'sonner';

interface ImportProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    units: Unit[];
    onSuccess: () => void;
}

interface ImportRow {
    code: string;
    name: string;
    category: string;
    description?: string;
    unit: string;
    basePrice: number;
    costPrice: number;
    unitId?: string;
}

interface ParsedRow extends ImportRow {
    rowIndex: number;
    errors: string[];
    isValid: boolean;
}

const VALID_CATEGORIES: ProductCategory[] = ['Phần mềm', 'Tư vấn', 'Thiết kế', 'Thi công', 'Bảo trì', 'Đào tạo'];

const ImportProductModal: React.FC<ImportProductModalProps> = ({ isOpen, onClose, units, onSuccess }) => {
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

    const parseNumber = (value: any): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const cleaned = value.replace(/[,.\s]/g, '');
            return parseInt(cleaned, 10) || 0;
        }
        return 0;
    };

    const findUnitId = (unitName: string): string | undefined => {
        if (!unitName) return undefined;
        const found = units.find(u =>
            u.name.toLowerCase().includes(unitName.toLowerCase()) ||
            u.code.toLowerCase() === unitName.toLowerCase()
        );
        return found?.id;
    };

    const validateRow = (row: ImportRow, rowIndex: number, existingCodes: Set<string>): ParsedRow => {
        const errors: string[] = [];

        // Required fields
        if (!row.code || row.code.trim() === '') {
            errors.push('Mã SP không được để trống');
        } else if (existingCodes.has(row.code.trim().toUpperCase())) {
            errors.push('Mã SP đã tồn tại trong file');
        }

        if (!row.name || row.name.trim() === '') {
            errors.push('Tên sản phẩm không được để trống');
        }

        // Category validation
        if (row.category && !VALID_CATEGORIES.includes(row.category as ProductCategory)) {
            errors.push(`Danh mục không hợp lệ. Chọn: ${VALID_CATEGORIES.join(', ')}`);
        }

        // Price validation
        if (row.basePrice < 0) {
            errors.push('Giá bán phải >= 0');
        }
        if (row.costPrice < 0) {
            errors.push('Giá vốn phải >= 0');
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
                const existingCodes = new Set<string>();
                const parsed: ParsedRow[] = [];

                rows.forEach((row, idx) => {
                    if (!row || row.length === 0 || !row[0]) return; // Skip empty rows

                    const importRow: ImportRow = {
                        code: String(row[0] || '').trim(),
                        name: String(row[1] || '').trim(),
                        category: String(row[2] || 'Phần mềm').trim(),
                        description: String(row[3] || '').trim(),
                        unit: String(row[4] || 'VNĐ').trim(),
                        basePrice: parseNumber(row[5]),
                        costPrice: parseNumber(row[6]),
                        unitId: findUnitId(String(row[7] || ''))
                    };

                    const validated = validateRow(importRow, idx + 2, existingCodes);
                    if (validated.code) {
                        existingCodes.add(validated.code.toUpperCase());
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
    }, [units]);

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
                await ProductService.create({
                    code: row.code,
                    name: row.name,
                    category: (row.category || 'Phần mềm') as ProductCategory,
                    description: row.description || '',
                    unit: row.unit || 'VNĐ',
                    basePrice: row.basePrice,
                    costPrice: row.costPrice,
                    isActive: true,
                    unitId: row.unitId
                });
                successCount++;
            } catch (error: any) {
                errors.push(`Dòng ${row.rowIndex}: ${error.message || 'Lỗi không xác định'}`);
            }
        }

        setIsImporting(false);

        if (successCount > 0) {
            toast.success(`Đã import thành công ${successCount}/${validRows.length} sản phẩm`);
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
            ['Mã SP', 'Tên sản phẩm', 'Danh mục', 'Mô tả', 'Đơn vị tính', 'Giá bán', 'Giá vốn', 'Đơn vị KD'],
            ['PM-001', 'Phần mềm quản lý dự án', 'Phần mềm', 'Quản lý dự án xây dựng', 'VNĐ', 50000000, 30000000, 'BIM'],
            ['TV-001', 'Tư vấn thiết kế kiến trúc', 'Tư vấn', 'Dịch vụ tư vấn', 'm2', 200000, 100000, 'TVTK'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Products');
        XLSX.writeFile(wb, 'template_import_products.xlsx');
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
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <FileSpreadsheet className="text-indigo-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Import Sản phẩm</h2>
                            <p className="text-sm text-slate-500">Nhập danh sách sản phẩm từ file Excel</p>
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
                                className="flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
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
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                        : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400'
                                    }`}
                            >
                                {isUploading ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={40} className="animate-spin text-indigo-500" />
                                        <p className="text-slate-600 dark:text-slate-400">Đang đọc file...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={48} className="mx-auto mb-4 text-slate-400" />
                                        <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            Kéo thả file Excel vào đây
                                        </p>
                                        <p className="text-sm text-slate-500 mb-4">hoặc</p>
                                        <label className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold cursor-pointer hover:bg-indigo-700 transition-colors">
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
                                                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Mã SP</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Tên sản phẩm</th>
                                                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Danh mục</th>
                                                <th className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400">Giá bán</th>
                                                <th className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-400">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {parsedData.map((row, idx) => (
                                                <tr key={idx} className={row.isValid ? '' : 'bg-rose-50 dark:bg-rose-900/10'}>
                                                    <td className="px-4 py-3 text-slate-500">{row.rowIndex}</td>
                                                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">{row.code}</td>
                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.name}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.category}</td>
                                                    <td className="px-4 py-3 text-right font-medium">{row.basePrice.toLocaleString('vi-VN')}</td>
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
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Đang import...
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    Import {validCount} sản phẩm
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportProductModal;
