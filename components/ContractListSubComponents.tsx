import React from 'react';
import { DollarSign, Briefcase, TrendingUp, Clock, AlertCircle, PackageCheck, FileText, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { formatVND as formatCurrency } from '../utils/contractHelpers';
import type { ContractStatus } from '../types';

export const computeDatesFromPeriodYear = (period: string, year: string): { from: string; to: string } => {
  if (period && period !== '') {
    const y = (year && year !== 'All') ? parseInt(year) : new Date().getFullYear();
    if (period.startsWith('M')) {
      const m = parseInt(period.substring(1));
      const first = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from: first, to: last };
    }
    if (period.startsWith('Q')) {
      const q = parseInt(period.substring(1));
      const sm = (q - 1) * 3 + 1;
      const em = q * 3;
      const first = `${y}-${String(sm).padStart(2, '0')}-01`;
      const lastDay = new Date(y, em, 0).getDate();
      const last = `${y}-${String(em).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from: first, to: last };
    }
  }
  if (year && year !== 'All') {
    const y = parseInt(year);
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return { from: '', to: '' };
};

export const CONTRACT_TABLE_COLUMNS = [
  { key: 'stt', defaultWidth: 36, minWidth: 30 },
  { key: 'contractCode', defaultWidth: 140, minWidth: 80 },
  { key: 'title', defaultWidth: 380, minWidth: 150 },
  { key: 'value', defaultWidth: 115, minWidth: 70 },
  { key: 'revenue', defaultWidth: 115, minWidth: 70 },
  { key: 'cash', defaultWidth: 115, minWidth: 70 },
  { key: 'adminProfit', defaultWidth: 115, minWidth: 70 },
  { key: 'revProfit', defaultWidth: 115, minWidth: 70 },
  { key: 'margin', defaultWidth: 52, minWidth: 40 },
  { key: 'status', defaultWidth: 130, minWidth: 80 },
  { key: 'actions', defaultWidth: 42, minWidth: 32 },
];

export const ACTIVE_STATUSES = [
  { value: 'Processing', label: 'Đang thực hiện', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
  { value: 'Suspended', label: 'Tạm dừng', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  { value: 'Cancelled', label: 'Hủy', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
  { value: 'Handover', label: 'Bàn giao', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800' },
  { value: 'Acceptance', label: 'Nghiệm thu/TL', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { value: 'Completed', label: 'Hoàn thành', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
];

export const TABLE_HEADERS = [
  { key: 'stt', label: 'STT', align: 'center' },
  { key: 'contractCode', label: 'Số HĐ', align: 'center', sortKey: 'signedDate' },
  { key: 'title', label: 'Nội dung hợp đồng', align: 'center', sortKey: 'title' },
  { key: 'value', label: 'Ký kết', align: 'center', sortKey: 'value' },
  { key: 'revenue', label: 'Doanh thu', align: 'center', sortKey: 'actualRevenue' },
  { key: 'cash', label: 'Tiền về', align: 'center' },
  { key: 'adminProfit', label: 'LNG quản trị', align: 'center', color: 'text-amber-700 dark:text-amber-400', sortKey: 'adminProfit' },
  { key: 'revProfit', label: 'LNG theo DT', align: 'center', color: 'text-purple-700 dark:text-purple-400', sortKey: 'revProfit' },
  { key: 'margin', label: 'Tỷ suất', align: 'center' },
  { key: 'status', label: 'Trạng thái', align: 'center', sortKey: 'status' },
  { key: 'actions', label: '', align: 'center' },
];

export interface ContractListStatsProps {
  metrics: {
    totalContracts: number;
    totalValue: number;
    totalRevenue: number;
    totalProfit: number;
    totalRevenueProfit: number;
    processingCount: number;
    suspendedCount: number;
    cancelledCount: number;
    handoverCount: number;
    acceptanceCount: number;
    completedCount: number;
  };
  statusFilter: ContractStatus | 'All';
  setStatusFilter: (status: ContractStatus | 'All') => void;
  statsCollapsed: boolean;
}

export const ContractListStats: React.FC<ContractListStatsProps> = ({ metrics, statusFilter, setStatusFilter, statsCollapsed }) => {
  const statusCards: { status: ContractStatus; label: string; count: number; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { status: 'Processing', label: 'Đang thực hiện', count: metrics.processingCount, icon: <Clock size={16} />, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/25 border border-orange-100 dark:border-orange-800/40' },
    { status: 'Suspended', label: 'Tạm dừng', count: metrics.suspendedCount, icon: <AlertTriangle size={16} />, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/25 border border-amber-100 dark:border-amber-800/40' },
    { status: 'Cancelled', label: 'Hủy', count: metrics.cancelledCount, icon: <AlertCircle size={16} />, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/25 border border-red-100 dark:border-red-800/40' },
    { status: 'Handover', label: 'Bàn giao', count: metrics.handoverCount, icon: <PackageCheck size={16} />, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-900/25 border border-cyan-100 dark:border-cyan-800/40' },
    { status: 'Acceptance', label: 'Nghiệm thu/TL', count: metrics.acceptanceCount, icon: <FileText size={16} />, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/25 border border-blue-100 dark:border-blue-800/40' },
    { status: 'Completed', label: 'Hoàn thành', count: metrics.completedCount, icon: <CheckCircle size={16} />, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-100 dark:border-emerald-800/40' },
  ];

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        maxHeight: statsCollapsed ? '0px' : '300px',
        opacity: statsCollapsed ? 0 : 1,
        marginTop: statsCollapsed ? '0px' : '0px',
      }}
    >
      <div className="space-y-3 pb-1">
        {/* SCORE CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Briefcase size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng số hồ sơ</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{metrics.totalContracts}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng giá trị ký</p>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(metrics.totalValue)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doanh thu thực tế</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(metrics.totalRevenue)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LNG Quản trị</p>
              <p className="text-base font-black text-amber-600 dark:text-amber-400">
                {formatCurrency(metrics.totalProfit)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LNG Doanh thu</p>
              <p className="text-base font-black text-purple-600 dark:text-purple-400">
                {formatCurrency(metrics.totalRevenueProfit)}
              </p>
            </div>
          </div>
        </div>

        {/* STATUS FILTER CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {statusCards.map(sc => (
            <button
              key={sc.status}
              onClick={() => setStatusFilter(statusFilter === sc.status ? 'All' : sc.status)}
              className={`${sc.bgColor} rounded-lg px-2 py-2 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] ${statusFilter === sc.status ? 'ring-2 ring-indigo-500 shadow-lg' : ''}`}
            >
              <div className={sc.color}>{sc.icon}</div>
              <div>
                <p className={`text-[9px] font-bold ${sc.color} uppercase`}>{sc.label}</p>
                <p className={`text-lg font-black ${sc.color}`}>{sc.count}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export interface WarningFilterChipsProps {
  warningCounts: { overdueAdvance: number; overduePayment: number; acceptedNoInvoice: number };
  warningFilter: string;
  setWarningFilter: (filter: 'none' | 'overdueAdvance' | 'overduePayment' | 'acceptedNoInvoice') => void;
}

export const ContractListWarningChips: React.FC<WarningFilterChipsProps> = ({ warningCounts, warningFilter, setWarningFilter }) => {
  const hasAnyWarning = warningCounts.overdueAdvance > 0 || warningCounts.overduePayment > 0 || warningCounts.acceptedNoInvoice > 0;
  if (!hasAnyWarning) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cảnh báo:</span>
      {warningCounts.overdueAdvance > 0 && (
        <button
          onClick={() => setWarningFilter(warningFilter === 'overdueAdvance' ? 'none' : 'overdueAdvance')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
            warningFilter === 'overdueAdvance'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/40 shadow-sm'
              : 'bg-amber-50 dark:bg-amber-900/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700'
          }`}
        >
          <AlertTriangle size={13} />
          QH tạm ứng
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            warningFilter === 'overdueAdvance'
              ? 'bg-amber-500 text-white'
              : 'bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
          }`}>{warningCounts.overdueAdvance}</span>
        </button>
      )}
      {warningCounts.overduePayment > 0 && (
        <button
          onClick={() => setWarningFilter(warningFilter === 'overduePayment' ? 'none' : 'overduePayment')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
            warningFilter === 'overduePayment'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-400 dark:border-red-600 ring-2 ring-red-500/40 shadow-sm'
              : 'bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700'
          }`}
        >
          <AlertCircle size={13} />
          QH thanh toán
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            warningFilter === 'overduePayment'
              ? 'bg-red-500 text-white'
              : 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300'
          }`}>{warningCounts.overduePayment}</span>
        </button>
      )}
      {warningCounts.acceptedNoInvoice > 0 && (
        <button
          onClick={() => setWarningFilter(warningFilter === 'acceptedNoInvoice' ? 'none' : 'acceptedNoInvoice')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
            warningFilter === 'acceptedNoInvoice'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-400 dark:border-purple-600 ring-2 ring-purple-500/40 shadow-sm'
              : 'bg-purple-50 dark:bg-purple-900/15 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700'
          }`}
        >
          <FileText size={13} />
          Chưa xuất HĐ
          <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            warningFilter === 'acceptedNoInvoice'
              ? 'bg-purple-500 text-white'
              : 'bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300'
          }`}>{warningCounts.acceptedNoInvoice}</span>
        </button>
      )}
      {warningFilter !== 'none' && (
        <button
          onClick={() => setWarningFilter('none')}
          className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          title="Bỏ lọc cảnh báo"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
