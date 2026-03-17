// Direct Cost Modal component - extracted from ContractForm
// Includes auto-calculation toggles for Thuế nhà thầu & Phí chuyển tiền
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Save, Calculator, ToggleLeft, ToggleRight, Equal } from 'lucide-react';
import { DirectCostDetail, LineItem } from '../../types';
import { ExchangeRateService } from '../../services/exchangeRateService';
import { safeEval, isFormula } from '../../utils/formulaEval';
import Modal from '../ui/Modal';

interface DirectCostModalProps {
    isOpen: boolean;
    onClose: () => void;
    lineItem: LineItem | null;
    tempCostDetails: DirectCostDetail[];
    setTempCostDetails: (details: DirectCostDetail[]) => void;
    onSave: () => void;
    formatVND: (val: number) => string;
    inputTotal?: number; // quantity * inputPrice — for auto-calc
    supplierShareCount?: number; // Số SP cùng NCC — để chia điện phí $10
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
                const updated = updateAutoCosts(cleaned, hasTax, detectedTransferType, inputTotal, usdRate, supplierShareCount);
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

    const calcTransferFee = useCallback((total: number, type: TransferFeeType, rate: number, shareCount: number = 1) => {
        if (type === 'domestic') {
            // Trong nước: total * 0.07%, min 22,000
            return Math.max(Math.round(total * 0.0007), 22000);
        }
        if (type === 'international') {
            // Nước ngoài: (total * 0.5%) + (10 * tỷ giá USD / số SP cùng NCC)
            // Điện phí $10 chỉ tính 1 lần cho mỗi NCC → chia đều cho các SP cùng NCC
            const sc = Math.max(shareCount, 1);
            return Math.round(total * 0.005 + 10 * rate / sc);
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
        shareCount: number = 1
    ) => {
        // Filter out ALL auto entries — both by ID and by name patterns
        let newDetails = details.filter(d => !isAutoTaxEntry(d) && !isAutoTransferEntry(d));

        if (tax) {
            newDetails = [
                { id: AUTO_TAX_ID, name: 'Thuế nhà thầu', amount: calcContractorTax(total) },
                ...newDetails,
            ];
        }

        if (transfer !== 'none') {
            const fee = calcTransferFee(total, transfer, rate, shareCount);
            const label = transfer === 'domestic'
                ? 'Phí chuyển tiền trong nước'
                : 'Phí chuyển tiền nước ngoài';
            // Insert after tax if present, else at start
            const insertIdx = newDetails.findIndex(d => d.id === AUTO_TAX_ID);
            const transferEntry = { id: AUTO_TRANSFER_ID, name: label, amount: fee };
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
        const updated = updateAutoCosts(tempCostDetails, newVal, transferFeeType, inputTotal, usdRate, supplierShareCount);
        setTempCostDetails(updated);
    };

    // Change transfer fee type
    const handleTransferChange = (type: TransferFeeType) => {
        setTransferFeeType(type);
        const updated = updateAutoCosts(tempCostDetails, contractorTax, type, inputTotal, usdRate, supplierShareCount);
        setTempCostDetails(updated);
    };

    // Recalculate auto costs when inputTotal changes
    useEffect(() => {
        if (!isOpen) return;
        if (!contractorTax && transferFeeType === 'none') return;
        const updated = updateAutoCosts(tempCostDetails, contractorTax, transferFeeType, inputTotal, usdRate, supplierShareCount);
        // Only update if amounts differ to avoid infinite loop
        const oldAutoAmounts = tempCostDetails.filter(d => d.id === AUTO_TAX_ID || d.id === AUTO_TRANSFER_ID).map(d => d.amount).join(',');
        const newAutoAmounts = updated.filter(d => d.id === AUTO_TAX_ID || d.id === AUTO_TRANSFER_ID).map(d => d.amount).join(',');
        if (oldAutoAmounts !== newAutoAmounts) {
            setTempCostDetails(updated);
        }
    }, [inputTotal, usdRate, supplierShareCount]);

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
                        {transferFeeType !== 'none' && (
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed">
                                            {transferFeeType === 'domestic'
                                                ? '= TT giá vào × 0.07% (tối thiểu 22.000₫)'
                                                : <>= (TT giá vào × 0.5%) + (10 × tỷ giá USD{supplierShareCount > 1 ? ` ÷ ${supplierShareCount}` : ''})</>
                                            }
                                        </p>
                                        {transferFeeType === 'international' && supplierShareCount > 1 && (
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                                                💡 Điện phí $10 chia cho {supplierShareCount} SP cùng NCC
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-sm font-black text-rose-500">
                                        {formatVND(calcTransferFee(inputTotal, transferFeeType, usdRate, supplierShareCount))}
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

                {/* ── Auto-generated entries (read-only display) ── */}
                {autoDetails.length > 0 && (
                    <div className="space-y-1.5">
                        {autoDetails.map(detail => (
                            <div key={detail.id} className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800/40">
                                <Calculator size={14} className="text-indigo-400 flex-shrink-0" />
                                <span className="flex-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">{detail.name}</span>
                                <span className="text-sm font-black text-rose-500">{formatVND(detail.amount)}</span>
                            </div>
                        ))}
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
                                        const newDetails = [...tempCostDetails];
                                        newDetails[realIndex].name = e.target.value;
                                        setTempCostDetails(newDetails);
                                    }}
                                    className="flex-1 bg-transparent px-3 py-2 text-sm font-medium outline-none border-b border-transparent focus:border-indigo-500 transition-colors text-slate-700 dark:text-slate-200"
                                />
                                <div className="w-40 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₫</span>
                                    <input
                                        type="text"
                                        value={detail.formula ?? (detail.amount ? formatVND(detail.amount) : '0')}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            const newDetails = [...tempCostDetails];
                                            // Store formula expression
                                            newDetails[realIndex].formula = raw;
                                            // Try to evaluate
                                            const plainNum = raw.replace(/\./g, '');
                                            if (/^\d*$/.test(plainNum)) {
                                                // Plain number (with dots as thousand sep) — clear formula
                                                newDetails[realIndex].amount = Number(plainNum);
                                                newDetails[realIndex].formula = undefined;
                                            } else {
                                                // Formula expression — evaluate and keep formula
                                                const result = safeEval(raw);
                                                if (!isNaN(result)) {
                                                    newDetails[realIndex].amount = Math.round(result);
                                                }
                                            }
                                            setTempCostDetails(newDetails);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                (e.target as HTMLInputElement).blur();
                                            }
                                        }}
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 pl-6 py-2 text-sm font-bold text-right outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-200 font-mono"
                                        placeholder="VD: 1000*70%"
                                    />
                                    {/* Formula result preview */}
                                    {detail.formula && isFormula(detail.formula) && (() => {
                                        const result = safeEval(detail.formula);
                                        return (
                                            <div className="absolute -bottom-5 right-0 flex items-center gap-1 text-[10px]">
                                                <Equal size={10} className="text-slate-400" />
                                                {!isNaN(result) ? (
                                                    <span className="font-bold text-emerald-500">{formatVND(Math.round(result))}</span>
                                                ) : (
                                                    <span className="font-bold text-rose-500">Lỗi</span>
                                                )}
                                            </div>
                                        );
                                    })()}
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
