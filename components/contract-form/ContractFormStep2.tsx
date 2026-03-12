// ContractForm Step 2: Phương án kinh doanh (Line Items + Execution Costs)
import React from 'react';
import {
    Plus, Trash2, X, Briefcase, Package, Calculator, ShieldCheck
} from 'lucide-react';
import {
    LineItem, Product, Customer, ExecutionCostItem
} from '../../types';
import { ProductService, CustomerService, ExecutionCostService } from '../../services';
import { ExecutionCostType } from '../../services/ExecutionCostService';
import SearchableSelect from '../ui/SearchableSelect';
import CurrencyCalculator from '../ui/CurrencyCalculator';
import { PAKDImportButton } from './PAKDImportButton';
import { FinancialTotals } from '../../hooks/useFinancialCalculations';



interface ContractFormStep2Props {
    // Data options
    products: Product[];
    setProducts: (v: Product[]) => void;
    suppliers: Customer[];
    setSuppliers: (v: Customer[]) => void;
    executionCostTypes: ExecutionCostType[];
    setExecutionCostTypes: (v: ExecutionCostType[]) => void;

    // Line Items
    lineItems: LineItem[];
    setLineItems: (items: LineItem[]) => void;
    addLineItem: () => void;
    removeLineItem: (id: string) => void;
    openCostModal: (index: number) => void;

    // Execution Costs
    executionCosts: ExecutionCostItem[];
    setExecutionCosts: React.Dispatch<React.SetStateAction<ExecutionCostItem[]>>;
    addExecutionCost: () => void;
    removeExecutionCost: (id: string) => void;
    updateExecutionCost: (id: string, field: keyof ExecutionCostItem, value: any) => void;



    // Financial totals
    totals: FinancialTotals;

    // Helpers
    formatVND: (val: number) => string;

    // Quick-add dialog triggers
    setAddProductForIndex: (v: number | null) => void;
    setShowAddProductDialog: (v: boolean) => void;
    setAddSupplierForIndex: (v: number | null) => void;
    setShowAddSupplierDialog: (v: boolean) => void;
}

const ContractFormStep2: React.FC<ContractFormStep2Props> = ({
    products, setProducts,
    suppliers, setSuppliers,
    executionCostTypes, setExecutionCostTypes,
    lineItems, setLineItems, addLineItem, removeLineItem, openCostModal,
    executionCosts, setExecutionCosts, addExecutionCost, removeExecutionCost, updateExecutionCost,

    totals,
    formatVND,
    setAddProductForIndex, setShowAddProductDialog,
    setAddSupplierForIndex, setShowAddSupplierDialog,
}) => {
    return (
        <section className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase size={16} /> Phương án kinh doanh
                </h3>
            </div>

            <div className="pl-4 border-l border-slate-200 dark:border-slate-800 space-y-8">
                {/* 3.1 CHI TIẾT SẢN PHẨM & DỊCH VỤ */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Package size={14} /> Chi tiết Sản phẩm & Dịch vụ
                        </h4>
                        <div className="flex items-center gap-2">
                            <PAKDImportButton
                                onImport={async (data) => {
                                    const { toast } = await import('sonner');
                                    toast.loading('Đang xử lý import PAKD...');
                                    try {
                                        const detectedVat = data.financials?.vatRate ?? 0;
                                        const processedItems: LineItem[] = [];

                                        for (let i = 0; i < data.lineItems.length; i++) {
                                            const item = data.lineItems[i];
                                            let productName = item.name;
                                            if (item.name?.trim()) {
                                                try {
                                                    const product = await ProductService.findOrCreate(item.name, item.unitCost, item.unitPrice);
                                                    productName = product.name;
                                                    const allProducts = await ProductService.getAll();
                                                    setProducts(allProducts);
                                                } catch (e) {
                                                    console.warn('[PAKD Import] Could not create product:', e);
                                                }
                                            }

                                            let supplierName = item.supplier || '';
                                            let supplierId: string | undefined;
                                            if (item.supplier?.trim()) {
                                                try {
                                                    const supplier = await CustomerService.findOrCreateSupplier(item.supplier);
                                                    supplierName = supplier.name;
                                                    supplierId = supplier.id;
                                                } catch (e) {
                                                    console.warn('[PAKD Import] Could not create supplier:', e);
                                                }
                                            }

                                            const directCostsTotal = item.importFee + item.contractorTax + item.transferFee;
                                            processedItems.push({
                                                id: `imported-${Date.now()}-${i}`,
                                                name: productName,
                                                supplier: supplierName,
                                                supplierId: supplierId,
                                                quantity: item.quantity,
                                                inputPrice: item.unitCost,
                                                outputPrice: item.unitPrice,
                                                directCosts: directCostsTotal,
                                                directCostDetails: [
                                                    { id: `dc-import-${i}`, name: 'Nhập khẩu', amount: item.importFee },
                                                    { id: `dc-tax-${i}`, name: 'Thuế nhà thầu', amount: item.contractorTax },
                                                    { id: `dc-transfer-${i}`, name: 'Chuyển tiền', amount: item.transferFee },
                                                ],
                                                foreignCurrency: item.foreignCurrency ? {
                                                    amount: item.foreignCurrency.amount,
                                                    rate: item.foreignCurrency.rate,
                                                    currency: item.foreignCurrency.currency,
                                                } : undefined,
                                                vatRate: item.vatRate !== undefined ? item.vatRate : detectedVat,
                                            });
                                        }

                                        // Refresh suppliers BEFORE setting lineItems
                                        // so SearchableSelect can match supplier names on first render
                                        try {
                                            const finalSuppliers = await CustomerService.getAll({ pageSize: 200 });
                                            setSuppliers(finalSuppliers.data?.filter(c => c.type === 'Supplier' || c.type === 'Both') || []);
                                        } catch (e) {
                                            console.warn('[PAKD Import] Could not refresh suppliers:', e);
                                        }

                                        setLineItems(processedItems);



                                        if (data.executionCosts && data.executionCosts.length > 0) {
                                            const importedExecutionCosts = data.executionCosts.map((cost: any, idx: number) => ({
                                                id: `pakd-exec-${Date.now()}-${idx}`,
                                                name: cost.name,
                                                amount: cost.amount,
                                                percentage: 0,
                                            }));
                                            setExecutionCosts(importedExecutionCosts);
                                            const costNames = importedExecutionCosts.map((c: any) => c.name);
                                            ExecutionCostService.bulkAdd(costNames).then(() => {
                                                ExecutionCostService.getAll().then(setExecutionCostTypes);
                                            });
                                        }

                                        toast.dismiss();
                                        toast.success('Đã import ' + processedItems.length + ' hạng mục + ' + (data.executionCosts?.length || 0) + ' chi phí thực hiện!');
                                    } catch (error: any) {
                                        const { toast } = await import('sonner');
                                        toast.dismiss();
                                        toast.error('Lỗi import PAKD: ' + (error.message || 'Unknown error'));
                                        console.error('[PAKD Import] Error:', error);
                                    }
                                }}
                            />
                            <button onClick={addLineItem} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 transition-colors">
                                <Plus size={12} /> Thêm hạng mục
                            </button>
                        </div>
                    </div>

                    {/* LINE ITEMS TABLE */}
                        <div className="overflow-visible rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <table className="w-full text-left text-xs" style={{ minWidth: '1100px' }}>
                            <thead className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-2 py-3 font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter text-[10px] w-[160px]">Nhà cung cấp</th>
                                    <th className="px-2 py-3 font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter text-[10px] w-[160px]">Hãng SX</th>
                                    <th className="px-2 py-3 font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter text-[10px] w-12">SL</th>
                                    <th className="px-2 py-3 font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter text-[10px] text-right whitespace-nowrap">Giá Đầu vào</th>
                                    <th className="px-2 py-3 font-black text-cyan-500 uppercase tracking-tighter text-[10px] text-right whitespace-nowrap">TT Đầu vào</th>
                                    <th className="px-2 py-3 font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter text-[10px] text-right whitespace-nowrap">Giá Đầu ra</th>
                                    <th className="px-2 py-3 font-black text-emerald-500 uppercase tracking-tighter text-[10px] text-center w-16 whitespace-nowrap">VAT</th>
                                    <th className="px-2 py-3 font-black text-indigo-400 uppercase tracking-tighter text-[10px] text-right whitespace-nowrap">TT Đầu ra</th>
                                    <th className="px-2 py-3 font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter text-[10px] text-right whitespace-nowrap">CP Trực tiếp</th>
                                    <th className="px-2 py-3 font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter text-[10px] text-right whitespace-nowrap">Chênh lệch</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item, index) => {
                                    const inputTotal = item.quantity * item.inputPrice;
                                    const outputTotal = item.quantity * item.outputPrice * (1 + (item.vatRate ?? 0) / 100);
                                    const lineMargin = outputTotal - inputTotal - item.directCosts;
                                    const lineMarginRate = outputTotal > 0 ? (lineMargin / outputTotal) * 100 : 0;
                                    const rowBg = index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/80 dark:bg-slate-800/80';

                                    return (
                                        <React.Fragment key={item.id}>
                                            {/* ── Row 1: Tên SP/DV ── */}
                                            <tr className={`${rowBg} border-t border-slate-200 dark:border-slate-700`}>
                                                <td colSpan={10} className="px-3 pt-2 pb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex-shrink-0 w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[9px] font-black">
                                                            {index + 1}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <SearchableSelect
                                                                value={products.find(p => p.name === item.name)?.id || null}
                                                                placeholder="Gõ để tìm sản phẩm/dịch vụ..."
                                                                getDisplayValue={(id) => {
                                                                    const prod = products.find(p => p.id === id);
                                                                    return prod?.name || item.name || undefined;
                                                                }}
                                                                onChange={(pId) => {
                                                                    const prod = pId ? products.find(p => p.id === pId) : null;
                                                                    const newList = [...lineItems];
                                                                    if (prod) {
                                                                        newList[index].name = prod.name;
                                                                        newList[index].inputPrice = prod.costPrice || 0;
                                                                        newList[index].outputPrice = prod.basePrice;
                                                                    } else {
                                                                        newList[index].name = '';
                                                                    }
                                                                    setLineItems(newList);
                                                                }}
                                                                onSearch={async (query) => {
                                                                    const results = await ProductService.search(query, 20);
                                                                    return results.map(p => ({ id: p.id, name: p.name, subText: p.category }));
                                                                }}
                                                                onAddNew={() => {
                                                                    setAddProductForIndex(index);
                                                                    setShowAddProductDialog(true);
                                                                }}
                                                                addNewLabel="Thêm sản phẩm mới"
                                                                dropdownMinWidth={400}
                                                            />
                                                        </div>
                                                        {lineItems.length > 1 && (
                                                            <button onClick={() => removeLineItem(item.id)} className="flex-shrink-0 text-slate-300 hover:text-rose-500 transition-colors p-1">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* ── Row 2: NCC, Hãng SX, SL, Giá, VAT, CP, Chênh lệch ── */}
                                            <tr className={`${rowBg} group transition-colors hover:bg-indigo-50/60 dark:hover:bg-slate-700/60 border-b border-slate-100 dark:border-slate-700/50`}>
                                                <td className="px-2 pb-2 pt-1">
                                                    <SearchableSelect
                                                        value={item.supplierId || suppliers.find(s => s.name === item.supplier || s.shortName === item.supplier)?.id || null}
                                                        placeholder="NCC..."
                                                        getDisplayValue={(id) => {
                                                            const sup = suppliers.find(s => s.id === id);
                                                            return sup ? (sup.shortName || sup.name) : item.supplier || undefined;
                                                        }}
                                                        onChange={(sId, option) => {
                                                            const newList = [...lineItems];
                                                            if (sId && option) {
                                                                newList[index].supplier = option.name;
                                                                newList[index].supplierId = sId;
                                                                if (!suppliers.find(s => s.id === sId)) {
                                                                    setSuppliers([...suppliers, { id: sId, name: option.name, shortName: option.name, type: 'Supplier', industry: [], contactPerson: '', phone: '', email: '', address: '', rating: 'Standard' } as Customer]);
                                                                }
                                                            } else {
                                                                newList[index].supplier = '';
                                                                newList[index].supplierId = undefined;
                                                            }
                                                            setLineItems(newList);
                                                        }}
                                                        onSearch={async (query) => {
                                                            const results = await CustomerService.search(query, 20);
                                                            return results
                                                                .filter(c => c.type === 'Supplier' || c.type === 'Both')
                                                                .map(c => ({ id: c.id, name: c.shortName || c.name, subText: c.industry?.join(', ') || undefined }));
                                                        }}
                                                        onAddNew={() => {
                                                            setAddSupplierForIndex(index);
                                                            setShowAddSupplierDialog(true);
                                                        }}
                                                        addNewLabel="Thêm NCC mới"
                                                    />
                                                </td>
                                                <td className="px-2 pb-2 pt-1">
                                                    <SearchableSelect
                                                        value={item.manufacturerId || suppliers.find(s => s.name === item.manufacturer || s.shortName === item.manufacturer)?.id || null}
                                                        placeholder="Hãng SX..."
                                                        getDisplayValue={(id) => {
                                                            const mfr = suppliers.find(s => s.id === id);
                                                            return mfr ? (mfr.shortName || mfr.name) : item.manufacturer || undefined;
                                                        }}
                                                        onChange={(mId, option) => {
                                                            const newList = [...lineItems];
                                                            if (mId && option) {
                                                                newList[index].manufacturer = option.name;
                                                                newList[index].manufacturerId = mId;
                                                            } else {
                                                                newList[index].manufacturer = '';
                                                                newList[index].manufacturerId = undefined;
                                                            }
                                                            setLineItems(newList);
                                                        }}
                                                        onSearch={async (query) => {
                                                            const results = await CustomerService.search(query, 20);
                                                            return results
                                                                .filter(c => c.type === 'Supplier' || c.type === 'Both')
                                                                .map(c => ({ id: c.id, name: c.shortName || c.name, subText: c.industry?.join(', ') || undefined }));
                                                        }}
                                                        onAddNew={() => {
                                                            setAddSupplierForIndex(index);
                                                            setShowAddSupplierDialog(true);
                                                        }}
                                                        addNewLabel="Thêm hãng SX mới"
                                                    />
                                                </td>
                                                <td className="px-2 pb-2 pt-1">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const newList = [...lineItems];
                                                            newList[index].quantity = Number(e.target.value);
                                                            setLineItems(newList);
                                                        }}
                                                        className="w-full min-w-[48px] px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-black outline-none text-slate-800 dark:text-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 transition-colors"
                                                    />
                                                </td>
                                                <td className="px-2 pb-2 pt-1">
                                                    <CurrencyCalculator
                                                        value={item.inputPrice}
                                                        onChange={(vnd) => {
                                                            const newList = [...lineItems];
                                                            newList[index].inputPrice = vnd;
                                                            setLineItems(newList);
                                                        }}
                                                        onForeignCurrencyChange={(info) => {
                                                            const newList = [...lineItems];
                                                            newList[index].foreignCurrency = info;
                                                            setLineItems(newList);
                                                        }}
                                                        foreignCurrency={item.foreignCurrency}
                                                        formula={item.inputPriceFormula}
                                                        onFormulaChange={(f) => {
                                                            const newList = [...lineItems];
                                                            newList[index].inputPriceFormula = f;
                                                            setLineItems(newList);
                                                        }}
                                                        formatVND={formatVND}
                                                        textColorClass="text-slate-600 dark:text-slate-300"
                                                    />
                                                </td>
                                                <td className="px-2 pb-2 pt-1 text-right">
                                                    <span className="font-bold text-cyan-600 dark:text-cyan-400">{formatVND(inputTotal)}</span>
                                                </td>
                                                <td className="px-2 pb-2 pt-1">
                                                    <CurrencyCalculator
                                                        value={item.outputPrice}
                                                        onChange={(vnd) => {
                                                            const newList = [...lineItems];
                                                            newList[index].outputPrice = vnd;
                                                            setLineItems(newList);
                                                        }}
                                                        formula={item.outputPriceFormula}
                                                        onFormulaChange={(f) => {
                                                            const newList = [...lineItems];
                                                            newList[index].outputPriceFormula = f;
                                                            setLineItems(newList);
                                                        }}
                                                        formatVND={formatVND}
                                                        textColorClass="text-indigo-600 dark:text-indigo-400"
                                                    />
                                                </td>
                                                <td className="px-2 pb-2 pt-1 text-center">
                                                    <select
                                                        value={item.vatRate ?? 0}
                                                        onChange={(e) => {
                                                            const newList = [...lineItems];
                                                            newList[index].vatRate = Number(e.target.value);
                                                            setLineItems(newList);
                                                        }}
                                                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-center font-bold text-emerald-600 dark:text-emerald-400 text-[11px] outline-none cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/30 transition-colors appearance-none"
                                                    >
                                                        <option value={0}>0%</option>
                                                        <option value={8}>8%</option>
                                                        <option value={10}>10%</option>
                                                    </select>
                                                </td>
                                                <td className="px-2 pb-2 pt-1 text-right">
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatVND(outputTotal)}</span>
                                                </td>
                                                <td className="px-2 pb-2 pt-1 text-right">
                                                    <div className="relative group/costs">
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            onClick={() => openCostModal(index)}
                                                            value={item.directCosts ? formatVND(item.directCosts) : '0'}
                                                            className="w-full bg-transparent font-bold text-rose-500 text-right outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1"
                                                        />
                                                        {item.directCostDetails && item.directCostDetails.length > 0 && (
                                                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 opacity-0 group-hover/costs:opacity-100 transition-opacity pointer-events-none">
                                                                <div className="space-y-1">
                                                                    {item.directCostDetails.map((detail, i) => (
                                                                        <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-1 last:border-0 last:pb-0">
                                                                            <span className="font-medium">{detail.name}</span>
                                                                            <span className="font-bold">{formatVND(detail.amount)}</span>
                                                                        </div>
                                                                    ))}
                                                                    <div className="pt-2 mt-1 border-t border-slate-700 flex justify-between">
                                                                        <span className="font-bold uppercase opacity-70">Tổng</span>
                                                                        <span className="font-black text-emerald-400">{formatVND(item.directCosts)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 pb-2 pt-1 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-black ${lineMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatVND(lineMargin)}</span>
                                                        <span className="text-[9px] font-bold text-slate-400">{lineMarginRate.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            {/* TOTALS FOOTER */}
                            <tfoot className="bg-slate-100 dark:bg-slate-800 font-black text-slate-700 dark:text-slate-200 border-t-2 border-slate-300 dark:border-slate-600">
                                <tr>
                                    <td colSpan={3} className="px-4 py-4 text-left uppercase text-xs tracking-widest text-slate-500">
                                        Tổng cộng
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                                        {formatVND(totals.totalInput)}
                                    </td>
                                    <td className="px-3 py-4 text-right text-cyan-600 font-black">
                                        {formatVND(lineItems.reduce((acc, item) => acc + (item.quantity * item.inputPrice), 0))}
                                    </td>
                                    <td className="px-4 py-4 text-right text-indigo-600">
                                        {formatVND(totals.signingValue)}
                                    </td>
                                    <td className="px-2 py-4"></td>
                                    <td className="px-3 py-4 text-right text-indigo-600 font-black">
                                        {formatVND(lineItems.reduce((acc, item) => acc + (item.quantity * item.outputPrice * (1 + (item.vatRate ?? 0) / 100)), 0))}
                                    </td>
                                    <td className="px-4 py-4 text-right text-rose-500">
                                        {formatVND(totals.totalDirectCosts)}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className={totals.signingValue - totals.totalInput - totals.totalDirectCosts >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                            {formatVND(totals.signingValue - totals.totalInput - totals.totalDirectCosts)}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* 3.2 CHI PHÍ THỰC HIỆN */}
                <div className="flex flex-wrap items-start gap-6 mt-10">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2 flex-1 min-w-[320px] max-w-xl">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Calculator size={14} /> Chi phí thực hiện hợp đồng
                            </h4>
                            <button
                                onClick={addExecutionCost}
                                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                            >
                                <Plus size={12} /> Thêm hạng mục
                            </button>
                        </div>

                        {executionCosts.length === 0 ? (
                            <div className="text-center py-3 text-slate-400 dark:text-slate-500 text-xs">
                                <p>Chưa có chi phí thực hiện. Nhấn "Thêm hạng mục" để bắt đầu.</p>
                            </div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-400 text-[10px] uppercase">
                                        <th className="text-left py-1 px-1 w-6">#</th>
                                        <th className="text-left py-1 px-1">Hạng mục</th>
                                        <th className="text-right py-1 px-1 w-24">%</th>
                                        <th className="text-right py-1 px-1 w-28">Số tiền</th>
                                        <th className="w-6"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {executionCosts.map((cost, idx) => (
                                        <tr key={cost.id} className="group border-b border-slate-100 dark:border-slate-800 last:border-0">
                                            <td className="py-1 px-1 text-slate-400 font-medium">{idx + 1}</td>
                                            <td className="py-2 px-2">
                                                <input
                                                    type="text"
                                                    list="execution-cost-names"
                                                    placeholder="Tên chi phí..."
                                                    value={cost.name}
                                                    onChange={(e) => updateExecutionCost(cost.id, 'name', e.target.value)}
                                                    onBlur={(e) => {
                                                        const name = e.target.value;
                                                        if (name?.trim()) {
                                                            ExecutionCostService.findOrCreate(name).then(() => {
                                                                ExecutionCostService.getAll().then(setExecutionCostTypes);
                                                            });
                                                        }
                                                    }}
                                                    className="w-full px-2 py-1 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 text-xs font-medium outline-none transition-colors"
                                                />
                                            </td>
                                            <td className="py-2 px-2">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0"
                                                        value={cost.percentage || ''}
                                                        onChange={(e) => {
                                                            const pct = Number(e.target.value);
                                                            const amount = Math.round((pct / 100) * totals.totalInput);
                                                            setExecutionCosts(prev => prev.map(c => c.id === cost.id ? { ...c, percentage: pct, amount } : c));
                                                        }}
                                                        className="w-full px-1 py-1 bg-transparent border-0 text-xs font-bold text-right outline-none"
                                                    />
                                                    <span className="text-[10px] text-slate-400 font-bold flex-shrink-0">%</span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2">
                                                <input
                                                    type="text"
                                                    value={cost.amount ? formatVND(cost.amount) : '0'}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/\./g, '');
                                                        if (!/^\d*$/.test(raw)) return;
                                                        const val = Number(raw);
                                                        const pct = totals.totalInput > 0 ? Number(((val / totals.totalInput) * 100).toFixed(2)) : 0;
                                                        setExecutionCosts(prev => prev.map(c => c.id === cost.id ? { ...c, amount: val, percentage: pct } : c));
                                                    }}
                                                    className="w-full px-2 py-1 bg-transparent border-0 text-xs font-black text-right outline-none"
                                                />
                                            </td>
                                            <td className="py-2 px-1">
                                                <button
                                                    onClick={() => removeExecutionCost(cost.id)}
                                                    className="p-1 text-slate-300 hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Xóa"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-slate-200 dark:border-slate-600">
                                        <td colSpan={3} className="py-2 px-2 text-right text-[10px] font-bold text-slate-400 uppercase">Tổng chi phí thực hiện:</td>
                                        <td className="py-2 px-2 text-right text-sm font-black text-rose-600 dark:text-rose-400">
                                            {formatVND(executionCosts.reduce((sum, c) => sum + (c.amount || 0), 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default React.memo(ContractFormStep2);
