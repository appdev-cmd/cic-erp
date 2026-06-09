import React, { useState, useCallback } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProjectService } from '../services';
import { toast } from 'sonner';
import type { BIMProject, BIMProjectStatus } from '../types/project';
import { exportProjectTemplate } from '../services/projectExportService';

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportRow {
  code?: string;
  name: string;
  status: BIMProjectStatus;
  location?: string;
  clientName?: string;
  serviceType?: string;
  constructionType?: string;
  contractValue: number;
  progress: number;
  startDate?: string;
  endDate?: string;
  contactName?: string;
  contactPhone?: string;
}

interface ParsedRow extends ImportRow {
  rowIndex: number;
  errors: string[];
  isValid: boolean;
}

const VALID_STATUSES: BIMProjectStatus[] = ['new', 'active', 'paused', 'done', 'cancelled'];
const STATUS_LABEL_MAP: Record<string, BIMProjectStatus> = {
  'mới': 'new', 'new': 'new',
  'đang triển khai': 'active', 'active': 'active', 'đang': 'active',
  'tạm dừng': 'paused', 'paused': 'paused', 'dừng': 'paused',
  'hoàn thành': 'done', 'done': 'done', 'xong': 'done',
  'hủy': 'cancelled', 'cancelled': 'cancelled', 'cancel': 'cancelled',
};

function parseStatus(value: string): BIMProjectStatus {
  if (!value) return 'new';
  const lower = value.trim().toLowerCase();
  return STATUS_LABEL_MAP[lower] ?? (VALID_STATUSES.includes(lower as BIMProjectStatus) ? (lower as BIMProjectStatus) : 'new');
}

function parseDate(value: any): string {
  if (!value) return '';
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  if (typeof value === 'string') {
    const m = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const [, d, mo, y] = m;
      const year = y.length === 2 ? '20' + y : y;
      return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.substring(0, 10);
  }
  return '';
}

const ImportProjectModal: React.FC<ImportProjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
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

  const validateRow = (row: ImportRow, rowIndex: number, existingNames: Set<string>): ParsedRow => {
    const errors: string[] = [];

    if (!row.name || row.name.trim() === '') {
      errors.push('Tên dự án không được để trống');
    } else if (existingNames.has(row.name.trim().toLowerCase())) {
      errors.push('Tên dự án bị trùng trong file');
    }

    if (isNaN(row.contractValue) || row.contractValue < 0) {
      errors.push('Giá trị hợp đồng không hợp lệ');
    }

    if (isNaN(row.progress) || row.progress < 0 || row.progress > 100) {
      errors.push('Tiến độ phải từ 0–100');
    }

    return { ...row, rowIndex, errors, isValid: errors.length === 0 };
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Skip header row + hint row
        const rows = jsonData.slice(2);
        const existingNames = new Set<string>();
        const parsed: ParsedRow[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          if (!row[1] && !row[0]) continue; // skip empty rows

          const importRow: ImportRow = {
            code: row[0] ? String(row[0]).trim() : undefined,
            name: String(row[1] || '').trim(),
            status: parseStatus(String(row[2] || '')),
            location: row[3] ? String(row[3]).trim() : undefined,
            clientName: row[4] ? String(row[4]).trim() : undefined,
            serviceType: row[5] ? String(row[5]).trim() : undefined,
            constructionType: row[6] ? String(row[6]).trim() : undefined,
            contractValue: parseFloat(String(row[7] || '0').replace(/[^\d.]/g, '')) || 0,
            progress: Math.min(100, Math.max(0, parseInt(String(row[8] || '0')) || 0)),
            startDate: parseDate(row[9]),
            endDate: parseDate(row[10]),
            contactName: row[11] ? String(row[11]).trim() : undefined,
            contactPhone: row[12] ? String(row[12]).trim() : undefined,
          };

          const parsedRow = validateRow(importRow, i + 3, existingNames);
          if (importRow.name) existingNames.add(importRow.name.toLowerCase());
          parsed.push(parsedRow);
        }

        setParsedData(parsed);
        const validCount = parsed.filter((r) => r.isValid).length;
        toast.success(`Đã đọc ${parsed.length} dòng (${validCount} hợp lệ)`);
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
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileRead(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileRead(e.target.files[0]);
  };

  const handleImport = async () => {
    const validRows = parsedData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('Không có dòng hợp lệ để nhập');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of validRows) {
      try {
        const projectData: Partial<BIMProject> = {
          code: row.code || '',
          name: row.name,
          status: row.status,
          location: row.location,
          clientName: row.clientName,
          serviceType: row.serviceType,
          constructionType: row.constructionType,
          contractValue: row.contractValue,
          progress: row.progress,
          startDate: row.startDate || undefined,
          endDate: row.endDate || undefined,
          contactName: row.contactName,
          contactPhone: row.contactPhone,
        };
        await ProjectService.create(projectData);
        successCount++;
      } catch (err) {
        console.error('Import row error:', err);
        errorCount++;
      }
    }

    setIsImporting(false);

    if (successCount > 0) {
      toast.success(`Nhập thành công ${successCount} dự án${errorCount > 0 ? `, lỗi ${errorCount} dòng` : ''}`);
      onSuccess();
      handleClose();
    } else {
      toast.error('Nhập thất bại. Kiểm tra lại dữ liệu.');
    }
  };

  if (!isOpen) return null;

  const validCount = parsedData.filter((r) => r.isValid).length;
  const errorCount = parsedData.filter((r) => !r.isValid).length;

  const STATUS_VI: Record<BIMProjectStatus, string> = {
    new: 'Mới', active: 'Đang triển khai', paused: 'Tạm dừng',
    done: 'Hoàn thành', cancelled: 'Hủy',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Nhập dự án từ Excel</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tải template, điền dữ liệu rồi upload file</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 1 - Download template */}
          <div className="flex items-start gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Tải file mẫu (template)</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Điền thông tin dự án vào file mẫu, sau đó upload lên.</p>
              <button
                onClick={exportProjectTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm font-semibold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shadow-sm"
              >
                <Download size={15} />
                Tải template_import_du_an.xlsx
              </button>
            </div>
          </div>

          {/* Step 2 - Upload */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Upload file Excel đã điền</p>
              <label
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  dragActive
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {isUploading ? (
                  <Loader2 size={28} className="text-indigo-500 animate-spin" />
                ) : (
                  <Upload size={28} className="text-slate-400" />
                )}
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    {isUploading ? 'Đang xử lý...' : 'Kéo thả file hoặc click để chọn'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">.xlsx, .xls</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>

          {/* Step 3 - Preview */}
          {parsedData.length > 0 && (
            <div className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Xem trước dữ liệu</p>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    {validCount} hợp lệ
                  </span>
                  {errorCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold">
                      {errorCount} lỗi
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Dòng</th>
                          <th className="px-3 py-2.5 text-left">Mã DA</th>
                          <th className="px-3 py-2.5 text-left min-w-[200px]">Tên dự án</th>
                          <th className="px-3 py-2.5 text-left">Trạng thái</th>
                          <th className="px-3 py-2.5 text-left">Địa điểm</th>
                          <th className="px-3 py-2.5 text-right">Giá trị (VNĐ)</th>
                          <th className="px-3 py-2.5 text-center">Tiến độ</th>
                          <th className="px-3 py-2.5 text-left">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedData.map((row) => (
                          <tr
                            key={row.rowIndex}
                            className={row.isValid ? 'bg-white dark:bg-slate-900' : 'bg-rose-50/60 dark:bg-rose-900/10'}
                          >
                            <td className="px-3 py-2 text-slate-400">{row.rowIndex}</td>
                            <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400">{row.code || '—'}</td>
                            <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200 max-w-[220px] truncate">{row.name}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{STATUS_VI[row.status]}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[120px] truncate">{row.location || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                              {row.contractValue ? new Intl.NumberFormat('vi-VN').format(row.contractValue) : '0'}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400">{row.progress}%</td>
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <CheckCircle size={13} /> OK
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold" title={row.errors.join('; ')}>
                                  <AlertCircle size={13} />
                                  <span className="max-w-[160px] truncate">{row.errors[0]}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {parsedData.length > 0
              ? `${parsedData.length} dòng đọc được — ${validCount} sẽ được nhập`
              : 'Upload file Excel để bắt đầu nhập dữ liệu'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleImport}
              disabled={validCount === 0 || isImporting}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              {isImporting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Đang nhập...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Nhập {validCount > 0 ? `${validCount} dự án` : 'dữ liệu'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProjectModal;
