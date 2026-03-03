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
                                        const detectedVat = data.financials?.vatRate ?? 10;
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
                                            if (item.supplier?.trim()) {
                                                try {
                                                    const supplier = await CustomerService.findOrCreateSupplier(item.supplier);
                                                    supplierName = supplier.shortName || supplier.name;
                                                    const allSuppliers = await CustomerService.getAll({ type: 'Supplier' });
                                                    setSuppliers(allSuppliers.data);
                                                } catch (e) {
                                                    console.warn('[PAKD Import] Could not create supplier:', e);
                                                }
                                            }

                                            const directCostsTotal = item.importFee + item.contractorTax + item.transferFee;
                                            processedItems.push({
                                                id: `imported-${Date.now()}-${i}`,
                                                name: productName,
                                                supplier: supplierName,
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

                                        setLineItems(processedItems);

                                        try {
                                            const finalSuppliers = await CustomerService.getAll({ type: 'Supplier' });
                                            setSuppliers(finalSuppliers.data);
                                        } catch (e) {
                                            console.warn('[PAKD Import] Could not refresh suppliers:', e);
                                        }



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
                    <div className="overflow-visible rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-tighter w-[320px]">Sản phẩm/Dịch vụ</th>
                                    <th className="px-2 py-4 font-black text-slate-400 uppercase tracking-tighter w-10">SL</th>
                                    <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-tighter w-[180px]">Nhà cung cấp</th>
                                    <th className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter text-right w-[120px] whitespace-nowrap">Giá Đầu vào</th>
                                    <th className="px-3 py-4 font-black text-cyan-500 uppercase tracking-tighter text-right w-[120px] whitespace-nowrap">TT Đầu vào</th>
                                    <th className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter text-right w-[120px] whitespace-nowrap">Giá Đầu ra</th>
                                    <th className="px-2 py-4 font-black text-emerald-500 uppercase tracking-tighter text-center w-14 whitespace-nowrap">VAT</th>
                                    <th className="px-3 py-4 font-black text-indigo-400 uppercase tracking-tighter text-right w-[120px] whitespace-nowrap">TT Đầu ra</th>
                                    <th className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter text-right w-[110px] whitespace-nowrap">CP Trực tiếp</th>
                                    <th className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter text-right w-[110px] whitespace-nowrap">Chênh lệch</th>
                                    <th className="px-4 py-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                {lineItems.map((item, index) => {
                                    const inputTotal = item.quantity * item.inputPrice;
                                    const outputTotal = item.quantity * item.outputPrice * (1 + (item.vatRate ?? 0) / 100);
                                    const lineMargin = outputTotal - inputTotal - item.directCosts;
                                    const lineMarginRate = outputTotal > 0 ? (lineMargin / outputTotal) * 100 : 0;

                                    return (
                                        <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                            <td className="px-4 py-3">
                                                <SearchableSelect
                                                    value={products.find(p => p.name === item.name)?.id || null}
                                                    placeholder="Gõ để tìm SP..."
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
                                                    addNewLabel="+ Thêm sản phẩm mới"
                                                />
                                            </td>
                                            <td className="px-2 py-3">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const newList = [...lineItems];
                                                        newList[index].quantity = Number(e.target.value);
                                                        setLineItems(newList);
                                                    }}
                                                    className="w-full bg-transparent font-black outline-none text-slate-800 dark:text-slate-200 dark:bg-slate-800"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <SearchableSelect
                                                    value={suppliers.find(s => (s.shortName || s.name) === item.supplier)?.id || null}
                                                    placeholder="Gõ để tìm NCC..."
                                                    getDisplayValue={(id) => {
                                                        const sup = suppliers.find(s => s.id === id);
                                                        return sup ? (sup.shortName || sup.name) : item.supplier || undefined;
                                                    }}
                                                    onChange={(sId, option) => {
                                                        const newList = [...lineItems];
                                                        if (sId && option) {
                                                            newList[index].supplier = option.name;
                                                        } else {
                                                            newList[index].supplier = '';
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
                                                    addNewLabel="+ Thêm NCC mới"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="relative group/currency">
                                                    <input
                                                        type="text"
                                                        value={item.inputPrice ? formatVND(item.inputPrice) : '0'}
                                                        onChange={(e) => {
                                                            const raw = e.target.value.replace(/\./g, '');
                                                            if (!/^\d*$/.test(raw)) return;
                                                            const newList = [...lineItems];
                                                            newList[index].inputPrice = Number(raw);
                                                            setLineItems(newList);
                                                        }}
                                                        className="w-full bg-transparent font-bold text-slate-500 text-right outline-none"
                                                    />
                                                    {item.foreignCurrency && (
                                                        <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 opacity-0 group-hover/currency:opacity-100 transition-opacity pointer-events-none">
                                                            <div className="space-y-1.5">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-medium">💱 Đơn giá ngoại tệ</span>
                                                                    <span className="font-bold text-cyan-400">
                                                                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(item.foreignCurrency.amount)} {item.foreignCurrency.currency}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center border-t border-slate-700 pt-1.5">
                                                                    <span className="font-medium">📊 Tỷ giá</span>
                                                                    <span className="font-bold text-amber-400">
                                                                        {new Intl.NumberFormat('vi-VN').format(item.foreignCurrency.rate)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="font-bold text-cyan-600 dark:text-cyan-400">{formatVND(inputTotal)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input
                                                    type="text"
                                                    value={item.outputPrice ? formatVND(item.outputPrice) : '0'}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/\./g, '');
                                                        if (!/^\d*$/.test(raw)) return;
                                                        const newList = [...lineItems];
                                                        newList[index].outputPrice = Number(raw);
                                                        setLineItems(newList);
                                                    }}
                                                    className="w-full bg-transparent font-bold text-indigo-600 text-right outline-none"
                                                />
                                            </td>
                                            <td className="px-2 py-3 text-center">
                                                <select
                                                    value={item.vatRate ?? 0}
                                                    onChange={(e) => {
                                                        const newList = [...lineItems];
                                                        newList[index].vatRate = Number(e.target.value);
                                                        setLineItems(newList);
                                                    }}
                                                    className="w-full bg-transparent text-center font-bold text-emerald-600 dark:text-emerald-400 text-[11px] outline-none cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-600 rounded px-0.5 py-0.5"
                                                >
                                                    <option value={0}>0%</option>
                                                    <option value={8}>8%</option>
                                                    <option value={10}>10%</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatVND(outputTotal)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="relative group/costs">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        onClick={() => openCostModal(index)}
                                                        value={item.directCosts ? formatVND(item.directCosts) : '0'}
                                                        className="w-full bg-transparent font-bold text-rose-500 text-right outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1"
                                                    />
                                                    {item.directCostDetails && item.directCostDetails.length > 0 && (
                                                        <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 opacity-0 group-hover/costs:opacity-100 transition-opacity pointer-events-none">
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
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-black ${lineMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatVND(lineMargin)}</span>
                                                    <span className="text-[9px] font-bold text-slate-400">{lineMarginRate.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {lineItems.length > 1 && (
                                                    <button onClick={() => removeLineItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* TOTALS FOOTER */}
                            <tfoot className="bg-slate-100 dark:bg-slate-800 font-black text-slate-700 dark:text-slate-200 border-t-2 border-slate-200 dark:border-slate-800">
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
                                    <td className="px-4 py-4"></td>
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
