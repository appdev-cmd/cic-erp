import React, { useState, useCallback } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CrmLeadService } from '../../../services';
import { dataClient as supabase } from '../../../lib/dataClient';
import { toast } from 'sonner';

interface ImportLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportRow {
  title: string;
  name: string;
  phone: string;
  email: string;
  companyName: string;
  source: string;
  expectedValue: number;
}

interface ParsedRow extends ImportRow {
  rowIndex: number;
  errors: string[];
  isValid: boolean;
}

const ImportLeadModal: React.FC<ImportLeadModalProps> = ({ isOpen, onClose, onSuccess }) => {
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

  const validateRow = (row: ImportRow, rowIndex: number): ParsedRow => {
    const errors: string[] = [];

    // Title is required
    if (!row.title || row.title.trim() === '') {
      errors.push('Tiêu đề không được để trống');
    }

    // Email format check (if provided)
    if (row.email && row.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email.trim())) {
        errors.push('Email không hợp lệ');
      }
    }

    // Phone format check (if provided)
    if (row.phone && row.phone.trim() !== '') {
      const phoneClean = row.phone.replace(/[\s\-().]/g, '');
      if (!/^\+?\d{8,15}$/.test(phoneClean)) {
        errors.push('Số điện thoại không hợp lệ');
      }
    }

    // Expected value must be a non-negative number
    if (row.expectedValue < 0) {
      errors.push('Giá trị dự kiến không được âm');
    }

    return {
      ...row,
      rowIndex,
      errors,
      isValid: errors.length === 0,
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
        const parsed: ParsedRow[] = [];

        rows.forEach((row, idx) => {
          if (!row || row.length === 0 || !row[0]) return; // Skip empty rows

          const rawValue = row[6];
          let parsedValue = 0;
          if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
            const num = Number(String(rawValue).replace(/[,.\s]/g, ''));
            parsedValue = isNaN(num) ? 0 : num;
          }

          const importRow: ImportRow = {
            title: String(row[0] || '').trim(),
            name: String(row[1] || '').trim(),
            phone: String(row[2] || '').trim(),
            email: String(row[3] || '').trim(),
            companyName: String(row[4] || '').trim(),
            source: String(row[5] || '').trim(),
            expectedValue: parsedValue,
          };

          const validated = validateRow(importRow, idx + 2);
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
    const validRows = parsedData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('Không có dữ liệu hợp lệ để import');
      return;
    }

    setIsImporting(true);

    try {
      // Get current user session for created_by and unit_id
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const profile = session?.user
        ? (await supabase.from('profiles').select('unit_id').eq('id', session.user.id).single()).data
        : null;

      let successCount = 0;
      const errors: string[] = [];

      for (const row of validRows) {
        try {
          await CrmLeadService.create({
            title: row.title,
            name: row.name || undefined,
            phone: row.phone || undefined,
            email: row.email || undefined,
            company_name: row.companyName || undefined,
            source: row.source || undefined,
            expected_value: row.expectedValue || 0,
            created_by: session?.user?.id,
            unit_id: profile?.unit_id || undefined,
          });
          successCount++;
        } catch (error: any) {
          errors.push(`Dòng ${row.rowIndex}: ${error.message || 'Lỗi không xác định'}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Đã import thành công ${successCount}/${validRows.length} đầu mối`);
        onSuccess();
        handleClose();
      }

      if (errors.length > 0) {
        toast.error(`Có ${errors.length} lỗi khi import`);
        console.error('Import errors:', errors);
      }
    } catch (error: any) {
      toast.error('Lỗi trong quá trình import: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['Tiêu đề', 'Người liên hệ', 'Điện thoại', 'Email', 'Tên công ty', 'Nguồn', 'Giá trị dự kiến'],
      ['Dự án ABC', 'Nguyễn Văn A', '0987654321', 'nguyenvana@company.vn', 'Công ty ABC', 'Website', '500000000'],
      ['Cơ hội XYZ', 'Trần Thị B', '0912345678', 'tranthib@corp.vn', 'Tập đoàn XYZ', 'Giới thiệu', '200000000'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);

    // Set column widths
    ws['!cols'] = [
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'template_import_leads.xlsx');
    toast.success('Đã tải template');
  };

  const validCount = parsedData.filter((r) => r.isValid).length;
  const invalidCount = parsedData.filter((r) => !r.isValid).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <FileSpreadsheet className="text-indigo-600 dark:text-indigo-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Import Đầu mối</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Nhập danh sách đầu mối (Lead) từ file Excel</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
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
                className="flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              >
                <Download size={18} />
                Tải template Excel mẫu
              </button>

              {/* Column Guide */}
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Cấu trúc cột trong file Excel
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['Tiêu đề *', 'Người liên hệ', 'Điện thoại', 'Email', 'Tên công ty', 'Nguồn', 'Giá trị dự kiến'].map(
                    (col, i) => (
                      <span
                        key={i}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          col.includes('*')
                            ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {i + 1}. {col}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600'
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
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">hoặc</p>
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
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                      Hỗ trợ định dạng .xlsx và .xls
                    </p>
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
                  <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{validCount} hợp lệ</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                    <AlertCircle size={16} className="text-rose-600 dark:text-rose-400" />
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
                        <th className="px-3 py-3 text-left font-bold text-slate-600 dark:text-slate-400 w-12">Dòng</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Tiêu đề</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Người liên hệ</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Điện thoại</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Email</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Công ty</th>
                        <th className="px-3 py-3 text-left font-bold text-slate-600 dark:text-slate-400">Nguồn</th>
                        <th className="px-3 py-3 text-right font-bold text-slate-600 dark:text-slate-400">Giá trị</th>
                        <th className="px-3 py-3 text-center font-bold text-slate-600 dark:text-slate-400 w-20">TT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedData.map((row, idx) => (
                        <tr
                          key={idx}
                          className={
                            row.isValid
                              ? 'hover:bg-slate-50 dark:hover:bg-slate-800'
                              : 'bg-rose-50 dark:bg-rose-900/10'
                          }
                        >
                          <td className="px-3 py-2.5 text-slate-400 dark:text-slate-500 text-xs">{row.rowIndex}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 max-w-[140px] truncate">
                            {row.title || <span className="text-rose-400 italic text-xs">Trống</span>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                            {row.name || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400 text-xs">
                            {row.phone || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 max-w-[160px] truncate text-xs">
                            {row.email || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                            {row.companyName || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            {row.source ? (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">
                                {row.source}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300 text-xs">
                            {row.expectedValue
                              ? new Intl.NumberFormat('vi-VN').format(row.expectedValue)
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {row.isValid ? (
                              <CheckCircle size={16} className="inline text-emerald-500" />
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <AlertCircle size={16} className="text-rose-500" />
                                <span
                                  className="text-xs text-rose-600 dark:text-rose-400 max-w-[120px] truncate"
                                  title={row.errors.join(', ')}
                                >
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
                  Import {validCount} đầu mối
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportLeadModal;
