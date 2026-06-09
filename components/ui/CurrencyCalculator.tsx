/**
 * CurrencyCalculator — Popover calculator cho giá đầu vào/ra.
 *
 * Features:
 * - Nhập công thức toán học: 2000*(222+333), 1500*25480, ...
 * - Tab VND: gõ công thức → tính ra kết quả VND
 * - Tab Ngoại tệ: gõ số ngoại tệ (hoặc công thức) + chọn loại tiền + auto-fill tỷ giá VCB
 * - Cho phép sửa tỷ giá tùy ý và lưu theo tỷ giá đã sửa
 * - Lưu foreignCurrency info vào LineItem
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, X, RefreshCw, Globe, ChevronDown, ArrowRight, Equal, Lock } from 'lucide-react';
import { ExchangeRateService, ExchangeRate, COMMON_CURRENCIES } from '../../services/exchangeRateService';

import { safeEval } from '../../utils/formulaEval';

interface CurrencyCalculatorProps {
    value: number;
    onChange: (vndValue: number) => void;
    onForeignCurrencyChange?: (info: { amount: number; rate: number; currency: string; formula?: string; isCustomRate?: boolean } | undefined) => void;
    foreignCurrency?: { amount: number; rate: number; currency: string; formula?: string; isCustomRate?: boolean };
    formatVND: (val: number) => string;
    placeholder?: string;
    inputClassName?: string;
    textColorClass?: string;
    /** VND formula persistence */
    formula?: string;
    onFormulaChange?: (formula: string | undefined) => void;
}

const CurrencyCalculator: React.FC<CurrencyCalculatorProps> = ({
    value,
    onChange,
    onForeignCurrencyChange,
    foreignCurrency,
    formatVND,
    placeholder = '0',
    inputClassName,
    textColorClass = 'text-slate-600 dark:text-slate-300',
    formula: existingFormula,
    onFormulaChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'vnd' | 'foreign'>(foreignCurrency ? 'foreign' : 'vnd');
    const [selectedCurrency, setSelectedCurrency] = useState(foreignCurrency?.currency || 'USD');
    const [foreignExpr, setForeignExpr] = useState(foreignCurrency?.formula || foreignCurrency?.amount?.toString() || '');
    const [vndExpr, setVndExpr] = useState('');
    const [customRate, setCustomRate] = useState(foreignCurrency?.rate?.toString() || '');
    const [isCustomRate, setIsCustomRate] = useState(foreignCurrency?.isCustomRate || false);
    const [rateEdited, setRateEdited] = useState(foreignCurrency?.isCustomRate || false); // track if user manually edited rate
    const [rates, setRates] = useState<ExchangeRate[]>([]);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesUpdatedAt, setRatesUpdatedAt] = useState('');
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    // Re-calculate popover position when open
    const updatePosition = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const popoverWidth = 360;
            // Chiều cao tự nhiên tối đa ở chế độ Ngoại tệ là khoảng 580px
            const popoverHeight = 580; 
            const gap = 8;
            const viewportH = window.innerHeight;
            const viewportW = window.innerWidth;

            let top: number;

            // 1. Thử hiển thị phía dưới trigger trước
            if (rect.bottom + gap + popoverHeight <= viewportH - 16) {
                top = rect.bottom + gap;
            } 
            // 2. Nếu không đủ chỗ phía dưới, thử hiển thị phía trên trigger
            else if (rect.top - gap - popoverHeight >= 16) {
                top = rect.top - gap - popoverHeight;
            } 
            // 3. Nếu màn hình nhỏ không vừa cả 2, ghim top trong khoảng an toàn cách mép dưới ít nhất 16px
            else {
                top = Math.max(16, viewportH - popoverHeight - 16);
            }

            // Align right edge với trigger, clamp trong viewport
            const left = Math.max(8, Math.min(rect.right - popoverWidth, viewportW - popoverWidth - 8));

            setPopoverPos({ top, left });
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen, updatePosition]);

    // Evaluate expressions
    const vndResult = safeEval(vndExpr);
    const foreignResult = safeEval(foreignExpr);
    const rateValue = parseFloat(customRate.replace(/,/g, '.')) || 0;
    const computedVND = Math.round((isNaN(foreignResult) ? 0 : foreignResult) * rateValue);

    // Load rates when popover opens in foreign mode
    const loadRates = useCallback(async () => {
        setRatesLoading(true);
        try {
            const { rates: fetchedRates, updatedAt } = await ExchangeRateService.getRates();
            setRates(ExchangeRateService.sortRates(fetchedRates));
            setRatesUpdatedAt(updatedAt);
            // Auto-fill rate only if user hasn't manually edited it AND it is not custom
            if (!isCustomRate && !rateEdited) {
                const rate = fetchedRates.find(r => r.currency === selectedCurrency);
                if (rate) {
                    setCustomRate(rate.sell.toString());
                }
            }
        } catch (e) {
            console.warn('[CurrencyCalculator] Failed to load rates:', e);
        } finally {
            setRatesLoading(false);
        }
    }, [selectedCurrency, rateEdited, isCustomRate]);

    useEffect(() => {
        if (isOpen && mode === 'foreign') {
            loadRates();
        }
    }, [isOpen, mode]);

    // Update rate when currency changes (only if rate is not custom/edited)
    useEffect(() => {
        if (rates.length > 0 && !isCustomRate && !rateEdited) {
            const rate = rates.find(r => r.currency === selectedCurrency);
            if (rate) {
                setCustomRate(rate.sell.toString());
            }
        }
        // Reset rateEdited when currency changes so new VCB rate loads
        if (!isCustomRate) {
            setRateEdited(false);
        }
    }, [selectedCurrency]);

    // Sync state from foreignCurrency when it changes or when popover opens
    useEffect(() => {
        if (isOpen) {
            if (foreignCurrency) {
                setSelectedCurrency(foreignCurrency.currency || 'USD');
                setForeignExpr(foreignCurrency.formula || foreignCurrency.amount?.toString() || '');
                setCustomRate(foreignCurrency.rate?.toString() || '');
                setIsCustomRate(foreignCurrency.isCustomRate || false);
                setRateEdited(foreignCurrency.isCustomRate || false);
            } else {
                // Default values if no foreign currency info is saved yet
                setSelectedCurrency('USD');
                setForeignExpr('');
                setCustomRate('');
                setIsCustomRate(false);
                setRateEdited(false);
            }
        }
    }, [isOpen, foreignCurrency]);

    // Sync vndExpr when popover opens
    useEffect(() => {
        if (isOpen && mode === 'vnd') {
            // Prefer existing formula, fallback to raw value
            setVndExpr(existingFormula || (value ? value.toString() : ''));
        }
    }, [isOpen]);

    // Close popover on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [isOpen]);

    // Check if expression contains operators (is a formula)
    const isFormula = (expr: string) => /[+\-*/(%)]+/.test(expr);

    const handleVNDApply = () => {
        if (!isNaN(vndResult)) {
            onChange(Math.round(vndResult));
            // Save formula if it's an expression (has operators)
            onFormulaChange?.(isFormula(vndExpr) ? vndExpr : undefined);
        }
        setIsOpen(false);
    };

    const handleForeignApply = () => {
        const amt = isNaN(foreignResult) ? 0 : foreignResult;
        const vnd = Math.round(amt * rateValue);
        const formula = isFormula(foreignExpr) ? foreignExpr : undefined;
        onChange(vnd);
        onForeignCurrencyChange?.({
            amount: amt,
            rate: rateValue,
            currency: selectedCurrency,
            formula,
            isCustomRate: isCustomRate
        });
        onFormulaChange?.(undefined); // Clear VND formula when price is set via foreign currency
        setIsOpen(false);
    };

    const handleClearForeign = () => {
        setForeignExpr('');
        setCustomRate('');
        setRateEdited(false);
        setMode('vnd');
        onForeignCurrencyChange?.(undefined);
        setIsOpen(false);
    };

    // Direct trigger input (simplified VND only)
    const handleTriggerInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\./g, '');
        if (!/^\d*$/.test(raw)) return;
        onChange(Number(raw));
    };

    // Handle Enter key in expressions
    const handleKeyDown = (e: React.KeyboardEvent, applyFn: () => void) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyFn();
        }
    };

    return (
        <div className="relative" ref={triggerRef}>
            {/* Trigger input */}
            <div className="relative group/calc">
                <input
                    type="text"
                    value={value ? formatVND(value) : placeholder}
                    onChange={handleTriggerInput}
                    onClick={() => !isOpen && setIsOpen(true)}
                    className={inputClassName || `w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-bold ${textColorClass} text-right outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 transition-colors pr-7`}
                />
                <button
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-indigo-500 transition-colors"
                    title="Calculator / Ngoại tệ"
                >
                    <Calculator size={14} />
                </button>
                {foreignCurrency && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[7px] font-black text-amber-900 border border-white dark:border-slate-800">
                        💱
                    </div>
                )}
            </div>

            {/* Popover via Portal */}
            {isOpen && createPortal(
                <div
                    ref={popoverRef}
                    style={{ 
                        position: 'fixed', 
                        top: popoverPos.top, 
                        left: Math.max(8, popoverPos.left), 
                        zIndex: 9999,
                        // Bỏ height cố định để tự co giãn theo chiều cao tự nhiên của VND/Foreign mode
                        maxHeight: `calc(100vh - ${popoverPos.top}px - 16px)`,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                    className="w-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Calculator size={16} className="text-indigo-500" />
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Tính giá</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Mode tabs */}
                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                        <button
                            onClick={() => setMode('vnd')}
                            className={`flex-1 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                                mode === 'vnd'
                                    ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                        >
                            VND trực tiếp
                        </button>
                        <button
                            onClick={() => setMode('foreign')}
                            className={`flex-1 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                                mode === 'foreign'
                                    ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-900/20'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                        >
                            <Globe size={12} /> Ngoại tệ
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                        {mode === 'vnd' ? (
                            /* ─── VND mode with formula support ─── */
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                    Công thức / Giá trị (VND)
                                    <span className="text-[8px] font-medium text-slate-400/70 normal-case">hỗ trợ +, -, *, /, (), %</span>
                                </label>
                                <input
                                    type="text"
                                    value={vndExpr}
                                    onChange={(e) => setVndExpr(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, handleVNDApply)}
                                    placeholder="VD: 2000*(222+333) hoặc 1000*70%"
                                    autoFocus
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-mono font-bold text-right text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                                />
                                {/* Result preview */}
                                {vndExpr && (
                                    <div className={`flex items-center justify-end gap-2 px-1 py-1 rounded ${isFormula(vndExpr) ? '' : ''}`}>
                                        {isFormula(vndExpr) && (
                                            <Equal size={12} className="text-slate-400" />
                                        )}
                                        {!isNaN(vndResult) ? (
                                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                {formatVND(Math.round(vndResult))} ₫
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-rose-500">Công thức không hợp lệ</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ─── Foreign currency mode ─── */
                            <div className="space-y-3">
                                {/* Currency selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Loại tiền</label>
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-left flex items-center justify-between hover:border-indigo-400 transition-colors"
                                        >
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                {selectedCurrency}
                                                <span className="text-[10px] ml-2 text-slate-400 font-medium">
                                                    {rates.find(r => r.currency === selectedCurrency)?.name || ''}
                                                </span>
                                            </span>
                                            <ChevronDown size={14} className="text-slate-400" />
                                        </button>
                                        {showCurrencyDropdown && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                                {(rates.length > 0 ? rates : COMMON_CURRENCIES.map(c => ({ currency: c, name: c, buy: 0, transfer: 0, sell: 0 }))).map(rate => (
                                                    <button
                                                        key={rate.currency}
                                                        onClick={() => {
                                                            setSelectedCurrency(rate.currency);
                                                            setShowCurrencyDropdown(false);
                                                        }}
                                                        className={`w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs transition-colors ${
                                                            selectedCurrency === rate.currency ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                                                        }`}
                                                    >
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">{rate.currency}</span>
                                                        <span className="text-slate-400">{rate.sell ? formatVND(rate.sell) : '—'}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Amount expression */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                        Số tiền ngoại tệ
                                        <span className="text-[8px] font-medium text-slate-400/70 normal-case">hỗ trợ công thức</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={foreignExpr}
                                        onChange={(e) => setForeignExpr(e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, handleForeignApply)}
                                        placeholder="VD: 1500 hoặc 500+1000 hoặc 1000*70%"
                                        autoFocus
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-mono font-bold text-right text-cyan-600 dark:text-cyan-400 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                                    />
                                    {foreignExpr && isFormula(foreignExpr) && (
                                        <div className="flex items-center justify-end gap-1.5 text-[10px]">
                                            <Equal size={10} className="text-slate-400" />
                                            {!isNaN(foreignResult) ? (
                                                <span className="font-bold text-cyan-500">
                                                    {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(foreignResult)} {selectedCurrency}
                                                </span>
                                            ) : (
                                                <span className="font-bold text-rose-500">Lỗi</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Exchange rate — editable */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                            Tỷ giá
                                            {isCustomRate && (
                                                <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                                    <Lock size={8} /> Đã chốt
                                                </span>
                                            )}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => { setIsCustomRate(false); setRateEdited(false); loadRates(); }}
                                            disabled={ratesLoading}
                                            className="text-[9px] text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
                                            title="Lấy tỷ giá VCB mới nhất"
                                        >
                                            <RefreshCw size={10} className={ratesLoading ? 'animate-spin' : ''} />
                                            {ratesLoading ? 'Đang tải...' : 'VCB bán ra'}
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={customRate}
                                        onChange={(e) => {
                                            setCustomRate(e.target.value);
                                            setRateEdited(true);
                                            setIsCustomRate(true); // Tự động chốt khi tự sửa
                                        }}
                                        placeholder="VD: 25480"
                                        className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-base font-black text-right outline-none focus:ring-2 transition-colors ${
                                            isCustomRate
                                                ? 'border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400 focus:border-amber-400 focus:ring-amber-400/20'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:border-indigo-400 focus:ring-indigo-400/20'
                                        }`}
                                    />
                                    {ratesUpdatedAt && !isCustomRate && (
                                        <p className="text-[8px] text-slate-400 text-right">
                                            VCB cập nhật: {ratesUpdatedAt}
                                        </p>
                                    )}
                                    {/* Switch chốt tỷ giá */}
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 mt-2 transition-all duration-200">
                                        <div className="flex items-center gap-2">
                                            <Lock size={12} className={isCustomRate ? "text-amber-500" : "text-slate-400"} />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Chốt tỷ giá tự nhập</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newValue = !isCustomRate;
                                                setIsCustomRate(newValue);
                                                setRateEdited(newValue);
                                                if (!newValue) {
                                                    // Reset và load rates từ VCB
                                                    loadRates();
                                                }
                                            }}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                isCustomRate ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                    isCustomRate ? 'translate-x-4' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* Result preview */}
                                <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-900/30 dark:to-emerald-900/30 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                            {!isNaN(foreignResult) && foreignResult > 0
                                                ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(foreignResult)} ${selectedCurrency}`
                                                : `0 ${selectedCurrency}`
                                            } × {customRate || '0'}
                                        </div>
                                        <ArrowRight size={12} className="text-slate-400" />
                                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                            {formatVND(computedVND)} ₫
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 rounded-b-xl">
                        <div>
                            {mode === 'foreign' && foreignCurrency && (
                                <button
                                    onClick={handleClearForeign}
                                    className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                                >
                                    Xóa ngoại tệ
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 uppercase tracking-wider"
                            >
                                Đóng
                            </button>
                            <button
                                onClick={mode === 'vnd' ? handleVNDApply : handleForeignApply}
                                disabled={mode === 'vnd' ? (!vndExpr || isNaN(vndResult)) : (!foreignExpr || !customRate)}
                                className="px-5 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
                            >
                                Áp dụng
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default React.memo(CurrencyCalculator);
