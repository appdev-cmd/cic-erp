import React, { useState } from 'react';
import { CrmLayout } from '../CrmLayout';
import { Search, Filter, Plus, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export const QuotesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for initial structure
  const quotes = [
    { id: '1', number: 'BG-2026-001', customer: 'Công ty Cổ phần Đầu tư CIC', date: '25/05/2026', total: 45000000, status: 'Approved' },
    { id: '2', number: 'BG-2026-002', customer: 'Tập đoàn Công nghệ Giga', date: '26/05/2026', total: 110000000, status: 'Pending' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Đã duyệt
          </span>
        );
      case 'Pending':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Chờ duyệt
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-3 h-3" /> Nháp
          </span>
        );
    }
  };

  return (
    <CrmLayout>
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0 gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm kiếm báo giá..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Tạo Báo giá mới
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 uppercase">
                  <tr>
                    <th className="px-6 py-4 font-medium">Số Báo Giá</th>
                    <th className="px-6 py-4 font-medium">Khách hàng</th>
                    <th className="px-6 py-4 font-medium">Ngày lập</th>
                    <th className="px-6 py-4 font-medium">Tổng tiền (VND)</th>
                    <th className="px-6 py-4 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {quotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                          <FileText className="w-4 h-4 text-slate-400" />
                          {quote.number}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{quote.customer}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{quote.date}</td>
                      <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-semibold">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(quote.total)}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(quote.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </CrmLayout>
  );
};

export default QuotesPage;
