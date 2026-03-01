import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, FileText, Activity } from 'lucide-react';
import { PAKDRecord } from '../../types';
import { PAKDService } from '../../services/pakdService';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'sonner';

interface PAKDListProps {
    onCreateNew: () => void;
    onEdit: (record: PAKDRecord) => void;
}

const PAKDList: React.FC<PAKDListProps> = ({ onCreateNew, onEdit }) => {
    const [records, setRecords] = useState<PAKDRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await PAKDService.getAll();
            setRecords(data);
        } catch (error) {
            console.error('Failed to load PAKD records', error);
            toast.error('Lỗi khi tải danh sách Phương án Kinh doanh');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xoá Phương án "${code}" không?`)) {
            const success = await PAKDService.delete(id);
            if (success) {
                toast.success('Đã xoá Phương án thành công');
                setRecords(records.filter(r => r.id !== id));
            } else {
                toast.error('Có lỗi xảy ra khi xoá Phương án');
            }
        }
    };

    const filteredRecords = records.filter(r =>
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity className="text-orange-500" size={20} />
                        Danh sách Phương án Kinh doanh (PAKD)
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Quản lý các bản dự toán và tính toán hiệu quả kinh doanh.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm mã, dự án, KH..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-orange-500 outline-none w-64"
                        />
                    </div>
                    <button
                        onClick={onCreateNew}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Tạo PAKD mới
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 font-medium">Mã PAKD / Dự án</th>
                            <th className="px-6 py-4 font-medium">Đơn vị</th>
                            <th className="px-6 py-4 font-medium">Người lập</th>
                            <th className="px-6 py-4 font-medium text-right">Doanh thu</th>
                            <th className="px-6 py-4 font-medium text-right">Chi phí</th>
                            <th className="px-6 py-4 font-medium text-right">Lợi nhuận gộp</th>
                            <th className="px-6 py-4 font-medium text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                    Đang tải dữ liệu...
                                </td>
                            </tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <FileText size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                                        <p className="text-slate-500 dark:text-slate-400">Chưa có Phương án kinh doanh nào được tạo.</p>
                                        <button
                                            onClick={onCreateNew}
                                            className="mt-4 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium"
                                        >
                                            + Tạo dự toán đầu tiên
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredRecords.map((record) => (
                                <tr key={record.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900 dark:text-white cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors" onClick={() => onEdit(record)}>
                                                {record.code}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={record.projectName}>
                                                {record.projectName || 'Chưa đặt tên'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                            {record.department || 'Trung ương'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                        {record.creator || 'Admin'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-white">
                                        {formatCurrency(record.totalRevenue || 0)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-rose-600 dark:text-rose-400">
                                        {formatCurrency(record.totalCosts || 0)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(record.grossProfit || 0)}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {(record.profitMargin || 0).toFixed(2)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => onEdit(record)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                title="Chỉnh sửa"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(record.id, record.code)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                title="Xoá"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PAKDList;
