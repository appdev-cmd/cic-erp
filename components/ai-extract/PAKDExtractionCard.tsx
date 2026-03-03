import React, { useState, useEffect } from 'react';
import { PAKDExtraction } from '../../services/aiExtractService';
import { Landmark, Save, Loader2 } from 'lucide-react';
import { ContractService } from '../../services/contractService';

export const PAKDExtractionCard = ({ data, onSave, saving }: { data: PAKDExtraction; onSave: (data: PAKDExtraction) => void; saving: boolean }) => {
    const [editedData, setEditedData] = useState<PAKDExtraction>(data);
    const [contracts, setContracts] = useState<{ id: string; title: string }[]>([]);

    useEffect(() => {
        ContractService.getAll().then(res => {
            setContracts(res.map(c => ({ id: c.id, title: c.title })));
        }).catch(console.error);
    }, []);

    const fmtMoney = (v?: number) => new Intl.NumberFormat('vi-VN').format(v || 0);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-amber-500" />
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Kết quả trích xuất PAKD</h4>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Hợp đồng:</span>
                    <select
                        value={editedData.contractNumber}
                        onChange={e => setEditedData({ ...editedData, contractNumber: e.target.value })}
                        className="text-xs font-bold px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 min-w-[200px]"
                    >
                        {!contracts.find(c => c.title === editedData.contractNumber) && (
                            <option value={editedData.contractNumber}>{editedData.contractNumber} (Trích xuất)</option>
                        )}
                        {contracts.map(c => (
                            <option key={c.id} value={c.title}>{c.title}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="p-4 space-y-5">
                {/* Financial Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">Doanh thu</div>
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">{fmtMoney(editedData.financials?.revenue)} ₫</div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">Đầu vào</div>
                        <div className="text-sm font-black text-amber-600 dark:text-amber-400">{fmtMoney(editedData.financials?.inputCost)} ₫</div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">Tổng chi phí</div>
                        <div className="text-sm font-black text-rose-600 dark:text-rose-400">{fmtMoney(editedData.financials?.totalCosts)} ₫</div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold mb-1">Lợi nhuận</div>
                        <div className="text-sm font-black text-violet-600 dark:text-violet-400">{fmtMoney(editedData.financials?.profit)} ₫</div>
                    </div>
                </div>

                {/* Additional Costs Breakdown */}
                <div className="bg-rose-50 dark:bg-rose-900/40 p-3 rounded-xl border border-rose-100 dark:border-rose-900/50">
                    <h5 className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider mb-2">Chi tiết các chi phí khác</h5>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                        <div>
                            <span className="block text-slate-500 dark:text-slate-400 text-[10px]">Thưởng hoàn thành</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">{fmtMoney(editedData.financials?.completionBonus)} ₫</span>
                        </div>
                        <div>
                            <span className="block text-slate-500 dark:text-slate-400 text-[10px]">Xúc tiến HĐ (DCS)</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">{fmtMoney(editedData.financials?.dealPromotion)} ₫</span>
                        </div>
                        <div>
                            <span className="block text-slate-500 dark:text-slate-400 text-[10px]">Ban lãnh đạo H/T</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">{fmtMoney(editedData.financials?.managementSupport)} ₫</span>
                        </div>
                        <div>
                            <span className="block text-slate-500 dark:text-slate-400 text-[10px]">Phí thuê chuyên gia</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">{fmtMoney(editedData.financials?.expertFee)} ₫</span>
                        </div>
                        <div>
                            <span className="block text-slate-500 dark:text-slate-400 text-[10px]">Phí thanh toán CT</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">{fmtMoney(editedData.financials?.documentFee)} ₫</span>
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <h5 className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Chi tiết SP/DV ({(editedData.lineItems || []).length})</h5>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">Tên SP/DV</th>
                                    <th className="px-3 py-2 font-semibold text-right">Giá vào</th>
                                    <th className="px-3 py-2 font-semibold text-right">Giá ra</th>
                                    <th className="px-3 py-2 font-semibold text-center">VAT (%)</th>
                                    <th className="px-3 py-2 font-semibold text-right">TT Đầu ra</th>
                                    <th className="px-3 py-2 font-semibold text-right">Chênh lệch</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(editedData.lineItems || []).map((item, idx) => {
                                    const vatRate = (item as any).vatRate ?? 0;
                                    const outputWithVat = item.totalPrice * (1 + vatRate / 100);
                                    const margin = outputWithVat - item.totalCost;
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                                                <div className="font-medium">{item.name || '(Trống)'}</div>
                                                <div className="text-[10px] text-slate-400">{item.supplier} • SL: {item.quantity} {item.unit}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium text-amber-600">{fmtMoney(item.totalCost)}</td>
                                            <td className="px-3 py-2 text-right font-medium text-emerald-600">{fmtMoney(item.totalPrice)}</td>
                                            <td className="px-3 py-2 text-center">
                                                <select
                                                    value={vatRate}
                                                    onChange={e => {
                                                        const newVat = Number(e.target.value);
                                                        setEditedData(prev => ({
                                                            ...prev,
                                                            lineItems: prev.lineItems.map((li, i) =>
                                                                i === idx ? { ...li, vatRate: newVat } as any : li
                                                            )
                                                        }));
                                                    }}
                                                    className="text-xs font-bold px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                                >
                                                    <option value={0}>0%</option>
                                                    <option value={8}>8%</option>
                                                    <option value={10}>10%</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(outputWithVat)}</td>
                                            <td className={`px-3 py-2 text-right font-bold ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmtMoney(margin)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => onSave(editedData)}
                    disabled={saving}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                    {saving ? (
                        <><Loader2 size={14} className="animate-spin" /> Đang cập nhật hợp đồng...</>
                    ) : (
                        <><Save size={14} /> Cập nhật PAKD vào hợp đồng</>
                    )}
                </button>
            </div>
        </div>
    );
};
