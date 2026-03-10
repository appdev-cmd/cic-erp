// CustomerDetail — Contracts Tab
import React from 'react';
import { FileText, ChevronRight } from 'lucide-react';
import { Contract } from '../../types';
import { formatDate } from '../../utils/formatters';

interface CustomerContractsTabProps {
    contracts: Contract[];
    filteredContracts: Contract[];
    contractFilter: string;
    setContractFilter: (v: string) => void;
    contractStatusCounts: Record<string, number>;
    formatCurrency: (val: number) => string;
    getStatusColor: (status: string) => string;
    onViewContract: (contractId: string) => void;
}

const CustomerContractsTab: React.FC<CustomerContractsTabProps> = React.memo(({
    contracts, filteredContracts, contractFilter, setContractFilter,
    contractStatusCounts, formatCurrency, getStatusColor, onViewContract
}) => (
    <div className="space-y-4">
        {/* Contract Mini Stats */}
        <div className="flex flex-wrap gap-3">
            {[
                { label: 'Tất cả', key: 'all', count: contracts.length, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
                { label: 'Đang TH', key: 'Processing', count: contractStatusCounts['Processing'] || 0, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
                { label: 'Hoàn thành', key: 'Completed', count: contractStatusCounts['Completed'] || 0, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                { label: 'Chờ duyệt', key: 'Pending', count: contractStatusCounts['Pending'] || 0, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
            ].filter(f => f.key === 'all' || f.count > 0).map(f => (
                <button
                    key={f.key}
                    onClick={() => setContractFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${contractFilter === f.key
                        ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 ' + f.color
                        : f.color + ' opacity-70 hover:opacity-100'
                        }`}
                >
                    {f.label} ({f.count})
                </button>
            ))}
        </div>

        {/* Contracts Table */}
        {filteredContracts.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                            <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mã HĐ</th>
                            <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Đơn vị</th>
                            <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Ngày ký</th>
                            <th className="text-right py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Giá trị</th>
                            <th className="text-right py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Doanh thu</th>
                            <th className="text-center py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>
                            <th className="py-3 px-5 w-12"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredContracts.map((contract) => (
                            <tr
                                key={contract.id}
                                className="border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                                onClick={() => onViewContract(contract.id)}
                            >
                                <td className="py-3.5 px-5">
                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{contract.contractCode}</p>
                                </td>
                                <td className="py-3.5 px-5 hidden md:table-cell">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">{contract.unitId.toUpperCase()}</p>
                                </td>
                                <td className="py-3.5 px-5 hidden lg:table-cell">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {formatDate(contract.signedDate)}
                                    </p>
                                </td>
                                <td className="py-3.5 px-5 text-right">
                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatCurrency(contract.value)}</p>
                                </td>
                                <td className="py-3.5 px-5 text-right hidden sm:table-cell">
                                    <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">{formatCurrency(contract.actualRevenue)}</p>
                                </td>
                                <td className="py-3.5 px-5 text-center">
                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(contract.status)}`}>
                                        {contract.status}
                                    </span>
                                </td>
                                <td className="py-3.5 px-5">
                                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                        <ChevronRight size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="text-center py-12">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText size={24} className="text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                    {contractFilter === 'all' ? 'Chưa có hợp đồng' : `Không có HĐ ${contractFilter}`}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {contractFilter === 'all' ? 'Khách hàng này chưa có hợp đồng nào' : 'Thử chọn bộ lọc khác'}
                </p>
            </div>
        )}
    </div>
));

CustomerContractsTab.displayName = 'CustomerContractsTab';
export default CustomerContractsTab;
