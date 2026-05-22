// Direct Cost Modal component - extracted from ContractForm
// Includes auto-calculation toggles for Thuế nhà thầu & Phí chuyển tiền
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Save, Calculator, ToggleLeft, ToggleRight } from 'lucide-react';
import { DirectCostDetail, LineItem } from '../../types';
import { ExchangeRateService } from '../../services/exchangeRateService';
import Modal from '../ui/Modal';
import CurrencyCalculator from '../ui/CurrencyCalculator';

interface DirectCostModalProps {
    isOpen: boolean;
    onClose: () => void;
    lineItem: LineItem | null;
    tempCostDetails: DirectCostDetail[];
    setTempCostDetails: React.Dispatch<React.SetStateAction<DirectCostDetail[]>>;
    onSave: () => void;
    formatVND: (val: number) => string;
    inputTotal?: number; // quantity * inputPrice — for auto-calc
    supplierShareCount?: number; // Số SP cùng NCC — để chia điện phí $10
    supplierTotalValue?: number; // Tổng giá trị SP cùng NCC
    onApplyToAllSupplierItems?: (tax: boolean, transferType: TransferFeeType, rate: number) => void;
}

// Auto-cost IDs (so we can identify and update them)
const AUTO_TAX_ID = '__auto_contractor_tax__';
const AUTO_TRANSFER_ID = '__auto_transfer_fee__';

type TransferFeeType = 'none' | 'domestic' | 'international';

const DirectCostModal: React.FC<DirectCostModalProps> = ({
    isOpen,
    onClose,
    lineItem,
    tempCostDetails,
    setTempCostDetails,
    onSave,
    formatVND,
    inputTotal = 0,
    supplierShareCount = 1,
    supplierTotalValue = 0,
    onApplyToAllSupplierItems,
}) => {
    // Auto-cost toggles
    const [contractorTax, setContractorTax] = useState(false);
    const [transferFeeType, setTransferFeeType] = useState<TransferFeeType>('none');
    const [usdRate, setUsdRate] = useState(0);
    const [loadingRate, setLoadingRate] = useState(false);
    const userEditedRate = useRef(false);

    // Name patterns to detect manual entries that match auto costs
    const TAX_NAMES = ['thuế nhà thầu', 'thue nha thau'];
    const TRANSFER_NAMES = ['phí chuyển tiền', 'phi chuyen tien'];
    const isAutoTaxEntry = (d: DirectCostDetail) => d.id === AUTO_TAX_ID || TAX_NAMES.some(n => d.name.toLowerCase().includes(n));
    const isAutoTransferEntry = (d: DirectCostDetail) => d.id === AUTO_TRANSFER_ID || TRANSFER_NAMES.some(n => d.name.toLowerCase().includes(n));

    // Initialize toggles from existing details (by ID or by name)
    useEffect(() => {
        if (isOpen) {
            userEditedRate.current = false;
            // Sync USD rate from lineItem's foreignCurrency (entered in CurrencyCalculator)
            if (lineItem?.foreignCurrency?.rate && lineItem.foreignCurrency.currency === 'USD') {
                setUsdRate(lineItem.foreignCurrency.rate);
                userEditedRate.current = true; // Prevent API from overwriting
            }
            const hasTax = tempCostDetails.some(d => isAutoTaxEntry(d));
            const transferEntry = tempCostDetails.find(d => isAutoTransferEntry(d));
            setContractorTax(hasTax);
            if (transferEntry) {
                setTransferFeeType(transferEntry.name.includes('nước ngoài') || transferEntry.name.includes('international') ? 'international' : 'domestic');
            } else {
                setTransferFeeType('none');
            }

            // Migrate old manual entries to auto IDs (remove old, auto recalc will add new)
            const hasOldManualTax = tempCostDetails.some(d => d.id !== AUTO_TAX_ID && TAX_NAMES.some(n => d.name.toLowerCase().includes(n)));
            const hasOldManualTransfer = tempCostDetails.some(d => d.id !== AUTO_TRANSFER_ID && TRANSFER_NAMES.some(n => d.name.toLowerCase().includes(n)));
            if (hasOldManualTax || hasOldManualTransfer) {
                // Clean up old manual entries, updateAutoCosts will re-add with auto IDs
                let cleaned = tempCostDetails.filter(d => !isAutoTaxEntry(d) && !isAutoTransferEntry(d));
                const detectedTransferType = transferEntry
                    ? (transferEntry.name.includes('nước ngoài') || transferEntry.name.includes('international') ? 'international' as TransferFeeType : 'domestic' as TransferFeeType)
                    : 'none' as TransferFeeType;
                const updated = updateAutoCosts(cleaned, hasTax, detectedTransferType, inputTotal, usdRate, supplierShareCount, supplierTotalValue);
                setTempCostDetails(updated);
            }
        }
    }, [isOpen]);

    // Fetch USD rate for international transfer
    useEffect(() => {
        if (transferFeeType === 'international' && usdRate === 0) {
            setLoadingRate(true);
            ExchangeRateService.getRate('USD').then(rate => {
                // Only set API rate if user hasn't manually edited
                if (!userEditedRate.current) {
                    setUsdRate(rate);
                }
                setLoadingRate(false);
            }).catch(() => setLoadingRate(false));
        }
    }, [transferFeeType]);

    // Calculate auto costs
    const calcContractorTax = useCallback((total: number) => {
        // Thuế nhà thầu = Thành tiền giá đầu vào / 0.9 * 0.1
        return Math.round(total / 0.9 * 0.1);
    }, []);

    const calcTransferFee = useCallback((total: number, type: TransferFeeType, rate: number, shareCount: number = 1, supplierTotalVal: number = 0) => {
        if (type === 'domestic') {
            // Trong nước mới: tổng phí = Max(supplierTotalValue * 0.07%, 22000)
            // Phí của SP = tổng phí * (total / supplierTotalValue)
            const stv = Math.max(supplierTotalVal, total, 1);
            const totalSupplierFee = Math.max(Math.round(stv * 0.0007), 22000);
            return Math.round(totalSupplierFee * (total / stv));
        }
        if (type === 'international') {
            // Nước ngoài mới: Phí = (total * 0.5%) + (10 * rate * (total / supplierTotalValue))
            const stv = Math.max(supplierTotalVal, total, 1);
            const percentPart = total * 0.005;
            const flatPart = 10 * rate * (total / stv);
            return Math.round(percentPart + flatPart);
        }
        return 0;
    }, []);

    // Update auto-cost entries when toggles or inputTotal change
    const updateAutoCosts = useCallback((
        details: DirectCostDetail[],
        tax: boolean,
        transfer: TransferFeeType,
        total: number,
        rate: number,
        shareCount: number = 1,
        supplierTotalVal: number = 0
    ) => {
        // Filter out ALL auto entries — both by ID and by name patterns
        let newDetails = details.filter(d => !isAutoTaxEntry(d) && !isAutoTransferEntry(d));

        if (tax) {
            const taxFormula = `${total}/0.9*0.1`;
            newDetails = [
                { id: AUTO_TAX_ID, name: 'Thuế nhà thầu', amount: calcContractorTax(total), formula: taxFormula },
                ...newDetails,
            ];
        }

        if (transfer !== 'none') {
            const sc = Math.max(shareCount, 1);
            const fee = calcTransferFee(total, transfer, rate, sc, supplierTotalVal);
            const label = transfer === 'domestic'
                ? 'Phí chuyển tiền trong nước'
                : 'Phí chuyển tiền nước ngoài';
            let transferFormula: string;
            if (transfer === 'domestic') {
                const stv = Math.max(supplierTotalVal, total, 1);
                transferFormula = stv > total
                    ? `Max(${stv}*0.07%,22k)*(${total}/${stv})`
                    : `Max(${total}*0.07%,22k)`;
            } else {
                const stv = Math.max(supplierTotalVal, total, 1);
                transferFormula = stv > total
                    ? `${total}*0.5%+10*${rate}*(${total}/${stv})`
                    : `${total}*0.5%+10*${rate}`;
            }
            // Insert after tax if present, else at start
            const insertIdx = newDetails.findIndex(d => d.id === AUTO_TAX_ID);
            const transferEntry: DirectCostDetail = { id: AUTO_TRANSFER_ID, name: label, amount: fee, formula: transferFormula };
            if (insertIdx >= 0) {
                newDetails.splice(insertIdx + 1, 0, transferEntry);
            } else {
                newDetails = [transferEntry, ...newDetails];
            }
        }

        return newDetails;
    }, [calcContractorTax, calcTransferFee]);

    // Toggle contractor tax
    const handleToggleTax = () => {
        const newVal = !contractorTax;
        setContractorTax(newVal);
        const updated = updateAutoCosts(tempCostDetails, newVal, transferFeeType, inputTotal, usdRate, supplierShareCount, supplierTotalValue);
        setTempCostDetails(updated);
    };

    // Change transfer fee type
    const handleTransferChange = (type: TransferFeeType) => {
        setTransferFeeType(type);
        const updated = updateAutoCosts(tempCostDetails, contractorTax, type, inputTotal, usdRate, supplierShareCount, supplierTotalValue);
        setTempCostDetails(updated);
    };

    // Recalculate auto costs when inputTotal, usdRate, or supplierShareCount changes
    useEffect(() => {
        if (!isOpen) return;
        if (!contractorTax && transferFeeType === 'none') return;

        const updated = updateAutoCosts(tempCostDetails, contractorTax, transferFeeType, inputTotal, usdRate, supplierShareCount, supplierTotalValue);
        // Only update if amounts differ to avoid infinite loop
        const oldAutoAmounts = tempCostDetails.filter(d => d.id === AUTO_TAX_ID || d.id === AUTO_TRANSFER_ID).map(d => d.amount).join(',');
        const newAutoAmounts = updated.filter(d => d.id === AUTO_TAX_ID || d.id === AUTO_TRANSFER_ID).map(d => d.amount).join(',');
        if (oldAutoAmounts !== newAutoAmounts) {
            setTempCostDetails(updated);
        }
    }, [inputTotal, usdRate, supplierShareCount, supplierTotalValue, isOpen]);

    // Manual (non-auto) details
    const manualDetails = tempCostDetails.filter(d => !isAutoTaxEntry(d) && !isAutoTransferEntry(d));
    const autoDetails = tempCostDetails.filter(d => d.id === AUTO_TAX_ID || d.id === AUTO_TRANSFER_ID);
    const totalCost = tempCostDetails.reduce((acc, item) => acc + item.amount, 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Chi tiết Chi phí Trực tiếp"
            size="lg"
        >
            <div className="space-y-4">
                {/* Product info */}
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                        {lineItem?.name
                            ? `Sản phẩm: ${lineItem.name}`
                            : 'Chi tiết chi phí'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Thành tiền đầu vào: <span className="font-black text-cyan-600 dark:text-cyan-400">{formatVND(inputTotal)}</span>
                        {lineItem?.supplier && (
                            <span className="ml-3">
                                NCC: <span className="font-bold text-slate-700 dark:text-slate-200">{lineItem.supplier}</span>
                                {supplierShareCount > 1 && (
                                    <span className="ml-1 text-amber-600 dark:text-amber-400 font-bold">({supplierShareCount} SP cùng NCC)</span>
                                )}
                            </span>
                        )}
                    </p>
                </div>

                {/* ── Auto-calculation toggles ── */}
                <div className="bg-amber-50/60 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200/60 dark:border-amber-800/40 space-y-3">
                    <h5 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Calculator size={12} /> Chi phí tính tự động
                    </h5>

                    {/* Thuế nhà thầu */}
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <button
                                onClick={handleToggleTax}
                                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                {contractorTax
                                    ? <ToggleRight size={20} className="text-indigo-600 dark:text-indigo-400" />
                                    : <ToggleLeft size={20} className="text-slate-300 dark:text-slate-600" />
                                }
                                Thuế nhà thầu
                            </button>
                            <p className="text-[10px] text-slate-400 ml-7 mt-0.5">
                                = TT giá vào ÷ 0.9 × 0.1
                            </p>
                        </div>
                        {contractorTax && (
                            <span className="text-sm font-black text-rose-500">
                                {formatVND(calcContractorTax(inputTotal))}
                            </span>
                        )}
                    </div>

                    {/* Phí chuyển tiền */}
                    <div className="border-t border-amber-200/50 dark:border-amber-800/30 pt-3">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Phí chuyển tiền</p>
                        <div className="flex flex-wrap gap-2">
                            {([
                                { value: 'none' as TransferFeeType, label: 'Không có' },
                                { value: 'domestic' as TransferFeeType, label: '🇻🇳 Trong nước' },
                                { value: 'international' as TransferFeeType, label: '🌍 Nước ngoài' },
                            ]).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleTransferChange(opt.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                        transferFeeType === opt.value
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none'
                                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {lineItem?.supplier && onApplyToAllSupplierItems && (
                            <button
                                type="button"
                                onClick={() => onApplyToAllSupplierItems(contractorTax, transferFeeType, usdRate)}
                                className="mt-3 w-full px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200/60 dark:border-indigo-800/40 transition-all flex items-center justify-center gap-1.5"
                            >
                                🔄 Áp dụng cấu hình phí này cho toàn bộ SP cùng NCC
                            </button>
                        )}
                        {transferFeeType !== 'none' && (
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 mr-2">
                                        <p className="text-[10px] text-slate-400 leading-relaxed">
                                            {transferFeeType === 'domestic' ? (
                                                supplierTotalValue > inputTotal ? (
                                                    <>= Phân bổ từ Tổng phí NCC (Tổng phí = Max({formatVND(supplierTotalValue)} × 0.07%, 22.000₫)) theo tỷ trọng {((inputTotal / Math.max(supplierTotalValue, 1)) * 100).toFixed(1)}%</>
                                                ) : (
                                                    '= TT giá vào × 0.07% (tối thiểu 22.000₫)'
                                                )
                                            ) : (
                                                supplierTotalValue > inputTotal ? (
                                                    <>= (TT giá vào × 0.5%) + (10 × tỷ giá USD × Tỷ trọng {((inputTotal / Math.max(supplierTotalValue, 1)) * 100).toFixed(1)}%)</>
                                                ) : (
                                                    '= (TT giá vào × 0.5%) + (10 × tỷ giá USD)'
                                                )
                                            )}
                                        </p>
                                        {supplierTotalValue > inputTotal && (
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                                                💡 Phí chuyển tiền và Điện phí được phân bổ theo tỷ trọng giá trị sản phẩm.
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-sm font-black text-rose-500 whitespace-nowrap">
                                        {formatVND(calcTransferFee(inputTotal, transferFeeType, usdRate, supplierShareCount, supplierTotalValue))}
                                    </span>
                                </div>
                                {transferFeeType === 'international' && (
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Tỷ giá USD:</span>
                                        <input
                                            type="text"
                                            value={usdRate ? formatVND(usdRate) : ''}
                                            placeholder={loadingRate ? 'Đang tải...' : 'Nhập tỷ giá'}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/\./g, '');
                                                if (!/^\d*$/.test(raw)) return;
                                                const newRate = Number(raw);
                                                userEditedRate.current = true;
                                                setUsdRate(newRate);
                                            }}
                                            className="flex-1 bg-transparent text-sm font-bold text-right outline-none text-amber-600 dark:text-amber-400 placeholder-slate-300 dark:placeholder-slate-600"
                                        />
                                        <span className="text-[10px] text-slate-400">₫/USD</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Auto-generated entries (editable with CurrencyCalculator) ── */}
                {autoDetails.length > 0 && (
                    <div className="space-y-1.5">
                        {autoDetails.map(detail => {
                            const realIndex = tempCostDetails.findIndex(d => d.id === detail.id);
                            return (
                                <div key={detail.id} className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800/40">
                                    <Calculator size={14} className="text-indigo-400 flex-shrink-0" />
                                    <span className="flex-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">{detail.name}</span>
                                    <div className="w-44">
                                        <CurrencyCalculator
                                            value={detail.amount || 0}
                                            onChange={(vnd) => {
                                                setTempCostDetails(prev => {
                                                    const newDetails = [...prev];
                                                    newDetails[realIndex] = { ...newDetails[realIndex], amount: vnd };
                                                    return newDetails;
                                                });
                                            }}
                                            formula={detail.formula}
                                            onFormulaChange={(f) => {
                                                setTempCostDetails(prev => {
                                                    const newDetails = [...prev];
                                                    newDetails[realIndex] = { ...newDetails[realIndex], formula: f };
                                                    return newDetails;
                                                });
                                            }}
                                            formatVND={formatVND}
                                            inputClassName="w-full bg-white/60 dark:bg-slate-800/60 rounded-md px-2 py-1 text-sm font-bold text-right outline-none focus:ring-1 focus:ring-indigo-500 text-rose-500 pr-6"
                                            textColorClass="text-rose-500"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Manual cost entries ── */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {manualDetails.map((detail) => {
                        const realIndex = tempCostDetails.findIndex(d => d.id === detail.id);
                        return (
                            <div key={detail.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                <input
                                    type="text"
                                    placeholder="Tên chi phí (VD: Tiếp khách, Vận chuyển...)"
                                    value={detail.name}
                                    onChange={(e) => {
                                        setTempCostDetails(prev => {
                                            const newDetails = [...prev];
                                            newDetails[realIndex].name = e.target.value;
                                            return newDetails;
                                        });
                                    }}
                                    className="flex-1 bg-transparent px-3 py-2 text-sm font-medium outline-none border-b border-transparent focus:border-indigo-500 transition-colors text-slate-700 dark:text-slate-200"
                                />
                                <div className="w-40">
                                    <CurrencyCalculator
                                        value={detail.amount || 0}
                                        onChange={(vnd) => {
                                            setTempCostDetails(prev => {
                                                const newDetails = [...prev];
                                                newDetails[realIndex] = { ...newDetails[realIndex], amount: vnd };
                                                return newDetails;
                                            });
                                        }}
                                        formula={detail.formula}
                                        onFormulaChange={(f) => {
                                            setTempCostDetails(prev => {
                                                const newDetails = [...prev];
                                                newDetails[realIndex] = { ...newDetails[realIndex], formula: f };
                                                return newDetails;
                                            });
                                        }}
                                        formatVND={formatVND}
                                        inputClassName="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-right outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 pr-7"
                                        textColorClass="text-slate-700 dark:text-slate-200"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        const newDetails = tempCostDetails.filter(d => d.id !== detail.id);
                                        setTempCostDetails(newDetails);
                                    }}
                                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={() => {
                        setTempCostDetails([...tempCostDetails, { id: Date.now().toString(), name: '', amount: 0 }]);
                    }}
                    className="w-full py-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 font-bold text-sm hover:border-indigo-500 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> Thêm khoản chi phí khác
                </button>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-bold">Tổng chi phí</p>
                        <p className="text-xl font-black text-rose-500">
                            {formatVND(totalCost)}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={onSave}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
                        >
                            <Save size={16} /> Lưu cập nhật
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default React.memo(DirectCostModal);
